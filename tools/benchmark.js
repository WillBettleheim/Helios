#!/usr/bin/env node
/*
 * HELIOS — detection benchmark on randomized simulated crews.
 *
 * The demo mission is one hand-written scenario; tuning on it would flatter the results. This
 * generates many synthetic astronauts instead:
 *   · between-person spread of the "normal" level (resting HR and HRV spread taken from the real
 *     PhysioNet MMASH data: 5.4 bpm and 14.5 ms; other indicators 1.5× their within-person SD);
 *   · day-to-day noise with autocorrelation (AR(1), φ = 0.5) — real physiology drifts, it is not
 *     independent from day to day, which makes false alarms harder to avoid than in the demo;
 *   · 10 preflight readings per indicator for the personal baseline (the app's own code path);
 *   · 40 % stay healthy; the rest develop 1–3 problems: random indicator, onset day 40–120,
 *     ramp 7–35 days, size 1.5–4 SD in the unhealthy direction, then persisting.
 * Detectors run in real time (no look-ahead). Scored per problem (detected? delay from onset)
 * and per false alarm (alarm episodes on indicators that have no problem, or before onset).
 *
 *   node tools/benchmark.js            # tuning set (seeds 1–200) and held-out set (seeds 1001–1200)
 */
'use strict';
const path = require('path');
const { load } = require('../test/_helpers');

const H = load('js/data.js', 'js/engine.js', 'js/weekly.js');
const DAYS = 150, START = 31;                       // judge days 31–150 (≈ 4 months)
const IDS = ['rhr', 'hrv', 'sbp', 'temp', 'sleep', 'sleff', 'exer', 'mood', 'stress', 'pvt', 'mass', 'fluid', 'kcal'];
const INDS = IDS.map((id) => H.INDICATORS.find((i) => i.id === id));
const BETWEEN = { rhr: 5.4, hrv: 14.5 };          // from MMASH (real between-person SD)
const PHI = 0.5;

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

function person(seed) {
  const r = rng(seed);
  const healthy = r() < 0.4;
  const events = [];
  if (!healthy) {
    const n = 1 + Math.floor(r() * 3), pool = IDS.slice();
    for (let k = 0; k < n; k++) {
      const id = pool.splice(Math.floor(r() * pool.length), 1)[0];
      events.push({ id, onset: 40 + Math.floor(r() * 81), ramp: 7 + Math.floor(r() * 29), size: 1.5 + r() * 2.5 });
    }
  }
  const series = {}, pre = {};
  INDS.forEach((ind) => {
    const [pm, sd] = ind.base, mu = pm + gauss(r) * (BETWEEN[ind.id] || 1.5 * sd), sign = ind.bad === 'up' ? 1 : -1;
    const ev = events.find((e) => e.id === ind.id);
    let e = gauss(r) * sd;
    const val = (d) => {
      e = PHI * e + Math.sqrt(1 - PHI * PHI) * sd * gauss(r);
      const eff = ev && d >= ev.onset ? sign * ev.size * sd * Math.min(1, (d - ev.onset + 1) / ev.ramp) : 0;
      let x = mu + e + eff;
      if (ind.clamp) x = Math.min(ind.clamp[1], Math.max(ind.clamp[0], x));
      return x;
    };
    pre[ind.id] = Array.from({ length: 10 }, () => val(0));
    series[ind.id] = [null];
    for (let d = 1; d <= DAYS; d++) series[ind.id].push(val(d));
  });
  H.INDICATORS.forEach((ind) => { if (!series[ind.id]) series[ind.id] = new Array(DAYS + 1).fill(null); });
  const profile = { start: '2026-01-01', plannedDays: DAYS, baseline: {} };
  const bases = H.personalBaselines(profile, { series, pre, day: DAYS });
  return { seed, healthy, events, series, bases };
}

