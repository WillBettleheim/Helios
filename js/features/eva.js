/*
 * HELIOS feature — EVA (spacewalk) readiness: a go / caution / no-go check that combines the
 * astronaut's own data with crew-wide state, says why, and says what would change the verdict.
 * Decision support only — the flight surgeon and commander make the call.
 */
window.H = window.H || {};
(H.features = H.features || []).push(function (app) {
  'use strict';
  const { esc, store } = app;
  const T = app.T;
  const VERDICT = [['GO', 'nominal'], ['CAUTION', 'monitor'], ['NO-GO', 'urgent']];

  app.addIcon('eva', '<circle cx="12" cy="7" r="4"/><path d="M8 7h8M6 21v-5a6 6 0 0112 0v5"/><path d="M9 16h6"/>');
  app.addView({ id: 'eva', label: 'EVA readiness', short: 'EVA', group: 'act', icon: 'eva', render });

  function checks() {
    const a = app.me(), id = app.ui.crewId, day = app.M.day, inds = a.inds;
    const ci = app.todayCheckin(id), sym = (s) => !!(ci && ci.symptoms.includes(s));
    const out = [];
    const add = (name, level, detail, fix) => out.push({ name, level, detail, fix });

    // Alertness: a PVT within the last day, judged against the person's baseline.
    const pvtToday = (store.pvt[id] || []).some((t) => t.day >= day - 1);
    const pvt = inds.pvt;
    if (!pvtToday && pvt.latestDay !== day) add('Alertness (PVT)', 1, 'No alertness test in the last 24 h.', 'Take the alertness test.');
    else add('Alertness (PVT)', pvt.status >= 2 ? 2 : pvt.status, `${H.fmt(pvt.current, 0)} ms${pvt.z != null ? ` (${pvt.z > 0 ? '+' : ''}${pvt.z.toFixed(1)} SD)` : ''}.`, pvt.status ? 'Recovery sleep, then re-test.' : '');

    // Sleep debt over 3 nights.
    const sr = app.data().crew[id].series.sleep, base = inds.sleep.base && inds.sleep.base.mean != null ? inds.sleep.base.mean : 7.5;
    let debt = 0;
    for (let d = day - 2; d <= day; d++) if (d >= 1 && sr[d] != null) debt += Math.max(0, base - sr[d]);
    add('Sleep debt (3 nights)', debt > 2.5 ? 2 : debt > 1 ? 1 : 0, `${debt.toFixed(1)} h below your ${base.toFixed(1)} h normal.`, debt > 1 ? 'Protect a full sleep period before EVA.' : '');

    // Symptoms reported today.
    if (!ci) add('Symptoms', 1, 'No check-in today.', 'Complete the daily check-in.');
    else {
      const stop = ['chest', 'dizzy', 'vision', 'fever'].filter(sym), slow = ['headache', 'nausea', 'fatigue', 'congestion'].filter(sym);
      add('Symptoms', stop.length ? 2 : slow.length ? 1 : 0, stop.length || slow.length ? `Reported: ${stop.concat(slow).join(', ')}.` : 'None reported.',
        stop.length ? 'CMO assessment required.' : slow.length ? 'Discuss with the CMO (congestion affects ear clearing during pressure changes).' : '');
    }

    const dom = (did) => a.domains.find((d) => d.id === did).status;
    add('Cardiovascular', Math.min(2, dom('cardio')), `Resting HR ${H.fmt(inds.rhr.current, 0)} bpm, BP ${H.fmt(inds.sbp.current, 0)} mmHg.`, dom('cardio') ? 'Resting ECG and CMO review.' : '');
    add('Infection / fever', Math.min(2, Math.max(inds.temp.status, inds.crp.status >= 2 ? 1 : 0)), `Core temperature ${H.fmt(inds.temp.current, 1)} °C.`, inds.temp.status ? 'Re-measure; CMO review.' : '');
    add('Hydration', Math.min(1, inds.fluid.status), `Fluid ${H.fmt(inds.fluid.current, 1)} L/day.`, inds.fluid.status ? 'Pre-hydrate 500 mL before suit-up.' : '');

    // Space weather and dose.
    const sw = store.spaceWeather || { state: 'quiet' };
    add('Space weather', sw.state !== 'quiet' ? 2 : inds.dose.status >= 1 ? 2 : 0, sw.state !== 'quiet' ? 'Solar particle event warning active.' : `Background ${H.fmt(inds.dose.current, 2)} mSv/day.`, sw.state !== 'quiet' ? 'No EVA until the all-clear.' : '');
    add('Career dose', inds.cumdose.status >= 2 ? 2 : inds.cumdose.status, inds.cumdose.noData ? 'No dosimetry logged.' : `${H.fmt(inds.cumdose.current, 0)} mSv of ${H.MISSION.careerLimit}.`, inds.cumdose.status ? 'Dosimetry review before adding EVA dose.' : '');

    // Emergency kit for the airlock.
    const kit = H.medkit ? ['AED pads', 'Epinephrine auto-injector 0.3 mg'].map(H.medkit.find).filter(Boolean) : [];
    const kitBad = kit.filter((i) => !i.qty || i.exp <= day);
    add('Airlock medical kit', kitBad.length ? 1 : 0, kitBad.length ? `Unavailable: ${kitBad.map((i) => i.name).join(', ')}.` : 'AED and epinephrine available.', kitBad.length ? 'Restock before EVA.' : '');
    return out;
  }

  function render() {
    const c = app.me().crew, list = checks();
    const verdict = Math.max(...list.map((x) => x.level));
    const [label, lvl] = VERDICT[verdict];
    const order = list.slice().sort((x, y) => y.level - x.level);
    return `<div class="page-head"><div><p class="eyebrow">${T('EVA readiness')} · ${esc(c.name)} · ${T('Mission day')} ${app.M.day}</p><h1>${T('Am I fit for a spacewalk today?')}</h1>
      <p class="lede">Combines your own alertness, sleep, symptoms and vitals with crew-wide space weather and kit status. Decision support only — the flight surgeon and commander make the call.</p></div></div>
      <section class="eva-verdict lvl-${lvl}">
        <div class="eva-light" aria-hidden="true"></div>
        <div><span class="eyebrow">${T('Recommendation')}</span><div class="eva-word mono">${label}</div>
          <p>${verdict === 0 ? 'All checks are within your normal range.' : `${list.filter((x) => x.level === verdict).length} check${list.filter((x) => x.level === verdict).length > 1 ? 's' : ''} ${verdict === 2 ? 'rule out EVA today' : 'need attention before EVA'}.`}</p></div>
        <div class="btns"><button class="btn" data-action="eva-log" data-v="${label}">${T('Log decision')}</button><button class="btn" data-action="eva-ground">${T('Send to flight surgeon')}</button></div>
      </section>
      <div class="card"><ul class="eva-list">${order.map((x) => `<li class="lvl-${VERDICT[x.level][1]}"><i class="dot"></i><b>${esc(T(x.name))}</b><span>${esc(x.detail)}</span>${x.fix ? `<small>${esc(x.fix)}</small>` : ''}<span class="eva-tag">${VERDICT[x.level][0]}</span></li>`).join('')}</ul></div>`;
  }

  H.bus.on('action:eva-log', (el) => { app.log(`EVA readiness: ${el.dataset.v}`, 'eva'); app.toast(`EVA readiness (${el.dataset.v}) logged.`); });
  H.bus.on('action:eva-ground', () => {
    const list = checks(), v = VERDICT[Math.max(...list.map((x) => x.level))][0];
    store.queue.push({ day: app.M.day, title: `EVA readiness ${v} — ${app.me().crew.name}`, kb: 2, crewName: app.me().crew.name, t: Date.now() });
    app.log(`EVA readiness ${v} queued for flight surgeon`, 'eva'); app.toast('Queued for the flight surgeon.'); app.render();
  });

  H.eva = { checks };
});
