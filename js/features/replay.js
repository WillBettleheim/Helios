/*
 * HELIOS feature — mission replay and early-warning lead time.
 * Re-runs the full engine for every past mission day and compares when HELIOS first flagged a
 * problem (personal baseline + trend) with when a conventional fixed medical limit was first
 * crossed. Also hosts "judge mode" (?judge): skips intro and tour and plays the replay.
 */
window.H = window.H || {};
(H.features = H.features || []).push(function (app) {
  'use strict';
  const { esc, store } = app;
  const T = app.T;
  const FROM = 90;          // scenario problems begin after day ~95; earlier days are baseline
  const st = { day: FROM, playing: false, speed: 1, timer: null, cache: {}, crew: null };

  app.addIcon('replay', '<path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8"/><path d="M3 3v5h5"/><path d="M10 9l5 3-5 3z"/>');
  app.addView({ id: 'replay', label: 'Mission replay', short: 'Replay', group: 'monitor', icon: 'replay', render, mount });

  // The replay has its own crew picker so it never changes the person selected in the rest of the app.
  const crewId = () => st.crew || (H.CREW.find((c) => c.id === app.ui.crewId) ? app.ui.crewId : 'nakamura');

  // Flag on day d counts only if it holds on at least 3 of the next 4 measured days (filters noise).
  function sustained(days, i) {
    const w = days.slice(i, i + 4);
    return w.filter(Boolean).length >= Math.min(3, w.length);
  }

  function history(id) {
    if (st.cache[id]) return st.cache[id];
    const c = H.CREW.find((x) => x.id === id), ds = app.data();
    const days = [];
    for (let d = FROM; d <= H.MISSION.day; d++) days.push({ d, a: H.assessCrew(c, ds, null, { day: d }) });

    const leads = [];
    H.INDICATORS.forEach((ind) => {
      const L = ind.limits || {};
      const final = days[days.length - 1].a.inds[ind.id];
      if (!final || final.status < 1) return;              // only problems that are real at day 147
      const sign = ind.bad === 'up' ? 1 : -1;
      const heliosFlags = days.map((x) => x.a.inds[ind.id].status >= 1);
      const limit = L.monitor != null ? L.monitor : L.action;
      const limitFlags = days.map((x) => { const r = x.a.inds[ind.id]; return limit != null && r.current != null && (sign > 0 ? r.current >= limit : r.current <= limit); });
      const hi = heliosFlags.findIndex((f, i) => f && sustained(heliosFlags, i));
      const li = limit == null ? -1 : limitFlags.findIndex((f, i) => f && sustained(limitFlags, i));
      if (hi < 0) return;
      // Weekly system: judged at the end of each complete week, same baseline.
      let weekly = null;
      if (H.weekly) {
        for (let d = 7 * Math.ceil(FROM / 7); d <= H.MISSION.day && weekly == null; d += 7) {
          const w = H.weekly.analyze(ind, ds.crew[id].series[ind.id], final.base, d);
          if (w.status === 'drift') weekly = d;
        }
      }
      leads.push({ ind, helios: days[hi].d, weekly, limit: li >= 0 ? days[li].d : null, hasLimit: limit != null, lead: li >= 0 ? days[li].d - days[hi].d : null });
    });
    const withBoth = leads.filter((l) => l.lead != null);
    const lead = withBoth.map((l) => l.lead).sort((a, b) => a - b);
    const summary = {
      n: leads.length,
      median: lead.length ? lead[Math.floor((lead.length - 1) / 2)] : null,
      earlier: withBoth.filter((l) => l.lead > 0).length,
      neverCrossed: leads.filter((l) => l.hasLimit && l.limit == null).length,
      noLimit: leads.filter((l) => !l.hasLimit).length,
    };
    return (st.cache[id] = { days, leads, summary });
  }

  const at = (h) => h.days.find((x) => x.d === st.day) || h.days[h.days.length - 1];

  function chart(h) {
    const W = 760, Hh = 170, m = { l: 34, r: 12, t: 14, b: 24 };
    const d0 = FROM, d1 = H.MISSION.day, X = (d) => m.l + ((d - d0) / (d1 - d0)) * (W - m.l - m.r), Y = (v) => m.t + (1 - v / 100) * (Hh - m.t - m.b);
    const line = h.days.map((x, i) => `${i ? 'L' : 'M'}${X(x.d).toFixed(1)},${Y(x.a.readiness).toFixed(1)}`).join('');
    const marks = h.leads.map((l) => `<g class="rp-mark"><line x1="${X(l.helios)}" x2="${X(l.helios)}" y1="${m.t}" y2="${Hh - m.b}"/><circle cx="${X(l.helios)}" cy="${m.t + 4}" r="4"><title>${esc(l.ind.short)} flagged D${l.helios}</title></circle></g>`).join('');
    const ev = H.MISSION.events.map((e) => `<line class="event" x1="${X(e.day)}" x2="${X(e.day)}" y1="${m.t}" y2="${Hh - m.b}"/><text class="event-label" x="${X(e.day) + 3}" y="${Hh - m.b - 4}">${esc(e.label)}</text>`).join('');
    const ticks = [90, 100, 110, 120, 130, 140, 147].map((d) => `<text class="tick" x="${X(d)}" y="${Hh - 6}" text-anchor="middle">D${d}</text>`).join('')
      + [0, 50, 100].map((v) => `<text class="tick" x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text><line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('');
    return `<svg class="rp-chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Readiness from day ${d0} to ${d1}">${ticks}${ev}${marks}
      <path class="rp-line" d="${line}"/><line id="rp-head" class="rp-head" x1="${X(st.day)}" x2="${X(st.day)}" y1="${m.t}" y2="${Hh - m.b}"/></svg>`;
  }

  function dayPanel(h) {
    const x = at(h), a = x.a;
    const fresh = h.leads.filter((l) => l.helios === x.d);
    return `<div class="rp-day">
      <div class="rp-score lvl-${app.lv(a.overall)}"><span class="eyebrow">${T('Mission day')} ${x.d}</span><b class="mono">${a.readiness}</b><small>${T('readiness')}</small></div>
      <div class="rp-find">${fresh.length ? `<div class="rp-new">${fresh.map((l) => `<span>⚑ ${esc(l.ind.short)} ${T('flagged today')}${l.limit ? ` — ${l.limit - l.helios} ${T('days before the fixed limit')}` : ''}</span>`).join('')}</div>` : ''}
        ${a.insights.length ? `<ul>${a.insights.slice(0, 5).map((i) => `<li>${app.pill(i.level)}<span>${esc(i.title)}</span></li>`).join('')}</ul>` : `<p class="muted">${T('No findings — everything within normal range.')}</p>`}</div>
    </div>`;
  }

  function render() {
    const id = crewId(), h = history(id), s = h.summary, c = H.CREW.find((x) => x.id === id);
    return `<div class="page-head"><div><p class="eyebrow">${T('Mission replay')} · ${esc(c.name)}</p><h1>${T('How early does HELIOS catch problems?')}</h1>
      <p class="lede">Replays days ${FROM}–${H.MISSION.day} through the full engine and compares when HELIOS first flagged each problem (personal baseline + trend) with when a conventional fixed medical limit was crossed.</p></div>
      <div class="seg">${H.CREW.map((x) => `<button class="${x.id === id ? 'active' : ''}" data-action="rp-crew" data-id="${x.id}">${esc(x.first)}</button>`).join('')}</div></div>

      ${(() => {
        const all = H.CREW.map((x) => history(x.id)).flatMap((x) => x.leads);
        const missed = all.filter((l) => l.limit == null).length, both = all.filter((l) => l.lead != null);
        const earlier = both.filter((l) => l.lead > 0), maxLead = Math.max(0, ...both.map((l) => l.lead));
        return `<section class="rp-stats">
          <div class="v-headline best"><span class="eyebrow">${T('Whole crew')} · ${T('missed by fixed limits')}</span><div class="v-big mono t-nominal">${missed}<small> / ${all.length} ${T('problems')}</small></div>
            <p>HELIOS flagged ${all.length} developing problems across the crew. <b>${missed}</b> never crossed a fixed medical limit by day ${H.MISSION.day} — a limit-only system would not have alarmed at all.</p></div>
          <div class="v-headline muted-card"><span class="eyebrow">${T('Whole crew')} · ${T('earlier warning')}</span><div class="v-big mono">${maxLead}<small> ${T('days, best case')}</small></div>
            <p>Of the ${both.length} problems that did cross a limit, <b>${earlier.length}</b> were flagged earlier by HELIOS${both.length - earlier.length ? ` and ${both.length - earlier.length} on the same day` : ''}.</p></div>
        </section>
        <p class="rp-person muted small">${esc(c.name)}: ${s.n} problem${s.n === 1 ? '' : 's'} flagged · ${s.neverCrossed + s.noLimit} before any limit${s.median != null ? ` · median ${s.median} d earlier where a limit was crossed` : ''}.</p>`;
      })()}

      <div class="card rp-card">
        <div class="rp-controls">
          <button class="btn primary" data-action="rp-play" aria-pressed="${st.playing}">${st.playing ? '❚❚ ' + T('Pause') : '▶ ' + T('Play')}</button>
          <div class="seg">${[1, 2, 4].map((v) => `<button class="${st.speed === v ? 'active' : ''}" data-action="rp-speed" data-v="${v}">${v}×</button>`).join('')}</div>
          <label class="rp-scrub"><span class="sr-only">Mission day</span><input type="range" min="${FROM}" max="${H.MISSION.day}" value="${st.day}" data-change="rp-day" id="rp-range"></label>
          <span class="mono" id="rp-daylabel">D${st.day}</span>
        </div>
        ${chart(h)}
        <div id="rp-panel">${dayPanel(h)}</div>
      </div>

      <div class="card table-wrap"><h2 class="ct">${T('Early-warning lead time by indicator')}</h2>
        <table class="table"><thead><tr><th>Indicator</th><th>Daily system</th><th>Weekly system</th><th>Fixed limit crossed</th><th>Lead</th></tr></thead>
        <tbody>${h.leads.sort((a, b) => a.helios - b.helios).map((l) => `<tr><td>${esc(l.ind.name)}</td><td class="mono">D${l.helios}</td><td class="mono">${l.weekly ? `D${l.weekly}` : '<span class="muted">—</span>'}</td>
          <td class="mono">${l.limit ? `D${l.limit}` : l.hasLimit ? `<span class="muted">not by D${H.MISSION.day}</span>` : '<span class="muted">no fixed limit</span>'}</td>
          <td class="mono">${l.lead != null ? `<b class="${l.lead > 0 ? 't-nominal' : ''}">${l.lead > 0 ? '+' : ''}${l.lead} d</b>` : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No problems developed for this crew member.</td></tr>'}</tbody></table>
        <p class="muted small">Simulated mission data. The weekly system is judged at the end of each complete mission week, so it is slower by design but independent of day-to-day noise. A daily flag counts only if it holds on at least 3 of the next 4 days. "Fixed limit" uses each indicator's conventional monitoring threshold — what a non-personalised system would alarm on.</p></div>`;
  }

  function mount() { if (st.playing) schedule(); }
  function update() {
    const h = history(crewId());
    const panel = document.getElementById('rp-panel'); if (panel) panel.innerHTML = dayPanel(h);
    const r = document.getElementById('rp-range'); if (r) r.value = st.day;
    const lab = document.getElementById('rp-daylabel'); if (lab) lab.textContent = `D${st.day}`;
    const head = document.getElementById('rp-head');
    if (head) { const x = 34 + ((st.day - FROM) / (H.MISSION.day - FROM)) * (760 - 46); head.setAttribute('x1', x); head.setAttribute('x2', x); }
  }
  function schedule() {
    clearTimeout(st.timer);
    st.timer = setTimeout(() => {
      if (!st.playing) return;
      if (st.day >= H.MISSION.day) { st.playing = false; app.render(); return; }
      st.day++; update(); schedule();
    }, 450 / st.speed);
  }
  function play(on) {
    st.playing = on;
    if (on && st.day >= H.MISSION.day) st.day = FROM;
    app.render();
  }

  H.bus.on('action:rp-play', () => play(!st.playing));
  H.bus.on('action:rp-speed', (el) => { st.speed = +el.dataset.v; app.render(); });
  H.bus.on('action:rp-crew', (el) => { st.day = FROM; st.crew = el.dataset.id; app.render(); });
  H.bus.on('change:rp-day', (el) => { st.playing = false; st.day = +el.value; app.render(); });
  document.addEventListener('input', (e) => { if (e.target && e.target.id === 'rp-range') { st.playing = false; st.day = +e.target.value; update(); } });
  H.bus.on('leave', (v) => { if (v === 'replay') { st.playing = false; clearTimeout(st.timer); } });

  // ---------- judge mode ----------
  const judge = typeof location !== 'undefined' && /[?&]judge\b/.test(location.search);
  H.bus.on('boot', () => {
    if (!judge) return;
    try { sessionStorage.setItem('helios.booted', '1'); } catch (e) { /* ignore */ }
    (store.prefs = store.prefs || {}).toured = true;
    const go = () => { st.crew = 'nakamura'; st.day = FROM; st.playing = true; app.go('replay'); };
    if (H.termsAccepted && !H.termsAccepted()) H.bus.on('terms-accepted', go); else setTimeout(go, 0);
  });

  H.replay = { history };
});
