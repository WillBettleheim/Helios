/*
 * HELIOS feature — communications blackout (autonomy) mode.
 * Simulates a loss of contact with Earth, such as the ~2-week Mars solar conjunction.
 * Ground escalations are re-routed to the Crew Medical Officer, reports queue until contact
 * returns, and a banner keeps the crew aware they are on their own.
 */
window.H = window.H || {};
(H.features = H.features || []).push(function (app) {
  'use strict';
  const { store } = app;
  const T = app.T;

  function start(days) {
    store.blackout = { since: Date.now(), until: Date.now() + days * 86400000, days, reason: days >= 10 ? 'Solar conjunction' : 'Loss of signal' };
    app.log(`Communications blackout started: ${store.blackout.reason}, ${days} days`, 'comms');
    app.render();
  }
  function end() {
    if (!store.blackout) return;
    const queued = store.queue.length;
    store.blackout = null;
    app.log('Communications restored', 'comms');
    app.toast(`Contact restored. ${queued} queued item${queued === 1 ? '' : 's'} will go out in the next downlink.`);
    app.render();
  }

  H.bus.on('slot:overview-top', () => {
    const b = app.blackout();
    if (!b) return '';
    const left = Math.max(0, b.until - Date.now()), d = Math.floor(left / 86400000), h = Math.floor(left / 3600000) % 24;
    return `<div class="banner blackout" role="status"><span class="bo-k">${T('No contact with Earth')}</span>
      <span><b>${b.reason}</b> — ${d} d ${h} h ${T('remaining')}. ${T('Ground escalations go to your Crew Medical Officer; reports are queued')} (${store.queue.length}). ${T('Act on board — HELIOS protocols and triage work offline.')}</span>
      <button class="btn sm" data-action="bo-end">${T('Restore contact')}</button></div>`;
  });

  H.bus.on('slot:overview-side-top', () => app.blackout() ? '' : `<div class="card"><h2 class="ct">📡 ${T('Autonomy drill')}</h2>
    <p class="muted small">${T('Rehearse a solar conjunction: no contact with Earth for two weeks.')}</p>
    <button class="link" data-action="bo-start" data-days="14">${T('Start conjunction blackout')} ${app.ICON.arrow}</button></div>`);

  H.bus.on('action:bo-start', (el) => start(+el.dataset.days || 14));
  H.bus.on('action:bo-end', end);
  H.bus.on('boot', () => { if (store.blackout && store.blackout.until <= Date.now()) store.blackout = null; });
});