// ---------- detectors: return a boolean alarm series over days START..DAYS ----------
const DETECTORS = {
  // Current daily engine: alarm whenever status ≥ Monitor.
  daily: (p, ind, opts = {}) => {
    const out = [];
    const i2 = opts.noLimits ? Object.assign({}, ind, { limits: null })
      : opts.safetyOnly ? Object.assign({}, ind, { limits: ind.limits ? { action: ind.limits.action, urgent: ind.limits.urgent } : null }) : ind;
    for (let d = START; d <= DAYS; d++) out.push(H.assessIndicator(i2, p.series[ind.id], d, { bases: p.bases, zMon: opts.zMon || 2, zAct: opts.zAct || 3, noTrend: opts.noTrend, noZ: opts.noZ, legacy: opts.engine ? false : true }).status >= 1);
    return out;
  },
  // Current weekly system: alarm from the end of the week it first reports a shift or drift.
  weekly: (p, ind) => {
    const out = []; let on = false;
    for (let d = START; d <= DAYS; d++) {
      if (d % 7 === 0) { const s = H.weekly.analyze(ind, p.series[ind.id], p.bases[ind.id], d).status; on = s === 'shift' || s === 'drift'; }
      out.push(on);
    }
    return out;
  },
};
// Persistence: alarm only if the raw detector fired on k of the last m days.
const persist = (raw, k, m) => raw.map((_, i) => raw.slice(Math.max(0, i - m + 1), i + 1).filter(Boolean).length >= k);
// EWMA control chart on the daily standardized deviation from the personal baseline.
function ewma(p, ind, lambda, L) {
  const B = p.bases[ind.id], sign = ind.bad === 'up' ? 1 : -1, out = [];
  if (!B || B.mean == null) return new Array(DAYS - START + 1).fill(false);
  // AR(1) noise inflates the EWMA variance: Var = σ²·λ/(2−λ)·(1+φ(1−λ))/(1−φ(1−λ)).
  const limit = L * Math.sqrt((lambda / (2 - lambda)) * (1 + PHI * (1 - lambda)) / (1 - PHI * (1 - lambda)));
  let z = 0;
  for (let d = 1; d <= DAYS; d++) {
    const x = p.series[ind.id][d];
    if (x != null) z = lambda * Math.max(-4, Math.min(4, sign * (x - B.mean) / B.sd)) + (1 - lambda) * z;
    if (d >= START) out.push(z >= limit);
  }
  return out;
}

// First day ≥ onset on which an alarm *starts* (rising edge). An alarm already running before
// the problem began is a false alarm that happens to overlap — it must not count as detection.
function firstNewAlarm(alarm, onset, deadline) {
  for (let i = 0; i < alarm.length; i++) {
    const d = START + i;
    if (d < onset) continue;
    if (d > deadline) break;
    if (alarm[i] && (i === 0 || !alarm[i - 1])) return d;
  }
  return null;
}

function score(people, detect) {
  let events = 0, found = 0, falseEp = 0, indDays = 0, pre = 0, cleanEvents = 0, cleanFound = 0, falseDays = 0;
  const delays = [];
  for (const p of people) {
    for (const ind of INDS) {
      const alarm = detect(p, ind);
      const ev = p.events.find((e) => e.id === ind.id);
      // count alarm episodes (rising edges)
      for (let i = 0; i < alarm.length; i++) {
        const d = START + i;
        if (alarm[i] && (i === 0 || !alarm[i - 1]) && (!ev || d < ev.onset)) falseEp++;
        if (alarm[i] && (!ev || d < ev.onset)) falseDays++;
      }
      indDays += ev ? Math.max(0, ev.onset - START) : alarm.length;
      if (ev) {
        events++;
        const det = firstNewAlarm(alarm, ev.onset, ev.onset + ev.ramp + 21);
        const iOn = ev.onset - START, already = iOn > 0 && alarm[iOn - 1];
        if (already) pre++; else { cleanEvents++; if (det != null) cleanFound++; }
        if (det != null) { found++; delays.push(det - ev.onset); }
      }
    }
  }
  delays.sort((a, b) => a - b);
  return {
    sensitivity: +(found / events).toFixed(3),
    sensitivityCleanStart: +(cleanFound / cleanEvents).toFixed(3),
    alreadyAlarmingAtOnset: +(pre / events).toFixed(3),
    medianDelay: delays.length ? delays[(delays.length - 1) >> 1] : null,
    falseAlarmsPerPersonMonth: +((falseEp / indDays) * 30 * INDS.length).toFixed(2),
    falseAlarmTimePct: +((falseDays / indDays) * 100).toFixed(1),
    events,
  };
}

