'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, isoDays } = require('./_helpers');

const H = load('js/data.js', 'js/engine.js');
const ds = H.buildDataset({ checkins: {}, pvt: {} });
const assess = (id) => H.assessCrew(H.CREW.find((c) => c.id === id), ds, null);

test('demo scenario produces the intended findings', () => {
  const ren = assess('nakamura');
  const ids = ren.insights.map((i) => i.id);
  for (const id of ['sleep', 'bone', 'headache', 'behav', 'nutrition']) assert.ok(ids.includes(id), `missing ${id}`);
  assert.equal(ren.insights[0].level >= ren.insights[ren.insights.length - 1].level, true, 'sorted by severity');
  assert.deepEqual(assess('lindqvist').insights, []);
  assert.equal(assess('lindqvist').readiness, 100);
  assert.ok(assess('haddad').insights.some((i) => i.id === 'immune' && i.level >= 2));
  assert.ok(assess('reyes').insights.some((i) => i.id === 'cardio'));
});

test('readiness stays within 0–100', () => {
  for (const c of H.CREW) { const r = assess(c.id).readiness; assert.ok(r >= 0 && r <= 100); }
});

test('absolute limits raise status even without a baseline', () => {
  const ind = H.INDICATORS.find((i) => i.id === 'vir');
  const arr = new Array(31).fill(null); arr[28] = 5000; arr[30] = 5200;
  const r = H.assessIndicator(ind, arr, 30, {});
  assert.equal(r.status, 2);
});

test('sensitivity thresholds change the verdict', () => {
  const ind = H.INDICATORS.find((i) => i.id === 'rhr');
  const arr = new Array(11).fill(null);
  for (let d = 1; d <= 10; d++) arr[d] = 64;        // steady 2 SD above 58 ± 3 for 10 days
  // Detector v2: smoothed (EWMA) deviation ≈ 3.5 alert units here.
  const at = (s) => H.assessIndicator(ind, arr, 10, H.SENSITIVITY[s]).status;
  assert.equal(at('sensitive'), 1);
  assert.equal(at('standard'), 1);
  assert.equal(at('conservative'), 0);
  // A single 1-day blip does not alert, but a jump of ≥ 4 SD does immediately.
  const blip = new Array(11).fill(58); blip[0] = null; blip[10] = 66;
  assert.equal(H.assessIndicator(ind, blip, 10, H.SENSITIVITY.standard).status, 0);
  const jump = new Array(11).fill(58); jump[0] = null; jump[8] = jump[9] = jump[10] = 72;
  assert.equal(H.assessIndicator(ind, jump, 10, H.SENSITIVITY.standard).status, 2);
});

test('detector v2: a one-day spike does not linger in the smoothed trend', () => {
  const ind = H.INDICATORS.find((i) => i.id === 'dose');
  const arr = new Array(41).fill(1.1); arr[0] = null; arr[20] = 25;   // solar storm on day 20
  assert.equal(H.assessIndicator(ind, arr, 21, {}).status >= 2, true, 'flagged during the event');
  assert.equal(H.assessIndicator(ind, arr, 40, {}).status, 0, 'cleared three weeks later');
});

// ---------- personal baselines ----------
function personal(records, extra = {}) {
  const profile = Object.assign({ name: 'Test', start: isoDays(-30), plannedDays: 180, baseline: {} }, extra);
  const cd = H.buildPersonal(profile, { personal: { records }, checkins: {}, pvt: {} });
  return { profile, cd, bases: H.personalBaselines(profile, cd) };
}

test('records before mission start become the preflight baseline', () => {
  const rec = {};
  for (let d = -40; d <= -31; d++) rec[isoDays(d)] = { rhr: 66 };
  const { cd, bases } = personal(rec);
  assert.equal(cd.pre.rhr.length, 10);
  assert.equal(bases.rhr.source, 'preflight');
  assert.ok(Math.abs(bases.rhr.mean - 66) < 1e-9);
});

test('calibrates until 7 readings, then learns', () => {
  const rec = {};
  for (let d = -5; d <= 0; d++) rec[isoDays(d)] = { sleep: 6.9 };
  assert.equal(personal(rec).bases.sleep.source, 'calibrating');
  rec[isoDays(-6)] = { sleep: 6.9 };
  const b = personal(rec).bases.sleep;
  assert.equal(b.source, 'learned');
  assert.ok(Math.abs(b.mean - 6.9) < 1e-9);
});

test('adaptive baseline ignores the most recent 14 days', () => {
  const rec = {};
  for (let d = -29; d <= 0; d++) rec[isoDays(d)] = { rhr: d > -10 ? 80 : 60 };   // recent spike
  const b = personal(rec).bases.rhr;
  assert.equal(b.source, 'adaptive');
  assert.ok(b.mean < 61, `baseline absorbed the spike: ${b.mean}`);
});

