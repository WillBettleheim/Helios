'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, fakeApp } = require('./_helpers');

const H = load('js/data.js', 'js/engine.js', 'js/weekly.js');
const W = H.weekly;
const rhr = H.INDICATORS.find((i) => i.id === 'rhr');
const base = { mean: 58, sd: 3 };

// Deterministic noise so tests are stable.
function series(days, fn) {
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; };
  const a = new Array(days + 1).fill(null);
  for (let d = 1; d <= days; d++) a[d] = fn(d) + r() * 2;
  return a;
}

test('Mann–Kendall and Sen match textbook values', () => {
  const mk = W.mannKendall([1, 2, 3, 4, 5, 6]);
  assert.equal(mk.S, 15);
  assert.ok(Math.abs(mk.pUp - 0.0043) < 0.0005, `p ${mk.pUp}`);     // n = 6, S = 15
  assert.ok(W.mannKendall([3, 1, 4, 1, 5, 9, 2, 6]).pUp > 0.05, 'noise is not a trend');
  assert.deepEqual(W.senSlope([[1, 1], [2, 3], [3, 5], [4, 7]]), { slope: 2, intercept: -1 });
  assert.ok(Math.abs(W.phi(1.96) - 0.975) < 1e-4 && Math.abs(W.phi(-1.645) - 0.05) < 1e-4);
});

test("a step change is the daily detector's job; a ramp is the weekly test's job", () => {
  const step = series(140, (d) => (d > 98 ? 65.5 : 58));      // +7.5 bpm (2.5 SD) from week 15, then flat
  assert.notEqual(W.analyze(rhr, step, base, 140).status, 'drift', 'a step is not a trend');
  // The daily EWMA chart flags the step within days of it happening.
  let flagged = null;
  for (let d = 99; d <= 140 && flagged == null; d++) if (H.assessIndicator(rhr, step, d, { bases: { rhr: base } }).status >= 1) flagged = d;
  // Measured: 1.7 SD → 17 days, 2 SD → 9, 2.5 SD → 4, 3 SD → 3 (larger changes are caught faster).
  assert.ok(flagged != null && flagged - 99 <= 7, `daily detector flagged on day ${flagged}`);
  const ramp = series(140, (d) => 58 + Math.max(0, d - 84) * 0.1);   // slow ramp from week 13
  const w = W.analyze(rhr, ramp, base, 140);
  assert.equal(w.status, 'drift');
  assert.ok(w.onset >= 11 && w.onset <= 15, `onset W${w.onset}`);
});

test('a slow drift is detected with its rate', () => {
  const s = series(140, (d) => 58 + Math.max(0, d - 84) * 0.12);   // +0.84 bpm/week from week 13
  const r = W.analyze(rhr, s, base, 140);
  assert.ok(r.status === 'drift' || r.status === 'shift', r.status);
  assert.ok(r.slope > 0.5 && r.slope < 1.2, `slope ${r.slope}`);
});

test('a single extreme week does not fake a shift; stable data stays steady', () => {
  const spike = series(140, (d) => (d >= 120 && d <= 126 ? 95 : 58));
  assert.notEqual(W.analyze(rhr, spike, base, 140).status, 'shift');
  assert.equal(W.analyze(rhr, series(140, () => 58), base, 140).status, 'steady');
});

test('cumulative totals are not trend-tested', () => {
  const cum = H.INDICATORS.find((i) => i.id === 'cumdose');
  assert.equal(W.analyze(cum, series(140, (d) => d * 1.1), null, 140).status, 'na');
});

test('too few weeks gives no verdict', () => {
  const r = W.analyze(rhr, series(20, () => 70), base, 20);
  assert.equal(r.status, 'insufficient');
});

test('demo crew: healthy member clean, scenario problems found, no radiation drift from the solar storm', () => {
  const ds = H.buildDataset({ checkins: {}, pvt: {} });
  const run = (id) => { const c = H.CREW.find((x) => x.id === id); return W.analyzeCrew(H.assessCrew(c, ds, null), ds.crew[id], 147); };
  assert.equal(run('lindqvist').drifts.length, 0, run('lindqvist').drifts.map((x) => x.ind.id).join());
  const ren = run('nakamura').drifts.map((x) => x.ind.id);
  for (const id of ['sleep', 'pvt', 'exer', 'bmd']) assert.ok(ren.includes(id), `missing ${id}`);
  for (const c of H.CREW) assert.ok(!run(c.id).drifts.some((x) => x.ind.id === 'dose'), `solar storm read as a dose drift for ${c.id}`);
  const reyes = run('reyes').drifts.map((x) => x.ind.id);
  for (const id of ['rhr', 'hrv', 'sbp']) assert.ok(reyes.includes(id), `missing ${id}`);
});

test('replay reports when the weekly system first flagged each problem', () => {
  const X = load('js/data.js', 'js/engine.js', 'js/weekly.js', 'js/protocols.js', 'js/sanitize.js', 'js/features/replay.js');
  const ds = X.buildDataset({ checkins: {}, pvt: {} });
  const app = fakeApp(X, { data: () => ds });
  X.features.forEach((f) => f(app));
  const sbp = X.replay.history('reyes').leads.find((l) => l.ind.id === 'sbp');
  assert.ok(sbp.weekly && sbp.weekly % 7 === 0, `weekly flag day ${sbp.weekly}`);
  assert.ok(sbp.weekly < sbp.limit, 'weekly system also beats the fixed limit for blood pressure');
  assert.equal(X.replay.history('reyes').leads.find((l) => l.ind.id === 'cumdose').weekly, null, 'no trend flag on a cumulative total');
  const rhr = X.replay.history('reyes').leads.find((l) => l.ind.id === 'rhr');
  assert.ok(rhr.helios <= rhr.weekly, 'the daily detector includes the weekly tests, so it is never later');
});
