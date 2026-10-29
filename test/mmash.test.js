'use strict';
/*
 * Real wearable data: PhysioNet MMASH (ODbL). The dataset tests run only when the data has been
 * fetched with `node tools/fetch-mmash.js`; the unit tests below always run.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load, fakeApp } = require('./_helpers');

function live() {
  const H = load('js/data.js', 'js/engine.js', 'js/sanitize.js', 'js/features/live.js', 'js/features/wearables.js');
  const app = fakeApp(H); H.features.forEach((f) => f(app));
  return H;
}

test('HRV: one artefact does not also reject the good beat after it', () => {
  const H = live();
  const rr = [800, 810, 790, 805, 795, 1600, 800, 812, 798, 803, 797, 801, 806, 799];
  const ok = H.live.validBeats(rr);
  assert.equal(ok[5], false, 'the 1600 ms artefact is rejected');
  assert.equal(ok[6], true, 'the normal beat after it is kept');
  // RMSSD uses adjacent valid pairs only: the jump into and out of the artefact is never counted.
  const clean = rr.filter((_, i) => i !== 5);
  let s = 0, n = 0;
  for (let i = 1; i < rr.length; i++) if (ok[i] && ok[i - 1]) { s += (rr[i] - rr[i - 1]) ** 2; n++; }
  assert.ok(Math.abs(H.live.rmssd(rr) - Math.sqrt(s / n)) < 1e-9);
  assert.ok(H.live.rmssd(rr) < 15, 'not inflated by the artefact');
  assert.ok(clean.length === 13);
});

test('HRV: a recording with too many artefacts reports no value instead of a wrong one', () => {
  const H = live();
  const noisy = Array.from({ length: 60 }, (_, i) => (i % 3 === 0 ? 400 + (i % 7) * 150 : 800 + (i % 5)));
  assert.ok(H.live.quality(noisy) < 0.8);
  assert.equal(H.live.rmssd(noisy), null);
});

test('import: bare numbers are not dates, and day-numbered files are detected', () => {
  const H = live();
  assert.equal(H.wearables.parseDate('2'), null);
  assert.equal(H.wearables.parseDate('45123'), null, 'spreadsheet serial numbers are not silently converted');
  const c = H.wearables.prepareCsv('s.csv', 'Night,Total Sleep Time (TST)\n1,420\n2,380\n2,40\n');
  assert.equal(c.dayNumbers, true);
  c.dayOne = '2026-03-01';
  const r = H.wearables.importCsvMapped(c);
  assert.deepEqual(Object.keys(r.byDate).sort(), ['2026-03-01', '2026-03-02']);
  assert.equal(r.byDate['2026-03-02'].sleep, 7, 'split nights are summed (380 + 40 min)');
});

const DIR = path.join(__dirname, '..', 'data', 'mmash', 'extracted', 'DataPaper');
const have = fs.existsSync(DIR);

test('MMASH: HELIOS HRV agrees with a reference on real recordings', { skip: !have && 'run node tools/fetch-mmash.js' }, () => {
  const { summary } = require('../tools/mmash-check.js');
  assert.ok(summary.analysed >= 18, `analysed ${summary.analysed}`);
  assert.equal(summary.packetRoundTripMaxErrorMs < 1, true, 'Bluetooth packet round trip within 1/1024 s');
  assert.ok(summary.rmssd.correlation > 0.95, `r = ${summary.rmssd.correlation}`);
  assert.ok(summary.rmssd.meanAbsDiffMs < 2.5, `mean |diff| ${summary.rmssd.meanAbsDiffMs} ms`);
  assert.ok(summary.hrvQualityGate.some((x) => x.startsWith('user_4 ')), 'the noisy recording is flagged');
  assert.ok(summary.restingHR.strapVsActigraphMedianAbsDiff <= 1, 'strap and actigraph heart rate agree');
});

test('MMASH: every real sleep file imports with the right hours', { skip: !have && 'run node tools/fetch-mmash.js' }, () => {
  const { summary } = require('../tools/mmash-check.js');
  assert.equal(summary.importer.importedCorrectly, 21);
  assert.equal(summary.importer.emptyFileRejectedCleanly, 1);
});