test('spread is shrunk toward the population SD', () => {
  const rec = {};
  for (let d = -40; d <= -31; d++) rec[isoDays(d)] = { rhr: 62 };   // zero variance
  const sd = personal(rec).bases.rhr.sd;
  assert.ok(sd > 1 && sd < 3, `sd ${sd}`);
});

test('"normal for me" re-baselines on the last 14 days', () => {
  const rec = {};
  for (let d = -29; d <= 0; d++) rec[isoDays(d)] = { rhr: d > -14 ? 70 : 60 };
  const day = H.personalDay({ start: isoDays(-30) });
  const b = personal(rec, { rebase: { rhr: day } }).bases.rhr;
  assert.equal(b.source, 'rebased');
  assert.ok(Math.abs(b.mean - 70) < 1e-9);
});

test('headache days count check-ins in a 7-day window', () => {
  const profile = { name: 'T', start: isoDays(-9), plannedDays: 60, baseline: {} };
  const checkins = {};
  [8, 9, 10].forEach((d) => { checkins[d] = { symptoms: ['headache'], vitals: {} }; });
  const cd = H.buildPersonal(profile, { checkins: { me: checkins }, pvt: {}, personal: { records: {} } });
  assert.equal(cd.series.headache[10], 3);
  assert.equal(cd.series.headache[1], null);
});

test('pattern finding: several small changes that line up are reported when none alarms alone', () => {
  const day = 60, mk = (v) => { const a = new Array(day + 1).fill(null); for (let d = 1; d <= day; d++) a[d] = v(d); return a; };
  const ramp = (d) => Math.max(0, Math.min(1, (d - 30) / 20));
  const series = {};
  H.INDICATORS.forEach((i) => { series[i.id] = new Array(day + 1).fill(null); });
  // Infection pattern: temperature, resting HR up and HRV down, each only ~1.6 SD by day 50+.
  series.temp = mk((d) => 36.7 + 0.32 * ramp(d));
  series.rhr = mk((d) => 58 + 4.8 * ramp(d));
  series.hrv = mk((d) => 52 - 9.6 * ramp(d));
  const bases = { temp: { mean: 36.7, sd: 0.2, source: 'preflight' }, rhr: { mean: 58, sd: 3, source: 'preflight' }, hrv: { mean: 52, sd: 6, source: 'preflight' } };
  const cd = { series, offsets: {}, doseRate: 0 };
  const a = H.assessCrew({ id: 'x', name: 'X', personal: true }, { crew: { x: cd }, env: H.buildDataset({ checkins: {}, pvt: {} }).env }, null, { day, bases, ...H.SENSITIVITY.conservative });
  const each = ['temp', 'rhr', 'hrv'].map((id) => a.inds[id].status);
  assert.deepEqual(each, [0, 0, 0], `members alarmed alone: ${each}`);
  assert.ok(a.insights.some((i) => i.id === 'pattern-infection'), a.insights.map((i) => i.id).join());
});

test('Conservative setting uses the confirm-twice rule for sparse lab values', () => {
  const ind = H.INDICATORS.find((i) => i.id === 'lymph');      // bad direction: down; base 2.0 ± 0.25
  const arr = new Array(43).fill(null);
  [7, 14, 21, 28, 35].forEach((d) => { arr[d] = 2.0; });
  arr[42] = 1.45;                                               // a single −2.2 SD result
  assert.equal(H.assessIndicator(ind, arr, 42, H.SENSITIVITY.standard).status >= 1, true, 'standard flags one result ≥ 2 SD');
  assert.equal(H.assessIndicator(ind, arr, 42, H.SENSITIVITY.conservative).status, 0, 'conservative waits for confirmation');
  arr[35] = 1.6;                                                // previous result also −1.6 SD → confirmed
  assert.equal(H.assessIndicator(ind, arr, 42, H.SENSITIVITY.conservative).status, 1);
});

test('exercise prescription is a target: only enforced for people whose normal meets it', () => {
  const ind = H.INDICATORS.find((i) => i.id === 'exer');
  const flat = (v) => { const a = new Array(31).fill(null); for (let d = 1; d <= 30; d++) a[d] = v; return a; };
  // A person who normally does 30 min/day is judged against that, not the 60-min prescription.
  assert.equal(H.assessIndicator(ind, flat(30), 30, { bases: { exer: { mean: 30, sd: 8, source: 'preflight' } } }).status, 0);
  // An astronaut whose normal is 120 min/day who drops to 50 still triggers the prescription limit.
  assert.equal(H.assessIndicator(ind, flat(50), 30, { bases: { exer: { mean: 120, sd: 12, source: 'preflight' } } }).status >= 2, true);
});
