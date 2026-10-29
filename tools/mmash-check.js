#!/usr/bin/env node
/*
 * HELIOS — checks against real wearable data (PhysioNet MMASH v1.0.0, ODbL).
 * Runs HELIOS's own code on 22 healthy people's 24-hour recordings:
 *   1. Live-sensor pipeline: real RR intervals encoded as Bluetooth Heart Rate packets, decoded by
 *      HELIOS, and HRV (RMSSD) compared with a reference Task Force–style computation.
 *   2. Wearable importer: each participant's real sleep.csv through the CSV auto-mapper.
 *   3. Baselines: how far real resting HR / HRV spread between people vs HELIOS's defaults.
 * Data: node tools/fetch-mmash.js (downloads + verifies; never committed).
 * Usage: node tools/mmash-check.js            → prints results, writes data/mmash-results.json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { load, fakeApp } = require('../test/_helpers');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'data', 'mmash', 'extracted', 'DataPaper');
if (!fs.existsSync(DIR)) { console.error('MMASH not found — run: node tools/fetch-mmash.js'); process.exit(1); }

const H = load('js/data.js', 'js/engine.js', 'js/sanitize.js', 'js/features/live.js', 'js/features/wearables.js');
const app = fakeApp(H);
H.features.forEach((f) => f(app));

const csv = (file) => {
  const [head, ...rows] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const h = head.split(',');
  return rows.map((r) => Object.fromEntries(r.split(',').map((v, i) => [h[i], v])));
};
const secs = (day, t) => (+day - 1) * 86400 + t.split(':').reduce((s, x, i) => s + +x * [3600, 60, 1][i], 0);
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : null; };
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };

// Reference RMSSD (independent of HELIOS): reject beats outside 300–2000 ms or > 20 % from the
// median of their 5 neighbours, then use successive differences of *adjacent* valid beats only.
function refRmssd(rr) {
  const ok = rr.map((x, i) => {
    if (x < 300 || x > 2000) return false;
    const nb = rr.slice(Math.max(0, i - 2), i + 3).filter((_, j) => j !== Math.min(2, i));
    return Math.abs(x - median(nb)) / median(nb) <= 0.2;
  });
  let s = 0, n = 0;
  for (let i = 1; i < rr.length; i++) if (ok[i] && ok[i - 1]) { s += (rr[i] - rr[i - 1]) ** 2; n++; }
  return n >= 10 ? Math.sqrt(s / n) : null;
}

// Encode RR like a Bluetooth heart-rate strap: one notification per beat, flags 0x10 (RR present).
function packet(rrMs) {
  const hr = Math.max(0, Math.min(255, Math.round(60000 / rrMs)));
  const raw = Math.round((rrMs / 1000) * 1024);
  return new DataView(new Uint8Array([0x10, hr, raw & 0xff, (raw >> 8) & 0xff]).buffer);
}

const users = fs.readdirSync(DIR).filter((d) => /^user_\d+$/.test(d)).sort((a, b) => +a.split('_')[1] - +b.split('_')[1]);
const rows = [];
const importer = [];
for (const u of users) {
  const p = (f) => path.join(DIR, u, f);
  if (!fs.existsSync(p('RR.csv')) || !fs.existsSync(p('sleep.csv'))) { rows.push({ user: u, note: 'missing files' }); continue; }
  // Dataset quirk: a few rows carry corrupted day numbers (e.g. -29); keep days 1–2 only.
  const rr = csv(p('RR.csv')).filter((r) => r.day === '1' || r.day === '2').map((r) => ({ t: secs(r.day, r.time), ms: +r.ibi_s * 1000 })).filter((r) => Number.isFinite(r.ms));
  const sleep = csv(p('sleep.csv'));
  if (!sleep.length) {
    rows.push({ user: u, note: 'no sleep record' });
    let msg = '';
    try { H.wearables.prepareCsv('sleep.csv', fs.readFileSync(p('sleep.csv'), 'utf8')); } catch (e) { msg = e.message; }
    importer.push({ user: u, rejectedWith: msg || '(accepted an empty file)' });
    continue;
  }
  // Sleep window: earliest onset to latest out-of-bed (nights can be split into several rows).
  const on = Math.min(...sleep.map((s) => secs(s['Onset Date'], s['Onset Time'])));
  let off = Math.max(...sleep.map((s) => secs(s['Out Bed Date'], s['Out Bed Time'])));
  if (off <= on) off += 86400;   // dataset quirk: nights crossing midnight labelled as ending on day 1
  const night = rr.filter((r) => r.t >= on && r.t <= off).map((r) => r.ms);

  // 1a. Live pipeline: packets → parse → 2-minute windows → HELIOS RMSSD.
  const decoded = night.map((ms) => H.live.parseHRM(packet(ms)).rr[0]);
  const quantErr = Math.max(...decoded.map((x, i) => Math.abs(x - night[i])));
  const win = [], ref5 = [];
  for (let i = 0; i + 120 <= decoded.length; i += 120) { const v = H.live.rmssd(decoded.slice(i, i + 120)); if (v != null) win.push(v); }
  for (let i = 0; i + 300 <= night.length; i += 300) { const v = refRmssd(night.slice(i, i + 300)); if (v != null) ref5.push(v); }
  // Artefacts: share of night beats outside physiological range or jumping > 20 %.
  const art = night.filter((x, i) => x < 300 || x > 2000 || (i && Math.abs(x - night[i - 1]) / night[i - 1] > 0.2)).length / night.length;
  // Resting HR: HELIOS saves the median of the live stream; compare with Actigraph HR in sleep.
  const act = fs.existsSync(p('Actigraph.csv')) ? csv(p('Actigraph.csv')).filter((r) => { const t = secs(r.day, r.time); return t >= on && t <= off && +r.HR > 0; }).map((r) => +r.HR) : [];
  const hrRR = median(night.filter((x) => x >= 300 && x <= 2000).map((x) => 60000 / x));
  const q = H.live.quality(night);
  rows.push({
    user: u, nightBeats: night.length, cleanPct: q != null ? +(q * 100).toFixed(1) : null, artefactPct: +(art * 100).toFixed(1), quantErrMs: +quantErr.toFixed(2),
    rmssdHelios: win.length ? +median(win).toFixed(1) : null, rmssdRef: ref5.length ? +median(ref5).toFixed(1) : null,
    hrStrap: hrRR != null ? +hrRR.toFixed(1) : null, hrActigraph: act.length ? +median(act).toFixed(1) : null,
  });

  // 2. Importer: the real sleep.csv through HELIOS's CSV auto-mapping.
  const text = fs.readFileSync(p('sleep.csv'), 'utf8');   // real file, unmodified
  const prep = H.wearables.prepareCsv('sleep.csv', text);
  const imported = H.wearables.importCsvMapped(prep);
  importer.push({
    user: u, dateCol: prep.dateCol >= 0 ? prep.head[prep.dateCol] : null, dayNumbers: prep.dayNumbers || false, importedDays: imported.days,
    importedSleepH: imported.days ? +Object.values(imported.byDate).reduce((s, v) => s + (v.sleep || 0), 0).toFixed(2) : null,
    sleepCol: prep.map.sleep ? `${prep.head[prep.map.sleep.col]} (${prep.map.sleep.unit})` : null,
    sleffCol: prep.map.sleff ? prep.head[prep.map.sleff.col] : null,
    tstMinutes: sleep.reduce((s, r) => s + +r['Total Sleep Time (TST)'], 0),
  });
}

const ok = rows.filter((r) => r.rmssdHelios != null && r.rmssdRef != null);
const diffs = ok.map((r) => r.rmssdHelios - r.rmssdRef);
const corr = (() => {
  const a = ok.map((r) => r.rmssdHelios), b = ok.map((r) => r.rmssdRef), ma = mean(a), mb = mean(b);
  const num = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0);
  return num / Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0) * b.reduce((s, x) => s + (x - mb) ** 2, 0));
})();
const hrs = rows.filter((r) => r.hrStrap != null).map((r) => r.hrStrap);
const hrvs = ok.map((r) => r.rmssdRef);
const rhrDef = H.INDICATORS.find((i) => i.id === 'rhr').base, hrvDef = H.INDICATORS.find((i) => i.id === 'hrv').base;
const outside = (vals, [m, s]) => vals.filter((v) => Math.abs(v - m) > 2 * s).length;
const hrAgree = rows.filter((r) => r.hrStrap != null && r.hrActigraph != null).map((r) => Math.abs(r.hrStrap - r.hrActigraph));

const summary = {
  dataset: 'PhysioNet MMASH v1.0.0 (ODbL 1.0) — 22 healthy adults, ~24 h each',
  participants: rows.length, analysed: ok.length,
  packetRoundTripMaxErrorMs: Math.max(...rows.map((r) => r.quantErrMs || 0)),
  rmssd: { correlation: +corr.toFixed(3), meanDiffMs: +mean(diffs).toFixed(2), meanAbsDiffMs: +mean(diffs.map(Math.abs)).toFixed(2), maxAbsDiffMs: +Math.max(...diffs.map(Math.abs)).toFixed(2) },
  artefacts: { medianPct: median(rows.map((r) => r.artefactPct).filter((x) => x != null)), maxPct: Math.max(...rows.map((r) => r.artefactPct || 0)) },
  restingHR: { mean: +mean(hrs).toFixed(1), betweenPersonSD: +sd(hrs).toFixed(1), range: [Math.min(...hrs), Math.max(...hrs)].map((x) => +x.toFixed(0)), outsideDefaultBand: `${outside(hrs, rhrDef)} of ${hrs.length}`, strapVsActigraphMedianAbsDiff: +median(hrAgree).toFixed(1) },
  hrv: { mean: +mean(hrvs).toFixed(1), betweenPersonSD: +sd(hrvs).toFixed(1), range: [Math.min(...hrvs), Math.max(...hrvs)].map((x) => +x.toFixed(0)), outsideDefaultBand: `${outside(hrvs, hrvDef)} of ${hrvs.length}` },
  hrvQualityGate: rows.filter((r) => r.cleanPct != null && r.cleanPct < 80).map((r) => `${r.user} (${r.cleanPct}% clean)`),
  importer: { importedCorrectly: importer.filter((x) => x.importedDays && Math.abs(x.importedSleepH - x.tstMinutes / 60) < 0.02).length, emptyFileRejectedCleanly: importer.filter((x) => x.rejectedWith === 'No data rows found.').length, dateColumnFound: importer.filter((x) => x.dateCol).length, sleepMapped: importer.filter((x) => x.sleepCol).length, efficiencyMapped: importer.filter((x) => x.sleffCol).length, dayNumbersDetected: importer.filter((x) => x.dayNumbers).length, of: importer.length },
};

if (require.main === module) {
  console.table(rows);
  console.table(importer.slice(0, 5));
  console.log(JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(ROOT, 'data', 'mmash-results.json'), JSON.stringify({ summary, participants: rows }, null, 2));
}
module.exports = { summary, rows, importer, refRmssd, packet };