const or = (...xs) => xs[0].map((_, k) => xs.some((x) => x[k]));
const bigJump = (p, i) => DETECTORS.daily(p, i, { noTrend: true, noLimits: true, zMon: 3, zAct: 4 });
const limitsOnly = (p, i) => DETECTORS.daily(p, i, { noTrend: true, noZ: true });
// Safety limits only: Action/Urgent thresholds (fever, high BP…); Monitor limits are left to the personal detectors.
const safetyLimits = (p, i) => DETECTORS.daily(p, i, { noTrend: true, noZ: true, safetyOnly: true });
// Weekly system, trend test only (Mann–Kendall drift), without the CUSUM shift test.
function weeklyDrift(p, ind) {
  const out = []; let on = false; const sign = ind.bad === 'up' ? 1 : -1;
  for (let d = START; d <= DAYS; d++) {
    if (d % 7 === 0) {
      const w = H.weekly.analyze(ind, p.series[ind.id], p.bases[ind.id], d);
      const pBad = w.mk ? (sign > 0 ? w.mk.pUp : w.mk.pDown) : 1;
      on = !!w.mk && pBad < 0.01 && (w.changeSD == null || w.changeSD >= 0.5);
    }
    out.push(on);
  }
  return out;
}
const VARIANTS = {
  'v3 cand: EWMA L3 + jump + safety': (p, i) => or(ewma(p, i, 0.2, 3), DETECTORS.daily(p, i, { noTrend: true, noLimits: true, zMon: 4, zAct: 5 }), safetyLimits(p, i)),
  'v3 cand: EWMA L3.25 + jump + safety': (p, i) => or(ewma(p, i, 0.2, 3.25), DETECTORS.daily(p, i, { noTrend: true, noLimits: true, zMon: 4, zAct: 5 }), safetyLimits(p, i)),
  'v3 cand: EWMA L3 + jump + safety + MK drift': (p, i) => or(ewma(p, i, 0.2, 3), DETECTORS.daily(p, i, { noTrend: true, noLimits: true, zMon: 4, zAct: 5 }), safetyLimits(p, i), weeklyDrift(p, i)),
  'v3 cand: EWMA L3.25 + jump + safety + MK drift': (p, i) => or(ewma(p, i, 0.2, 3.25), DETECTORS.daily(p, i, { noTrend: true, noLimits: true, zMon: 4, zAct: 5 }), safetyLimits(p, i), weeklyDrift(p, i)),
  'weekly MK drift only': (p, i) => weeklyDrift(p, i),
  'HELIOS engine (as shipped, v3)': (p, i) => DETECTORS.daily(p, i, { engine: true }),
  'NEW G: EWMA L3.5 + weekly + safety limits': (p, i) => or(ewma(p, i, 0.2, 3.5), DETECTORS.weekly(p, i), safetyLimits(p, i)),
  'NEW H: EWMA L3 + weekly + safety limits': (p, i) => or(ewma(p, i, 0.2, 3), DETECTORS.weekly(p, i), safetyLimits(p, i)),
  'NEW I: EWMA L3.25 + weekly + safety limits': (p, i) => or(ewma(p, i, 0.2, 3.25), DETECTORS.weekly(p, i), safetyLimits(p, i)),
  'NEW J: I + jump≥4SD': (p, i) => or(ewma(p, i, 0.2, 3.25), DETECTORS.weekly(p, i), safetyLimits(p, i), DETECTORS.daily(p, i, { noTrend: true, noLimits: true, zMon: 4, zAct: 5 })),
  'NEW A: EWMA L3 + jump≥3SD + limits': (p, i) => or(ewma(p, i, 0.2, 3), bigJump(p, i), limitsOnly(p, i)),
  'NEW B: A, limits 2 of 3 days': (p, i) => or(ewma(p, i, 0.2, 3), bigJump(p, i), persist(limitsOnly(p, i), 2, 3)),
  'NEW C: B + weekly': (p, i) => or(ewma(p, i, 0.2, 3), bigJump(p, i), persist(limitsOnly(p, i), 2, 3), DETECTORS.weekly(p, i)),
  'NEW D: B, jump 2 of 3 days': (p, i) => or(ewma(p, i, 0.2, 3), persist(bigJump(p, i), 2, 3), persist(limitsOnly(p, i), 2, 3)),
  'NEW E: D + weekly': (p, i) => or(ewma(p, i, 0.2, 3), persist(bigJump(p, i), 2, 3), persist(limitsOnly(p, i), 2, 3), DETECTORS.weekly(p, i)),
  'NEW F: EWMA L2.75 + jump 2/3 + limits 2/3 + weekly': (p, i) => or(ewma(p, i, 0.2, 2.75), persist(bigJump(p, i), 2, 3), persist(limitsOnly(p, i), 2, 3), DETECTORS.weekly(p, i)),
  'diag: z only': (p, i) => DETECTORS.daily(p, i, { noTrend: true, noLimits: true }),
  'diag: trend only': (p, i) => DETECTORS.daily(p, i, { noZ: true, noLimits: true }),
  'diag: z + limits (no trend)': (p, i) => DETECTORS.daily(p, i, { noTrend: true }),
  'v1: original daily engine': (p, i) => DETECTORS.daily(p, i),
  'weekly (current)': (p, i) => DETECTORS.weekly(p, i),
  'daily OR weekly': (p, i) => { const a = DETECTORS.daily(p, i), b = DETECTORS.weekly(p, i); return a.map((x, k) => x || b[k]); },
  'daily, 2 of 3 days': (p, i) => persist(DETECTORS.daily(p, i), 2, 3),
  'daily, 3 of 4 days': (p, i) => persist(DETECTORS.daily(p, i), 3, 4),
  'daily z 2.5/3.5, 2 of 3': (p, i) => persist(DETECTORS.daily(p, i, { zMon: 2.5, zAct: 3.5 }), 2, 3),
  'EWMA λ0.2 L3': (p, i) => ewma(p, i, 0.2, 3),
  'EWMA λ0.2 L3.5': (p, i) => ewma(p, i, 0.2, 3.5),
  'EWMA λ0.1 L3.5': (p, i) => ewma(p, i, 0.1, 3.5),
  'EWMA λ0.2 L3.5 OR weekly': (p, i) => { const a = ewma(p, i, 0.2, 3.5), b = DETECTORS.weekly(p, i); return a.map((x, k) => x || b[k]); },
};

