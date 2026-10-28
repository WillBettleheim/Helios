'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, fakeApp } = require('./_helpers');

function setup(file, extraFiles = []) {
  const H = load('js/data.js', 'js/engine.js', 'js/protocols.js', 'js/sanitize.js', ...extraFiles, file);
  const app = fakeApp(H);
  H.features.forEach((f) => f(app));
  return { H, app };
}

test('lab model: day-after-landing draws score above recovery draws', () => {
  const { H } = setup('js/features/labs.js', ['js/lab-model.js']);
  let higher = 0;
  for (const ex of H.LABMODEL.examples) {
    const draws = ex.draws.map((d) => ({ ...d, date: d.t }));
    const r1 = H.labs.score(draws.find((d) => d.t === 'R+1'), draws);
    const rec = ['R+45', 'R+82', 'R+194'].map((t) => H.labs.score(draws.find((d) => d.t === t), draws).value);
    assert.ok(r1.value >= 0 && r1.value <= 100);
    if (r1.value > Math.max(...rec)) higher++;
  }
  // Trained on these same four people, so this checks wiring, not accuracy.
  assert.ok(higher >= 3, `R+1 highest for only ${higher}/4`);
});

test('lab model needs a preflight draw', () => {
  const { H } = setup('js/features/labs.js', ['js/lab-model.js']);
  assert.equal(H.labs.score({ kind: 'post', values: {} }, [{ kind: 'post', values: {} }]), null);
});

test('wearables: CSV parsing handles quotes and separators', () => {
  const { H } = setup('js/features/wearables.js');
  const rows = H.wearables.parseCsv('date,"Resting Heart Rate",note\n2026-01-02,58,"a, b"\n');
  assert.deepEqual(rows[1], ['2026-01-02', '58', 'a, b']);
});

test('wearables: dates and units are recognised', () => {
  const { H } = setup('js/features/wearables.js');
  const W = H.wearables;
  assert.equal(W.parseDate('2026-3-7'), '2026-03-07');
  assert.equal(W.parseDate('03/07/2026'), '2026-03-07');
  assert.equal(W.parseDate('03/07/2026', 'dmy'), '2026-07-03');
  assert.equal(W.parseDate('31/12/2024', 'mdy'), null, 'impossible month rejected, not stored');
  assert.equal(W.detectOrder(['05/03/2024', '31/12/2024']), 'dmy');
  assert.equal(W.guessUnit('sleep', [420, 380, 450]), 'min');
  assert.equal(W.guessUnit('sleep', [7.1, 6.5]), 'h');
  assert.equal(W.guessUnit('temp', [98.2, 98.6]), 'f');
  const c = W.prepareCsv('x.csv', 'Date,Resting Heart Rate,Minutes Asleep\n2026-01-01,57,430\n');
  assert.equal(c.dateCol, 0);
  assert.equal(c.map.rhr.col, 1);
  assert.equal(c.map.sleep.unit, 'min');
});

test('wearables: Apple Health export is aggregated per day', async () => {
  const { H } = setup('js/features/wearables.js');
  const xml = `<HealthData>
    <Record type="HKQuantityTypeIdentifierRestingHeartRate" unit="count/min" startDate="2026-01-01 07:00:00 +0000" endDate="2026-01-01 07:00:00 +0000" value="56"/>
    <Record type="HKQuantityTypeIdentifierRestingHeartRate" unit="count/min" startDate="2026-01-01 19:00:00 +0000" endDate="2026-01-01 19:00:00 +0000" value="60"/>
    <Record type="HKQuantityTypeIdentifierBodyMass" unit="lb" startDate="2026-01-01 08:00:00 +0000" endDate="2026-01-01 08:00:00 +0000" value="160"/>
    <Record type="HKQuantityTypeIdentifierAppleExerciseTime" unit="min" startDate="2026-01-01 09:00:00 +0000" endDate="2026-01-01 09:30:00 +0000" value="30"/>
    <Record type="HKQuantityTypeIdentifierAppleExerciseTime" unit="min" startDate="2026-01-01 18:00:00 +0000" endDate="2026-01-01 18:15:00 +0000" value="15"/>
    <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" startDate="2026-01-01 23:00:00 +0000" endDate="2026-01-02 06:30:00 +0000" value="HKCategoryValueSleepAnalysisAsleepCore"/>
    <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="iPhone" startDate="2026-01-01 23:30:00 +0000" endDate="2026-01-02 06:30:00 +0000" value="HKCategoryValueSleepAnalysisAsleepUnspecified"/>
    <Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="2026-01-01 22:30:00 +0000" endDate="2026-01-02 07:00:00 +0000" value="HKCategoryValueSleepAnalysisInBed"/>
  </HealthData>`;
  const r = await H.wearables.parseApple(new Blob([xml]), () => {});
  assert.equal(r.byDate['2026-01-01'].rhr, 58);                     // mean
  assert.equal(r.byDate['2026-01-01'].exer, 45);                    // sum
  assert.ok(Math.abs(r.byDate['2026-01-01'].mass - 72.575) < 0.01); // lb → kg
  assert.equal(r.byDate['2026-01-02'].sleep, 7.5);                  // asleep only, in-bed ignored, watch+phone not double-counted
});

