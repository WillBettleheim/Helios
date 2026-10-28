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
  for (let d = 1; d <= 10; d++) arr[d] = 64.7;     // 2.23 SD above 58 ± 3
  const at = (s) => H.assessIndicator(ind, arr, 10, H.SENSITIVITY[s]).status;
  assert.equal(at('sensitive'), 1);
  assert.equal(at('standard'), 1);
  assert.equal(at('conservative'), 0);
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