function run(seeds, names = Object.keys(VARIANTS)) {
  const people = seeds.map(person);
  return Object.fromEntries(names.map((n) => [n, score(people, VARIANTS[n])]));
}

if (require.main === module && !process.argv.includes('--sparse') && !process.argv.includes('--syndromes')) {
  const N = +(process.argv[2] || 200);
  const tune = run(Array.from({ length: N }, (_, i) => i + 1));
  console.log(`Tuning set (${N} people):`); console.table(tune);
  const pick = process.argv[3];
  if (pick) { console.log(`Held-out set (${N} people), variants: ${pick}`); console.table(run(Array.from({ length: N }, (_, i) => 1001 + i), pick.split('|'))); }
}
module.exports = { person, score, run, VARIANTS, DETECTORS, persist, ewma, INDS, START, DAYS };

// ======================= Sparse measurements (weekly labs, scans) =======================
// Same idea for indicators measured every 3–14 days. Lab values carry assay noise and some
// week-to-week persistence (φ = 0.3). Problems ramp over 14–56 days (slower physiology).
const SPARSE = ['lymph', 'crp', 'grip', 'uca', 'bmd', 'rnfl'].map((id) => H.INDICATORS.find((i) => i.id === id));
function personSparse(seed) {
  const r = rng(seed + 50000);
  const healthy = r() < 0.4, events = [];
  if (!healthy) {
    const pool = SPARSE.map((i) => i.id), n = 1 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) events.push({ id: pool.splice(Math.floor(r() * pool.length), 1)[0], onset: 40 + Math.floor(r() * 71), ramp: 14 + Math.floor(r() * 43), size: 1.5 + r() * 2.5 });
  }
  const series = {}, pre = {};
  SPARSE.forEach((ind) => {
    const [pm, sd] = ind.base, sign = ind.bad === 'up' ? 1 : -1, ev = events.find((e) => e.id === ind.id);
    const mu = pm + gauss(r) * 1.5 * sd, off = Math.floor(r() * ind.cadence);
    let e = gauss(r) * sd;
    const val = (d) => {
      e = 0.3 * e + Math.sqrt(1 - 0.09) * sd * gauss(r);
      const eff = ev && d >= ev.onset ? sign * ev.size * sd * Math.min(1, (d - ev.onset + 1) / ev.ramp) : 0;
      let x = mu + (ind.expected ? ind.expected(Math.max(d, 1)) : 0) + e + eff;
      if (ind.clamp) x = Math.min(ind.clamp[1], Math.max(ind.clamp[0], x));
      return x;
    };
    pre[ind.id] = Array.from({ length: 4 }, () => val(0));
    series[ind.id] = [null];
    for (let d = 1; d <= DAYS; d++) series[ind.id].push((d + off) % ind.cadence === 0 ? val(d) : null);
  });
  H.INDICATORS.forEach((ind) => { if (!series[ind.id]) series[ind.id] = new Array(DAYS + 1).fill(null); });
  const bases = H.personalBaselines({ start: '2026-01-01', plannedDays: DAYS, baseline: {} }, { series, pre, day: DAYS });
  return { seed, healthy, events, series, bases };
}