test('sync: same person merges per record; a crewmate is never merged in', () => {
  const H = load('js/data.js', 'js/engine.js', 'js/protocols.js', 'js/sanitize.js', 'js/features/settings.js');
  const store = { profile: { uid: 'u-1', name: 'Joe', updated: 1 }, personal: { records: { '2026-01-01': { rhr: 60 } } },
    checkins: { me: { 3: { mood: 5, t: 10, symptoms: [] } } }, medkit: [{ name: 'Aspirin', qty: 30, updated: 5 }] };
  const app = fakeApp(H, { store });
  H.features.forEach((f) => f(app));
  const remote = { profile: { uid: 'u-1', name: 'Joe', updated: 0 }, personal: { records: { '2026-01-02': { rhr: 61 } } },
    checkins: { 3: { mood: 8, t: 20, symptoms: ['headache'] }, 4: { mood: 6, t: 30, symptoms: [] } }, pvt: [{ ts: 1, mean: 300 }] };
  H.sync.mergePerson(store.profile, remote);
  assert.deepEqual(Object.keys(store.personal.records).sort(), ['2026-01-01', '2026-01-02']);
  assert.equal(store.checkins.me[3].mood, 8, 'newer check-in wins whole, no hybrid');
  assert.deepEqual(store.checkins.me[3].symptoms, ['headache']);
  assert.equal(store.pvt.me.length, 1);
  H.sync.mergePerson(store.profile, remote);
  assert.equal(store.pvt.me.length, 1, 'idempotent');
  H.sync.mergeKit([{ name: 'Aspirin', qty: 29, updated: 9 }, { name: 'Aspirin', qty: 99, updated: 1 }]);
  assert.equal(store.medkit.length, 1, 'no duplicates');
  assert.equal(store.medkit[0].qty, 29, 'latest update wins');
});

test('sync: channel id is a slow PBKDF2 derivation, not a bare hash', async () => {
  const H = load('js/data.js', 'js/engine.js', 'js/protocols.js', 'js/sanitize.js', 'js/features/settings.js');
  const app = fakeApp(H); H.features.forEach((f) => f(app));
  const t0 = Date.now(); const a = await H.sync.channel('correct horse battery'); const ms = Date.now() - t0;
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.equal(await H.sync.channel('correct horse battery'), a);
  assert.notEqual(await H.sync.channel('correct horse batterz'), a);
  assert.ok(ms > 20, `derivation suspiciously fast (${ms} ms)`);
});

test('sanitizer: hostile or malformed data is neutralised', () => {
  const H = load('js/data.js', 'js/engine.js', 'js/sanitize.js');
  const s = H.sanitize.store({
    profile: { name: '<img src=x onerror=alert(1)>', role: 42, start: 'x', plannedDays: 'NaN', baseline: { rhr: '61', evil: 1, hrv: 'abc' }, sensitivity: 'nope' },
    checkins: { me: { 3: { mood: 99, symptoms: ['headache', '<script>'], vitals: { rhr: '70', bogus: 1 } }, x: {} } },
    medkit: [{ name: 'A', qty: '<b>5</b>', start: -3 }],
    queue: [{ day: '<i>', title: 't', kb: 'x' }], log: new Array(500).fill({ text: 'a' }),
  });
  assert.match(s.profile.start, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(s.profile.plannedDays, 180);
  assert.equal(s.profile.role, '42');
  assert.deepEqual(s.profile.baseline, { rhr: 61 });
  assert.equal(s.profile.sensitivity, 'standard');
  assert.ok(s.profile.uid, 'gets a stable id');
  assert.equal(s.checkins.me[3].mood, 10);
  assert.deepEqual(s.checkins.me[3].symptoms, ['headache']);
  assert.deepEqual(s.checkins.me[3].vitals, { rhr: 70 });
  assert.equal(s.checkins.me.x, undefined);
  assert.equal(s.medkit[0].qty, 0);
  assert.equal(s.medkit[0].start, 1);
  assert.equal(s.queue[0].day, 0);
  assert.equal(s.log.length, 200);
  // A sanitised hostile profile can be computed without throwing.
  assert.doesNotThrow(() => H.personalBaselines(s.profile, H.buildPersonal(s.profile, s)));
});

test('outcomes: improvement is measured in the healthy direction', () => {
  const { H } = setup('js/features/outcomes.js');
  const series = { sleep: new Array(20).fill(null) };
  for (let d = 1; d <= 10; d++) series.sleep[d] = 5.8;
  for (let d = 12; d <= 17; d++) series.sleep[d] = 7.2;
  const ind = H.INDICATORS.find((i) => i.id === 'sleep');
  const a = { inds: { sleep: { ind, base: { mean: 7.2, sd: 0.45 } } } };
  const o = { day: 10, before: { sleep: 5.8 } };
  assert.equal(H.outcomes.evaluate(o, a, series, 11).state, 'pending');
  const r = H.outcomes.evaluate(o, a, series, 18);
  assert.equal(r.state, 'better');
  series.sleep.fill(5.0, 12, 18);
  assert.equal(H.outcomes.evaluate(o, a, series, 18).state, 'worse');
});

test('cognition: math items never equal 5', () => {
  const { H } = setup('js/features/cognition.js');
  for (let i = 0; i < 500; i++) {
    const it = H.cognition.makeItem();
    const v = Function(`return ${it.text.replace(/−/g, '-')}`)();
    assert.notEqual(v, 5);
    assert.equal(it.gt, v > 5);
  }
});

test('triage: every guide path ends in an outcome', () => {
  const { H } = setup('js/features/triage.js');
  for (const g of H.triage.GUIDES) {
    const walk = (id, depth) => {
      assert.ok(depth < 10, 'cycle');
      const n = g.nodes[id];
      assert.ok(n, `${g.id}: missing node ${id}`);
      if (n.q) { walk(n.yes, depth + 1); walk(n.no, depth + 1); } else assert.ok(n.steps.length && n.level >= 0);
    };
    walk(g.start, 0);
  }
});
