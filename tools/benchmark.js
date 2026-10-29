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

function score(people, detect) {
  let events = 0, found = 0, falseEp = 0, indDays = 0;
  const delays = [];
  for (const p of people) {
    for (const ind of INDS) {
      const alarm = detect(p, ind);
      const ev = p.events.find((e) => e.id === ind.id);
      // count alarm episodes (rising edges)
      for (let i = 0; i < alarm.length; i++) {
        const d = START + i;
        if (alarm[i] && (i === 0 || !alarm[i - 1]) && (!ev || d < ev.onset)) falseEp++;
      }
      indDays += ev ? Math.max(0, ev.onset - START) : alarm.length;
      if (ev) {
        events++;
        const deadline = ev.onset + ev.ramp + 21;
        let det = null;
        for (let i = 0; i < alarm.length; i++) { const d = START + i; if (d >= ev.onset && d <= deadline && alarm[i]) { det = d; break; } }
        if (det != null) { found++; delays.push(det - ev.onset); }
      }
    }
  }
  delays.sort((a, b) => a - b);
  return {
    sensitivity: +(found / events).toFixed(3),
    medianDelay: delays.length ? delays[(delays.length - 1) >> 1] : null,
    falseAlarmsPerPersonMonth: +((falseEp / indDays) * 30 * INDS.length).toFixed(2),
    events,
  };
}

const or = (...xs) => xs[0].map((_, k) => xs.some((x) => x[k]));
const bigJump = (p, i) => DETECTORS.daily(p, i, { noTrend: true, noLimits: true, zMon: 3, zAct: 4 });
const limitsOnly = (p, i) => DETECTORS.daily(p, i, { noTrend: true, noZ: true });
// Safety limits only: Action/Urgent thresholds (fever, high BP…); Monitor limits are left to the personal detectors.
const safetyLimits = (p, i) => DETECTORS.daily(p, i, { noTrend: true, noZ: true, safetyOnly: true });
const VARIANTS = {
  'HELIOS engine v2 (as shipped)': (p, i) => DETECTORS.daily(p, i, { engine: true }),
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
  'daily (current)': (p, i) => DETECTORS.daily(p, i),
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

if (require.main === module) {
  const N = +(process.argv[2] || 200);
  const tune = run(Array.from({ length: N }, (_, i) => i + 1));
  console.log(`Tuning set (${N} people):`); console.table(tune);
  const pick = process.argv[3];
  if (pick) { console.log(`Held-out set (${N} people), variants: ${pick}`); console.table(run(Array.from({ length: N }, (_, i) => 1001 + i), pick.split('|'))); }
}
module.exports = { person, score, run, VARIANTS, DETECTORS, persist, ewma, INDS, START, DAYS };
