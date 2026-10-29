'use strict';
// Real multi-week data (PMData, CC BY 4.0). Runs when fetched with `node tools/fetch-pmdata.js`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const have = fs.existsSync(path.join(__dirname, '..', 'data', 'pmdata', 'p01'));

test('PMData: v3 alerts far less than v1 on 16 real people over ~4 months', { skip: !have && 'run node tools/fetch-pmdata.js' }, () => {
  const { summary } = require('../tools/pmdata-check.js');
  assert.equal(summary.people, 16);
  assert.ok(summary.v3.alertsPerPersonMonth < 0.5 * summary.v1.alertsPerPersonMonth, JSON.stringify([summary.v1, summary.v3]));
  assert.ok(summary.v3.alertTimePct < 0.3 * summary.v1.alertTimePct);
  assert.ok(summary.v3.alertTimePct < 10, `v3 alert time ${summary.v3.alertTimePct}%`);
  assert.ok(summary.perIndicatorAlertPct.v3.exer < 10, 'exercise prescription no longer flags ordinary people');
});
