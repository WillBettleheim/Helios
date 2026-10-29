/*
 * HELIOS feature — Weekly trend review.
 * Screen and overview card for the multi-week detection system in js/weekly.js, which runs
 * separately from the daily engine and looks for slow drifts and persistent shifts.
 */
window.H = window.H || {};
(H.features = H.features || []).push(function (app) {
  'use strict';
  const { esc, store } = app;
  const T = app.T;
  const ui = { sel: null };

  app.addIcon('weekly', '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="M7 17l3-3 3 2 4-5"/>');
  app.addView({ id: 'weekly', label: 'Weekly trends', short: 'Weekly', group: 'monitor', icon: 'weekly', render,
    badge: () => { const r = run(); const n = r.shifts.length + r.drifts.length; return n ? `<span class="badge lvl-monitor">${n}</span>` : ''; } });

  function run() {
    const id = app.ui.crewId;
    return H.weekly.analyzeCrew(app.me(), app.data().crew[id], app.dayFor(id));
  }

  const STATUS = {
    shift: ['Sustained shift', 2], drift: ['Slow drift', 1], improving: ['Improving', 0], steady: ['Steady', 0], insufficient: ['Not enough weeks', 0], na: ['Not applicable', 0],
  };
  const fmtSlope = (r) => `${r.slope > 0 ? '+' : ''}${H.fmt(r.slope, r.ind.dec + 1)} ${r.ind.unit}/wk`;

  function bars(r) {
    const ws = r.weeks;
    if (!ws.length) return '<svg class="wk-bars" viewBox="0 0 120 32"></svg>';
    const vals = ws.map((x) => x.mean), lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
    const bw = 120 / H.weekly.MAX_WEEKS;
    return `<svg class="wk-bars" viewBox="0 0 120 32" aria-hidden="true">${ws.map((x, i) => {
      const h = 4 + ((x.mean - lo) / span) * 26;
      return `<rect x="${(H.weekly.MAX_WEEKS - ws.length + i) * bw + 1}" y="${32 - h}" width="${bw - 3}" height="${h}" rx="2"/>`;
    }).join('')}</svg>`;
  }

  function chart(r) {
    const all = r.history.filter((x) => x.w > r.lastFull - 16);
    if (all.length < 2) return '';
    const W = 640, Hh = 210, m = { l: 48, r: 12, t: 12, b: 26 }, ind = r.ind;
    const B = app.me().inds[ind.id] && app.me().inds[ind.id].base;
    const center = (d) => (B && B.mean != null ? B.mean : ind.base ? ind.base[0] : null) + (ind.expected ? ind.expected(d) : 0);
    const ys = all.map((x) => x.mean).concat(B && B.mean != null ? [center(all[0].mid) - B.sd, center(all[all.length - 1].mid) + B.sd] : []);
    let lo = Math.min(...ys), hi = Math.max(...ys); const pad = (hi - lo || 1) * 0.12; lo -= pad; hi += pad;
    const w0 = all[0].w, w1 = all[all.length - 1].w;
    const X = (w) => m.l + ((w - w0) / Math.max(1, w1 - w0)) * (W - m.l - m.r), Y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (Hh - m.t - m.b);
    let s = `<svg class="wk-chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(ind.name)} weekly means">`;
    [lo + pad, (lo + hi) / 2, hi - pad].forEach((v) => { s += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tick" x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${H.fmt(v, ind.dec)}</text>`; });
    all.forEach((x) => { s += `<text class="tick" x="${X(x.w)}" y="${Hh - 8}" text-anchor="middle">W${x.w}</text>`; });
    if (B && B.mean != null) {
      const top = all.map((x) => `${X(x.w)},${Y(center(x.mid) + B.sd)}`), bot = all.map((x) => `${X(x.w)},${Y(center(x.mid) - B.sd)}`).reverse();
      s += `<polygon class="band" points="${top.concat(bot).join(' ')}"/><polyline class="center" points="${all.map((x) => `${X(x.w)},${Y(center(x.mid))}`).join(' ')}"/>`;
    }
    if (r.shift) {
      const ox = X(r.shift.since), right = ox > W * 0.7;
      s += `<line class="wk-onset" x1="${ox}" x2="${ox}" y1="${m.t}" y2="${Hh - m.b}"/><text class="event-label" x="${right ? ox - 4 : ox + 4}" y="${m.t + 10}" text-anchor="${right ? 'end' : 'start'}">${T('shift began ~')}W${r.shift.since}</text>`;
    }
    if (r.slope != null && r.weeks.length >= H.weekly.MIN_WEEKS) {
      const a = r.weeks[0].w, b = r.weeks[r.weeks.length - 1].w, yAt = (w) => r.intercept + r.slope * w + (ind.expected ? ind.expected(7 * (w - 1) + 4) : 0);
      s += `<line class="wk-sen" x1="${X(a)}" y1="${Y(yAt(a))}" x2="${X(b)}" y2="${Y(yAt(b))}"/>`;
    }
    s += `<polyline class="line" points="${all.map((x) => `${X(x.w)},${Y(x.mean)}`).join(' ')}"/>`;
    all.forEach((x) => { s += `<circle class="pt" cx="${X(x.w)}" cy="${Y(x.mean)}" r="3.5"><title>W${x.w}: ${H.fmt(x.mean, ind.dec)} ${esc(ind.unit)} (${x.n} readings)</title></circle>`; });
    return s + '</svg>';
  }

  function row(r) {
    const [label, lvl] = STATUS[r.status];
    return `<button class="wk-row ${ui.sel === r.ind.id ? 'active' : ''}" data-action="wk-sel" data-ind="${r.ind.id}" aria-expanded="${ui.sel === r.ind.id}">
      <span class="wk-name"><b>${esc(r.ind.short)}</b><small>${esc(H.DOMAINS.find((d) => d.id === r.ind.domain).name)}</small></span>
      ${bars(r)}
      <span class="mono wk-slope">${r.status === 'insufficient' ? '—' : fmtSlope(r)}</span>
      ${app.pill(r.status === 'improving' ? 0 : r.level, r.status === 'shift' ? `${T('Shift since')} ~W${r.shift.since}` : T(label))}
    </button>${ui.sel === r.ind.id ? detail(r) : ''}`;
  }

  function detail(r) {
    return `<div class="wk-detail">
      ${chart(r)}
      <ul class="reasons">${r.reasons.map((x) => `<li>${esc(x)}</li>`).join('') || `<li>${T('No consistent trend over the last weeks.')}</li>`}</ul>
      <div class="stats">
        <div class="stat"><span class="k">${T('This week')}</span><span class="v mono">${H.fmt(r.current, r.ind.dec)}</span><small>${esc(r.ind.unit)}</small></div>
        <div class="stat"><span class="k">${T('Trend')}</span><span class="v mono">${r.slope != null ? fmtSlope(r) : '—'}</span><small>Sen's slope</small></div>
        <div class="stat"><span class="k">p</span><span class="v mono">${r.p != null ? r.p.toFixed(3) : '—'}</span><small>Mann–Kendall</small></div>
        <div class="stat"><span class="k">${T('To limit')}</span><span class="v mono">${r.weeksToLimit != null ? `${Math.round(r.weeksToLimit)} wk` : '—'}</span><small>${T('at this rate')}</small></div>
      </div>
      <button class="link" data-action="open-ind" data-ind="${r.ind.id}">${T('Daily chart for')} ${esc(r.ind.short)} ${app.ICON.arrow}</button>
    </div>`;
  }

  function render() {
    const res = run(), c = app.me().crew;
    const attention = res.results.filter((r) => r.status === 'shift' || r.status === 'drift').sort((a, b) => b.level - a.level || (a.weeksToLimit ?? 99) - (b.weeksToLimit ?? 99));
    const rest = res.results.filter((r) => !attention.includes(r)).sort((a, b) => ['improving', 'steady', 'insufficient'].indexOf(a.status) - ['improving', 'steady', 'insufficient'].indexOf(b.status));
    const count = (s) => res.results.filter((r) => r.status === s).length;
    if (ui.sel == null && attention[0]) ui.sel = attention[0].ind.id;
    return `<div class="page-head"><div><p class="eyebrow">${T('Weekly trends')} · ${esc(c.name)} · ${T('mission week')} ${res.week}</p><h1>${T('What is changing slowly?')}</h1>
      <p class="lede">A separate detection system from the daily checks. It averages each indicator per mission week and tests the last ${H.weekly.MAX_WEEKS} complete weeks for slow drifts (Mann–Kendall + Sen's slope) and persistent shifts from your baseline (CUSUM) — the kind of change no single day reveals.</p></div>
      <button class="btn" data-action="wk-queue">${T('Send weekly review to flight surgeon')}</button></div>
      <section class="wk-sum">
        ${[['shift', 'action'], ['drift', 'monitor'], ['improving', 'nominal'], ['steady', ''], ['insufficient', '']].map(([k, l]) => `<div class="stat ${l ? 't-' + l : ''}"><span class="k">${T(STATUS[k][0])}</span><span class="v mono">${count(k)}</span></div>`).join('')}
      </section>
      <div class="card"><h2 class="ct">${T('Needs attention')}</h2>
        ${attention.length ? `<div class="wk-list">${attention.map(row).join('')}</div>` : `<p class="muted">${T('No slow drifts or sustained shifts in the last weeks.')}</p>`}</div>
      <div class="card"><h2 class="ct">${T('Everything else')}</h2><div class="wk-list">${rest.map(row).join('')}</div></div>
      <details class="card how"><summary>${T('How the weekly system works')}</summary>
        <p>Daily readings are averaged per mission week (a week needs at least 3 readings for daily indicators). Then three independent checks run on the last ${H.weekly.MAX_WEEKS} complete weeks:</p>
        <ul><li><b>Mann–Kendall trend test</b>: is there a consistent rise or fall? Non-parametric, so one odd week cannot create a trend. Flagged at p &lt; 0.01, because about two dozen indicators are tested.</li>
        <li><b>Sen's slope</b>: the robust rate of change per week, used to estimate weeks until the monitoring limit.</li>
        <li><b>CUSUM</b>: accumulates weekly deviations from your baseline in the unhealthy direction (k = 0.5, h = 5, each week capped at 3 SE so a single storm or sick day cannot fake a shift). The estimated start week is the classic change-point estimate and is approximate.</li></ul>
        <p>Indicators with an expected in-flight trend (hip bone density) are detrended first. Trends must also be practically meaningful (at least half a standard deviation in total).</p></details>`;
  }

  H.bus.on('action:wk-sel', (el) => { ui.sel = ui.sel === el.dataset.ind ? '' : el.dataset.ind; app.render(); });
  H.bus.on('action:wk-queue', () => {
    const r = run();
    const title = `Weekly trend review W${r.week} — ${app.me().crew.name}: ${r.shifts.length} shift${r.shifts.length === 1 ? '' : 's'}, ${r.drifts.length} drift${r.drifts.length === 1 ? '' : 's'}`;
    store.queue.push({ day: app.M.day, title, kb: 2, crewName: app.me().crew.name, t: Date.now() });
    app.log(title, 'weekly'); app.toast(`Queued for the flight surgeon — arrives in about ${app.arrivalText()}.`); app.render();
  });

  H.bus.on('slot:overview-side-top', () => {
    const r = run();
    const items = r.shifts.concat(r.drifts);
    return `<div class="card"><h2 class="ct">📈 ${T('Weekly trends')}</h2>
      ${items.length ? `<p class="small"><b>${r.shifts.length}</b> ${T('sustained shift')}${r.shifts.length === 1 ? '' : 's'} · <b>${r.drifts.length}</b> ${T('slow drift')}${r.drifts.length === 1 ? '' : 's'}</p>
        <ul class="kv">${items.slice(0, 3).map((x) => `<li><span>${esc(x.ind.short)}</span><span class="mono small">${x.status === 'shift' ? `~W${x.shift.since}` : fmtSlope(x)}</span></li>`).join('')}</ul>`
        : `<p class="muted small">${r.results.every((x) => x.status === 'insufficient') ? T('Builds up after 4 weeks of readings.') : T('No slow drifts in the last weeks.')}</p>`}
      <button class="link" data-action="nav" data-view="weekly">${T('Weekly review')} ${app.ICON.arrow}</button></div>`;
  });

  H.weeklyView = { run };
});