// Sparse detectors. Each returns an alarm per day (state held between measurements).
const sparseLegacy = (p, ind, o = {}) => { const out = []; for (let d = START; d <= DAYS; d++) out.push(H.assessIndicator(o.noTrend ? ind : ind, p.series[ind.id], d, { bases: p.bases, noTrend: o.noTrend, legacy: true }).status >= 1); return out; };
// Confirmation: alarm when the last two measurements both deviate ≥ k SD (bad direction), or a safety limit is crossed.
function sparseConfirm(p, ind, k = 2, single = 3.5) {
  const B = p.bases[ind.id], sign = ind.bad === 'up' ? 1 : -1, out = [];
  const center = (d) => B.mean + (ind.expected ? ind.expected(d) : 0);
  const L = ind.limits || {}, safety = L.action != null ? L.action : L.urgent;
  const vals = [];
  for (let d = 1; d <= DAYS; d++) {
    const x = p.series[ind.id][d];
    if (x != null) vals.push(sign * (x - center(d)) / B.sd);
    const last2 = vals.slice(-2);
    const alarm = (last2.length === 2 && last2.every((z) => z >= k)) || (vals.length && vals[vals.length - 1] >= single) ||
      (x != null && safety != null && (sign > 0 ? x >= safety : x <= safety));
    if (d >= START) out.push(x == null && out.length ? out[out.length - 1] : !!alarm);
  }
  return out;
}

function scoreSparse(people, detect) {
  let events = 0, found = 0, falseEp = 0, indDays = 0; const delays = [];
  for (const p of people) for (const ind of SPARSE) {
    const alarm = detect(p, ind), ev = p.events.find((e) => e.id === ind.id);
    for (let i = 0; i < alarm.length; i++) { const d = START + i; if (alarm[i] && (i === 0 || !alarm[i - 1]) && (!ev || d < ev.onset)) falseEp++; }
    indDays += ev ? Math.max(0, ev.onset - START) : alarm.length;
    if (ev) {
      events++;
      const det = firstNewAlarm(alarm, ev.onset, ev.onset + ev.ramp + 28);
      if (det != null) { found++; delays.push(det - ev.onset); }
    }
  }
  delays.sort((a, b) => a - b);
  return { sensitivity: +(found / events).toFixed(3), medianDelay: delays.length ? delays[(delays.length - 1) >> 1] : null, falseAlarmsPerPersonMonth: +((falseEp / indDays) * 30 * SPARSE.length).toFixed(2), events };
}

