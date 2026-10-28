/*
 * HELIOS — record sanitizer.
 * Everything that reaches the store from outside the app's own forms (older saves, backups,
 * sync bundles) passes through here: unknown keys are dropped, strings are bounded, numbers are
 * coerced and range-checked, dates validated. A malformed file can then neither crash the app
 * nor smuggle markup into the page.
 */
window.H = window.H || {};
(function (H) {
  'use strict';
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  const arr = (x) => (Array.isArray(x) ? x : []);
  const str = (x, n) => (typeof x === 'string' ? x : x == null ? '' : String(x)).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, n);
  const num = (x, lo, hi, d) => { const v = typeof x === 'string' && x.trim() === '' ? NaN : Number(x); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const int = (x, lo, hi, d) => { const v = num(x, lo, hi, d); return v == null ? v : Math.round(v); };
  const iso = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x + 'T00:00:00Z'));
  const hhmm = (x) => typeof x === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x);
  const ids = () => H.INDICATORS.map((i) => i.id);
  const isInd = (k) => ids().includes(k);
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2));
  const perCrew = (o, fn) => Object.fromEntries(Object.entries(obj(o)).filter(([k]) => /^[a-z0-9_-]{1,40}$/i.test(k)).map(([k, v]) => [k, fn(v)]));
  const SYMPTOMS = ['headache', 'vision', 'congestion', 'back', 'nausea', 'rash', 'fatigue', 'dizzy', 'fever', 'chest', 'isolated'];

  function profile(p) {
    if (!p || typeof p !== 'object') return undefined;
    const out = {
      uid: str(p.uid, 40) || uid(), name: str(p.name, 60).trim() || 'Astronaut', role: str(p.role, 40), mission: str(p.mission, 40),
      start: iso(p.start) ? p.start : today(), plannedDays: int(p.plannedDays, 1, 3000, 180), priorDose: num(p.priorDose, 0, 5000, 0),
      sensitivity: H.SENSITIVITY && H.SENSITIVITY[p.sensitivity] ? p.sensitivity : 'standard',
      baseline: {}, rebase: {}, created: num(p.created, 0, 1e15, Date.now()), updated: num(p.updated, 0, 1e15, 0),
    };
    Object.entries(obj(p.baseline)).forEach(([k, v]) => { const x = num(v, -1e6, 1e6, null); if (isInd(k) && x != null) out.baseline[k] = x; });
    Object.entries(obj(p.rebase)).forEach(([k, v]) => { const x = int(v, 1, 100000, null); if (isInd(k) && x != null) out.rebase[k] = x; });
    return out;
  }
  const values = (v) => Object.fromEntries(Object.entries(obj(v)).filter(([k, x]) => isInd(k) && x !== null && num(x, -1e7, 1e7, null) != null).map(([k, x]) => [k, Number(x)]));
  function checkin(c) {
    c = obj(c);
    const vit = {};
    Object.entries(obj(c.vitals)).forEach(([k, x]) => { if (isInd(k)) vit[k] = x === null ? null : num(x, -1e7, 1e7, null); });
    return {
      sleepQ: int(c.sleepQ, 1, 5, 3), mood: num(c.mood, 1, 10, null), energy: num(c.energy, 1, 10, null), stress: num(c.stress, 1, 10, null),
      symptoms: arr(c.symptoms).filter((s) => SYMPTOMS.includes(s)), vitals: vit, notes: str(c.notes, 1000),
      share: c.share === 'private' ? 'private' : 'cmo', t: num(c.t, 0, 1e15, 0),
    };
  }
  const checkins = (o) => Object.fromEntries(Object.entries(obj(o)).filter(([k]) => /^\d{1,5}$/.test(k)).map(([k, v]) => [k, checkin(v)]));
  const pvt = (a) => arr(a).map((t) => ({ day: int(t.day, -1e5, 1e5, 0), ts: num(t.ts, 0, 1e15, 0), mode: int(t.mode, 1, 600, 60), mean: int(t.mean, 0, 10000, 0), median: int(t.median, 0, 10000, 0), lapses: int(t.lapses, 0, 1e4, 0), falseStarts: int(t.falseStarts, 0, 1e4, 0), n: int(t.n, 0, 1e4, 0) }));
  const labs = (a) => arr(a).filter((d) => iso(obj(d).date)).map((d) => ({ id: str(d.id, 40) || uid(), date: d.date, kind: d.kind === 'pre' ? 'pre' : 'post', source: str(d.source, 80),
    values: Object.fromEntries(Object.entries(obj(d.values)).filter(([k, x]) => /^(cbc|cmp):[A-Z0-9 ;/().,-]{1,60}$/i.test(k) && num(x, -1e7, 1e7, null) != null).map(([k, x]) => [k, Number(x)])) }));
  const cog = (a) => arr(a).filter((r) => ['span', 'math'].includes(obj(r).test)).map((r) => ({ test: r.test, day: int(r.day, -1e5, 1e5, 0), ts: num(r.ts, 0, 1e15, 0),
    ...(r.test === 'span' ? { span: int(r.span, 0, 30, 0) } : { throughput: int(r.throughput, 0, 500, 0), accuracy: int(r.accuracy, 0, 100, 0), rt: int(r.rt, 0, 60000, 0) }) }));
  const outcomes = (a) => arr(a).map((o) => ({ protocol: str(o.protocol, 20), day: int(o.day, -1e5, 1e5, 0), ts: num(o.ts, 0, 1e15, 0), steps: int(o.steps, 0, 100, 0), total: int(o.total, 0, 100, 0),
    before: Object.fromEntries(Object.entries(obj(o.before)).filter(([k, x]) => isInd(k) && num(x, -1e7, 1e7, null) != null).map(([k, x]) => [k, Number(x)])) }));
  const medlog = (a) => arr(a).map((l) => ({ name: str(l.name, 80), day: int(l.day, -1e5, 1e5, 0), t: num(l.t, 0, 1e15, 0) }));
  const medkit = (a) => (Array.isArray(a) ? a.map((i) => ({ name: str(i.name, 80), use: str(i.use, 80), qty: int(i.qty, 0, 1e5, 0), start: int(i.start, 1, 1e5, 1), exp: int(i.exp, 0, 1e5, 0), rad: !!i.rad, rx: !!i.rx, updated: num(i.updated, 0, 1e15, 0) })) : undefined);
  const planner = (p) => { p = obj(p); return { wake: hhmm(p.wake) ? p.wake : '06:30', sleepH: num(p.sleepH, 5, 11, 8.5), critical: hhmm(p.critical) ? p.critical : '' }; };
  const records = (r) => Object.fromEntries(Object.entries(obj(r)).filter(([d]) => iso(d)).map(([d, v]) => [d, Object.fromEntries(Object.entries(values(v)).filter(([k]) => H.LOGGABLE.includes(k)))]));

  function store(s) {
    s = obj(s);
    const prefs = obj(s.prefs), sync = obj(prefs.sync), sw = obj(s.spaceWeather);
    const out = {
      v: 1,
      checkins: perCrew(s.checkins, checkins),
      pvt: perCrew(s.pvt, pvt),
      log: arr(s.log).slice(0, 200).map((l) => ({ t: num(l.t, 0, 1e15, 0), day: int(l.day, -1e5, 1e5, 0), crew: str(l.crew, 40), text: str(l.text, 300), kind: str(l.kind, 20) })),
      steps: perCrew(s.steps, (o) => Object.fromEntries(Object.entries(obj(o)).map(([k, v]) => [str(k, 20), arr(v).map((x) => int(x, 0, 100, 0))]))),
      acks: perCrew(s.acks, (o) => Object.fromEntries(Object.entries(obj(o)).map(([k, v]) => [str(k, 40), int(v, -1e5, 1e5, 0)]))),
      queue: arr(s.queue).map((q) => ({ day: int(q.day, -1e5, 1e5, 0), title: str(q.title, 200), kb: num(q.kb, 0, 1e5, 0), crewName: str(q.crewName, 60), t: num(q.t, 0, 1e15, 0) })),
      prefs: { glove: !!prefs.glove, toured: !!prefs.toured, autoLockMin: int(prefs.autoLockMin, 1, 240, 10), lastSync: str(prefs.lastSync, 120),
        termsVersion: str(prefs.termsVersion, 10), termsAt: num(prefs.termsAt, 0, 1e15, 0),
        sync: { url: str(sync.url, 200) || 'http://localhost:8787', device: str(sync.device, 40) || 'Tablet-1', delay: !!sync.delay } },
    };
    const p = profile(s.profile);
    if (p) out.profile = p;
    if (s.personal) out.personal = { records: records(obj(s.personal).records) };
    if (s.labs) out.labs = perCrew(s.labs, labs);
    if (s.cog) out.cog = perCrew(s.cog, cog);
    if (s.outcomes) out.outcomes = perCrew(s.outcomes, outcomes);
    if (s.medlog) out.medlog = perCrew(s.medlog, medlog);
    if (s.planner) out.planner = perCrew(s.planner, planner);
    const mk = medkit(s.medkit);
    if (mk) out.medkit = mk;
    if (s.spaceWeather) {
      out.spaceWeather = { state: ['quiet', 'warning', 'shelter'].includes(sw.state) ? sw.state : 'quiet', arrival: num(sw.arrival, 0, 1e15, 0), shelteredAt: num(sw.shelteredAt, 0, 1e15, 0), minimised: !!sw.minimised,
        events: arr(sw.events).map((e) => ({ day: int(e.day, -1e5, 1e5, 0), hours: num(e.hours, 0, 1e4, 0), dose: num(e.dose, 0, 1e4, 0), avoided: num(e.avoided, 0, 1e4, 0), crew: str(e.crew, 40) })) };
    }
    return out;
  }

  H.sanitize = { store, profile, checkin, labs, records, uid };
})(window.H);
