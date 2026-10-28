/*
 * HELIOS — application shell, views and interactions.
 */
(function (H) {
  'use strict';

  const M = H.MISSION;
  const STORE_KEY = 'helios.v1';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lv = (n) => H.LEVELS[n];
  const pill = (n, text) => `<span class="pill lvl-${lv(n)}"><i class="dot"></i>${text || H.LEVEL_LABEL[n]}</span>`;

  const P = (d) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICON = {
    overview: P('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
    trends: P('<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>'),
    checkin: P('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 12l2 2 4-4"/>'),
    pvt: P('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
    protocols: P('<path d="M4 4h11a3 3 0 013 3v13H7a3 3 0 01-3-3z"/><path d="M8 9h6M8 13h6"/>'),
    report: P('<path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/>'),
    crew: P('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 016 5"/>'),
    heart: P('<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/><path d="M7 12h3l1.5-2.5 2 4 1.5-1.5H17"/>'),
    bone: P('<path d="M8.5 6.5a2.5 2.5 0 10-3.5 3.5l9 9a2.5 2.5 0 103.5-3.5l-9-9z"/><path d="M15.5 6.5a2.5 2.5 0 113.5 3.5M5 14a2.5 2.5 0 103.5 3.5"/>'),
    shield: P('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M12 8v8M8 12h8"/>'),
    radiation: P('<circle cx="12" cy="12" r="1.8"/><path d="M12 3.5a8.5 8.5 0 017.4 4.3L14 11M4.6 7.8A8.5 8.5 0 0112 3.5M10 11L4.6 7.8M14 13l5.4 3.2A8.5 8.5 0 0112 20.5M4.6 16.2A8.5 8.5 0 0012 20.5V14.5M10 13l-5.4 3.2"/>'),
    moon: P('<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>'),
    eye: P('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    home: P('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
    antenna: P('<path d="M12 12v9M8 21h8"/><circle cx="12" cy="10" r="2"/><path d="M7.8 5.8a6 6 0 000 8.4M16.2 5.8a6 6 0 010 8.4M5 3a10 10 0 000 14M19 3a10 10 0 010 14"/>'),
    sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    lock: P('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'),
    check: P('<path d="M5 12l5 5L20 7"/>'),
    arrow: P('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  };

  const NAV = [
    { id: 'overview', label: 'My health', short: 'Health' },
    { id: 'trends', label: 'Trends' },
    { id: 'checkin', label: 'Daily check-in', short: 'Check-in' },
    { id: 'pvt', label: 'Alertness test', short: 'PVT' },
    { id: 'protocols', label: 'Protocols' },
    { id: 'report', label: 'Downlink report', short: 'Report' },
    { id: 'crew', label: 'Crew (CMO)', short: 'Crew' },
  ];

  const SYMPTOMS = [
    ['headache', 'Headache'], ['vision', 'Vision change / blur'], ['congestion', 'Congestion / sinus pressure'],
    ['back', 'Back pain'], ['nausea', 'Nausea'], ['rash', 'Skin rash or blisters'], ['fatigue', 'Unusual fatigue'],
    ['dizzy', 'Dizziness'], ['fever', 'Feverish / chills'], ['chest', 'Chest pain or palpitations'], ['isolated', 'Feeling isolated or low'],
  ];

  // ---------- state ----------
  function loadStore() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && s.v === 1) return s;
    } catch (e) { /* storage unavailable */ }
    return { v: 1, checkins: {}, pvt: {}, log: [], steps: {}, acks: {}, queue: [] };
  }
  const store = loadStore();
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } }

  const ui = { crewId: 'nakamura', view: 'overview', domain: 'behav', ind: 'sleep', range: 60, protocol: 'P-SLP-01', checkinDone: false };
  let ds, A;

  const todayCheckin = (id) => ((store.checkins[id] || {})[M.day]) || null;
  const pvtTests = (id) => store.pvt[id] || [];
  const me = () => A[ui.crewId];

  function recompute() {
    ds = H.buildDataset(store);
    A = {};
    H.CREW.forEach((c) => { A[c.id] = H.assessCrew(c, ds, todayCheckin(c.id)); });
  }

  function log(text, kind) {
    store.log.unshift({ t: Date.now(), day: M.day, crew: ui.crewId, text, kind: kind || 'info' });
    store.log = store.log.slice(0, 200);
    save();
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.h);
    toast.h = setTimeout(() => t.classList.remove('show'), 3600);
  }

  // ---------- time ----------
  const loadedAt = Date.now();
  const pad2 = (n) => String(n).padStart(2, '0');
  function hms(sec) { sec = Math.max(0, Math.floor(sec)); return `${pad2(Math.floor(sec / 3600))}:${pad2(Math.floor(sec / 60) % 60)}:${pad2(sec % 60)}`; }
  function downlinkSec() { return M.downlinkInMin * 60 - (Date.now() - loadedAt) / 1000; }
  function arrivalText() {
    const s = Math.max(0, downlinkSec()) + M.lightTimeSec;
    return `${Math.floor(s / 3600)}h ${pad2(Math.floor(s / 60) % 60)}m`;
  }
  function tickClock() {
    const now = new Date();
    const sec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const met = $('#met'); if (met) met.textContent = `${M.day - 1}d ${hms(sec)}`;
    const aos = $('#aos'); if (aos) aos.textContent = downlinkSec() > 0 ? hms(downlinkSec()) : 'IN WINDOW';
  }

  // ---------- shell ----------
  function renderNav() {
    const a = me();
    $('#nav').innerHTML = NAV.map((n) => {
      let badge = '';
      if (n.id === 'checkin' && !todayCheckin(ui.crewId)) badge = '<span class="badge">Due</span>';
      if (n.id === 'pvt' && !pvtTests(ui.crewId).some((t) => t.day === M.day)) badge = '<span class="badge">Due</span>';
      if (n.id === 'overview' && a.insights.length) badge = `<span class="badge lvl-${lv(a.overall)}">${a.insights.length}</span>`;
      if (n.id === 'report' && store.queue.length) badge = `<span class="badge">${store.queue.length}</span>`;
      return `<a href="#${n.id}" class="nav-item ${ui.view === n.id ? 'active' : ''}" data-action="nav" data-view="${n.id}" ${ui.view === n.id ? 'aria-current="page"' : ''}>${ICON[n.id]}<span class="nl">${n.label}</span><span class="ns">${n.short || n.label}</span>${badge}</a>`;
    }).join('');
  }

  function renderTopbar() {
    const c = me().crew;
    $('#topbar').innerHTML = `
      <div class="tb-stats">
        <div class="tb-stat"><span class="k">Mission day</span><span class="v mono">${M.day}<small> / ${M.plannedDays}</small></span></div>
        <div class="tb-stat hide-sm"><span class="k">MET</span><span class="v mono" id="met">—</span></div>
        <div class="tb-stat hide-sm hide-md"><span class="k">Earth delay (one-way)</span><span class="v mono">${Math.floor(M.lightTimeSec / 60)}m ${pad2(M.lightTimeSec % 60)}s</span></div>
        <div class="tb-stat"><span class="k">Next downlink</span><span class="v mono" id="aos">—</span></div>
      </div>
      <div class="tb-right">
        <label class="crew-select">
          <span class="avatar">${c.initials}</span>
          <span class="sr-only">Crew member</span>
          <select data-change="crew">${H.CREW.map((x) => `<option value="${x.id}" ${x.id === ui.crewId ? 'selected' : ''}>${esc(x.name)}${x.self ? ' (you)' : ''} — ${x.role}</option>`).join('')}</select>
        </label>
        <button class="icon-btn" data-action="night" title="Toggle sleep-period display (low blue light)" aria-label="Toggle sleep-period display">${document.body.classList.contains('night') ? ICON.sun : ICON.moon}</button>
      </div>`;
    tickClock();
  }

  function render() {
    if (ui.view !== 'pvt') pvtAbort();
    renderNav();
    renderTopbar();
    const v = $('#view');
    const views = { overview: vOverview, trends: vTrends, checkin: vCheckin, pvt: vPvt, protocols: vProtocols, report: vReport, crew: vCrew };
    v.innerHTML = (views[ui.view] || vOverview)();
    if (ui.view === 'trends') mountTrendChart();
  }

  function go(view) {
    ui.view = view;
    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    render();
    $('#view').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  // ---------- overview ----------
  function ring(score, level) {
    const r = 52, c = 2 * Math.PI * r;
    return `<svg class="ring lvl-${lv(level)}" viewBox="0 0 128 128" role="img" aria-label="Readiness ${score} of 100">
      <circle class="track" cx="64" cy="64" r="${r}"/>
      <circle class="val" cx="64" cy="64" r="${r}" stroke-dasharray="${(score / 100) * c} ${c}" transform="rotate(-90 64 64)"/>
      <text x="64" y="64" class="ring-num">${score}</text><text x="64" y="84" class="ring-sub">READINESS</text></svg>`;
  }

  const HEADLINE = ['All indicators within your normal range', 'Mostly nominal — a few trends to watch', 'Action recommended', 'Urgent attention required'];

  function vOverview() {
    const a = me(), c = a.crew;
    const ci = todayCheckin(c.id);
    const pvtDone = pvtTests(c.id).some((t) => t.day === M.day);
    const counts = [3, 2, 1].map((l) => [l, a.insights.filter((i) => i.level === l).length]).filter((x) => x[1]);
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const viewingOther = !c.self;

    const domainCards = a.domains.map((d) => {
      const worst = d.list.slice().sort((x, y) => y.status - x.status)[0];
      const keyInd = worst.status > 0 ? worst : d.list[0];
      const series = ds.crew[c.id].series[keyInd.ind.id].slice(M.day - 29);
      return `<button class="domain-card lvl-${lv(d.status)}" data-action="open-domain" data-domain="${d.id}">
        <div class="dc-head"><span class="dc-icon">${ICON[d.icon]}</span><span class="dc-name">${d.name}</span>${pill(d.status)}</div>
        <div class="dc-body">
          <div><div class="dc-k">${keyInd.ind.short}</div><div class="dc-v mono">${H.fmt(keyInd.current, keyInd.ind.dec)}<small> ${keyInd.ind.unit}</small></div></div>
          ${H.charts.spark(series)}
        </div>
        <div class="dc-note">${worst.status > 0 ? esc(worst.reasons[0]) : `${d.list.length} indicators within range`}</div>
      </button>`;
    }).join('');

    const insights = a.insights.length
      ? a.insights.map((i) => insightCard(i)).join('')
      : `<div class="empty">${ICON.check}<div><b>Nothing needs your attention.</b><p>All indicators are within your personal baseline and medical limits. Keep up your check-ins so HELIOS can spot changes early.</p></div></div>`;

    const exer = ds.crew[c.id].series.exer[M.day];
    const env = a.env;
    const envRow = (id) => { const r = env[id]; return `<li><span>${r.ind.short}</span><span class="mono">${H.fmt(r.current, r.ind.dec)} ${r.ind.unit}</span>${r.status ? pill(r.status) : ''}</li>`; };
    const nextOf = (id) => {
      const ind = H.INDICATORS.find((i) => i.id === id), off = ds.crew[c.id].offsets[id];
      for (let d = M.day + 1; d <= M.day + ind.cadence; d++) if ((d + off) % ind.cadence === 0) return d - M.day;
      return ind.cadence;
    };

    return `
      ${viewingOther ? `<div class="banner">${ICON.lock}<span>Viewing <b>${esc(c.name)}</b>'s record as Crew Medical Officer. Private behavioral entries are hidden unless shared.</span></div>` : ''}
      <section class="hero lvl-${lv(a.overall)}">
        ${ring(a.readiness, a.overall)}
        <div class="hero-text">
          <p class="eyebrow">${viewingOther ? esc(c.role) : `${greet}, ${esc(c.first)}`} · Mission day ${M.day}</p>
          <h1>${HEADLINE[a.overall]}</h1>
          <p class="lede">${counts.length ? counts.map(([l, n]) => `<b class="t-${lv(l)}">${n} ${H.LEVEL_LABEL[l].toLowerCase()}</b>`).join(' · ') + ` finding${a.insights.length > 1 ? 's' : ''} from ${H.INDICATORS.length} indicators, compared with your own preflight baseline.` : `${H.INDICATORS.length} indicators checked against your own preflight baseline.`}</p>
          <div class="hero-actions">
            ${ci ? `<span class="done">${ICON.check} Check-in done</span>` : `<button class="btn primary" data-action="nav" data-view="checkin">Start daily check-in ${ICON.arrow}</button>`}
            ${pvtDone ? `<span class="done">${ICON.check} Alertness test done</span>` : `<button class="btn" data-action="nav" data-view="pvt">Take alertness test</button>`}
          </div>
        </div>
      </section>

      <div class="grid-main">
        <div class="col">
          <h2 class="section-title">Health domains</h2>
          <div class="domain-grid">${domainCards}</div>
          <h2 class="section-title">What needs your attention</h2>
          <div class="insights">${insights}</div>
        </div>
        <aside class="col side">
          <div class="card">
            <h3>Today</h3>
            <ul class="tasks">
              <li class="${ci ? 'ok' : ''}">${ci ? ICON.check : '<i class="todo"></i>'}<span>Daily check-in</span><small>${ci ? 'Submitted' : '2 min'}</small></li>
              <li class="${pvtDone ? 'ok' : ''}">${pvtDone ? ICON.check : '<i class="todo"></i>'}<span>Alertness test (PVT-B)</span><small>${pvtDone ? 'Done' : '1–3 min'}</small></li>
              <li class="${exer >= 120 ? 'ok' : ''}">${exer >= 120 ? ICON.check : '<i class="todo"></i>'}<span>Countermeasure exercise</span><small class="mono">${exer ?? 0}/120 min</small></li>
            </ul>
            <div class="sched">
              <div><span class="k">Blood & saliva</span><span class="mono">in ${nextOf('lymph')} d</span></div>
              <div><span class="k">Bone ultrasound</span><span class="mono">in ${nextOf('bmd')} d</span></div>
              <div><span class="k">OCT eye scan</span><span class="mono">in ${nextOf('rnfl')} d</span></div>
            </div>
          </div>
          <div class="card">
            <h3>Habitat environment</h3>
            <ul class="kv">${['co2', 'ctemp', 'rh', 'noise'].map(envRow).join('')}</ul>
            <button class="link" data-action="open-domain" data-domain="env">View environment trends ${ICON.arrow}</button>
          </div>
          <div class="card">
            <h3>${ICON.antenna} Ground link</h3>
            <p class="muted small">You are ${Math.floor(M.lightTimeSec / 60)} light-minutes from Earth. A question sent now gets an answer in about <b>${arrivalText().replace('h', 'h').trim()}</b> at the earliest, so act on-board first.</p>
            <div class="sched"><div><span class="k">Items queued for downlink</span><span class="mono">${store.queue.length}</span></div></div>
            <button class="link" data-action="nav" data-view="report">Open downlink report ${ICON.arrow}</button>
          </div>
        </aside>
      </div>`;
  }

  function insightCard(i) {
    const ack = ((store.acks[ui.crewId] || {})[i.id]) === M.day;
    const proto = H.PROTOCOLS.find((p) => p.id === i.protocol);
    return `<article class="insight lvl-${lv(i.level)}">
      <header>
        ${pill(i.level)}
        <h3>${esc(i.title)}</h3>
        ${i.private ? `<span class="tag" title="Private: visible to you and the flight surgeon only">${ICON.lock} Private</span>` : ''}
        ${ack ? `<span class="tag ok">${ICON.check} Acknowledged</span>` : ''}
      </header>
      <p>${esc(i.summary)}</p>
      ${i.evidence.length ? `<ul class="evidence">${i.evidence.map((e) => `<li class="lvl-${lv(e.status)}"><button data-action="open-ind" data-ind="${e.id}"><b>${esc(e.label)}</b> <span class="mono">${esc(e.value)}</span><small>${esc(e.note)}</small></button></li>`).join('')}</ul>` : ''}
      <div class="do">
        <div class="do-k">Do now</div>
        <ol>${i.actions.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      </div>
      <footer>
        <span class="route">Recommended route: <b>${H.ESCALATION[i.escalate]}</b></span>
        <div class="btns">
          ${proto ? `<button class="btn sm primary" data-action="open-protocol" data-id="${proto.id}">Open ${proto.id}</button>` : ''}
          ${i.escalate >= 1 ? `<button class="btn sm" data-action="escalate" data-to="cmo" data-id="${i.id}">Notify CMO</button>` : ''}
          <button class="btn sm" data-action="escalate" data-to="ground" data-id="${i.id}">Flag for flight surgeon</button>
          ${ack ? '' : `<button class="btn sm ghost" data-action="ack" data-id="${i.id}">Acknowledge</button>`}
        </div>
      </footer>
    </article>`;
  }

  // ---------- trends ----------
  function trendDomains() {
    return H.DOMAINS.map((d) => ({ id: d.id, name: d.name, icon: d.icon })).concat([{ id: 'env', name: 'Habitat', icon: 'home' }]);
  }
  function indicatorsFor(domain) {
    return domain === 'env' ? H.ENV_INDICATORS : H.INDICATORS.filter((i) => i.domain === domain);
  }
  function resultFor(id) {
    const a = me();
    return a.inds[id] || a.env[id];
  }

  function vTrends() {
    const a = me();
    const inds = indicatorsFor(ui.domain);
    if (!inds.some((i) => i.id === ui.ind)) ui.ind = inds[0].id;
    const r = resultFor(ui.ind), ind = r.ind;
    const dom = H.DOMAINS.find((d) => d.id === ui.domain);
    const seriesOf = (id) => (ui.domain === 'env' ? ds.env[id] : ds.crew[ui.crewId].series[id]);

    const tabs = trendDomains().map((d) => {
      const st = d.id === 'env' ? Math.max(...H.ENV_INDICATORS.map((i) => a.env[i.id].status)) : a.domains.find((x) => x.id === d.id).status;
      return `<button class="tab ${ui.domain === d.id ? 'active' : ''}" data-action="set-domain" data-domain="${d.id}">${ICON[d.icon]}<span>${d.name}</span><i class="dot lvl-${lv(st)}"></i></button>`;
    }).join('');

    const list = inds.map((i) => {
      const x = resultFor(i.id);
      return `<button class="ind-row ${ui.ind === i.id ? 'active' : ''}" data-action="set-ind" data-ind="${i.id}">
        <i class="dot lvl-${lv(x.status)}"></i>
        <span class="ind-name">${i.short}<small>${i.src}</small></span>
        <span class="mono ind-val">${H.fmt(x.current, i.dec)}<small> ${i.unit}</small></span>
        ${H.charts.spark(seriesOf(i.id).slice(M.day - 29))}
      </button>`;
    }).join('');

    const slope = r.slopeWeek;
    const stat = (k, v, sub) => `<div class="stat"><span class="k">${k}</span><span class="v mono">${v}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const baseTxt = ind.base ? `${H.fmt(r.center, ind.dec)} ± ${H.fmt(ind.base[1], ind.dec)}` : '—';
    const how = ind.cumulative
      ? `Career dose is prior-flight dose plus every daily dosimeter reading. HELIOS projects it to mission end (day ${M.plannedDays}) at your current background rate and compares it with the ${M.careerLimit} mSv career limit.`
      : ind.base && ind.useZ !== false
        ? `Compared with ${ind.expected ? 'the expected in-flight trajectory built from your preflight baseline' : 'your own preflight baseline'} (shaded band = ±2 SD). Monitor at 2 SD, action at 3 SD, plus absolute medical limits. A 21-day trend projected 14 days ahead flags slow drifts early.`
        : `Judged against absolute limits${ind.limits ? ` (monitor ${ind.limits.monitor}, action ${ind.limits.action} ${ind.unit})` : ''}, plus a 21-day trend projected 14 days ahead.`;

    return `
      <div class="page-head"><div><p class="eyebrow">Trends</p><h1>${ui.domain === 'env' ? 'Habitat environment' : dom.name}</h1>
        <p class="lede">${ui.domain === 'env' ? 'Cabin conditions shared by the whole crew — often the hidden cause behind symptoms.' : esc(dom.risk)}</p></div></div>
      <div class="tabs" role="tablist">${tabs}</div>
      <div class="trend-layout">
        <div class="ind-list">${list}</div>
        <div class="card detail">
          <div class="detail-head">
            <div><h2>${ind.name}</h2><p class="muted small">${ind.src} · every ${ind.cadence === 1 ? 'day' : ind.cadence + ' days'}</p></div>
            ${pill(r.status, r.trending ? 'Monitor · trend' : null)}
          </div>
          ${r.reasons.length ? `<ul class="reasons">${r.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          <div class="stats">
            ${stat('Current', `${H.fmt(r.current, ind.dec)} <small>${ind.unit}</small>`, r.latestDay === M.day ? 'today' : `last reading D${r.latestDay}`)}
            ${stat(ind.expected ? 'Expected now' : 'Baseline', baseTxt, ind.base ? (ind.expected ? 'in-flight model' : 'preflight mean ± SD') : 'absolute limits')}
            ${stat('Deviation', r.z != null ? `${r.z > 0 ? '+' : ''}${r.z.toFixed(1)} SD` : '—', r.z != null ? 'from baseline' : '')}
            ${stat('Trend', slope != null ? `${slope > 0 ? '+' : ''}${H.fmt(slope, ind.dec + (Math.abs(slope) < 1 ? 1 : 0))}` : '—', `${ind.unit} per week`)}
            ${stat(ind.cumulative ? 'Mission end' : 'In 14 days', r.projected != null ? H.fmt(r.projected, ind.dec) : '—', ind.unit)}
            ${stat('Coverage', `${Math.round((r.confidence || 0) * 100)}%`, r.stale ? 'stale — re-measure' : 'last 14 days')}
          </div>
          <div class="chart-head">
            <span class="legend"><i class="lg-line"></i>Measured${ind.base ? '<i class="lg-band"></i>Your normal range' : ''}<i class="lg-limit"></i>Limits</span>
            <div class="seg">${[30, 60, 0].map((n) => `<button class="${ui.range === n ? 'active' : ''}" data-action="set-range" data-range="${n}">${n ? n + ' d' : 'Mission'}</button>`).join('')}</div>
          </div>
          <div id="chart"></div>
          <details class="how"><summary>How HELIOS assesses this</summary><p>${how}</p></details>
        </div>
      </div>`;
  }

  function mountTrendChart() {
    const el = $('#chart');
    if (!el) return;
    const r = resultFor(ui.ind), ind = r.ind;
    const d1 = M.day, d0 = ui.range ? Math.max(1, d1 - ui.range + 1) : 1;
    const L = ind.limits || {};
    const sign = ind.bad === 'up' ? 1 : -1;
    const limits = [['monitor', 'Monitor'], ['action', 'Action'], ['urgent', 'Urgent']]
      .filter(([k]) => L[k] != null).map(([k, label]) => ({ v: L[k], lvl: k, label }));
    if (ind.cumulative) limits.push({ v: M.careerLimit, lvl: 'urgent', label: 'Career limit' });
    H.charts.trend(el, {
      pts: r.pts, d0, d1, unit: ind.unit, dec: ind.dec, label: ind.name, limits, sign,
      center: ind.base ? (d) => ind.base[0] + (ind.expected ? ind.expected(d) : 0) : null,
      sd: ind.base ? ind.base[1] : 0, bandK: 2, sparse: ind.cadence > 2,
      events: M.events.filter((e) => ui.domain === 'env' ? e.kind === 'env' : true),
    });
  }

  // ---------- check-in ----------
  function vCheckin() {
    const c = me().crew;
    const ci = todayCheckin(c.id);
    if (ci && ui.checkinDone) return checkinResult();
    const v = ci || { sleepQ: 3, mood: 7, energy: 6, stress: 3, symptoms: [], vitals: {}, notes: '', share: 'cmo' };
    const scale = (name, label, lo, hi, val) => `
      <div class="field range-field">
        <label for="f-${name}">${label} <output id="o-${name}" class="mono">${val}</output></label>
        <input type="range" id="f-${name}" name="${name}" min="1" max="10" step="1" value="${val}" data-output="o-${name}">
        <div class="range-ends"><span>${lo}</span><span>${hi}</span></div>
      </div>`;
    return `
      <div class="page-head"><div><p class="eyebrow">Daily check-in · Mission day ${M.day}</p><h1>How are you today?</h1>
        <p class="lede">Two minutes. Your answers are compared with your own history — there are no right answers, only changes worth catching early.</p></div></div>
      <form id="checkin-form" class="card form" autocomplete="off">
        <fieldset>
          <legend>Sleep</legend>
          <p class="muted small">Your watch logged <b class="mono">${H.fmt(ds.crew[c.id].series.sleep[M.day], 1)} h</b> last sleep period.</p>
          <div class="field"><span class="label">How rested do you feel?</span>
            <div class="choice" role="radiogroup">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="sleepQ" value="${n}" ${+v.sleepQ === n ? 'checked' : ''}><span>${['Exhausted', 'Tired', 'OK', 'Rested', 'Fully rested'][n - 1]}</span></label>`).join('')}</div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Mood & energy</legend>
          <div class="ranges">
            ${scale('mood', 'Mood', 'Very low', 'Excellent', v.mood)}
            ${scale('energy', 'Energy', 'Drained', 'Energetic', v.energy)}
            ${scale('stress', 'Stress', 'Calm', 'Overwhelmed', v.stress)}
          </div>
        </fieldset>
        <fieldset>
          <legend>Symptoms since last check-in</legend>
          <div class="chips">${SYMPTOMS.map(([id, label]) => `<label class="chip"><input type="checkbox" name="symptoms" value="${id}" ${v.symptoms.includes(id) ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div>
        </fieldset>
        <fieldset>
          <legend>Manual vitals <span class="muted small">— optional, only if a sensor is unavailable</span></legend>
          <div class="vitals">
            <div class="field"><label for="f-rhr">Resting HR <small>bpm</small></label><input id="f-rhr" name="rhr" type="number" min="30" max="200" inputmode="numeric" value="${v.vitals.rhr || ''}" placeholder="${H.fmt(me().inds.rhr.current, 0)}"></div>
            <div class="field"><label for="f-sbp">Systolic BP <small>mmHg</small></label><input id="f-sbp" name="sbp" type="number" min="70" max="250" inputmode="numeric" value="${v.vitals.sbp || ''}" placeholder="${H.fmt(me().inds.sbp.current, 0)}"></div>
            <div class="field"><label for="f-temp">Temperature <small>°C</small></label><input id="f-temp" name="temp" type="number" min="34" max="42" step="0.1" inputmode="decimal" value="${v.vitals.temp || ''}" placeholder="${H.fmt(me().inds.temp.current, 1)}"></div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Anything else?</legend>
          <textarea name="notes" rows="3" placeholder="Optional note for your record">${esc(v.notes)}</textarea>
          <div class="field"><span class="label">Who can see the behavioral part of this check-in?</span>
            <div class="choice">
              <label><input type="radio" name="share" value="cmo" ${v.share !== 'private' ? 'checked' : ''}><span>CMO + flight surgeon</span></label>
              <label><input type="radio" name="share" value="private" ${v.share === 'private' ? 'checked' : ''}><span>${ICON.lock} Flight surgeon only</span></label>
            </div>
          </div>
        </fieldset>
        <div class="form-foot"><button type="submit" class="btn primary">Submit check-in ${ICON.arrow}</button></div>
      </form>`;
  }

  function submitCheckin(form) {
    const fd = new FormData(form);
    const num = (k) => { const x = parseFloat(fd.get(k)); return Number.isFinite(x) ? x : null; };
    const before = me();
    const prev = { readiness: before.readiness, ids: before.insights.map((i) => i.id) };
    const entry = {
      sleepQ: +fd.get('sleepQ') || 3, mood: num('mood'), energy: num('energy'), stress: num('stress'),
      symptoms: fd.getAll('symptoms'), vitals: { rhr: num('rhr'), sbp: num('sbp'), temp: num('temp') },
      notes: String(fd.get('notes') || '').slice(0, 1000), share: fd.get('share'), t: Date.now(),
    };
    (store.checkins[ui.crewId] = store.checkins[ui.crewId] || {})[M.day] = entry;
    log(`Daily check-in submitted${entry.symptoms.length ? ` — symptoms: ${entry.symptoms.map((s) => SYMPTOMS.find((x) => x[0] === s)[1]).join(', ')}` : ''}`, 'checkin');
    recompute();
    ui.checkinDone = true;
    ui.checkinPrev = prev;
    render();
  }

  function checkinResult() {
    const a = me(), prev = ui.checkinPrev || { readiness: a.readiness, ids: a.insights.map((i) => i.id) };
    const added = a.insights.filter((i) => !prev.ids.includes(i.id));
    const delta = a.readiness - prev.readiness;
    const ci = todayCheckin(a.crew.id);
    const urgent = a.insights.filter((i) => i.level >= 3);
    return `
      <div class="page-head"><div><p class="eyebrow">Check-in received · Mission day ${M.day}</p><h1>Thanks — here is what changed</h1></div></div>
      ${urgent.length ? `<div class="banner lvl-urgent">${ICON.heart}<span><b>${esc(urgent[0].title)}.</b> ${esc(urgent[0].actions[0])}.</span></div>` : ''}
      <div class="result-grid">
        <div class="card center">${ring(a.readiness, a.overall)}<p class="muted small">${delta === 0 ? 'Readiness unchanged' : `Readiness ${delta > 0 ? '+' : ''}${delta} after your check-in`}</p></div>
        <div class="card">
          <h3>Your entries</h3>
          <ul class="kv">
            <li><span>Mood</span><span class="mono">${ci.mood}/10</span>${pill(a.inds.mood.status)}</li>
            <li><span>Stress</span><span class="mono">${ci.stress}/10</span>${pill(a.inds.stress.status)}</li>
            <li><span>Energy</span><span class="mono">${ci.energy}/10</span></li>
            <li><span>Symptoms</span><span>${ci.symptoms.length ? ci.symptoms.map((s) => SYMPTOMS.find((x) => x[0] === s)[1]).join(', ') : 'None'}</span></li>
          </ul>
          <p class="muted small">${ci.share === 'private' ? `${ICON.lock} Behavioral answers are private to you and the flight surgeon.` : 'Shared with the CMO and flight surgeon.'}</p>
        </div>
      </div>
      <h2 class="section-title">${added.length ? 'New findings from this check-in' : 'No new findings'}</h2>
      <div class="insights">${added.length ? added.map(insightCard).join('') : '<div class="empty">' + ICON.check + '<div><b>Nothing new.</b><p>Your answers are in line with what HELIOS already knew.</p></div></div>'}</div>
      <div class="form-foot">
        <button class="btn" data-action="edit-checkin">Edit check-in</button>
        <button class="btn primary" data-action="nav" data-view="${pvtTests(a.crew.id).some((t) => t.day === M.day) ? 'overview' : 'pvt'}">${pvtTests(a.crew.id).some((t) => t.day === M.day) ? 'Back to my health' : 'Next: alertness test'} ${ICON.arrow}</button>
      </div>`;
  }

  // ---------- PVT ----------
  const pvt = { state: 'idle', trials: [], falseStarts: 0, timer: null, raf: null, stimAt: 0, endAt: 0, duration: 60, result: null };
  const PVT_TIMEOUT = 3000, PVT_LAPSE = 355;

  function vPvt() {
    const base = H.INDICATORS.find((i) => i.id === 'pvt').base;
    const hist = pvtTests(ui.crewId).slice(-5).reverse();
    return `
      <div class="page-head"><div><p class="eyebrow">Cognition · PVT-B</p><h1>Alertness test</h1>
        <p class="lede">Psychomotor vigilance is one of the most sensitive measures of fatigue. Tap the panel (or press <kbd>Space</kbd>) as soon as the counter appears. Don't tap early.</p></div></div>
      <div class="pvt-layout">
        <div class="card">
          <div id="pvt-box" class="pvt-box" tabindex="0" role="button" aria-label="Response area">${pvtBoxInner()}</div>
          <div class="pvt-controls">
            <div class="seg">${[60, 180].map((s) => `<button class="${pvt.duration === s ? 'active' : ''}" data-action="pvt-duration" data-s="${s}" ${pvt.state !== 'idle' && pvt.state !== 'done' ? 'disabled' : ''}>${s === 60 ? 'Quick · 1 min' : 'Standard · 3 min'}</button>`).join('')}</div>
            <div id="pvt-meta" class="muted small mono">${pvtMeta()}</div>
          </div>
        </div>
        <aside class="card">
          <h3>Your reference</h3>
          <ul class="kv">
            <li><span>Preflight baseline</span><span class="mono">${base[0]} ± ${base[1]} ms</span></li>
            <li><span>Lapse threshold</span><span class="mono">&gt; ${PVT_LAPSE} ms</span></li>
          </ul>
          <h3>Recent tests</h3>
          ${hist.length ? `<ul class="kv">${hist.map((t) => `<li><span>D${t.day} · ${new Date(t.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span class="mono">${t.mean} ms · ${t.lapses} lapse${t.lapses === 1 ? "" : "s"}</span></li>`).join('')}</ul>` : '<p class="muted small">No tests recorded in this session yet.</p>'}
          <p class="muted small">Baseline was set on the on-board tablet. Browser and mouse latency can add 30–60 ms, so treat prototype results as indicative.</p>
        </aside>
      </div>`;
  }

  function pvtBoxInner() {
    if (pvt.state === 'idle') return `<div class="pvt-msg"><b>Ready when you are</b><span>Find a quiet moment, then start.</span><button class="btn primary" data-action="pvt-start">Start test</button></div>`;
    if (pvt.state === 'done') return pvtResultHtml();
    return `<div class="pvt-counter mono" id="pvt-counter">${pvt.state === 'stim' ? '0' : ''}</div><div class="pvt-hint" id="pvt-hint">${pvt.state === 'wait' ? 'Wait for the counter…' : ''}</div>`;
  }

  function pvtMeta() {
    if (pvt.state === 'idle' || pvt.state === 'done') return '';
    const left = Math.max(0, (pvt.endAt - performance.now()) / 1000);
    return `${pvt.trials.length} responses · ${pvt.falseStarts} early · ${Math.ceil(left)} s left`;
  }

  function pvtUpdate() {
    const box = $('#pvt-box');
    if (!box) return;
    box.className = `pvt-box s-${pvt.state}`;
    box.innerHTML = pvtBoxInner();
    const meta = $('#pvt-meta'); if (meta) meta.textContent = pvtMeta();
  }

  function pvtStart() {
    Object.assign(pvt, { state: 'wait', trials: [], falseStarts: 0, endAt: performance.now() + pvt.duration * 1000, result: null });
    $('#pvt-box').focus();
    pvtSchedule();
  }
  function pvtSchedule() {
    clearTimeout(pvt.timer); cancelAnimationFrame(pvt.raf);
    if (performance.now() >= pvt.endAt) return pvtFinish();
    pvt.state = 'wait';
    pvtUpdate();
    pvt.timer = setTimeout(pvtStimulus, 2000 + Math.random() * 3000);
  }
  function pvtStimulus() {
    pvt.state = 'stim';
    pvt.stimAt = performance.now();
    pvtUpdate();
    const counter = $('#pvt-counter');
    const tick = () => {
      if (pvt.state !== 'stim') return;
      if (counter) counter.textContent = Math.round(performance.now() - pvt.stimAt);
      pvt.raf = requestAnimationFrame(tick);
    };
    tick();
    pvt.timer = setTimeout(() => pvtRecord(PVT_TIMEOUT), PVT_TIMEOUT);
  }
  function pvtRespond() {
    if (pvt.state === 'wait') {
      pvt.falseStarts++;
      clearTimeout(pvt.timer);
      pvt.state = 'feedback';
      pvtUpdate();
      $('#pvt-hint').textContent = 'Too early — wait for the counter';
      $('#pvt-box').classList.add('s-early');
      pvt.timer = setTimeout(pvtSchedule, 900);
    } else if (pvt.state === 'stim') {
      pvtRecord(performance.now() - pvt.stimAt);
    }
  }
  function pvtRecord(rt) {
    clearTimeout(pvt.timer); cancelAnimationFrame(pvt.raf);
    pvt.trials.push(rt);
    pvt.state = 'feedback';
    pvtUpdate();
    $('#pvt-counter').textContent = rt >= PVT_TIMEOUT ? 'Missed' : Math.round(rt);
    $('#pvt-hint').textContent = rt > PVT_LAPSE ? 'Lapse' : '';
    pvt.timer = setTimeout(pvtSchedule, 700);
  }
  function pvtFinish() {
    clearTimeout(pvt.timer); cancelAnimationFrame(pvt.raf);
    const valid = pvt.trials.filter((t) => t >= 100);
    if (!valid.length) { pvt.state = 'idle'; pvtUpdate(); toast('No responses recorded — test discarded.'); return; }
    const sorted = valid.slice().sort((a, b) => a - b);
    const result = {
      day: M.day, ts: Date.now(), mode: pvt.duration,
      mean: Math.round(valid.reduce((s, x) => s + x, 0) / valid.length),
      median: Math.round(sorted[Math.floor(sorted.length / 2)]),
      lapses: valid.filter((t) => t > PVT_LAPSE).length,
      falseStarts: pvt.falseStarts, n: valid.length,
    };
    (store.pvt[ui.crewId] = store.pvt[ui.crewId] || []).push(result);
    log(`Alertness test: mean ${result.mean} ms, ${result.lapses} lapses, ${result.falseStarts} early`, 'pvt');
    recompute();
    pvt.result = result;
    pvt.state = 'done';
    render();
  }
  function pvtAbort() {
    if (pvt.state === 'idle' || pvt.state === 'done') return;
    clearTimeout(pvt.timer); cancelAnimationFrame(pvt.raf);
    pvt.state = 'idle';
  }

  function pvtResultHtml() {
    const r = pvt.result, a = me(), st = a.inds.pvt;
    const base = st.ind.base;
    const z = (r.mean - base[0]) / base[1];
    return `<div class="pvt-msg result">
      ${pill(st.status)}
      <div class="pvt-big mono">${r.mean}<small> ms</small></div>
      <span>${z <= 1 ? 'In line with your baseline.' : `${z.toFixed(1)} SD slower than your baseline.`} ${r.lapses} lapse${r.lapses === 1 ? '' : 's'} · ${r.falseStarts} early · median ${r.median} ms · ${r.n} trials</span>
      <div class="btns"><button class="btn" data-action="pvt-start">Retake</button><button class="btn primary" data-action="nav" data-view="overview">See my health</button></div>
    </div>`;
  }

  // ---------- protocols ----------
  function vProtocols() {
    const a = me();
    const active = new Set(a.insights.map((i) => i.protocol));
    const p = H.PROTOCOLS.find((x) => x.id === ui.protocol) || H.PROTOCOLS[0];
    const done = ((store.steps[ui.crewId] || {})[p.id]) || [];
    const dom = H.DOMAINS.find((d) => d.id === p.domain);
    const list = H.PROTOCOLS.map((x) => `<button class="proto-row ${x.id === p.id ? 'active' : ''}" data-action="open-protocol" data-id="${x.id}">
      <span class="mono code">${x.id}</span><span class="pr-title">${x.title}</span>${active.has(x.id) ? '<span class="tag rec">Recommended</span>' : ''}</button>`).join('');
    return `
      <div class="page-head"><div><p class="eyebrow">Protocols</p><h1>On-board procedures</h1>
        <p class="lede">Step-by-step responses you can run without waiting for ground. Recommended ones are linked to your current findings.</p></div></div>
      <div class="proto-layout">
        <div class="proto-list">${list}</div>
        <article class="card proto">
          <div class="detail-head"><div><p class="eyebrow mono">${p.id} · ${dom.name}</p><h2>${p.title}</h2></div>${active.has(p.id) ? '<span class="tag rec">Recommended for you</span>' : ''}</div>
          <div class="proto-meta"><div><span class="k">Use when</span><p>${esc(p.when)}</p></div><div><span class="k">Duration</span><p>${esc(p.duration)}</p></div></div>
          <ol class="steps">${p.steps.map((s, i) => `<li class="${done.includes(i) ? 'done' : ''}"><label><input type="checkbox" data-change="step" data-id="${p.id}" data-i="${i}" ${done.includes(i) ? 'checked' : ''}><span>${esc(s)}</span></label></li>`).join('')}</ol>
          <div class="progress"><div style="width:${(done.length / p.steps.length) * 100}%"></div></div>
          <div class="escalate"><span class="k">Escalate to the CMO immediately if</span><ul>${p.escalateIf.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>
          <div class="form-foot">
            <button class="btn" data-action="reset-steps" data-id="${p.id}">Reset</button>
            <button class="btn primary" data-action="complete-protocol" data-id="${p.id}" ${done.length ? '' : 'disabled'}>Log ${done.length === p.steps.length ? 'completion' : 'progress'}</button>
          </div>
        </article>
      </div>`;
  }

  // ---------- report ----------
  function buildReport() {
    const a = me(), c = a.crew, ci = todayCheckin(c.id);
    const hideBehav = ci && ci.share === 'private';
    return {
      generated: new Date().toISOString(), mission: M.name, missionDay: M.day,
      crew: { id: c.id, name: c.name, role: c.role },
      readiness: a.readiness, overall: H.LEVEL_LABEL[a.overall],
      domains: a.domains.map((d) => ({
        domain: d.name, status: H.LEVEL_LABEL[d.status],
        indicators: d.list.map((r) => ({ id: r.ind.id, name: r.ind.name, value: r.current == null ? null : +r.current.toFixed(r.ind.dec + 1), unit: r.ind.unit, status: H.LEVEL_LABEL[r.status], deviationSD: r.z == null ? null : +r.z.toFixed(2), trendPerWeek: r.slopeWeek == null ? null : +r.slopeWeek.toFixed(3), reasons: r.reasons })),
      })),
      findings: a.insights.map((i) => ({ title: i.title, level: H.LEVEL_LABEL[i.level], route: H.ESCALATION[i.escalate], protocol: i.protocol })),
      checkin: ci ? { sleepQuality: ci.sleepQ, symptoms: ci.symptoms, notes: ci.notes, behavioral: hideBehav ? 'private — flight surgeon channel' : { mood: ci.mood, stress: ci.stress, energy: ci.energy } } : null,
      pvt: pvtTests(c.id).slice(-3),
      actionLog: store.log.filter((l) => l.crew === c.id).slice(0, 30),
    };
  }

  function vReport() {
    const a = me(), c = a.crew;
    const rep = buildReport();
    const size = Math.ceil(JSON.stringify(rep).length / 1024);
    const entries = store.log.filter((l) => l.crew === c.id).slice(0, 12);
    return `
      <div class="page-head"><div><p class="eyebrow">Downlink report</p><h1>Medical status summary</h1>
        <p class="lede">A compact packet for the flight surgeon. It travels at the next downlink window and arrives about <b>${arrivalText()}</b> from now.</p></div>
        <div class="btns no-print">
          <button class="btn" data-action="print">Print</button>
          <button class="btn" data-action="export">Export JSON</button>
          <button class="btn primary" data-action="queue">Queue for downlink · ${size} KB</button>
        </div></div>
      <div class="card report">
        <div class="report-head">
          <div><span class="k">Crew member</span><b>${esc(c.name)}</b><small>${esc(c.role)}</small></div>
          <div><span class="k">Mission</span><b>${M.name}</b><small>Day ${M.day} · ${H.dayToDate(M.day).toISOString().slice(0, 10)}</small></div>
          <div><span class="k">Readiness</span><b class="t-${lv(a.overall)}">${a.readiness} / 100</b><small>${H.LEVEL_LABEL[a.overall]}</small></div>
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Domain</th><th>Status</th><th>Key indicators</th></tr></thead>
          <tbody>${a.domains.map((d) => `<tr><td>${d.name}</td><td>${pill(d.status)}</td><td>${d.list.map((r) => `<span class="kvi ${r.status ? 't-' + lv(r.status) : ''}">${r.ind.short} <b class="mono">${H.fmt(r.current, r.ind.dec)}</b> ${r.ind.unit}</span>`).join('')}</td></tr>`).join('')}</tbody>
        </table></div>
        <h3>Findings</h3>
        ${a.insights.length ? `<ul class="findings">${a.insights.map((i) => `<li>${pill(i.level)}<span>${esc(i.title)}</span><small>${H.ESCALATION[i.escalate]} · ${i.protocol}</small></li>`).join('')}</ul>` : '<p class="muted">No active findings.</p>'}
        <h3>Crew actions log</h3>
        ${entries.length ? `<ul class="log">${entries.map((l) => `<li><span class="mono">D${l.day} ${new Date(l.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>${esc(l.text)}</li>`).join('')}</ul>` : '<p class="muted small">No actions logged yet. Check-ins, tests, protocol steps and escalations appear here.</p>'}
      </div>
      <div class="card">
        <h3>${ICON.antenna} Downlink queue</h3>
        ${store.queue.length ? `<ul class="log">${store.queue.map((q) => `<li><span class="mono">D${q.day}</span>${esc(q.title)} <small class="muted">· ${q.kb} KB · ${esc(q.crewName)}</small></li>`).join('')}</ul>
          <button class="btn sm ghost" data-action="clear-queue">Clear queue</button>` : '<p class="muted small">Nothing queued. Items you flag for the flight surgeon are batched here for the next window.</p>'}
      </div>`;
  }

  // ---------- crew ----------
  function vCrew() {
    const rows = H.CREW.map((c) => {
      const a = A[c.id], ci = todayCheckin(c.id);
      const privateBehav = ci && ci.share === 'private';
      return `<tr>
        <td><button class="crew-cell" data-action="set-crew" data-id="${c.id}"><span class="avatar">${c.initials}</span><span><b>${esc(c.name)}</b><small>${c.role}</small></span></button></td>
        <td class="mono t-${lv(a.overall)}"><b>${a.readiness}</b></td>
        ${a.domains.map((d) => `<td>${d.id === 'behav' && privateBehav ? `<span class="tag">${ICON.lock} Private</span>` : `<i class="dot lvl-${lv(d.status)}" title="${H.LEVEL_LABEL[d.status]}"></i><span class="sr-only">${H.LEVEL_LABEL[d.status]}</span>`}</td>`).join('')}
        <td>${ci ? `<span class="t-nominal">${ICON.check}</span>` : '<span class="muted">Pending</span>'}</td>
      </tr>`;
    }).join('');
    return `
      <div class="page-head"><div><p class="eyebrow">Crew Medical Officer view</p><h1>Crew health at a glance</h1>
        <p class="lede">Each crew member owns their data. This summary is shared with the CMO under the crew health agreement; private behavioral entries stay hidden.</p></div></div>
      <div class="card table-wrap">
        <table class="table crew-table">
          <thead><tr><th>Crew member</th><th>Readiness</th>${H.DOMAINS.map((d) => `<th title="${d.name}">${ICON[d.icon]}<span class="sr-only">${d.name}</span><span class="th-l">${d.name.split(' ')[0]}</span></th>`).join('')}<th>Check-in</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="legend-row">${[0, 1, 2, 3].map((l) => `<span><i class="dot lvl-${lv(l)}"></i>${H.LEVEL_LABEL[l]}</span>`).join('')}</div>
      </div>
      <h2 class="section-title">Crew findings</h2>
      <div class="crew-findings">${H.CREW.map((c) => A[c.id].insights.filter((i) => !i.private).map((i) => `<button class="cf lvl-${lv(i.level)}" data-action="set-crew" data-id="${c.id}">${pill(i.level)}<span><b>${esc(c.name)}</b> — ${esc(i.title)}</span>${ICON.arrow}</button>`).join('')).join('')}</div>`;
  }

  // ---------- interactions ----------
  function findInsight(id) { return me().insights.find((i) => i.id === id); }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const act = el.dataset.action;
    if (act === 'nav') { e.preventDefault(); if (el.dataset.view === 'checkin') ui.checkinDone = false; go(el.dataset.view); }
    else if (act === 'open-domain') { ui.domain = el.dataset.domain; ui.ind = indicatorsFor(ui.domain).slice().sort((x, y) => resultFor(y.id).status - resultFor(x.id).status)[0].id; go('trends'); }
    else if (act === 'open-ind') {
      const id = el.dataset.ind;
      ui.domain = H.ENV_INDICATORS.some((i) => i.id === id) ? 'env' : H.INDICATORS.find((i) => i.id === id).domain;
      ui.ind = id; go('trends');
    }
    else if (act === 'set-domain') { ui.domain = el.dataset.domain; ui.ind = indicatorsFor(ui.domain)[0].id; render(); }
    else if (act === 'set-ind') { ui.ind = el.dataset.ind; render(); }
    else if (act === 'set-range') { ui.range = +el.dataset.range; render(); }
    else if (act === 'set-crew') { ui.crewId = el.dataset.id; go('overview'); }
    else if (act === 'open-protocol') { ui.protocol = el.dataset.id; go('protocols'); }
    else if (act === 'night') {
      document.body.classList.toggle('night');
      try { localStorage.setItem('helios.night', document.body.classList.contains('night') ? '1' : '0'); } catch (err) { /* ignore */ }
      render();
    }
    else if (act === 'ack') {
      (store.acks[ui.crewId] = store.acks[ui.crewId] || {})[el.dataset.id] = M.day;
      log(`Acknowledged finding: ${findInsight(el.dataset.id).title}`, 'ack');
      render();
    }
    else if (act === 'escalate') {
      const ins = findInsight(el.dataset.id);
      if (el.dataset.to === 'cmo') {
        log(`Notified CMO: ${ins.title}`, 'escalate');
        toast(`Crew Medical Officer notified about “${ins.title}”.`);
      } else {
        store.queue.push({ day: M.day, title: ins.title, kb: 3, crewName: me().crew.name, t: Date.now() });
        log(`Flagged for flight surgeon: ${ins.title}`, 'escalate');
        toast(`Queued for the flight surgeon — arrives on Earth in ≈ ${arrivalText()}.`);
      }
      save(); render();
    }
    else if (act === 'reset-steps') { (store.steps[ui.crewId] = store.steps[ui.crewId] || {})[el.dataset.id] = []; save(); render(); }
    else if (act === 'complete-protocol') {
      const p = H.PROTOCOLS.find((x) => x.id === el.dataset.id);
      const n = ((store.steps[ui.crewId] || {})[p.id] || []).length;
      log(`${p.id} ${p.title}: ${n}/${p.steps.length} steps completed`, 'protocol');
      toast(`Logged ${p.id}: ${n} of ${p.steps.length} steps.`);
      render();
    }
    else if (act === 'edit-checkin') { ui.checkinDone = false; render(); }
    else if (act === 'pvt-start') { pvt.state = 'idle'; render(); pvtStart(); }
    else if (act === 'pvt-duration') { pvt.duration = +el.dataset.s; pvt.state = 'idle'; render(); }
    else if (act === 'queue') {
      const rep = buildReport();
      store.queue.push({ day: M.day, title: `Medical status summary — ${rep.crew.name}`, kb: Math.ceil(JSON.stringify(rep).length / 1024), crewName: rep.crew.name, t: Date.now() });
      log('Medical status summary queued for downlink', 'downlink');
      toast(`Report queued. Arrives on Earth in ≈ ${arrivalText()}.`);
      render();
    }
    else if (act === 'clear-queue') { store.queue = []; save(); render(); }
    else if (act === 'export') {
      const blob = new Blob([JSON.stringify(buildReport(), null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `helios-${ui.crewId}-D${M.day}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }
    else if (act === 'print') window.print();
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.change === 'crew') { ui.crewId = el.value; render(); }
    else if (el.dataset.change === 'step') {
      const map = (store.steps[ui.crewId] = store.steps[ui.crewId] || {});
      const set = new Set(map[el.dataset.id] || []);
      el.checked ? set.add(+el.dataset.i) : set.delete(+el.dataset.i);
      map[el.dataset.id] = [...set].sort((a, b) => a - b);
      save(); render();
    }
  });

  document.addEventListener('input', (e) => {
    const out = e.target.dataset && e.target.dataset.output;
    if (out) $('#' + out).textContent = e.target.value;
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id === 'checkin-form') { e.preventDefault(); submitCheckin(e.target); }
  });

  document.addEventListener('pointerdown', (e) => {
    if (ui.view === 'pvt' && e.target.closest('#pvt-box') && !e.target.closest('button')) { e.preventDefault(); pvtRespond(); }
  });
  document.addEventListener('keydown', (e) => {
    if (ui.view === 'pvt' && e.code === 'Space' && pvt.state !== 'idle' && pvt.state !== 'done') { e.preventDefault(); pvtRespond(); }
  });

  window.addEventListener('hashchange', () => {
    const v = location.hash.slice(1);
    if (v && v !== ui.view && NAV.some((n) => n.id === v)) go(v);
  });
  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (ui.view === 'trends') mountTrendChart(); }, 150); });

  // ---------- boot ----------
  try { if (localStorage.getItem('helios.night') === '1') document.body.classList.add('night'); } catch (e) { /* ignore */ }
  const initial = location.hash.slice(1);
  if (NAV.some((n) => n.id === initial)) ui.view = initial;
  recompute();
  render();
  setInterval(tickClock, 1000);
})(window.H);