const SPARSE_VARIANTS = {
  'sparse v1 (current: ≥2 SD + projection + limits)': (p, i) => sparseLegacy(p, i),
  'sparse v1 without projection': (p, i) => sparseLegacy(p, i, { noTrend: true }),
  'confirm: 2 in a row ≥ 2 SD (+ ≥3.5 SD or safety limit)': (p, i) => sparseConfirm(p, i, 2),
  'confirm: 2 in a row ≥ 1.5 SD (+ ≥3.5 SD or safety limit)': (p, i) => sparseConfirm(p, i, 1.5),
  'confirm: 2 in a row ≥ 2.5 SD (+ ≥3.5 SD or safety limit)': (p, i) => sparseConfirm(p, i, 2.5),
  'hybrid: one ≥ 2.5 SD, or 2 in a row ≥ 1.5 SD': (p, i) => sparseConfirm(p, i, 1.5, 2.5),
  'hybrid: one ≥ 2.75 SD, or 2 in a row ≥ 1.5 SD': (p, i) => sparseConfirm(p, i, 1.5, 2.75),
  'hybrid: one ≥ 2.5 SD, or 2 in a row ≥ 1.75 SD': (p, i) => sparseConfirm(p, i, 1.75, 2.5),
};
function runSparse(seeds, names = Object.keys(SPARSE_VARIANTS)) {
  const people = seeds.map(personSparse);
  return Object.fromEntries(names.map((n) => [n, scoreSparse(people, SPARSE_VARIANTS[n])]));
}
module.exports.runSparse = runSparse;
module.exports.SPARSE_VARIANTS = SPARSE_VARIANTS;
module.exports.personSparse = personSparse;
if (require.main === module && process.argv.includes('--sparse')) {
  console.log('Sparse, tuning (seeds 1–200):'); console.table(runSparse(Array.from({ length: 200 }, (_, i) => i + 1)));
}

// ======================= Multi-measurement patterns ("syndromes") =======================
// Real problems rarely move one number. Each syndrome shifts several related indicators by a
// small amount (0.8–2 SD each), which single-indicator detectors find hard.
const SYNDROMES = {
  sleepLoss: ['sleep', 'sleff', 'pvt', 'mood'],
  infection: ['temp', 'rhr', 'hrv'],
  cardioStrain: ['rhr', 'hrv', 'sbp'],
  stress: ['stress', 'mood', 'sleep'],
  underEating: ['mass', 'kcal', 'fluid'],
};
function personSyndrome(seed) {
  const r = rng(seed + 90000);
  const healthy = r() < 0.4, syn = [];
  if (!healthy) {
    const pool = Object.keys(SYNDROMES), n = 1 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const name = pool.splice(Math.floor(r() * pool.length), 1)[0];
      syn.push({ name, members: SYNDROMES[name], onset: 40 + Math.floor(r() * 81), ramp: 7 + Math.floor(r() * 29), sizes: SYNDROMES[name].map(() => 0.8 + r() * 1.2) });
    }
  }
  // Per-indicator effects (an indicator can belong to two syndromes: effects add).
  const effects = {};
  syn.forEach((s) => s.members.forEach((id, j) => (effects[id] = effects[id] || []).push({ onset: s.onset, ramp: s.ramp, size: s.sizes[j] })));
  const series = {}, pre = {};
  INDS.forEach((ind) => {
    const [pm, sd] = ind.base, sign = ind.bad === 'up' ? 1 : -1;
    const mu = pm + gauss(r) * (BETWEEN[ind.id] || 1.5 * sd);
    let e = gauss(r) * sd;
    const val = (d) => {
      e = PHI * e + Math.sqrt(1 - PHI * PHI) * sd * gauss(r);
      const eff = (effects[ind.id] || []).reduce((s, x) => s + (d >= x.onset ? sign * x.size * sd * Math.min(1, (d - x.onset + 1) / x.ramp) : 0), 0);
      let x = mu + e + eff;
      if (ind.clamp) x = Math.min(ind.clamp[1], Math.max(ind.clamp[0], x));
      return x;
    };
    pre[ind.id] = Array.from({ length: 10 }, () => val(0));
    series[ind.id] = [null];
    for (let d = 1; d <= DAYS; d++) series[ind.id].push(val(d));
  });
  H.INDICATORS.forEach((ind) => { if (!series[ind.id]) series[ind.id] = new Array(DAYS + 1).fill(null); });
  const bases = H.personalBaselines({ start: '2026-01-01', plannedDays: DAYS, baseline: {} }, { series, pre, day: DAYS });
  return { seed, healthy, syn, series, bases };
}

