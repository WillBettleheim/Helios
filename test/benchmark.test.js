'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

// Guards the detector-v2 result on randomized simulated people the tuning never saw.
test('benchmark: detector v2 keeps detection while cutting false alarms by more than half', () => {
  const B = require('../tools/benchmark.js');
  const seeds = Array.from({ length: 80 }, (_, i) => 1001 + i);
  const r = B.run(seeds, ['v1: original daily engine', 'HELIOS engine (as shipped, v3)']);
  const v1 = r['v1: original daily engine'], v2 = r['HELIOS engine (as shipped, v3)'];
  assert.ok(v2.sensitivity >= v1.sensitivity - 0.03, `sensitivity ${v2.sensitivity} vs ${v1.sensitivity}`);
  assert.ok(v2.falseAlarmsPerPersonMonth < 0.5 * v1.falseAlarmsPerPersonMonth, `false alarms ${v2.falseAlarmsPerPersonMonth} vs ${v1.falseAlarmsPerPersonMonth}`);
  assert.ok(v2.medianDelay <= 14, `median delay ${v2.medianDelay} d`);
});
