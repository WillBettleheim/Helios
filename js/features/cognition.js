/*
 * HELIOS feature — cognition battery.
 * Two short tests alongside the PVT, each scored against the person's own previous results:
 *  · Digit span — working memory (longest sequence recalled)
 *  · Math processing — speed and accuracy on two-step arithmetic
 */
window.H = window.H || {};
(H.features = H.features || []).push(function (app) {
  'use strict';
  const { esc, store, ICON } = app;
  const T = app.T;
  const st = { test: null, phase: 'idle', seq: [], len: 3, fails: 0, best: 0, timers: [], items: [], i: 0, t0: 0, correct: 0, rts: [], end: 0 };

  app.addIcon('cognition', '<path d="M9 4a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 006 0V4a3 3 0 00-3 0z"/><path d="M15 4a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-6 0"/>');
  app.addView({ id: 'cognition', label: 'Cognition tests', short: 'Cognition', group: 'daily', icon: 'cognition', render, mount });

  const results = (id) => (store.cog = store.cog || {})[id] = (store.cog[id] || []);
  const TESTS = {
    span: { name: 'Digit span', what: 'Working memory', unit: 'digits', higherBetter: true, key: 'span' },
    math: { name: 'Math processing', what: 'Processing speed', unit: 'correct/min', higherBetter: true, key: 'throughput' },
  };

  // Personal baseline: mean ± SD of earlier results (needs 3).
  function compare(test, value) {
    const prev = results(app.ui.crewId).filter((r) => r.test === test).slice(0, -1).map((r) => r[TESTS[test].key]);
    if (prev.length < 3) return { learning: prev.length };
    const m = prev.reduce((s, x) => s + x, 0) / prev.length;
    const sd = Math.max(Math.sqrt(prev.reduce((s, x) => s + (x - m) ** 2, 0) / (prev.length - 1)), test === 'span' ? 0.5 : 1.5);
    return { m, sd, z: (value - m) / sd };
  }

  function clear() { st.timers.forEach(clearTimeout); st.timers = []; }
  H.bus.on('leave', (v) => { if (v === 'cognition') { clear(); if (st.phase !== 'done') st.phase = 'idle'; } });

  function render() {
    const hist = results(app.ui.crewId).slice(-8).reverse();
    return `<div class="page-head"><div><p class="eyebrow">${T('Cognition tests')}</p><h1>${T('How sharp are you today?')}</h1>
      <p class="lede">Two 1-minute tests that complement the alertness test. Fatigue, CO₂, stress and radiation can all erode memory and processing speed before you notice. Results are compared with your own history.</p></div></div>
      <div class="cog-grid">
        ${Object.entries(TESTS).map(([k, t]) => `<button class="triage-card ${st.test === k ? 'active' : ''}" data-action="cog-pick" data-t="${k}">${ICON.cognition}<b>${T(t.name)}</b><small class="muted">${T(t.what)}</small></button>`).join('')}
        <button class="triage-card" data-action="nav" data-view="pvt">${ICON.pvt}<b>${T('Alertness (PVT)')}</b><small class="muted">${T('Vigilance')}</small></button>
      </div>
      ${st.test ? `<div class="card"><div id="cog-stage" class="cog-stage">${stage()}</div></div>` : ''}
      <div class="card"><h2 class="ct">${T('Recent results')}</h2>${hist.length ? `<ul class="kv">${hist.map((r) => `<li><span>${T(TESTS[r.test].name)} · D${r.day}</span><span class="mono">${+r[TESTS[r.test].key]} ${TESTS[r.test].unit}</span></li>`).join('')}</ul>` : `<p class="muted small">${T('No results yet.')}</p>`}</div>`;
  }

  function stage() {
    const t = TESTS[st.test];
    if (st.phase === 'idle') {
      return `<div class="pvt-msg"><b>${T(t.name)}</b><span>${st.test === 'span' ? T('Digits appear one at a time. Type them back in order. Sequences get longer until you miss twice.') : T('Solve each sum and answer whether the result is greater or less than 5. Go fast — 60 seconds.')}</span><button class="btn primary" data-action="cog-start">${T('Start')}</button></div>`;
    }
    if (st.phase === 'done') {
      const r = results(app.ui.crewId).slice(-1)[0], v = r[t.key], c = compare(st.test, v);
      const msg = c.learning != null ? `Learning your baseline (${c.learning}/3 earlier results).` : Math.abs(c.z) < 1 ? 'In line with your baseline.' : `${Math.abs(c.z).toFixed(1)} SD ${c.z < 0 ? 'below' : 'above'} your baseline (${c.m.toFixed(1)}).`;
      return `<div class="pvt-msg result"><div class="pvt-big mono">${v}<small> ${t.unit}</small></div><span>${esc(msg)}${st.test === 'math' ? ` ${r.accuracy}% accurate · ${r.rt} ms per answer.` : ''}</span>
        <div class="btns"><button class="btn" data-action="cog-start">${T('Retake')}</button><button class="btn primary" data-action="cog-pick" data-t="${st.test === 'span' ? 'math' : 'span'}">${T('Next test')}</button></div></div>`;
    }
    if (st.test === 'span') {
      if (st.phase === 'show') return `<div class="pvt-counter mono" id="cog-digit"></div><div class="pvt-hint">${T('Remember')} ${st.len} ${T('digits')}</div>`;
      return `<form id="span-form" class="span-form"><label for="span-in">${T('Type the digits in order')}</label><input id="span-in" name="ans" inputmode="numeric" autocomplete="off" pattern="[0-9]*" maxlength="${st.len}" class="mono"><button class="btn primary" type="submit">${T('Enter')}</button></form>`;
    }
    const q = st.items[st.i];
    return `<div class="math-q mono">${q ? q.text : ''}</div><div class="btns"><button class="btn big" data-action="cog-ans" data-v="lt">&lt; 5</button><button class="btn big" data-action="cog-ans" data-v="gt">&gt; 5</button></div><div class="pvt-hint" id="cog-left"></div>`;
  }

  function mount() {
    if (st.test === 'span' && st.phase === 'show') playSequence();
    if (st.test === 'span' && st.phase === 'input') { const i = document.getElementById('span-in'); if (i) i.focus(); }
    if (st.test === 'math' && st.phase === 'run') tickMath();
  }
  const restage = () => { const el = document.getElementById('cog-stage'); if (el) { el.innerHTML = stage(); mount(); } };

  // ---------- digit span ----------
  function playSequence() {
    clear();
    st.seq = Array.from({ length: st.len }, () => Math.floor(Math.random() * 10));
    st.seq.forEach((d, i) => {
      st.timers.push(setTimeout(() => { const el = document.getElementById('cog-digit'); if (el) el.textContent = d; }, 400 + i * 1000));
      st.timers.push(setTimeout(() => { const el = document.getElementById('cog-digit'); if (el) el.textContent = ''; }, 1200 + i * 1000));
    });
    st.timers.push(setTimeout(() => { st.phase = 'input'; restage(); }, 600 + st.len * 1000));
  }
  H.bus.on('submit:span-form', (f) => {
    const ans = String(new FormData(f).get('ans') || '').replace(/\D/g, '');
    if (ans === st.seq.join('')) { st.best = st.len; st.len++; st.fails = 0; }
    else { st.fails++; }
    if (st.fails >= 2 || st.len > 12) return finish({ span: st.best });
    st.phase = 'show'; restage();
  });

  // ---------- math ----------
  function makeItem() {
    for (;;) {
      const a = 1 + Math.floor(Math.random() * 9), b = 1 + Math.floor(Math.random() * 9), c = 1 + Math.floor(Math.random() * 9);
      const op = Math.random() < 0.5 ? '+' : '−', v = op === '+' ? a + b - c : a - b + c;
      if (v !== 5) return { text: `${a} ${op === '+' ? '+' : '−'} ${b} ${op === '+' ? '−' : '+'} ${c}`, gt: v > 5 };
    }
  }
  function tickMath() {
    const el = document.getElementById('cog-left');
    if (!el || st.phase !== 'run') return;
    const left = Math.max(0, st.end - performance.now());
    el.textContent = `${Math.ceil(left / 1000)} s · ${st.correct} ${T('correct')}`;
    if (left <= 0) return finishMath();
    st.timers.push(setTimeout(tickMath, 250));
  }
  H.bus.on('action:cog-ans', (el) => {
    if (st.phase !== 'run') return;
    const q = st.items[st.i];
    st.rts.push(performance.now() - st.t0);
    if ((el.dataset.v === 'gt') === q.gt) st.correct++;
    st.i++; st.items.push(makeItem()); st.t0 = performance.now();
    document.querySelector('.math-q').textContent = st.items[st.i].text;
  });
  function finishMath() {
    const n = st.rts.length;
    finish({ throughput: n ? Math.round(st.correct / 1) : 0, accuracy: n ? Math.round((st.correct / n) * 100) : 0, rt: n ? Math.round(st.rts.reduce((s, x) => s + x, 0) / n) : 0 });
  }

  function finish(r) {
    clear();
    results(app.ui.crewId).push(Object.assign({ test: st.test, day: app.M.day, ts: Date.now() }, r));
    app.log(`${TESTS[st.test].name}: ${r[TESTS[st.test].key]} ${TESTS[st.test].unit}`, 'cognition');
    st.phase = 'done'; restage();
  }

  H.bus.on('action:cog-pick', (el) => { clear(); st.test = el.dataset.t; st.phase = 'idle'; app.render(); });
  H.bus.on('action:cog-start', () => {
    clear();
    if (st.test === 'span') Object.assign(st, { phase: 'show', len: 3, fails: 0, best: 0 });
    else Object.assign(st, { phase: 'run', items: [makeItem()], i: 0, correct: 0, rts: [], t0: performance.now(), end: performance.now() + 60000 });
    restage();
  });

  H.cognition = { compare, makeItem };
});
