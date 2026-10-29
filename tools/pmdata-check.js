#!/usr/bin/env node
/*
 * HELIOS on real multi-week data: PMData (16 people, ~5 months, Fitbit + daily wellness; CC BY 4.0).
 * Each person's first 30 days become their "preflight" baseline (how a real user would start); the
 * rest is run day by day through HELIOS's own engine, v1 (legacy) and v3 (current), in real time.
 * These are healthy people living normal lives — colds, travel and training blocks are real — so an
 * alert is not automatically false. The comparison between detectors is what matters, plus whether
 * alerts cluster around self-reported injuries.
 *   node tools/fetch-pmdata.js && node tools/pmdata-check.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { load, fakeApp } = require('../test/_helpers');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'data', 'pmdata');
if (!fs.existsSync(DIR)) { console.error('PMData not found — run: node tools/fetch-pmdata.js'); process.exit(1); }

const H = load('js/data.js', 'js/engine.js', 'js/weekly.js', 'js/sanitize.js', 'js/features/wearables.js');
fakeApp(H); (H.features || []).forEach((f) => f(fakeApp(H)));
const BASELINE_DAYS = 30;
const IDS = ['rhr', 'sleep', 'sleff', 'exer', 'mood', 'stress', 'mass', 'fluid'];

const iso = (d) => d.toISOString().slice(0, 10);
const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []);
const readCsv = (f) => { if (!fs.existsSync(f)) return []; const t = H.wearables.parseCsv(fs.readFileSync(f, 'utf8')); return t.slice(1).map((c) => Object.fromEntries(t[0].map((k, i) => [k, c[i]]))); };
const pos = (x) => { const v = +x; return Number.isFinite(v) && v > 0 ? v : null; };   // PMSys/Fitbit use 0 for "missing"

function loadPerson(p) {
  const f = (...a) => path.join(DIR, p, ...a);
  const byDate = {};
  const put = (date, id, v) => { if (v == null || !H.plausible(id, v)) return; (byDate[date] = byDate[date] || {})[id] = v; };
  readJson(f('fitbit', 'resting_heart_rate.json')).forEach((r) => put(r.dateTime.slice(0, 10), 'rhr', pos(r.value && r.value.value)));
  // Sleep: main sleep per night (Fitbit marks it); otherwise the longest record that night.
  const nights = {};
  readJson(f('fitbit', 'sleep.json')).forEach((s) => { const n = nights[s.dateOfSleep]; if (s.mainSleep || !n || (!n.mainSleep && s.minutesAsleep > n.minutesAsleep)) nights[s.dateOfSleep] = s; });
  Object.entries(nights).forEach(([d, s]) => { put(d, 'sleep', pos(s.minutesAsleep) && s.minutesAsleep / 60); put(d, 'sleff', pos(s.efficiency)); });
  readJson(f('fitbit', 'very_active_minutes.json')).forEach((r) => put(r.dateTime.slice(0, 10), 'exer', +r.value >= 0 ? +r.value : null));
  // PMSys 1–5, higher = better (stress 5 = relaxed — checked: corr(stress, mood) = +0.45). HELIOS: mood ×2; stress (6 − x) ×2.
  readCsv(f('pmsys', 'wellness.csv')).forEach((r) => {
    const d = (r.effective_time_frame || '').slice(0, 10);
    const m = pos(r.mood), s = pos(r.stress);
    if (m) put(d, 'mood', m * 2);
    if (s) put(d, 'stress', (6 - s) * 2);
  });
  // Google Forms: dd/mm/yyyy; glasses of fluid ≈ 0.25 L each.
  readCsv(f('googledocs', 'reporting.csv')).forEach((r) => {
    const m = (r.date || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return;
    const d = `${m[3]}-${m[2]}-${m[1]}`;
    put(d, 'mass', pos(r.weight));
    if (pos(r.glasses_of_fluid)) put(d, 'fluid', +r.glasses_of_fluid * 0.25);
  });
  const injuries = readCsv(f('pmsys', 'injury.csv')).filter((r) => r.injuries && r.injuries.trim() !== '{}').map((r) => r.effective_time_frame.slice(0, 10));
  const dates = Object.keys(byDate).sort();
  return { p, byDate, injuries, first: dates[0], last: dates[dates.length - 1] };
}

function evaluate(person) {
  const start = new Date(person.first + 'T00:00:00Z');
  start.setUTCDate(start.getUTCDate() + BASELINE_DAYS);
  const startISO = iso(start);
  const profile = H.sanitize.profile({ name: person.p, start: startISO, plannedDays: 200 });
  const store = { personal: { records: person.byDate }, checkins: {}, pvt: {} };
  const dayOf = (date) => H.dayOf(date, startISO);
  const lastDay = dayOf(person.last);
  // Build the series once at the last day; the engine only looks at data up to the judged day.
  const realDay = H.personalDay;
  H.personalDay = () => lastDay;
  const cd = H.buildPersonal(profile, store);
  H.personalDay = realDay;
  const bases = H.personalBaselines(profile, cd);
  const out = { p: person.p, days: lastDay, perVersion: {} };
  for (const legacy of [true, false]) {
    const alarms = {};
    IDS.forEach((id) => {
      const ind = H.INDICATORS.find((i) => i.id === id), a = [];
      for (let d = 1; d <= lastDay; d++) a.push(cd.series[id].slice(0, d + 1).some((v) => v != null) ? H.assessIndicator(ind, cd.series[id], d, { bases, legacy }).status >= 1 : false);
      alarms[id] = a;
    });
    const indDays = IDS.reduce((s, id) => s + (cd.series[id].some((v) => v != null) ? lastDay : 0), 0);
    let episodes = 0, alarmDays = 0;
    const onsets = [];
    IDS.forEach((id) => alarms[id].forEach((on, i) => { if (on) alarmDays++; if (on && (i === 0 || !alarms[id][i - 1])) { episodes++; onsets.push(i + 1); } }));
    // Injury enrichment: alert onsets within 7 days before/after a reported injury vs elsewhere.
    const injDays = person.injuries.map(dayOf).filter((d) => d >= 1 && d <= lastDay);
    const near = new Set();
    injDays.forEach((d) => { for (let k = d - 7; k <= d + 7; k++) near.add(k); });
    const nearDays = [...near].filter((d) => d >= 1 && d <= lastDay).length;
    const onsetsNear = onsets.filter((d) => near.has(d)).length;
    const perInd = Object.fromEntries(IDS.filter((id) => cd.series[id].some((v) => v != null)).map((id) => [id, +((alarms[id].filter(Boolean).length / lastDay) * 100).toFixed(1)]));
    out.perVersion[legacy ? 'v1' : 'v3'] = {
      perIndicatorAlertPct: perInd,
      alertsPerMonth: +((episodes / lastDay) * 30).toFixed(2),
      alertTimePct: indDays ? +((alarmDays / indDays) * 100).toFixed(1) : 0,
      onsetsNearInjury: onsetsNear, nearDays, onsetsElsewhere: onsets.length - onsetsNear, elsewhereDays: lastDay - nearDays,
    };
  }
  // Weekly drifts and pattern findings at the end of the period (current engine).
  const a = H.assessCrew({ id: 'x', name: person.p, personal: true }, { crew: { x: cd }, env: H.buildDataset({ checkins: {}, pvt: {} }).env }, null, { day: lastDay, bases, ...H.SENSITIVITY.standard });
  out.drifts = IDS.filter((id) => a.inds[id].weekly && a.inds[id].weekly.status === 'drift').map((id) => `${id}${a.inds[id].weekly.onset ? '~W' + a.inds[id].weekly.onset : ''}`);
  out.patterns = a.insights.filter((i) => i.id.startsWith('pattern-')).map((i) => i.id);
  out.coverage = Object.fromEntries(IDS.map((id) => [id, cd.series[id].filter((v) => v != null).length]));
  out.baselines = Object.fromEntries(['rhr', 'sleep'].map((id) => [id, bases[id] && bases[id].mean != null ? `${bases[id].mean.toFixed(1)}±${bases[id].sd.toFixed(1)} (${bases[id].source})` : bases[id] && bases[id].source]));
  return out;
}

const people = fs.readdirSync(DIR).filter((d) => /^p\d\d$/.test(d)).sort().map(loadPerson);
const results = people.map(evaluate);
const sum = (v, k) => results.reduce((s, r) => s + r.perVersion[v][k], 0);
const mean = (v, k) => +(results.reduce((s, r) => s + r.perVersion[v][k], 0) / results.length).toFixed(2);
const enrich = (v) => {
  const near = sum(v, 'onsetsNearInjury') / Math.max(1, sum(v, 'nearDays')), else_ = sum(v, 'onsetsElsewhere') / Math.max(1, sum(v, 'elsewhereDays'));
  return { onsetRateNearInjury: +(near * 30).toFixed(2), onsetRateElsewhere: +(else_ * 30).toFixed(2), ratio: else_ ? +(near / else_).toFixed(2) : null };
};
const summary = {
  dataset: 'PMData (Simula, CC BY 4.0) — 16 people, ~5 months, Fitbit + PMSys wellness',
  people: results.length, baselineDays: BASELINE_DAYS, indicators: IDS,
  v1: { alertsPerPersonMonth: mean('v1', 'alertsPerMonth'), alertTimePct: mean('v1', 'alertTimePct'), injury: enrich('v1') },
  v3: { alertsPerPersonMonth: mean('v3', 'alertsPerMonth'), alertTimePct: mean('v3', 'alertTimePct'), injury: enrich('v3') },
  peopleWithWeeklyDrifts: results.filter((r) => r.drifts.length).length,
  patternFindings: results.reduce((s, r) => s + r.patterns.length, 0),
  injuryReports: people.reduce((s, p) => s + p.injuries.length, 0),
  perIndicatorAlertPct: Object.fromEntries(['v1', 'v3'].map((v) => [v, Object.fromEntries(IDS.map((id) => {
    const xs = results.map((r) => r.perVersion[v].perIndicatorAlertPct[id]).filter((x) => x != null);
    return [id, xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : null];
  }))])),
};

if (require.main === module) {
  console.table(results.map((r) => ({ p: r.p, days: r.days, 'v1 alerts/mo': r.perVersion.v1.alertsPerMonth, 'v3 alerts/mo': r.perVersion.v3.alertsPerMonth, 'v1 alert%': r.perVersion.v1.alertTimePct, 'v3 alert%': r.perVersion.v3.alertTimePct, drifts: r.drifts.join(' '), patterns: r.patterns.join(' '), rhrBase: r.baselines.rhr })));
  console.log(JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(ROOT, 'data', 'pmdata-results.json'), JSON.stringify({ summary, results }, null, 2));
}
module.exports = { summary, results };