// Robust EWMA values in control-limit units (same construction as the engine), unhealthy direction positive.
function ewmaUnits(p, ind) {
  const B = p.bases[ind.id], sign = ind.bad === 'up' ? 1 : -1, lam = 0.2;
  const unit = Math.sqrt((lam / (2 - lam)) * (1 + PHI * (1 - lam)) / (1 - PHI * (1 - lam)));
  let z = 0; const out = [];
  for (let d = 1; d <= DAYS; d++) {
    const x = p.series[ind.id][d];
    if (x != null) z = lam * Math.max(-4, Math.min(4, sign * (x - B.mean) / B.sd)) + (1 - lam) * z;
    if (d >= START) out.push(z / unit);
  }
  return out;
}
// Pattern score: sum of the members' EWMA units / √k (≈ standard normal when healthy). Members
// moving the healthy way are floored at 0 so one improving indicator cannot cancel the others.
function patternAlarm(p, members, L) {
  const ev = members.map((id) => ewmaUnits(p, INDS.find((i) => i.id === id)));
  return ev[0].map((_, k) => ev.reduce((s, a) => s + Math.max(0, a[k]), 0) / Math.sqrt(members.length) >= L);
}

// Scoring: a syndrome is detected by any alarm on one of its members or on its pattern.
function scoreSyndromes(people, withPatterns, L) {
  let events = 0, found = 0, falseEp = 0, personMonths = 0, falseDays = 0, streamDays = 0; const delays = [];
  for (const p of people) {
    const firstOnset = p.syn.length ? Math.min(...p.syn.map((s) => s.onset)) : DAYS + 1;
    personMonths += (Math.min(firstOnset, DAYS + 1) - START) / 30;
    const streams = {};
    INDS.forEach((ind) => { streams['i:' + ind.id] = DETECTORS.daily(p, ind, { engine: true }); });
    if (withPatterns) Object.entries(SYNDROMES).forEach(([name, members]) => { streams['p:' + name] = patternAlarm(p, members, L); });
    // False alarms: rising edges before the first problem starts (healthy people: whole period).
    Object.values(streams).forEach((a) => { for (let i = 0; i < a.length; i++) { const d = START + i; if (d < firstOnset) { streamDays++; if (a[i]) falseDays++; if (a[i] && (i === 0 || !a[i - 1])) falseEp++; } } });
    p.syn.forEach((s) => {
      events++;
      const keys = s.members.map((id) => 'i:' + id).concat(withPatterns ? ['p:' + s.name] : []);
      const hits = keys.map((k) => firstNewAlarm(streams[k], s.onset, s.onset + s.ramp + 21)).filter((d) => d != null);
      const det = hits.length ? Math.min(...hits) : null;
      if (det != null) { found++; delays.push(det - s.onset); }
    });
  }
  delays.sort((a, b) => a - b);
  return { sensitivity: +(found / events).toFixed(3), medianDelay: delays.length ? delays[(delays.length - 1) >> 1] : null, falseAlarmsPerPersonMonth: +(falseEp / personMonths).toFixed(2), falseAlarmTimePct: +((falseDays / streamDays) * 100).toFixed(1), events };
}
function runSyndromes(seeds, Ls = [3, 3.25, 3.5, 4]) {
  const people = seeds.map(personSyndrome);
  const out = { 'v3 (single indicators)': scoreSyndromes(people, false) };
  Ls.forEach((L) => { out[`v3 + patterns (L ${L})`] = scoreSyndromes(people, true, L); });
  return out;
}
module.exports.runSyndromes = runSyndromes;
module.exports.SYNDROMES = SYNDROMES;
if (require.main === module && process.argv.includes('--syndromes')) {
  console.log('Syndromes, tuning (seeds 1–200):'); console.table(runSyndromes(Array.from({ length: 200 }, (_, i) => i + 1)));
}
