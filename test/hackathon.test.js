'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, fakeApp } = require('./_helpers');

function setup(files, over = {}) {
  const H = load('js/data.js', 'js/engine.js', 'js/protocols.js', 'js/sanitize.js', ...files);
  const ds = H.buildDataset({ checkins: {}, pvt: {} });
  const A = {};
  H.CREW.forEach((c) => { A[c.id] = H.assessCrew(c, ds, null); });
  const app = fakeApp(H, Object.assign({
    store: { checkins: {}, pvt: {}, queue: [], log: [] }, ui: { crewId: 'nakamura' }, M: { day: 147, plannedDays: 400, startISO: '2026-06-04' },
    data: () => ds, me: () => A.nakamura, assessments: () => A, todayCheckin: () => null, dayDate: (d) => H.dayToDate(d), dayFor: () => 147,
  }, over));
  (H.features || []).forEach((f) => f(app));
  return { H, app, A };
}

test('replay: problems are flagged no later than the fixed limit, and most never cross it', () => {
  const { H } = setup(['js/features/replay.js']);
  const h = H.replay.history('nakamura');
  assert.ok(h.leads.length >= 6, `only ${h.leads.length} problems`);
  h.leads.filter((l) => l.lead != null).forEach((l) => assert.ok(l.lead >= 0, `${l.ind.id} flagged after the limit`));
  assert.ok(h.leads.some((l) => l.hasLimit && l.limit == null), 'some problems never cross a fixed limit');
  assert.equal(H.replay.history('lindqvist').leads.length, 0, 'healthy crew member: nothing flagged');
  const reyes = H.replay.history('reyes').leads.find((l) => l.ind.id === 'sbp');
  assert.ok(reyes.lead >= 14, `BP lead ${reyes.lead}`);
});

test('eva: verdict follows the worst check and reasons are given', () => {
  const { H, app } = setup(['js/features/medkit.js', 'js/features/eva.js']);
  const checks = H.eva.checks();
  assert.ok(checks.length >= 8);
  assert.ok(checks.every((c) => c.name && c.detail && c.level >= 0 && c.level <= 2));
  assert.equal(checks.find((c) => c.name === 'Symptoms').level, 1, 'no check-in today → caution');
  app.store.spaceWeather = { state: 'warning' };
  assert.equal(H.eva.checks().find((c) => c.name === 'Space weather').level, 2, 'SPE warning → no-go');
});

test('live: Bluetooth heart-rate packets are parsed per the GATT spec', () => {
  const { H } = setup(['js/features/live.js']);
  // flags 0x10 (RR present, 8-bit HR), HR 72, RR 1024/1024 s and 840/1024 s
  const dv = new DataView(new Uint8Array([0x10, 72, 0x00, 0x04, 0x48, 0x03]).buffer);
  const p = H.live.parseHRM(dv);
  assert.equal(p.hr, 72);
  assert.deepEqual(p.rr.map(Math.round), [1000, 820]);
  // 16-bit HR flag
  assert.equal(H.live.parseHRM(new DataView(new Uint8Array([0x01, 0x2c, 0x01]).buffer)).hr, 300);
});

test('live: RMSSD matches a hand calculation and ignores artefacts', () => {
  const { H } = setup(['js/features/live.js']);
  const rr = [800, 810, 790, 805, 795, 800, 812, 798, 803, 797, 801];
  let s = 0; for (let i = 1; i < rr.length; i++) s += (rr[i] - rr[i - 1]) ** 2;
  assert.ok(Math.abs(H.live.rmssd(rr) - Math.sqrt(s / (rr.length - 1))) < 1e-9);
  assert.ok(H.live.rmssd(rr.concat([1600])) < 20, 'a 2x jump (missed beat) is dropped');
  assert.equal(H.live.rmssd([800, 810]), null, 'too few beats');
});

test('fhir: bundle has a patient, coded observations and detected issues', () => {
  const { H } = setup(['js/features/fhir.js']);
  const b = H.fhir.bundle();
  assert.equal(b.resourceType, 'Bundle');
  const types = b.entry.map((e) => e.resource.resourceType);
  assert.equal(types.filter((t) => t === 'Patient').length, 1);
  assert.ok(types.filter((t) => t === 'Observation').length > 15);
  assert.ok(types.includes('DetectedIssue'));
  const rhr = b.entry.map((e) => e.resource).find((r) => r.code && r.code.coding[0].code === '40443-4');
  assert.equal(rhr.valueQuantity.code, '/min');
  const pid = b.entry[0].fullUrl;
  assert.ok(b.entry.filter((e) => e.resource.resourceType === 'Observation').every((e) => e.resource.subject.reference === pid));
  assert.ok(b.entry.every((e) => e.fullUrl === `urn:uuid:${e.resource.id}`));
});

test('medkit: forecast flags items that run out before mission end', () => {
  const { H, app } = setup(['js/features/medkit.js']);
  const kit = H.medkit.kit();
  const vitD = kit.find((i) => i.name === 'Vitamin D 800 IU');
  const f = H.medkit.forecast(vitD);
  assert.ok(f.short, 'vitamin D at 4/day runs out early');
  assert.equal(f.out, 147 + 100);
  const aspirin = H.medkit.forecast(kit.find((i) => i.name === 'Aspirin 325 mg'));
  assert.equal(aspirin.short, false);
  // Heavy actual use raises the forecast rate above the plan.
  app.store.medlog = { nakamura: Array.from({ length: 30 }, () => ({ name: 'Aspirin 325 mg', t: Date.now() })) };
  assert.ok(H.medkit.forecast(kit.find((i) => i.name === 'Aspirin 325 mg')).observed);
});

test('sanitizer: cohesion answers, journal and blackout survive; junk does not', () => {
  const { H } = setup([]);
  const s = H.sanitize.store({
    checkins: { me: { 4: { social: 3, talks: '2', symptoms: [] } } },
    journal: { me: { 4: 'feeling far from home', x: 'bad key' } },
    blackout: { since: 1, until: 9e12, days: 14, reason: 'Solar conjunction' },
  });
  assert.equal(s.checkins.me[4].social, 3);
  assert.equal(s.checkins.me[4].talks, 2);
  assert.deepEqual(s.journal.me, { 4: 'feeling far from home' });
  assert.equal(s.blackout.reason, 'Solar conjunction');
});
