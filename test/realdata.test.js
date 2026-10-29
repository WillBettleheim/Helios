'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load, fakeApp, isoDays } = require('./_helpers');

test('real data: lab values embedded in the app match NASA OSDR raw files exactly', () => {
  const H = load('js/lab-model.js');
  const parse = (f) => { const [h, ...rows] = fs.readFileSync(path.join(__dirname, '..', 'data', 'osdr', f), 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/); const head = h.split(','); return rows.map((r) => Object.fromEntries(r.split(',').map((v, i) => [head[i], v]))); };
  const raw = {};
  for (const [f, tcol] of [['cbc.csv', 'TEST_DATE'], ['cmp.csv', 'timepoint']]) for (const r of parse(f)) {
    const v = parseFloat(r.VALUE); if (!Number.isFinite(v)) continue;
    ((raw[r.SUBJECT_ID] = raw[r.SUBJECT_ID] || {})[r[tcol]] = raw[r.SUBJECT_ID][r[tcol]] || {})[`${f.slice(0, 3)}:${r.ANALYTE.replace(/ \(FEMALE\)$/, '')}`] = v;
  }
  let n = 0;
  for (const ex of H.LABMODEL.examples) for (const d of ex.draws) for (const f of H.LABMODEL.features) { assert.equal(d.values[f.id], raw[ex.id][d.t][f.id], `${ex.id} ${d.t} ${f.id}`); n++; }
  assert.equal(n, 4 * 7 * H.LABMODEL.features.length);
});

function labs() {
  const H = load('js/data.js', 'js/engine.js', 'js/sanitize.js', 'js/lab-model.js', 'js/features/labs.js');
  const app = fakeApp(H, { store: {}, ui: { crewId: 'me' } });
  H.features.forEach((f) => f(app));
  return { H, app };
}

test('real data: unit mix-ups are detected (glucose in mmol/L instead of mg/dL)', () => {
  const { H } = labs();
  const ex = H.LABMODEL.examples[0].draws[3].values;
  assert.deepEqual(H.labs.unitSuspects(ex), [], 'real values pass');
  const sus = H.labs.unitSuspects({ ...ex, 'cmp:GLUCOSE': 4.6 }).map((f) => f.id);
  assert.deepEqual(sus, ['cmp:GLUCOSE']);
});

test('real data: a sparse panel gets no verdict', () => {
  const { H } = labs();
  const ex = H.LABMODEL.examples[0];
  const pre = ex.draws.filter((d) => d.kind === 'pre');
  const few = { kind: 'post', values: Object.fromEntries(Object.entries(ex.draws[3].values).slice(0, 5)) };
  assert.equal(H.labs.score(few, pre.concat([few])).enough, false);
  assert.equal(H.labs.score(ex.draws[3], ex.draws).enough, true);
});

test('real data: loading an Inspiration4 example never puts draws in the future', () => {
  const { H, app } = labs();
  H.bus.emit('action:lab-load-example');
  const today = isoDays(0);
  const draws = app.store.labs.me;
  assert.equal(draws.length, 4);
  assert.ok(draws.every((d) => d.date <= today), JSON.stringify(draws.map((d) => d.date)));
  assert.equal(draws.find((d) => /R\+1/.test(d.source)).date, today);
});

test('impossible values are rejected as data errors on every entry path', () => {
  const H = load('js/data.js', 'js/engine.js', 'js/sanitize.js');
  const s = H.sanitize.store({
    profile: { name: 'P', start: isoDays(-20), baseline: { rhr: 0, sbp: 120 } },
    personal: { records: { [isoDays(-2)]: { rhr: -5, sleep: 7 }, [isoDays(-1)]: { rhr: 1e6, temp: 98.6 } } },
    checkins: { me: { 3: { vitals: { rhr: 0, sbp: 400, sleep: 7.5 }, symptoms: [] } } },
  });
  assert.deepEqual(s.profile.baseline, { sbp: 120 });
  assert.deepEqual(s.personal.records[isoDays(-2)], { sleep: 7 });
  assert.deepEqual(s.personal.records[isoDays(-1)], {}, '°F temperature and 1e6 bpm dropped');
  assert.equal(s.checkins.me[3].vitals.rhr, null);
  assert.equal(s.checkins.me[3].vitals.sbp, null);
  const cd = H.buildPersonal(s.profile, s);
  assert.ok(cd.series.rhr.every((v) => v == null), 'no impossible heart rate reaches the engine');
});

test('wearable import skips implausible values and reports them', () => {
  const H = load('js/data.js', 'js/engine.js', 'js/sanitize.js', 'js/features/wearables.js');
  const app = fakeApp(H); H.features.forEach((f) => f(app));
  const r = H.wearables.finish({ '2026-01-01': { rhr: [0, 1], sleep: [7, 1] }, '2026-01-02': { rhr: [61, 1] } }, 3);
  assert.equal(r.rejected, 1);
  assert.equal(r.byDate['2026-01-01'].rhr, undefined);
  assert.equal(r.byDate['2026-01-02'].rhr, 61);
});
