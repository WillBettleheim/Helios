/*
 * HELIOS feature — first-run guided tour.
 * Spotlights the parts of the dashboard an astronaut needs on day one. Shown once; can be
 * replayed from Settings or the command palette.
 */
window.H = window.H || {};
(H.features = H.features || []).push(function (app) {
  'use strict';
  const { store, esc } = app;
  const T = app.T;

  const STEPS = [
    { sel: '.hero .ring', title: 'Your readiness', text: `One number for how you are doing today, built from ${H.INDICATORS.length} indicators compared with your own normal — not a population average.` },
    { sel: '.domain-grid', title: `${H.DOMAINS.length} health domains`, text: 'Each card shows its most important indicator and a 30-day trend. Tap one to see the full chart and how it is judged.' },
    { sel: '.insights', title: 'What needs your attention', text: 'Findings combine several signals, explain the evidence, and say what to do now and who to involve.' },
    { sel: '.body-card', title: 'Body status', text: 'The same domains on a body map. Pulsing points need attention.' },
    { sel: '.hero-actions', title: 'Two minutes a day', text: 'A daily check-in and an alertness test keep HELIOS learning what normal looks like for you.' },
    { sel: '[data-action="palette"]', title: 'Jump anywhere', text: 'Press ⌘K, Ctrl+K or / to open any screen, indicator, protocol or crew member.' },
    { sel: '#nav', title: 'Everything else', text: 'Lab panels, triage, medical kit, day planner, cognition tests and settings — including a privacy lock for your data.' },
  ];
  let i = -1, el = null;

  function place() {
    const s = STEPS[i];
    const target = document.querySelector(s.sel);
    if (!target || !target.getClientRects().length) { if (i < STEPS.length - 1) { i++; return place(); } return end(); }
    target.scrollIntoView({ block: 'center', behavior: H.cosmos && H.cosmos.reduced ? 'auto' : 'smooth' });
    setTimeout(() => {
      const r = target.getBoundingClientRect(), pad = 8;
      const spot = el.querySelector('.tour-spot'), card = el.querySelector('.tour-card');
      Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
      card.innerHTML = `<span class="eyebrow">${i + 1} / ${STEPS.length}</span><h3>${esc(T(s.title))}</h3><p>${esc(T(s.text))}</p>
        <div class="btns"><button class="btn ghost sm" data-action="tour-end">${T('Skip')}</button>${i ? `<button class="btn sm" data-action="tour-prev">${T('Back')}</button>` : ''}
        <button class="btn primary sm" data-action="tour-next">${i === STEPS.length - 1 ? T('Done') : T('Next')}</button></div>`;
      const below = r.bottom + 16 + card.offsetHeight < innerHeight;
      const left = Math.min(innerWidth - card.offsetWidth - 16, Math.max(16, r.left));
      Object.assign(card.style, { left: `${left}px`, top: `${below ? r.bottom + 16 : Math.max(16, r.top - card.offsetHeight - 16)}px` });
      card.querySelector('[data-action="tour-next"]').focus();
    }, 260);
  }

  function start() {
    if (el) return;
    if (app.ui.view !== 'overview') app.go('overview');
    el = document.createElement('div');
    el.id = 'tour';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', T('Guided tour'));
    el.innerHTML = '<div class="tour-spot"></div><div class="tour-card" aria-live="polite"></div>';
    document.body.appendChild(el);
    i = 0;
    setTimeout(place, 50);
  }
  function end() {
    if (el) el.remove();
    el = null;
    (store.prefs = store.prefs || {}).toured = true;
    app.save();
  }

  H.bus.on('action:tour-next', () => { if (i >= STEPS.length - 1) end(); else { i++; place(); } });
  H.bus.on('action:tour-prev', () => { i = Math.max(0, i - 1); place(); });
  H.bus.on('action:tour-end', end);
  H.bus.on('action:tour-start', start);
  document.addEventListener('keydown', (e) => {
    if (!el) return;
    if (e.key === 'Escape') end();
    else if (e.key === 'ArrowRight') { if (i >= STEPS.length - 1) end(); else { i++; place(); } }
    else if (e.key === 'ArrowLeft') { i = Math.max(0, i - 1); place(); }
  });
  window.addEventListener('resize', () => { if (el) place(); });

  // First run: wait for the start-up sequence to finish.
  H.bus.on('boot', () => {
    if (store.prefs && store.prefs.toured) return;
    const wait = () => (document.getElementById('boot') ? setTimeout(wait, 300) : setTimeout(start, 600));
    wait();
  });
  H.bus.on('slot:profile-bottom', () => '');
  H.tour = { start };
});
