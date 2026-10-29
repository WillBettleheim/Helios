/*
 * HELIOS — application shell, views and interactions.
 */
(function (H) {
  'use strict';

  // Mission context for whoever is selected: the demo mission, or the person's own profile.
  const M = new Proxy(H.MISSION, {
    get(t, k) {
      const p = store.profile;
      if (p && ui.crewId === 'me') {
        if (k === 'day') return H.personalDay(p);
        if (k === 'plannedDays') return p.plannedDays;
        if (k === 'name') return p.mission || 'My mission';
        if (k === 'startISO') return p.start;
      }
      return t[k];
    },
  });
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
    profile: P('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/><path d="M18.5 4.5l1 1 2-2"/>'),
    upload: P('<path d="M12 16V4"/><path d="M8 8l4-4 4 4"/><path d="M5 20h14"/>'),
    validation: P('<path d="M9 3h6M10 3v6l-5 9a2 2 0 001.8 3h10.4a2 2 0 001.8-3l-5-9V3"/><path d="M7.5 14h9"/>'),
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
    drop: P('<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>'),
    speaker: P('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/>'),
    stop: P('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
    search: P('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
    arrow: P('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  };

  // Navigation, grouped. `mobile` items sit in the phone tab bar; the rest live under "More".
  const NAV_GROUPS = [['monitor', 'Monitor'], ['daily', 'Daily'], ['act', 'Act'], ['ground', 'Crew & ground'], ['me', 'You']];
  const NAV = [
    { id: 'overview', label: 'My health', short: 'Health', group: 'monitor', mobile: true },
    { id: 'trends', label: 'Trends', group: 'monitor', mobile: true },
    { id: 'checkin', label: 'Daily check-in', short: 'Check-in', group: 'daily', mobile: true },
    { id: 'pvt', label: 'Alertness test', short: 'PVT', group: 'daily' },
    { id: 'protocols', label: 'Protocols', group: 'act', mobile: true },
    { id: 'report', label: 'Downlink report', short: 'Report', group: 'ground' },
    { id: 'crew', label: 'Crew (CMO)', short: 'Crew', group: 'ground' },
    { id: 'validation', label: 'Model validation', short: 'Validate', group: 'ground' },
    { id: 'profile', label: 'My profile', short: 'Profile', group: 'me' },
  ];
  const EXTRA_VIEWS = {};   // views registered by feature modules
  const T = (str) => (H.t ? H.t(str) : str);
  // Tiny event bus so feature modules can react to app events without touching this file.
  const handlers = {};
  H.bus = {
    on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); },
    emit(ev, ...args) { return (handlers[ev] || []).map((fn) => fn(...args)); },
  };
  const slot = (name, ...args) => H.bus.emit('slot:' + name, ...args).filter(Boolean).join('');

  // Per-person collections keyed by crew id; "me" is the profile owner.
  const PERSONAL_KEYS = ['checkins', 'pvt', 'steps', 'acks', 'labs', 'cog', 'outcomes', 'medlog', 'planner', 'journal'];
  const SYMPTOMS = [
    ['headache', 'Headache'], ['vision', 'Vision change / blur'], ['congestion', 'Congestion / sinus pressure'],
    ['back', 'Back pain'], ['nausea', 'Nausea'], ['rash', 'Skin rash or blisters'], ['fatigue', 'Unusual fatigue'],
    ['dizzy', 'Dizziness'], ['fever', 'Feverish / chills'], ['chest', 'Chest pain or palpitations'], ['isolated', 'Feeling isolated or low'],
  ];

  // ---------- state ----------
  // Fills in anything an older or damaged record is missing, so a bad save can't break startup.
  const normalize = (s) => H.sanitize.store(s);
  function loadStore() {
    if (H.vault && H.vault.enabled()) return normalize({});      // filled in after unlock
    try { return normalize(JSON.parse(localStorage.getItem(STORE_KEY))); } catch (e) { return normalize({}); }
  }
  const store = loadStore();
  let saveWarned = false;
  function save() {
    try {
      if (H.vault && H.vault.unlocked()) H.vault.save(store);
      else if (!(H.vault && H.vault.enabled())) localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) {
      if (!saveWarned) { saveWarned = true; toast('Could not save — device storage is full or blocked. Export a backup from My profile.'); }
    }
  }

  const ui = { crewId: store.profile ? 'me' : 'nakamura', view: 'overview', domain: 'behav', ind: 'sleep', range: 60, protocol: 'P-SLP-01', checkinDone: false, vrun: 'final', vmethod: 'ensemble' };
  let ds, A;

  const dayFor = (id) => (id === 'me' && store.profile ? H.personalDay(store.profile) : H.MISSION.day);
  const todayCheckin = (id) => ((store.checkins[id] || {})[dayFor(id)]) || null;
  const pvtTests = (id) => store.pvt[id] || [];
  const me = () => A[ui.crewId];
  const dayDate = (d) => H.dayToDate(d, M.startISO);
  const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'ME';

  // The person's own profile, shown as a crew member with id "me".
  function meCrew() {
    const p = store.profile;
    if (!p) return null;
    return { id: 'me', name: p.name, first: p.name.split(/\s+/)[0], role: p.role || 'Astronaut', initials: initials(p.name), priorDose: +p.priorDose || 0, self: true, personal: true };
  }
  function crewList() {
    const m = meCrew();
    return m ? [m].concat(H.CREW.map((c) => Object.assign({}, c, { self: false }))) : H.CREW;
  }

  function recompute() {
    ds = H.buildDataset(store);
    A = {};
    crewList().forEach((c) => {
      if (!c.personal) { A[c.id] = H.assessCrew(c, ds, todayCheckin(c.id)); return; }
      const p = store.profile, cd = H.buildPersonal(p, store);
      ds.crew.me = cd;
      const sens = H.SENSITIVITY[p.sensitivity] || H.SENSITIVITY.standard;
      A.me = H.assessCrew(c, ds, todayCheckin('me'), { day: cd.day, bases: H.personalBaselines(p, cd), zMon: sens.zMon, zAct: sens.zAct, plannedDays: p.plannedDays });
    });
    if (!A[ui.crewId]) ui.crewId = crewList()[0].id;
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
  // Communications blackout (e.g. solar conjunction): the next downlink is when the blackout ends.
  const blackout = () => { const b = store.blackout; return b && b.until > Date.now() ? b : null; };
  function downlinkSec() {
    const b = blackout();
    if (b) return (b.until - Date.now()) / 1000;
    return M.downlinkInMin * 60 - (Date.now() - loadedAt) / 1000;
  }
  function arrivalText() {
    const s = Math.max(0, downlinkSec()) + M.lightTimeSec;
    const d = Math.floor(s / 86400);
    return d ? `${d}d ${Math.floor(s / 3600) % 24}h` : `${Math.floor(s / 3600)}h ${pad2(Math.floor(s / 60) % 60)}m`;
  }
  function tickClock() {
    const now = new Date();
    const sec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const met = $('#met'); if (met) met.textContent = `${M.day - 1}d ${hms(sec)}`;
    const aos = $('#aos');
    if (aos) {
      const sec = downlinkSec(), b = blackout();
      aos.textContent = b ? `LOS ${Math.floor(sec / 86400)}d ${pad2(Math.floor(sec / 3600) % 24)}h` : sec > 0 ? hms(sec) : 'IN WINDOW';
      aos.classList.toggle('t-urgent', !!b);
    }
  }

  // ---------- shell ----------
  function renderNav() {
    const a = me();
    const item = (n) => {
      let badge = '';
      if (n.id === 'checkin' && !todayCheckin(ui.crewId)) badge = '<span class="badge">Due</span>';
      if (n.id === 'pvt' && !pvtTests(ui.crewId).some((t) => t.day === M.day)) badge = '<span class="badge">Due</span>';
      if (n.id === 'overview' && a.insights.length) badge = `<span class="badge lvl-${lv(a.overall)}">${a.insights.length}</span>`;
      if (n.id === 'report' && store.queue.length) badge = `<span class="badge">${store.queue.length}</span>`;
      if (n.badge) badge = n.badge() || badge;
      return `<a href="#${n.id}" class="nav-item ${ui.view === n.id ? 'active' : ''} ${n.mobile ? 'm-show' : ''}" data-action="nav" data-view="${n.id}" ${ui.view === n.id ? 'aria-current="page"' : ''}>${ICON[n.icon || n.id] || ICON.overview}<span class="nl">${T(n.label)}</span><span class="ns">${T(n.short || n.label)}</span>${badge}</a>`;
    };
    const moreActive = !NAV.find((n) => n.id === ui.view && n.mobile);
    $('#nav').innerHTML = NAV_GROUPS.map(([g, label]) => {
      const items = NAV.filter((n) => n.group === g);
      return items.length ? `<div class="nav-group"><span class="nav-gl">${T(label)}</span>${items.map(item).join('')}</div>` : '';
    }).join('') + `<button class="nav-item more-btn ${moreActive ? 'active' : ''}" data-action="more" aria-label="${T('More')}">${ICON.overview}<span class="ns">${T('More')}</span></button>`;
  }

  function openMore() {
    const el = $('#more-sheet');
    el.hidden = false;
    el.innerHTML = `<div class="sheet" role="dialog" aria-label="${T('All sections')}">
      <div class="sheet-head"><b>${T('All sections')}</b><button class="icon-btn" data-action="close-more" aria-label="Close">✕</button></div>
      ${NAV_GROUPS.map(([g, label]) => `<div class="sheet-group" role="group" aria-label="${T(label)}"><span class="nav-gl">${T(label)}</span><div class="sheet-grid">${NAV.filter((n) => n.group === g).map((n) => `<button data-action="nav" data-view="${n.id}" class="${ui.view === n.id ? 'active' : ''}">${ICON[n.icon || n.id] || ICON.overview}<span>${T(n.label)}</span></button>`).join('')}</div></div>`).join('')}
    </div>`;
    trapFocus(el);
  }
  function closeMore() { const el = $('#more-sheet'); if (el && !el.hidden) { el.hidden = true; el.innerHTML = ''; const b = $('.more-btn'); if (b) b.focus(); } }

  function renderTopbar() {
    const c = me().crew;
    $('#topbar').innerHTML = `
      <div class="tb-stats">
        <div class="tb-stat"><span class="k">${T('Mission day')}</span><span class="v mono">${M.day}<small> / ${M.plannedDays}</small></span></div>
        <div class="tb-stat hide-sm"><span class="k">MET</span><span class="v mono" id="met">—</span></div>
        <div class="tb-stat hide-sm hide-md"><span class="k">Earth delay (one-way)</span><span class="v mono">${Math.floor(M.lightTimeSec / 60)}m ${pad2(M.lightTimeSec % 60)}s</span></div>
        <div class="tb-stat"><span class="k">${T('Next downlink')}</span><span class="v mono" id="aos">—</span></div>
      </div>
      <div class="tb-right">
        <label class="crew-select">
          <span class="avatar">${esc(c.initials)}</span>
          <span class="sr-only">Crew member</span>
          <select data-change="crew">${crewList().map((x) => `<option value="${x.id}" ${x.id === ui.crewId ? 'selected' : ''}>${esc(x.name)}${x.self ? ' (you)' : ''} — ${esc(x.role)}</option>`).join('')}</select>
        </label>
        <button class="pal-btn" data-action="palette" aria-label="Open command palette">${ICON.search}<span>Search</span><kbd>⌘K</kbd></button>
        <button class="icon-btn" data-action="night" title="Toggle sleep-period display (low blue light)" aria-label="Toggle sleep-period display" aria-pressed="${document.body.classList.contains('night')}">${document.body.classList.contains('night') ? ICON.sun : ICON.moon}</button>
      </div>`;
    tickClock();
  }

  let lastView = null;
  // Identifies the focused control so focus can be restored after a re-render.
  function focusKey() {
    const a = document.activeElement;
    if (!a || a === document.body || !$('#view').contains(a) && !$('#nav').contains(a)) return null;
    if (a.id) return '#' + CSS.escape(a.id);
    const attrs = ['data-action', 'data-view', 'data-id', 'data-ind', 'data-domain', 'data-range', 'data-i', 'data-change', 'data-v', 'data-k', 'data-t', 'name', 'value']
      .filter((k) => a.hasAttribute(k)).map((k) => `[${k}="${CSS.escape(a.getAttribute(k))}"]`).join('');
    return attrs ? a.tagName.toLowerCase() + attrs : null;
  }
  function render() {
    if (ui.view !== 'pvt') pvtAbort();
    const changed = lastView !== ui.view;
    if (changed && lastView) H.bus.emit('leave', lastView);
    lastView = ui.view;
    const fk = changed ? null : focusKey();
    closeMore();
    const v = $('#view');
    // Error boundary: a failing view shows a recoverable message instead of a blank page.
    try {
      renderNav();
      renderTopbar();
      renderAlertBar();
      const views = { overview: vOverview, trends: vTrends, checkin: vCheckin, pvt: vPvt, protocols: vProtocols, report: vReport, crew: vCrew, validation: vValidation, profile: vProfile };
      const extra = EXTRA_VIEWS[ui.view];
      v.innerHTML = extra ? extra.render() : (views[ui.view] || vOverview)();
      if (ui.view === 'trends') mountTrendChart();
      if (extra && extra.mount) extra.mount(v);
    } catch (err) {
      console.error(err);
      v.innerHTML = `<div class="empty err"><div><b>This screen hit a problem.</b><p>${esc(err && err.message)}</p>
        <div class="btns"><button class="btn" data-action="nav" data-view="overview">Back to My health</button></div></div></div>`;
    }
    if (changed) {
      animateIn();
      const h1 = v.querySelector('h1');
      const ann = $('#announce');
      if (ann && h1) ann.textContent = `${T((NAV.find((n) => n.id === ui.view) || {}).label || '')}: ${h1.textContent}`;
    } else if (fk) {
      const el = document.querySelector(fk);
      if (el) el.focus({ preventScroll: true });
    }
  }

  // Urgent findings follow the astronaut to every screen until acknowledged.
  function renderAlertBar() {
    const bar = $('#alert-bar');
    if (!bar) return;
    const acks = store.acks[ui.crewId] || {};
    const urgent = me().insights.filter((i) => i.level >= 3 && acks[i.id] !== M.day);
    if (!urgent.length) { bar.hidden = true; bar.innerHTML = ''; return; }
    const i = urgent[0];
    bar.hidden = false;
    bar.innerHTML = `<span class="ab-k">${T('Urgent')}</span><b>${esc(i.title)}</b><span class="ab-a">${esc(i.actions[0])}</span>
      <div class="btns">${i.protocol ? `<button class="btn sm" data-action="open-protocol" data-id="${i.protocol}">${i.protocol}</button>` : ''}
      <button class="btn sm" data-action="nav" data-view="triage">${T('Symptom triage')}</button><button class="btn sm ghost" data-action="ack" data-id="${i.id}">${T('Acknowledge')}</button></div>`;
  }

  // Keeps Tab inside an open dialog.
  function trapFocus(container) {
    const f = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (f.length) f[0].focus();
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const dlg = document.querySelector('#terms-gate .tg-box, #lock .lock-box, #palette:not([hidden]) .pal-box, #more-sheet:not([hidden]) .sheet, #spe:not(.min) .spe-box, #tour .tour-card');
    if (!dlg) return;
    const f = [...dlg.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!dlg.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  });

  function switchCrew(id) {
    if (!A[id]) return;
    pvtAbort();
    Object.assign(pvt, { state: 'idle', result: null });
    ui.checkinDone = false; ui.checkinPrev = null; ui.editProfile = false;
    ui.crewId = id;
  }

  function go(view) {
    if (view !== ui.view) lastView = lastView || ui.view;
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
      <circle class="val" cx="64" cy="64" r="${r}" stroke-dasharray="${c} ${c}" stroke-dashoffset="${c * (1 - score / 100)}" style="--c:${c}" transform="rotate(-90 64 64)"/>
      <text x="64" y="64" class="ring-num" data-count="${score}">${score}</text><text x="64" y="84" class="ring-sub">READINESS</text></svg>`;
  }

  // Earth → Mars transfer arc with the vehicle's current position.
  function trajectory() {
    const f = M.day / M.plannedDays;
    const P0 = [90, 130], C = [500, -30], P1 = [910, 78];
    const bz = (t) => [0, 1].map((k) => (1 - t) ** 2 * P0[k] + 2 * (1 - t) * t * C[k] + t * t * P1[k]);
    const pathTo = (t0, t1, n = 40) => Array.from({ length: n + 1 }, (_, i) => bz(t0 + (t1 - t0) * (i / n)).map((v) => v.toFixed(1)).join(',')).join(' ');
    const [sx, sy] = bz(f), [nx, ny] = bz(Math.min(1, f + 0.01));
    const ang = Math.atan2(ny - sy, nx - sx) * 180 / Math.PI;
    const arrive = dayDate(M.plannedDays).toISOString().slice(0, 10);
    return `<svg class="traj" viewBox="0 0 1000 175" role="img" aria-label="Mission progress: day ${M.day} of ${M.plannedDays}, Earth to Mars">
      <defs>
        <radialGradient id="g-earth" cx="35%" cy="35%"><stop offset="0" stop-color="#9fd4ff"/><stop offset=".55" stop-color="#2f7fd8"/><stop offset="1" stop-color="#0b2a55"/></radialGradient>
        <radialGradient id="g-mars" cx="35%" cy="35%"><stop offset="0" stop-color="#ffc59a"/><stop offset=".55" stop-color="#d0603a"/><stop offset="1" stop-color="#4a160b"/></radialGradient>
        <radialGradient id="g-ship"><stop offset="0" stop-color="var(--sun)" stop-opacity=".9"/><stop offset="1" stop-color="var(--sun)" stop-opacity="0"/></radialGradient>
      </defs>
      <polyline class="arc-future" points="${pathTo(f, 1)}"/>
      <polyline class="arc-done" points="${pathTo(0, f)}"/>
      <circle cx="${P0[0]}" cy="${P0[1]}" r="26" class="planet-glow earth"/><circle cx="${P0[0]}" cy="${P0[1]}" r="20" fill="url(#g-earth)"/>
      <circle cx="${P1[0]}" cy="${P1[1]}" r="20" class="planet-glow mars"/><circle cx="${P1[0]}" cy="${P1[1]}" r="14" fill="url(#g-mars)"/>
      <text class="pl" x="${P0[0]}" y="${P0[1] + 40}" text-anchor="middle">EARTH · D1</text>
      <text class="pl" x="${P1[0]}" y="${P1[1] + 34}" text-anchor="middle">MARS · D${M.plannedDays}</text>
      <circle cx="${sx}" cy="${sy}" r="26" fill="url(#g-ship)" class="ship-glow"/>
      <g transform="translate(${sx} ${sy}) rotate(${ang})"><path class="ship" d="M9 0 L-6 -5 L-3 0 L-6 5 Z"/></g>
      <text class="pl ship-l" x="${sx}" y="${sy - 22}" text-anchor="middle">${esc(M.name)} · D${M.day}</text>
    </svg>
    <div class="traj-stats">
      <div><span class="k">Transit</span><b class="mono">${Math.round(f * 100)}%</b></div>
      <div><span class="k">Days to Mars</span><b class="mono">${M.plannedDays - M.day}</b></div>
      <div><span class="k">Arrival</span><b class="mono">${arrive}</b></div>
      <div><span class="k">Signal delay</span><b class="mono">${Math.floor(M.lightTimeSec / 60)}m ${pad2(M.lightTimeSec % 60)}s</b></div>
    </div>`;
  }

  const BODY_SPOTS = { behav: [86, 30], sans: [113, 42], cardio: [111, 104], immune: [84, 130], msk: [100, 190], rad: [158, 66], nutrition: [114, 152] };
  function bodyMap(a) {
    const spots = a.domains.map((d) => {
      const [x, y] = BODY_SPOTS[d.id];
      return `<g class="spot lvl-${lv(d.status)} ${d.status ? 'alert' : ''}" data-action="open-domain" data-domain="${d.id}" tabindex="0" role="button" aria-label="${d.name}: ${H.LEVEL_LABEL[d.status]}">
        <circle class="pulse" cx="${x}" cy="${y}" r="9"/><circle class="core" cx="${x}" cy="${y}" r="6"/><title>${d.name} · ${H.LEVEL_LABEL[d.status]}</title></g>`;
    }).join('');
    return `<div class="body-map">
      <svg viewBox="0 0 200 350" aria-label="Body status map">
        <g class="sil">
          <circle cx="100" cy="40" r="24"/><rect x="91" y="62" width="18" height="14" rx="5"/>
          <rect x="64" y="72" width="72" height="122" rx="28"/>
          <rect x="38" y="80" width="22" height="118" rx="11" transform="rotate(8 49 80)"/><rect x="140" y="80" width="22" height="118" rx="11" transform="rotate(-8 151 80)"/>
          <rect x="70" y="182" width="27" height="156" rx="13"/><rect x="103" y="182" width="27" height="156" rx="13"/>
        </g>
        <circle class="rad-halo" cx="100" cy="175" r="${a.domains.find((d) => d.id === 'rad').status ? 168 : 0}"/>
        <g class="scan"><rect x="20" y="0" width="160" height="3"/></g>
        ${spots}
      </svg>
      <ul class="body-legend">${a.domains.map((d) => `<li><button data-action="open-domain" data-domain="${d.id}"><i class="dot lvl-${lv(d.status)}"></i><span>${d.name}</span><small>${H.LEVEL_LABEL[d.status]}</small></button></li>`).join('')}</ul>
    </div>`;
  }

  function briefingText(a) {
    const c = a.crew;
    const lines = [`${c.self ? 'Good ' + (new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening') + ', ' + c.first : 'Briefing for ' + c.name}. Mission day ${M.day}.`,
      `Readiness is ${a.readiness} out of 100. ${HEADLINE[a.overall]}.`];
    a.insights.slice(0, 3).forEach((i, n) => lines.push(`${n === 0 ? 'First' : n === 1 ? 'Second' : 'Third'}: ${i.title}. ${i.actions[0]}.`));
    if (a.insights.length > 3) lines.push(`${a.insights.length - 3} more findings are on your dashboard.`);
    if (!todayCheckin(c.id)) lines.push('Your daily check-in is still due.');
    lines.push(`Next downlink in ${Math.max(0, Math.round(downlinkSec() / 60))} minutes.`);
    return lines.join(' ');
  }

  function speak() {
    if (!('speechSynthesis' in window)) { toast('Voice briefing is not supported in this browser.'); return; }
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
    const u = new SpeechSynthesisUtterance(briefingText(me()));
    u.rate = 1.02; u.pitch = 0.95;
    const btn = () => $('[data-action="brief"]');
    u.onstart = () => { const b = btn(); if (b) { b.classList.add('on'); b.innerHTML = `${ICON.stop} Stop briefing`; } };
    u.onend = u.onerror = () => { const b = btn(); if (b) { b.classList.remove('on'); b.innerHTML = `${ICON.speaker} Voice briefing`; } };
    speechSynthesis.speak(u);
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
      const series = ds.crew[c.id].series[keyInd.ind.id].slice(Math.max(0, M.day - 29));
      const withData = d.list.filter((x) => !x.noData).length;
      return `<button class="domain-card lvl-${lv(d.status)}" data-action="open-domain" data-domain="${d.id}">
        <div class="dc-head"><span class="dc-icon">${ICON[d.icon]}</span><span class="dc-name">${d.name}</span>${pill(d.status)}</div>
        <div class="dc-body">
          <div><div class="dc-k">${keyInd.ind.short}</div><div class="dc-v mono">${H.fmt(keyInd.current, keyInd.ind.dec)}<small> ${keyInd.ind.unit}</small></div></div>
          ${H.charts.spark(series)}
        </div>
        <div class="dc-note">${worst.status > 0 ? esc(worst.reasons[0]) : withData ? `${withData} indicator${withData > 1 ? 's' : ''} within range` : 'No data yet — log or import readings'}</div>
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
      if (off == null) return '—';
      for (let d = M.day + 1; d <= M.day + ind.cadence; d++) if ((d + off) % ind.cadence === 0) return d - M.day;
      return ind.cadence;
    };

    return `
      ${viewingOther ? `<div class="banner">${ICON.lock}<span>Viewing <b>${esc(c.name)}</b>'s record as Crew Medical Officer. Private behavioral entries are hidden unless shared.</span></div>` : ''}
      ${!store.profile ? `<div class="banner cta">${ICON.profile}<span><b>This is demo data.</b> Set up your profile and HELIOS will learn your personal baselines from your own readings.</span><button class="btn sm primary" data-action="nav" data-view="profile">Make it mine ${ICON.arrow}</button></div>` : ''}
      ${slot('overview-top', a)}
      <section class="mission-banner">${trajectory()}</section>
      <section class="hero lvl-${lv(a.overall)}">
        ${ring(a.readiness, a.overall)}
        <div class="hero-text">
          <p class="eyebrow">${viewingOther ? esc(c.role) : `${greet}, ${esc(c.first)}`} · Mission day ${M.day}</p>
          <h1>${T(HEADLINE[a.overall])}</h1>
          <p class="lede">${counts.length ? counts.map(([l, n]) => `<b class="t-${lv(l)}">${n} ${H.LEVEL_LABEL[l].toLowerCase()}</b>`).join(' · ') + ` finding${a.insights.length > 1 ? 's' : ''} from ${H.INDICATORS.length} indicators, compared with your own preflight baseline.` : `${H.INDICATORS.length} indicators checked against your own preflight baseline.`}</p>
          <div class="hero-actions">
            ${ci ? `<span class="done">${ICON.check} Check-in done</span>` : `<button class="btn primary" data-action="nav" data-view="checkin">${T('Start daily check-in')} ${ICON.arrow}</button>`}
            ${pvtDone ? `<span class="done">${ICON.check} Alertness test done</span>` : `<button class="btn" data-action="nav" data-view="pvt">${T('Take alertness test')}</button>`}
            <button class="btn ghost" data-action="brief">${ICON.speaker} ${T('Voice briefing')}</button>
          </div>
        </div>
      </section>

      <div class="grid-main">
        <div class="col">
          <h2 class="section-title">${T('Health domains')}</h2>
          <div class="domain-grid">${domainCards}</div>
          <h2 class="section-title">${T('What needs your attention')}</h2>
          <div class="insights">${insights}</div>
        </div>
        <aside class="col side">
          ${slot('overview-side-top', a)}
          ${c.personal ? adaptCard(a) : ''}
          <div class="card body-card">
            <h2 class="ct">${T('Body status')}</h2>
            ${bodyMap(a)}
          </div>
          <div class="card">
            <h2 class="ct">${T('Today')}</h2>
            <ul class="tasks">
              <li class="${ci ? 'ok' : ''}">${ci ? ICON.check : '<i class="todo"></i>'}<span>Daily check-in</span><small>${ci ? 'Submitted' : '2 min'}</small></li>
              <li class="${pvtDone ? 'ok' : ''}">${pvtDone ? ICON.check : '<i class="todo"></i>'}<span>Alertness test (PVT-B)</span><small>${pvtDone ? 'Done' : '1–3 min'}</small></li>
              <li class="${exer >= 120 ? 'ok' : ''}">${exer >= 120 ? ICON.check : '<i class="todo"></i>'}<span>Countermeasure exercise</span><small class="mono">${exer ?? 0}/120 min</small></li>
            </ul>
            <div class="sched">
              <div><span class="k">Blood & saliva</span><span class="mono">${c.personal ? 'when logged' : `in ${nextOf('lymph')} d`}</span></div>
              <div><span class="k">Bone ultrasound</span><span class="mono">${c.personal ? 'when logged' : `in ${nextOf('bmd')} d`}</span></div>
              <div><span class="k">OCT eye scan</span><span class="mono">${c.personal ? 'when logged' : `in ${nextOf('rnfl')} d`}</span></div>
            </div>
          </div>
          <div class="card">
            <h2 class="ct">Habitat environment</h2>
            <ul class="kv">${['co2', 'ctemp', 'rh', 'noise'].map(envRow).join('')}</ul>
            <button class="link" data-action="open-domain" data-domain="env">View environment trends ${ICON.arrow}</button>
          </div>
          <div class="card">
            <h2 class="ct">${ICON.antenna} Ground link</h2>
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
        <span class="route">Recommended route: <b>${blackout() && i.escalate === 2 ? `${T('Crew Medical Officer')} — ${T('ground out of contact')}` : H.ESCALATION[i.escalate]}</b></span>
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
        ${H.charts.spark(seriesOf(i.id).slice(Math.max(0, (ui.domain === 'env' ? H.MISSION.day : M.day) - 29)))}
      </button>`;
    }).join('');

    const slope = r.slopeWeek;
    const stat = (k, v, sub) => `<div class="stat"><span class="k">${k}</span><span class="v mono">${v}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const B = r.base, hasB = !!(B && B.mean != null);
    const baseTxt = hasB ? `${H.fmt(r.center, ind.dec)} ± ${H.fmt(r.sd, ind.dec)}` : B && B.source === 'calibrating' ? `${B.n}/${B.need}` : '—';
    const personal = me().crew.personal && ui.domain !== 'env';
    const how = ind.cumulative
      ? `Career dose is prior-flight dose plus every daily dosimeter reading. HELIOS projects it to mission end (day ${M.plannedDays}) at your current background rate and compares it with the ${M.careerLimit} mSv career limit.`
      : ind.base && ind.useZ !== false
        ? `Compared with ${ind.expected ? 'the expected in-flight trajectory built from your preflight baseline' : 'your own preflight baseline'} (shaded band = ±2 SD). Monitor at 2 SD, action at 3 SD, plus absolute medical limits. A 21-day trend projected 14 days ahead flags slow drifts early.`
        : `Judged against absolute limits${ind.limits ? ` (monitor ${ind.limits.monitor}, action ${ind.limits.action} ${ind.unit})` : ''}, plus a 21-day trend projected 14 days ahead.`;

    return `
      <div class="page-head"><div><p class="eyebrow">Trends</p><h1>${ui.domain === 'env' ? 'Habitat environment' : dom.name}</h1>
        <p class="lede">${ui.domain === 'env' ? 'Cabin conditions shared by the whole crew — often the hidden cause behind symptoms.' : esc(dom.risk)}</p></div></div>
      <div class="tabs" role="group" aria-label="Health domains">${tabs}</div>
      <div class="trend-layout">
        <div class="ind-list">${list}</div>
        <div class="card detail">
          <div class="detail-head">
            <div><h2>${ind.name}</h2><p class="muted small">${ind.src} · every ${ind.cadence === 1 ? 'day' : ind.cadence + ' days'}</p></div>
            ${pill(r.status, r.trending ? 'Monitor · trend' : null)}
          </div>
          ${r.reasons.length ? `<ul class="reasons">${r.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          <div class="stats">
            ${stat('Current', `${H.fmt(r.current, ind.dec)} <small>${ind.unit}</small>`, r.noData ? 'no readings yet' : r.latestDay === M.day ? 'today' : `last reading D${r.latestDay}`)}
            ${stat(ind.expected ? 'Expected now' : B && B.source === 'calibrating' ? 'Learning' : 'Baseline', baseTxt, B ? (ind.expected ? 'in-flight model' : SOURCE_TEXT[B.source]) : 'absolute limits')}
            ${stat('Deviation', r.z != null ? `${r.z > 0 ? '+' : ''}${r.z.toFixed(1)} SD` : '—', r.z != null ? 'from baseline' : '')}
            ${stat('Trend', slope != null ? `${slope > 0 ? '+' : ''}${H.fmt(slope, ind.dec + (Math.abs(slope) < 1 ? 1 : 0))}` : '—', `${ind.unit} per week`)}
            ${stat(ind.cumulative ? 'Mission end' : 'In 14 days', r.projected != null ? H.fmt(r.projected, ind.dec) : '—', ind.unit)}
            ${stat('Coverage', `${Math.round((r.confidence || 0) * 100)}%`, r.stale ? 'stale — re-measure' : 'last 14 days')}
          </div>
          <div class="chart-head">
            <span class="legend"><i class="lg-line"></i>Measured${hasB ? '<i class="lg-band"></i>Your normal range' : ''}<i class="lg-limit"></i>Limits</span>
            <div class="chart-tools">
              <div class="seg">${[30, 60, 0].map((n) => `<button class="${ui.range === n ? 'active' : ''}" data-action="set-range" data-range="${n}">${n ? n + ' d' : 'Mission'}</button>`).join('')}</div>
              <div class="seg"><button class="${ui.trendTable ? '' : 'active'}" data-action="trend-view" data-v="chart" aria-pressed="${!ui.trendTable}">Chart</button><button class="${ui.trendTable ? 'active' : ''}" data-action="trend-view" data-v="table" aria-pressed="${!!ui.trendTable}">Table</button></div>
              <button class="btn sm ghost" data-action="trend-csv" title="Download this indicator as CSV">CSV</button>
            </div>
          </div>
          ${ui.trendTable ? trendTable(r) : '<div id="chart"></div>'}
          ${personal && B && !ind.expected && B.source !== 'default' ? `<div class="rebase">
            <span>${ICON.profile} <b>${SOURCE_LABEL[B.source]}</b> — ${SOURCE_TEXT[B.source]}${B.n ? ` (${B.n} readings)` : ''}.</span>
            ${B.source === 'rebased' ? `<button class="btn sm" data-action="unrebase" data-ind="${ind.id}">Reset to automatic</button>` : r.current != null && !r.noData ? `<button class="btn sm" data-action="rebase" data-ind="${ind.id}" title="Use your last 14 days as your normal for this indicator">This is normal for me</button>` : ''}
          </div>` : ''}
          <details class="how"><summary>How HELIOS assesses this</summary><p>${how}${personal ? ' Your baseline comes from your own data: preflight readings if you have them, otherwise your first 7 readings; after that it adapts slowly using readings more than 14 days old, so a developing problem does not become your new normal.' : ''}</p></details>
        </div>
      </div>`;
  }

  function trendRange() {
    const d1 = ui.domain === 'env' ? H.MISSION.day : M.day;
    return [ui.range ? Math.max(1, d1 - ui.range + 1) : 1, d1];
  }
  const trendDate = (d) => (ui.domain === 'env' ? H.dayToDate(d) : dayDate(d)).toISOString().slice(0, 10);

  // Screen-reader friendly alternative to the chart.
  function trendTable(r) {
    const [d0, d1] = trendRange(), ind = r.ind, B = r.base;
    const rows = r.pts.filter((p) => p[0] >= d0 && p[0] <= d1).reverse();
    const flag = (d, v) => {
      if (!B || B.mean == null) return '';
      const z = (v - (B.mean + (ind.expected ? ind.expected(d) : 0))) / B.sd;
      return Math.abs(z) >= 2 ? `<span class="muted">${z > 0 ? '+' : ''}${z.toFixed(1)} SD</span>` : '';
    };
    return `<div class="table-wrap trend-table"><table class="table"><caption class="sr-only">${esc(ind.name)}, mission days ${d0}–${d1}</caption>
      <thead><tr><th scope="col">Day</th><th scope="col">Date</th><th scope="col">${esc(ind.short)} (${esc(ind.unit)})</th><th scope="col">vs. baseline</th></tr></thead>
      <tbody>${rows.length ? rows.map(([d, v]) => `<tr><td class="mono">D${d}</td><td class="mono">${trendDate(d)}</td><td class="mono">${H.fmt(v, ind.dec)}</td><td>${flag(d, v)}</td></tr>`).join('') : '<tr><td colspan="4" class="muted">No readings in this range.</td></tr>'}</tbody></table></div>`;
  }

  function mountTrendChart() {
    const el = $('#chart');
    if (!el) return;
    const r = resultFor(ui.ind), ind = r.ind;
    const d1 = ui.domain === 'env' ? H.MISSION.day : M.day, d0 = ui.range ? Math.max(1, d1 - ui.range + 1) : 1;
    const L = ind.limits || {};
    const sign = ind.bad === 'up' ? 1 : -1;
    const limits = [['monitor', 'Monitor'], ['action', 'Action'], ['urgent', 'Urgent']]
      .filter(([k]) => L[k] != null).map(([k, label]) => ({ v: L[k], lvl: k, label }));
    if (ind.cumulative) limits.push({ v: M.careerLimit, lvl: 'urgent', label: 'Career limit' });
    H.charts.trend(el, {
      pts: r.pts, d0, d1, unit: ind.unit, dec: ind.dec, label: ind.name, limits, sign,
      center: r.base && r.base.mean != null ? (d) => r.base.mean + (ind.expected ? ind.expected(d) : 0) : null,
      sd: r.base ? r.base.sd : 0, dateOf: ui.domain === 'env' ? (d) => H.dayToDate(d) : dayDate, bandK: 2, sparse: ind.cadence > 2,
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
          ${c.personal ? `<div class="vitals">
            <div class="field"><label for="f-sleep">Hours slept <small>h</small></label><input id="f-sleep" name="sleep" type="number" min="0" max="16" step="0.25" inputmode="decimal" value="${v.vitals.sleep ?? ''}"></div>
          </div>` : `<p class="muted small">Your watch logged <b class="mono">${H.fmt(ds.crew[c.id].series.sleep[M.day], 1)} h</b> last sleep period.</p>`}
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
          <legend>${c.personal ? 'Your readings <span class="muted small">— optional; every reading helps HELIOS learn your normal</span>' : 'Manual vitals <span class="muted small">— optional, only if a sensor is unavailable</span>'}</legend>
          <div class="vitals">
            <div class="field"><label for="f-rhr">Resting HR <small>bpm</small></label><input id="f-rhr" name="rhr" type="number" min="30" max="200" inputmode="numeric" value="${v.vitals.rhr || ''}" placeholder="${H.fmt(me().inds.rhr.current, 0)}"></div>
            <div class="field"><label for="f-sbp">Systolic BP <small>mmHg</small></label><input id="f-sbp" name="sbp" type="number" min="70" max="250" inputmode="numeric" value="${v.vitals.sbp || ''}" placeholder="${H.fmt(me().inds.sbp.current, 0)}"></div>
            <div class="field"><label for="f-temp">Temperature <small>°C</small></label><input id="f-temp" name="temp" type="number" min="34" max="42" step="0.1" inputmode="decimal" value="${v.vitals.temp || ''}" placeholder="${H.fmt(me().inds.temp.current, 1)}"></div>
            ${c.personal ? `<div class="field"><label for="f-hrv">HRV (RMSSD) <small>ms</small></label><input id="f-hrv" name="hrv" type="number" min="5" max="250" inputmode="numeric" value="${v.vitals.hrv ?? ''}"></div>
            <div class="field"><label for="f-exer">Exercise <small>min</small></label><input id="f-exer" name="exer" type="number" min="0" max="600" inputmode="numeric" value="${v.vitals.exer ?? ''}"></div>` : ''}
          </div>
        </fieldset>
        ${slot('checkin-fields', c, v)}
        <fieldset>
          <legend>Anything else?</legend>
          <label for="f-notes" class="sr-only">Note for your record</label><textarea id="f-notes" name="notes" rows="3" placeholder="Optional note for your record">${esc(v.notes)}</textarea>
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
      symptoms: fd.getAll('symptoms'), vitals: { rhr: num('rhr'), sbp: num('sbp'), temp: num('temp'), sleep: num('sleep'), hrv: num('hrv'), exer: num('exer') },
      notes: String(fd.get('notes') || '').slice(0, 1000), share: fd.get('share'), t: Date.now(),
    };
    H.bus.emit('checkin-submit', entry, fd);
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
          <h2 class="ct">Your entries</h2>
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
    const PB = me().inds.pvt.base;
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
          <h2 class="ct">Your reference</h2>
          <ul class="kv">
            <li><span>${PB && PB.mean != null ? SOURCE_LABEL[PB.source] : 'Your baseline'}</span><span class="mono">${PB && PB.mean != null ? `${Math.round(PB.mean)} ± ${Math.round(PB.sd)} ms` : `learning ${PB ? PB.n : 0}/7 tests`}</span></li>
            <li><span>Lapse threshold</span><span class="mono">&gt; ${PVT_LAPSE} ms</span></li>
          </ul>
          <h2 class="ct">Recent tests</h2>
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
    Object.assign(pvt, { state: 'wait', trials: [], falseStarts: 0, endAt: performance.now() + pvt.duration * 1000, result: null, crewId: ui.crewId });
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
    if (pvt.crewId !== ui.crewId) { pvt.state = 'idle'; return; }   // crew changed mid-test: discard
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
    const z = st.base && st.base.mean != null ? (r.mean - st.base.mean) / st.base.sd : null;
    return `<div class="pvt-msg result">
      ${pill(st.status)}
      <div class="pvt-big mono">${r.mean}<small> ms</small></div>
      <span>${z == null ? `HELIOS is still learning your baseline (${st.base ? st.base.n : 0}/7 tests).` : z <= 1 ? 'In line with your baseline.' : `${z.toFixed(1)} SD slower than your baseline.`} ${r.lapses} lapse${r.lapses === 1 ? '' : 's'} · ${r.falseStarts} early · median ${r.median} ms · ${r.n} trials</span>
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
          ${slot('protocol-detail', p)}
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
          ${slot('report-actions')}
          <button class="btn primary" data-action="queue">Queue for downlink · ${size} KB</button>
        </div></div>
      <div class="card report">
        <div class="report-head">
          <div><span class="k">Crew member</span><b>${esc(c.name)}</b><small>${esc(c.role)}</small></div>
          <div><span class="k">Mission</span><b>${esc(M.name)}</b><small>Day ${M.day} · ${dayDate(M.day).toISOString().slice(0, 10)}</small></div>
          <div><span class="k">Readiness</span><b class="t-${lv(a.overall)}">${a.readiness} / 100</b><small>${H.LEVEL_LABEL[a.overall]}</small></div>
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Domain</th><th>Status</th><th>Key indicators</th></tr></thead>
          <tbody>${a.domains.map((d) => `<tr><td>${d.name}</td><td>${pill(d.status)}</td><td>${d.list.map((r) => `<span class="kvi ${r.status ? 't-' + lv(r.status) : ''}">${r.ind.short} <b class="mono">${H.fmt(r.current, r.ind.dec)}</b> ${r.ind.unit}</span>`).join('')}</td></tr>`).join('')}</tbody>
        </table></div>
        <h2 class="ct">Findings</h2>
        ${a.insights.length ? `<ul class="findings">${a.insights.map((i) => `<li>${pill(i.level)}<span>${esc(i.title)}</span><small>${H.ESCALATION[i.escalate]} · ${i.protocol}</small></li>`).join('')}</ul>` : '<p class="muted">No active findings.</p>'}
        <h2 class="ct">Crew actions log</h2>
        ${entries.length ? `<ul class="log">${entries.map((l) => `<li><span class="mono">D${l.day} ${new Date(l.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>${esc(l.text)}</li>`).join('')}</ul>` : '<p class="muted small">No actions logged yet. Check-ins, tests, protocol steps and escalations appear here.</p>'}
      </div>
      <div class="card">
        <h2 class="ct">${ICON.antenna} Downlink queue</h2>
        ${store.queue.length ? `<ul class="log">${store.queue.map((q) => `<li><span class="mono">D${+q.day}</span>${esc(q.title)} <small class="muted">· ${+q.kb} KB · ${esc(q.crewName)}</small></li>`).join('')}</ul>
          <button class="btn sm ghost" data-action="clear-queue">Clear queue</button>` : '<p class="muted small">Nothing queued. Items you flag for the flight surgeon are batched here for the next window.</p>'}
      </div>`;
  }

  // ---------- crew ----------
  function vCrew() {
    const rows = crewList().map((c) => {
      const a = A[c.id], ci = todayCheckin(c.id);
      const privateBehav = ci && ci.share === 'private';
      return `<tr>
        <td><button class="crew-cell" data-action="set-crew" data-id="${c.id}"><span class="avatar">${esc(c.initials)}</span><span><b>${esc(c.name)}</b><small>${esc(c.role)}</small></span></button></td>
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
      <div class="crew-findings">${crewList().map((c) => A[c.id].insights.filter((i) => !i.private).map((i) => `<button class="cf lvl-${lv(i.level)}" data-action="set-crew" data-id="${c.id}">${pill(i.level)}<span><b>${esc(c.name)}</b> — ${esc(i.title)}</span>${ICON.arrow}</button>`).join('')).join('')}</div>`;
  }

  // ---------- validation on real data ----------
  const PANEL_NAME = { cbc: 'Blood count', cmp: 'Metabolic', cardio: 'Cardiovascular', immune: 'Cytokine' };

  function aurocBar(v) {
    const pct = Math.max(0, Math.min(1, v)) * 100;
    const cls = v >= 0.75 ? 'good' : v > 0.55 ? 'fair' : 'poor';
    return `<span class="auc ${cls}"><span class="auc-track"><i style="width:${pct}%"></i><b style="left:50%"></b></span><span class="mono">${v.toFixed(2)}</span></span>`;
  }

  function scoreStrip(m) {
    const scores = m.rows.map((r) => r.score);
    let lo = Math.min(...scores), hi = Math.max(...scores);
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const W = 640, rowH = 46, L = 64, R = 20, Hh = 4 * rowH + 28;
    const X = (v) => L + ((v - lo) / (hi - lo)) * (W - L - R);
    const crew = ['C001', 'C002', 'C003', 'C004'];
    let svg = `<svg class="strip" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Scores per crew member and blood draw">`;
    svg += `<text class="tick" x="${L}" y="${Hh - 6}">lower score · looks normal</text><text class="tick" x="${W - R}" y="${Hh - 6}" text-anchor="end">higher score · looks abnormal</text>`;
    crew.forEach((c, i) => {
      const y = 18 + i * rowH;
      svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text class="tick" x="${L - 12}" y="${y + 4}" text-anchor="end">${c}</text>`;
      m.rows.filter((r) => r.subject === c).sort((a, b) => a.label - b.label).forEach((r) => {
        const pre = r.t.startsWith('L');
        svg += `<g class="sdot ${r.label ? 'pos' : pre ? 'pre' : 'rec'}"><circle cx="${X(r.score)}" cy="${y}" r="${r.label ? 8 : 6}"><title>${c} ${r.t}: ${r.score}</title></circle>${r.label ? `<text x="${X(r.score)}" y="${y - 13}" text-anchor="middle">R+1</text>` : ''}</g>`;
      });
    });
    return svg + '</svg>';
  }

  // The nested search and ensemble are shown as a fourth "run" so the same table and chart serve them.
  function finalRun(V) {
    const N = V.nested, last = V.runs[V.runs.length - 1];
    return {
      config: { id: 'final', label: 'Final · ensemble & nested search' }, dataset: last.dataset, markers: last.markers,
      results: [
        { id: 'ensemble', name: 'Ensemble of 24 models', kind: 'ML · rank-averaged', desc: `Averages the within-person rank from all ${N.grid} configurations (3 panel sets × 2 models × 4 feature counts). No selection step, so nothing is tuned to the test crew.`,
          auroc: N.ensemble.auroc, aurocPostOnly: N.ensemble.aurocPostOnly, pValue: N.ensemble.pValue, top1: N.ensemble.top1, crew: N.crew, rows: N.ensemble.rows },
        { id: 'nested', name: 'Nested model search', kind: 'ML · auto-selected', desc: 'For each held-out astronaut, picks the best of 24 configurations using only the other three crew, then applies it. The most honest estimate of "searching for the best model".',
          auroc: N.auroc, aurocPostOnly: N.aurocPostOnly, pValue: N.pValue, top1: N.top1, crew: N.crew, rows: N.rows,
          sensitivity: N.personal.sensitivity, specificity: N.personal.specificity },
      ],
    };
  }

  function vValidation() {
    const V = H.VALIDATION;
    if (!V) return '<div class="empty"><div><b>No validation results.</b><p>Run <code>node tools/evaluate.js</code> to generate them.</p></div></div>';
    const runs = V.nested ? V.runs.concat([finalRun(V)]) : V.runs;
    const run = runs.find((r) => r.config.id === ui.vrun) || runs[runs.length - 1];
    const m = run.results.find((x) => x.id === ui.vmethod) || run.results[0];
    const helios = V.runs[0].results.find((x) => x.id === 'rules');
    const N = V.nested;
    const stat = (k, v, sub) => `<div class="stat"><span class="k">${k}</span><span class="v mono">${v}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const maxZ = Math.max(...run.markers.map((x) => Math.abs(x.meanZ)));

    return `
      <div class="page-head"><div><p class="eyebrow">Model validation · real astronaut data</p><h1>How well do the models work on real crew blood data?</h1>
        <p class="lede">HELIOS's detection methods, tested on open clinical data from the four SpaceX Inspiration4 crew members, published by NASA. The task: using each person's own preflight blood draws as their baseline, single out the draw taken the day after landing (R+1) from normal draws.</p></div></div>

      ${N ? `<section class="v-final">
        <div class="v-headline best">
          <span class="eyebrow">Best result · ensemble of ${N.grid} models</span>
          <div class="v-big mono t-nominal" data-count-dec="${N.ensemble.auroc}">${N.ensemble.auroc.toFixed(2)}<small> AUROC</small></div>
          <p>Ranks the R+1 draw first for <b>${N.ensemble.top1} of ${N.crew}</b> crew. Among post-flight draws AUROC is <b>${N.ensemble.aurocPostOnly.toFixed(2)}</b> (p = ${N.ensemble.pValue.toFixed(3)}).</p>
        </div>
        <div class="v-headline muted-card">
          <span class="eyebrow">Honest estimate · nested model search</span>
          <div class="v-big mono t-monitor">${N.auroc.toFixed(2)}<small> AUROC</small></div>
          <p>Choosing one "best" configuration inside each fold scores lower — the choice itself is noisy with 4 people (p = ${N.pValue.toFixed(2)}).</p>
        </div>
        <div class="v-headline muted-card">
          <span class="eyebrow">Current HELIOS rules</span>
          <div class="v-big mono t-action">${helios.auroc.toFixed(2)}<small> AUROC</small></div>
          <p>Counting values 3+ SD from personal baseline does <b>no better than chance</b> on lab panels (0.50 = chance).</p>
        </div>
      </section>` : ''}
      <section class="v-hero">
        <div class="stats v-data">
          ${stat('Crew', V.dataset.crew, 'Inspiration4')}
          ${stat('Blood draws', V.dataset.crew * V.dataset.timepoints.length, '3 pre · 4 post')}
          ${stat('Lab values', V.dataset.features, '4 panels')}
          ${stat('Test cases', `${V.dataset.positives}+${V.dataset.negatives}`, 'R+1 vs normal')}
        </div>
      </section>

      <div class="card">
        <div class="detail-head">
          <div><h2>Results by method</h2><p class="muted small">${esc(V.protocol)}</p></div>
        </div>
        <div class="seg v-runs">${runs.map((r) => `<button class="${r.config.id === run.config.id ? 'active' : ''}" data-action="vrun" data-id="${r.config.id}">${esc(r.config.label.split(' · ')[0])}<small>${esc(r.config.label.split(' · ')[1])}</small></button>`).join('')}</div>
        <div class="table-wrap">
          <table class="table v-table">
            <thead><tr><th>Method</th><th>AUROC</th><th title="AUROC among post-flight draws only">Post-flight only</th><th>p</th><th>Sensitivity</th><th>Specificity</th><th title="Crew members whose R+1 draw scored highest of their post-flight draws">R+1 ranked first</th></tr></thead>
            <tbody>${run.results.map((x) => `<tr class="${x.id === m.id ? 'active' : ''}" data-action="vmethod" data-id="${x.id}">
              <td><b>${esc(x.name)}</b><small>${esc(x.kind)}</small></td>
              <td>${aurocBar(x.auroc)}</td><td class="mono">${x.aurocPostOnly.toFixed(2)}</td>
              <td class="mono ${x.pValue < 0.05 ? 't-nominal' : 'muted'}">${x.pValue.toFixed(3)}</td>
              <td class="mono">${x.sensitivity == null ? '—' : Math.round(x.sensitivity * 100) + '%'}</td><td class="mono">${x.specificity == null ? '—' : Math.round(x.specificity * 100) + '%'}</td>
              <td class="mono">${x.top1} / ${x.crew}</td></tr>`).join('')}</tbody>
          </table>
        </div>
        <p class="muted small">AUROC: 1.0 = perfect ranking, 0.5 = chance. Sensitivity and specificity use a threshold learned on the other three crew. p is from a 20,000-label permutation test and is not corrected for the many methods and runs compared.</p>
      </div>

      <div class="v-grid">
        <div class="card">
          <h2 class="ct">${esc(m.name)} · scores per draw</h2>
          <p class="muted small">${esc(m.desc)}</p>
          ${scoreStrip(m)}
          <div class="legend-row"><span><i class="sw pos"></i>R+1 (day after landing)</span><span><i class="sw rec"></i>Recovery R+45/82/194</span><span><i class="sw pre"></i>Preflight</span></div>
        </div>
        <div class="card">
          <h2 class="ct">Largest changes the day after landing</h2>
          <p class="muted small">Average shift from each person's preflight baseline at R+1 (${esc(run.config.label.split(' · ')[0])}).</p>
          <ul class="markers">${run.markers.slice(0, 10).map((x) => `<li><span>${esc(x.name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()))}<small>${PANEL_NAME[x.panel]} · ${x.sameDir}/4 crew same direction</small></span>
            <span class="zbar ${x.meanZ < 0 ? 'neg' : 'pos'}"><i style="width:${(Math.abs(x.meanZ) / maxZ) * 50}%"></i></span><span class="mono">${x.meanZ > 0 ? '+' : ''}${x.meanZ.toFixed(1)} SD</span></li>`).join('')}</ul>
        </div>
      </div>

      <div class="card">
        <h2 class="ct">What this means — and what it doesn't</h2>
        <ul class="v-notes">
          ${N ? `<li><b>Averaging beats picking.</b> The rank-averaged ensemble (${N.ensemble.auroc.toFixed(2)}) outperforms choosing one configuration by inner cross-validation (${N.auroc.toFixed(2)}): with 4 people, which single model "wins" is mostly luck, while the average is stable. The ensemble design was chosen after runs 1–3, so treat it as promising rather than proven.</li>` : ''}
          <li><b>A supervised spaceflight signature works better than outlier counting.</b> Learning which lab values move together after flight (on the other three crew) picked out R+1 for 3 of 4 people. Counting individual outliers did not.</li>
          <li><b>The research cytokine panel added noise.</b> Restricting to standard blood count and metabolic values (what an on-board analyzer measures) improved the supervised models; run 3 was chosen after seeing runs 1–2, so its score is optimistic.</li>
          <li><b>Alarms need per-person calibration.</b> A threshold learned on other crew catches 0–25% of R+1 draws. Comparing each post-flight score with the person's own preflight scores does better (nested model: ${N ? Math.round(N.personal.sensitivity * 100) + '% sensitivity, ' + Math.round(N.personal.specificity * 100) + '% specificity' : 'see report'}), but is still far from flight-ready.</li>
          <li><b>This is 4 people and a 3-day flight.</b> No result here is statistically robust after correcting for multiple comparisons. Long-duration data (e.g. NASA's Twins Study, ISS crews) is available only by application.</li>
          <li><b>Wearable indicators are not validated here.</b> No open in-flight heart-rate, sleep or PVT data exists for astronauts, so those parts of HELIOS remain tested on simulated data only.</li>
        </ul>
        <p class="muted small">Data: NASA Open Science Data Repository — ${V.dataset.studies.map((s) => `${s.label} (${s.osd})`).join(', ')}. Reproduce with <code>node tools/evaluate.js</code>.</p>
      </div>`;
  }

  // ---------- personal profile ----------
  const SOURCE_LABEL = { preflight: 'Preflight baseline', learned: 'Learned baseline', adaptive: 'Adaptive baseline', rebased: 'Your chosen normal', calibrating: 'Calibrating', default: 'Population default' };
  const SOURCE_TEXT = {
    preflight: 'from your readings before mission start', learned: 'learned from your first readings', adaptive: 'adapting to you over time',
    rebased: 'set from 14 days you marked as normal', calibrating: 'needs more readings', default: 'standard reference until HELIOS knows you',
  };
  const BASELINE_FIELDS = () => H.INDICATORS.filter((i) => i.base && !i.derived && !i.expected);

  function adaptStats(a) {
    const c = { preflight: 0, learned: 0, adaptive: 0, rebased: 0, calibrating: 0, default: 0 };
    BASELINE_FIELDS().forEach((i) => { const b = a.inds[i.id].base; if (b) c[b.source]++; });
    return c;
  }

  function adaptCard(a) {
    const st = adaptStats(a), total = BASELINE_FIELDS().length;
    const mine = st.preflight + st.learned + st.adaptive + st.rebased;
    const sens = H.SENSITIVITY[store.profile.sensitivity] || H.SENSITIVITY.standard;
    return `<div class="card adapt-card">
      <h2 class="ct">${ICON.profile} Tuned to you</h2>
      <div class="adapt-meter"><i style="width:${(mine / total) * 100}%"></i><b style="width:${(st.calibrating / total) * 100}%"></b></div>
      <p class="small"><b class="mono">${mine}/${total}</b> baselines are personal${st.calibrating ? ` · <b class="mono">${st.calibrating}</b> learning` : ''}.</p>
      <p class="muted small">Alerts: <b>${sens.label}</b> (${sens.zMon}/${sens.zAct} SD).</p>
      <button class="link" data-action="nav" data-view="profile">Manage baselines & data ${ICON.arrow}</button>
    </div>`;
  }

  function vProfile() {
    const p = store.profile;
    if (!p || ui.editProfile) return profileForm(p);
    const a = A.me, day = H.personalDay(p), st = adaptStats(a);
    const recs = (store.personal && store.personal.records) || {};
    const nReadings = Object.values(recs).reduce((s, r) => s + Object.keys(r).length, 0);
    const nCheck = Object.keys(store.checkins.me || {}).length, nPvt = (store.pvt.me || []).length;
    const rows = BASELINE_FIELDS().map((ind) => {
      const r = a.inds[ind.id], B = r.base || { source: 'default' };
      return `<tr>
        <td><button class="link-row" data-action="open-ind" data-ind="${ind.id}"><b>${ind.short}</b><small>${ind.unit}</small></button></td>
        <td><span class="src src-${B.source}">${SOURCE_LABEL[B.source]}</span></td>
        <td class="mono">${B.mean != null ? `${H.fmt(B.mean, ind.dec)} ± ${H.fmt(B.sd, ind.dec)}` : `${B.n || 0}/${B.need || 7}`}</td>
        <td class="mono">${r.noData ? '—' : H.fmt(r.current, ind.dec)}</td>
        <td>${r.noData ? '' : pill(r.status)}</td>
        <td class="right">${B.source === 'rebased' ? `<button class="btn sm ghost" data-action="unrebase" data-ind="${ind.id}">Reset</button>` : !r.noData && B.source !== 'calibrating' ? `<button class="btn sm ghost" data-action="rebase" data-ind="${ind.id}">Normal for me</button>` : ''}</td>
      </tr>`;
    }).join('');
    return `
      <div class="page-head"><div class="who">
        <span class="avatar big">${initials(p.name)}</span>
        <div><p class="eyebrow">My profile</p><h1>${esc(p.name)}</h1><p class="lede">${esc(p.role || 'Astronaut')} · ${esc(p.mission || 'My mission')} · day ${day} of ${+p.plannedDays} · started ${esc(p.start)}</p></div>
      </div><button class="btn" data-action="edit-profile">Edit profile</button></div>

      <section class="adapt-hero">
        ${[['preflight', st.preflight], ['learned', st.learned + st.adaptive], ['rebased', st.rebased], ['calibrating', st.calibrating], ['default', st.default]].map(([k, n]) => `<div class="stat"><span class="k">${k === 'learned' ? 'Learned & adaptive' : SOURCE_LABEL[k]}</span><span class="v mono">${n}</span><small>${SOURCE_TEXT[k]}</small></div>`).join('')}
      </section>

      <div class="grid-2">
        <div class="card">
          <h2 class="ct">Alert sensitivity</h2>
          <p class="muted small">How far from <em>your</em> normal a reading must be before HELIOS raises Monitor and Action.</p>
          <div class="sens">${Object.entries(H.SENSITIVITY).map(([k, v]) => `<button class="${(p.sensitivity || 'standard') === k ? 'active' : ''}" data-action="sensitivity" data-k="${k}"><b>${v.label}</b><span class="mono">${v.zMon} / ${v.zAct} SD</span><small>${v.note}</small></button>`).join('')}</div>
        </div>
        <div class="card">
          <h2 class="ct">${ICON.upload} Your data</h2>
          <p class="muted small"><b class="mono">${nReadings}</b> imported readings over <b class="mono">${Object.keys(recs).length}</b> days · <b class="mono">${nCheck}</b> check-ins · <b class="mono">${nPvt}</b> alertness tests. Everything stays on this device.</p>
          <div class="btns">
            <label class="btn sm primary file-btn">${ICON.upload} Import CSV<input type="file" accept=".csv,text/csv" data-change="import-csv" hidden></label>
            <button class="btn sm" data-action="csv-template">CSV template</button>
            <button class="btn sm" data-action="export-me">Export backup</button>
            <button class="btn sm" data-action="export-readings">Export readings CSV</button>
            <label class="btn sm file-btn">Restore backup<input type="file" accept=".json,application/json" data-change="import-json" hidden></label>
          </div>
          <p class="muted small">CSV: one row per day — a <code>date</code> column (YYYY-MM-DD) plus any of ${H.LOGGABLE.map((x) => `<code>${x}</code>`).join(' ')}. Rows dated before your mission start become your preflight baseline.</p>
        </div>
      </div>

      <div class="card table-wrap">
        <h2 class="ct">Your baselines</h2>
        <table class="table">
          <thead><tr><th>Indicator</th><th>Source</th><th>Your normal</th><th>Current</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="muted small">Preflight readings are used first. Without them HELIOS learns from your first 7 readings, then adapts slowly using readings more than 14 days old (30-day half-life), skipping outliers. The spread is blended with the population reference so a few readings can't make the band unrealistically tight.</p>
      </div>
      ${slot('profile-bottom')}
      <div class="danger"><button class="btn sm ghost" data-action="delete-me">Delete my profile and data</button></div>`;
  }

  function profileForm(p) {
    const v = p || { name: '', role: 'Flight Engineer', mission: 'My mission', start: new Date().toISOString().slice(0, 10), plannedDays: 180, sensitivity: 'standard', priorDose: 0, baseline: {} };
    const fields = BASELINE_FIELDS().map((i) => `<div class="field"><label for="b-${i.id}">${i.short} <small>${i.unit}</small></label><input id="b-${i.id}" name="b-${i.id}" type="number" step="any" inputmode="decimal" value="${v.baseline && v.baseline[i.id] != null ? v.baseline[i.id] : ''}" placeholder="${i.base[0]}"></div>`).join('');
    return `
      <div class="page-head"><div><p class="eyebrow">${p ? 'Edit profile' : 'Personalize HELIOS'}</p><h1>${p ? 'Your profile' : 'Make HELIOS yours'}</h1>
        <p class="lede">HELIOS judges every reading against <b>your</b> normal, not a population average. Tell it a little about you — everything is optional except your name, and it never leaves this device.</p></div></div>
      <form id="profile-form" class="card form" autocomplete="off">
        <fieldset><legend>About you</legend>
          <div class="vitals">
            <div class="field"><label for="p-name">Name</label><input id="p-name" name="name" type="text" required maxlength="60" value="${esc(v.name)}"></div>
            <div class="field"><label for="p-role">Role</label><input id="p-role" name="role" type="text" maxlength="40" value="${esc(v.role)}"></div>
            <div class="field"><label for="p-dose">Prior career dose <small>mSv</small></label><input id="p-dose" name="priorDose" type="number" min="0" step="any" value="${v.priorDose || 0}"></div>
          </div>
        </fieldset>
        <fieldset><legend>Mission</legend>
          <div class="vitals">
            <div class="field"><label for="p-mission">Mission name</label><input id="p-mission" name="mission" type="text" maxlength="40" value="${esc(v.mission)}"></div>
            <div class="field"><label for="p-start">Start date</label><input id="p-start" name="start" type="date" required value="${esc(v.start)}"></div>
            <div class="field"><label for="p-days">Planned duration <small>days</small></label><input id="p-days" name="plannedDays" type="number" min="1" max="3000" required value="${v.plannedDays}"></div>
          </div>
        </fieldset>
        <fieldset><legend>Preflight baselines <span class="muted small">— optional; leave blank and HELIOS learns them from your first week</span></legend>
          <div class="base-grid">${fields}</div>
        </fieldset>
        <fieldset><legend>Alert sensitivity</legend>
          <div class="choice">${Object.entries(H.SENSITIVITY).map(([k, s]) => `<label><input type="radio" name="sensitivity" value="${k}" ${v.sensitivity === k ? 'checked' : ''}><span><b>${s.label}</b> · ${s.note}</span></label>`).join('')}</div>
        </fieldset>
        <div class="form-foot">${p ? '<button type="button" class="btn" data-action="cancel-profile">Cancel</button>' : ''}<button type="submit" class="btn primary">${p ? 'Save profile' : 'Create my profile'} ${ICON.arrow}</button></div>
      </form>`;
  }

  function submitProfile(form) {
    const fd = new FormData(form);
    const baseline = {};
    BASELINE_FIELDS().forEach((i) => { const x = parseFloat(fd.get('b-' + i.id)); if (Number.isFinite(x)) baseline[i.id] = x; });
    const prev = store.profile || {};
    store.profile = H.sanitize.profile({
      uid: prev.uid, name: fd.get('name'), role: fd.get('role'), mission: fd.get('mission'), start: fd.get('start'), plannedDays: fd.get('plannedDays'),
      priorDose: fd.get('priorDose'), sensitivity: fd.get('sensitivity'), baseline, rebase: prev.rebase || {}, created: prev.created || Date.now(), updated: Date.now(),
    });
    const dropped = Object.keys(baseline).filter((k) => !(k in store.profile.baseline));
    if (dropped.length) toast(`Ignored impossible baseline value${dropped.length > 1 ? 's' : ''}: ${dropped.map((k) => H.INDICATORS.find((i) => i.id === k).short).join(', ')}. Check the units.`);
    store.personal = store.personal || { records: {} };
    ui.editProfile = false;
    ui.crewId = 'me';
    log(prev.name ? 'Profile updated' : 'Profile created — HELIOS is now learning your baselines', 'profile');
    recompute();
    go(prev.name ? 'profile' : 'overview');
    if (!prev.name) toast('Profile created. Add a check-in or import readings so HELIOS can learn your normal.');
  }

  function importCsv(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) { toast('That CSV has no data rows.'); return; }
    const head = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const di = head.indexOf('date');
    if (di < 0) { toast('The CSV needs a "date" column.'); return; }
    const cols = head.map((h, i) => (H.LOGGABLE.includes(h) ? [i, h] : null)).filter(Boolean);
    if (!cols.length) { toast(`No recognised columns. Use: ${H.LOGGABLE.join(', ')}.`); return; }
    const recs = (store.personal = store.personal || { records: {} }).records;
    let n = 0, days = 0, pre = 0, bad = 0;
    lines.slice(1).forEach((l) => {
      const cells = l.split(',');
      const date = (cells[di] || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      let any = false;
      cols.forEach(([i, id]) => {
        const x = parseFloat(cells[i]);
        if (!Number.isFinite(x)) return;
        if (!H.plausible(id, x)) { bad++; return; }
        (recs[date] = recs[date] || {})[id] = x; n++; any = true;
      });
      if (any) { days++; if (H.dayOf(date, store.profile.start) < 1) pre++; }
    });
    log(`Imported ${n} readings over ${days} days`, 'import');
    recompute(); render();
    toast(`Imported ${n} readings over ${days} days${pre ? ` (${pre} days before mission start used as preflight baseline)` : ''}${bad ? `; ${bad} implausible value${bad === 1 ? '' : 's'} skipped — check units` : ''}.`);
  }

  function download(name, text, type) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type }));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  // ---------- command palette ----------
  const palette = { open: false, q: '', i: 0 };
  function commands() {
    const list = NAV.map((n) => ({ label: `Go to ${n.label}`, hint: 'Navigate', run: () => go(n.id) }));
    H.INDICATORS.concat(H.ENV_INDICATORS).forEach((ind) => list.push({ label: `Trend: ${ind.name}`, hint: 'Indicator', run: () => {
      ui.domain = ind.domain || 'env'; ui.ind = ind.id; go('trends');
    } }));
    H.PROTOCOLS.forEach((p) => list.push({ label: `${p.id} ${p.title}`, hint: 'Protocol', run: () => { ui.protocol = p.id; go('protocols'); } }));
    crewList().forEach((c) => list.push({ label: `Switch to ${c.name}`, hint: c.role, run: () => { switchCrew(c.id); go('overview'); } }));
    list.push({ label: 'Play voice briefing', hint: 'Action', run: speak });
    list.push({ label: 'Take the guided tour', hint: 'Action', run: () => H.tour && H.tour.start() });
    list.push({ label: 'Toggle sleep-period display', hint: 'Action', run: () => $('[data-action="night"]').click() });
    list.push({ label: 'Start alertness test', hint: 'Action', run: () => { go('pvt'); pvtStart(); } });
    list.push({ label: 'Queue downlink report', hint: 'Action', run: () => { go('report'); $('[data-action="queue"]').click(); } });
    return list;
  }
  function paletteMatches() {
    const norm = (x) => x.normalize('NFKC').toLowerCase();
    const q = norm(palette.q.trim());
    const all = commands();
    if (!q) return all.slice(0, 9);
    return all.filter((c) => q.split(/\s+/).every((w) => norm(c.label + ' ' + c.hint).includes(w))).slice(0, 9);
  }
  function renderPalette() {
    const el = $('#palette');
    if (!palette.open) { el.hidden = true; el.innerHTML = ''; return; }
    const items = paletteMatches();
    palette.i = Math.min(palette.i, Math.max(0, items.length - 1));
    const listHtml = items.length ? items.map((c, i) => `<li role="option" aria-selected="${i === palette.i}" class="${i === palette.i ? 'sel' : ''}" data-pi="${i}"><span>${esc(c.label)}</span><small>${esc(c.hint)}</small></li>`).join('') : '<li class="none">No matching command</li>';
    if (el.hidden || !$('#pal-input')) {
      el.hidden = false;
      el.innerHTML = `<div class="pal-box" role="dialog" aria-label="Command palette">
        <div class="pal-in">${ICON.search}<input id="pal-input" placeholder="Search views, indicators, protocols, crew…" autocomplete="off" aria-label="Search commands"><kbd>esc</kbd></div>
        <ul class="pal-list" role="listbox"></ul></div>`;
      const inp = $('#pal-input');
      inp.value = palette.q;
      inp.addEventListener('input', () => { palette.q = inp.value; palette.i = 0; renderPalette(); });
      inp.focus();
    }
    $('.pal-list').innerHTML = listHtml;
  }
  function openPalette() { palette.ret = document.activeElement; palette.open = true; palette.q = ''; palette.i = 0; renderPalette(); }
  function closePalette() {
    palette.open = false; renderPalette();
    if (palette.ret && document.contains(palette.ret)) palette.ret.focus({ preventScroll: true });
  }
  function runPalette(i) {
    const c = paletteMatches()[i];
    closePalette();
    if (c) c.run();
  }

  function animateIn() {
    if (H.cosmos && H.cosmos.reduced) return;
    const v = $('#view');
    v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
    document.querySelectorAll('[data-count]').forEach((el) => {
      const target = +el.dataset.count, t0 = performance.now();
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / 1100), e = 1 - (1 - k) ** 3;
        el.textContent = Math.round(target * e);
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
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
    else if (act === 'set-crew') { switchCrew(el.dataset.id); go('overview'); }
    else if (act === 'open-protocol') { ui.protocol = el.dataset.id; go('protocols'); }
    else if (act === 'night') {
      // The moon button flips between the sleep display and whatever theme was chosen before.
      const cur = H.theme.get();
      H.theme.set(cur === 'night' ? (H.theme.prev || 'dark') : (H.theme.prev = cur, 'night'));
      if (H.redrawStars) H.redrawStars();
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
      H.bus.emit('protocol-complete', { protocol: p, steps: n, crewId: ui.crewId, day: M.day, a: me(), series: ds.crew[ui.crewId].series });
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
    else if (act === 'brief') speak();
    else if (act === 'emergency-export') { let raw = ''; try { raw = localStorage.getItem(STORE_KEY) || localStorage.getItem('helios.vault') || ''; } catch (err) { /* ignore */ } download('helios-raw-data.json', raw, 'application/json'); }
    else if (act === 'emergency-reset') { if (window.confirm('Clear the saved data on this device and start fresh? Download the raw data first if you need it.')) { try { localStorage.removeItem(STORE_KEY); localStorage.removeItem('helios.vault'); } catch (err) { /* ignore */ } location.reload(); } }
    else if (act === 'trend-view') { ui.trendTable = el.dataset.v === 'table'; render(); }
    else if (act === 'trend-csv') {
      const r = resultFor(ui.ind), [d0, d1] = trendRange();
      const rows = r.pts.filter((p) => p[0] >= d0 && p[0] <= d1).map(([d, v]) => `${trendDate(d)},${d},${+v.toFixed(r.ind.dec + 2)}`);
      download(`helios-${me().crew.id}-${r.ind.id}.csv`, `date,mission_day,${r.ind.id}\n${rows.join('\n')}\n`, 'text/csv');
    }
    else if (act === 'export-readings') {
      // Everything HELIOS knows about you, in the same format the CSV importer reads.
      const cd = ds.crew.me, p = store.profile, ids = H.LOGGABLE;
      const lines = [['date'].concat(ids).join(',')];
      for (let d = 1; d <= cd.day; d++) {
        const vals = ids.map((id) => (cd.series[id][d] == null ? '' : +cd.series[id][d].toFixed(3)));
        if (vals.some((v) => v !== '')) lines.push([H.dayToDate(d, p.start).toISOString().slice(0, 10)].concat(vals).join(','));
      }
      download(`helios-readings-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n') + '\n', 'text/csv');
    }
    else if (act === 'more') openMore();
    else if (act === 'close-more') closeMore();
    else if (act === 'more-scrim') { if (e.target === el) closeMore(); }
    else if (act === 'edit-profile') { ui.editProfile = true; render(); }
    else if (act === 'cancel-profile') { ui.editProfile = false; render(); }
    else if (act === 'sensitivity') {
      store.profile.sensitivity = el.dataset.k;
      log(`Alert sensitivity set to ${H.SENSITIVITY[el.dataset.k].label}`, 'profile');
      recompute(); render();
    }
    else if (act === 'rebase' || act === 'unrebase') {
      const id = el.dataset.ind, ind = H.INDICATORS.find((i) => i.id === id);
      store.profile.rebase = store.profile.rebase || {};
      if (act === 'rebase') { store.profile.rebase[id] = H.personalDay(store.profile); log(`Marked current ${ind.short} as normal`, 'profile'); toast(`${ind.short}: your last 14 days are now your normal.`); }
      else { delete store.profile.rebase[id]; log(`${ind.short} baseline reset to automatic`, 'profile'); }
      recompute(); render();
    }
    else if (act === 'csv-template') download('helios-readings-template.csv', ['date'].concat(H.LOGGABLE).join(',') + '\n', 'text/csv');
    else if (act === 'export-me') {
      const keep = (o) => (o && o.me ? { me: o.me } : {});
      const b = { helios: 1, profile: store.profile, personal: store.personal };
      PERSONAL_KEYS.forEach((k) => { b[k] = keep(store[k]); });
      download(`helios-profile-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b, null, 2), 'application/json');
    }
    else if (act === 'delete-me') {
      if (!window.confirm('Delete your profile, imported readings, check-ins and test results from this device? This cannot be undone.')) return;
      delete store.profile; delete store.personal;
      PERSONAL_KEYS.forEach((k) => { if (store[k]) delete store[k].me; });
      store.log = store.log.filter((l) => l.crew !== 'me');
      ui.crewId = 'nakamura'; save(); recompute(); go('overview'); toast('Your profile and data were deleted.');
    }
    else if (act === 'palette') openPalette();
    else if (act === 'vrun') { ui.vrun = el.dataset.id; render(); }
    else if (act === 'vmethod') { ui.vmethod = el.dataset.id; render(); }
    else H.bus.emit('action:' + act, el, e);
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.change && el.dataset.change !== 'crew' && el.dataset.change !== 'step' && !el.dataset.change.startsWith('import-')) H.bus.emit('change:' + el.dataset.change, el, e);
    if (el.dataset.change === 'crew') { switchCrew(el.value); render(); }
    else if (el.dataset.change === 'import-csv' || el.dataset.change === 'import-json') {
      const f = el.files && el.files[0];
      if (!f) return;
      if (f.size > 5e6) { toast('That file is too large (5 MB max).'); return; }
      const kind = el.dataset.change;
      f.text().then((t) => {
        if (kind === 'import-csv') { importCsv(t); return; }
        try {
          const b = JSON.parse(t);
          if (!b || b.helios !== 1 || !b.profile) throw new Error('not a HELIOS backup');
          const candidate = { ...store, profile: b.profile, personal: b.personal || { records: {} } };
          PERSONAL_KEYS.forEach((k) => { if (b[k] && b[k].me) candidate[k] = { ...(store[k] || {}), me: b[k].me }; });
          const clean = H.sanitize.store(candidate);
          H.personalBaselines(clean.profile, H.buildPersonal(clean.profile, clean));   // throws if still unusable
          Object.keys(store).forEach((k) => delete store[k]);
          Object.assign(store, clean);
          ['checkins', 'pvt', 'steps'].forEach((k) => { if (b[k] && b[k].me) (store[k] = store[k] || {}).me = b[k].me; });
          ui.crewId = 'me'; log('Profile restored from backup', 'import'); recompute(); render(); toast('Backup restored.');
        } catch (err) { toast('That file is not a HELIOS backup.'); }
      });
      el.value = '';
    }
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
    if (e.target.id === 'profile-form') { e.preventDefault(); submitProfile(e.target); }
    else if (e.target.id && !['checkin-form'].includes(e.target.id) && handlers['submit:' + e.target.id]) { e.preventDefault(); H.bus.emit('submit:' + e.target.id, e.target); }
  });

  document.addEventListener('mousedown', (e) => {
    if (!palette.open) return;
    const li = e.target.closest('[data-pi]');
    if (li) { e.preventDefault(); runPalette(+li.dataset.pi); }
    else if (!e.target.closest('.pal-box')) closePalette();
  });
  document.addEventListener('pointerdown', (e) => {
    if (ui.view === 'pvt' && e.target.closest('#pvt-box') && !e.target.closest('button')) { e.preventDefault(); pvtRespond(); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette.open ? closePalette() : openPalette(); return; }
    if (palette.open) {
      const n = paletteMatches().length;
      if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); palette.i = (palette.i + 1) % Math.max(1, n); renderPalette(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); palette.i = (palette.i - 1 + n) % Math.max(1, n); renderPalette(); }
      else if (e.key === 'Enter') { e.preventDefault(); runPalette(palette.i); }
      return;
    }
    if (e.key === 'Enter' && e.target.matches && e.target.matches('g.spot')) { e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
    if (e.key === 'Escape' && !$('#more-sheet').hidden) { closeMore(); return; }
    if (e.key === 'Escape' && $('#spe') && !$('#spe').classList.contains('min')) { const m = $('#spe [data-action="spe-min"], #spe [data-action="spe-cancel"]'); if (m) m.click(); return; }
    if (e.key === '/' && !e.target.closest('input, textarea, select')) { e.preventDefault(); openPalette(); return; }
    if (ui.view === 'pvt' && e.code === 'Space' && pvt.state !== 'idle' && pvt.state !== 'done') { e.preventDefault(); pvtRespond(); }
  });

  window.addEventListener('hashchange', () => {
    const v = location.hash.slice(1);
    if (v && v !== ui.view && NAV.some((n) => n.id === v)) go(v);
  });
  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (ui.view === 'trends') mountTrendChart(); }, 150); });

  // ---------- theme: dark (default), day (light), night (red sleep display), or follow the system ----------
  H.theme = {
    get() {
      try {
        const t = localStorage.getItem('helios.theme');
        if (t) return t;
        return localStorage.getItem('helios.night') === '1' ? 'night' : 'dark';   // older setting
      } catch (e) { return 'dark'; }
    },
    set(t) { try { localStorage.setItem('helios.theme', t); } catch (e) { /* ignore */ } H.theme.apply(); },
    apply() {
      const t = H.theme.get();
      const light = t === 'day' || (t === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
      document.body.classList.toggle('night', t === 'night');
      document.body.classList.toggle('day', light);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = light ? '#eef2f7' : t === 'night' ? '#050101' : '#05070d';
      if (H.redrawStars) H.redrawStars();
    },
  };
  if (window.matchMedia) matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (H.theme.get() === 'system') { H.theme.apply(); render(); } });

  // ---------- feature API ----------
  H.app = {
    store, ui, ICON, M, $, esc, pill, lv, T, save, log, toast, go, slot, download,
    render: () => render(), recompute: () => recompute(), blackout, arrivalText, normalize, armAutoLock, trapFocus, me: () => me(), crew: () => crewList(),
    data: () => ds, assessments: () => A, dayFor, dayDate, todayCheckin,
    addView(v) { EXTRA_VIEWS[v.id] = v; if (!NAV.find((n) => n.id === v.id)) NAV.push(v); if (v.icon && v.iconSvg) ICON[v.icon] = v.iconSvg; },
    addIcon(name, svgInner) { ICON[name] = P(svgInner); },
  };
  (H.features || []).forEach((setup) => setup(H.app));

  // ---------- lock screen (encryption at rest) ----------
  function showLock() {
    const el = document.createElement('div');
    el.id = 'lock';
    // Wrong-PIN count and lockout survive reloads; each extra failure doubles the wait.
    const readF = () => { try { return JSON.parse(localStorage.getItem('helios.lockfails')) || { n: 0, until: 0 }; } catch (e) { return { n: 0, until: 0 }; } };
    const writeF = (f) => { try { localStorage.setItem('helios.lockfails', JSON.stringify(f)); } catch (e) { /* ignore */ } };
    el.innerHTML = `<form class="lock-box" autocomplete="off">
      <svg viewBox="0 0 32 32" class="boot-logo" aria-hidden="true"><circle cx="16" cy="16" r="6.5" class="sun"/><ellipse cx="16" cy="16" rx="14" ry="6" class="orbit" transform="rotate(-25 16 16)"/></svg>
      <h1>HELIOS</h1><p>${T('Your health record is encrypted on this device.')}</p>
      <label for="lock-pin" class="sr-only">PIN</label>
      <input id="lock-pin" type="password" autocomplete="current-password" placeholder="PIN or passphrase" maxlength="128" required>
      <button class="btn primary" type="submit">${T('Unlock')}</button><p class="lock-msg" role="status"></p>
      <button type="button" class="link lock-forgot" aria-expanded="false" aria-controls="lock-reset">${T('Forgot PIN?')}</button>
      <div id="lock-reset" class="lock-reset" hidden>
        <p><b>${T('Your data cannot be recovered without the PIN.')}</b> ${T('It is encrypted on this device and nobody — including the HELIOS developers — holds a copy of the key.')}</p>
        <p>${T('You can erase it and start fresh, then restore a backup from My profile if you exported one.')}</p>
        <label for="lock-erase">${T('Type ERASE to confirm')}</label>
        <input id="lock-erase" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false">
        <button type="button" class="btn danger-btn" data-erase disabled>${T('Erase my data and start fresh')}</button>
      </div></form>`;
    document.body.appendChild(el);
    const input = el.querySelector('input'), msg = el.querySelector('.lock-msg');
    // Forgot PIN: the only way out is erasing the encrypted record (it cannot be decrypted).
    const forgot = el.querySelector('.lock-forgot'), reset = el.querySelector('#lock-reset');
    const confirmBox = el.querySelector('#lock-erase'), eraseBtn = el.querySelector('[data-erase]');
    forgot.addEventListener('click', () => {
      reset.hidden = !reset.hidden;
      forgot.setAttribute('aria-expanded', String(!reset.hidden));
      if (!reset.hidden) confirmBox.focus();
    });
    confirmBox.addEventListener('input', () => { eraseBtn.disabled = confirmBox.value.trim().toUpperCase() !== 'ERASE'; });
    confirmBox.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!eraseBtn.disabled) eraseBtn.click(); } });
    eraseBtn.addEventListener('click', () => {
      if (confirmBox.value.trim().toUpperCase() !== 'ERASE') return;
      try {
        ['helios.vault', 'helios.lockfails', STORE_KEY].forEach((k) => localStorage.removeItem(k));
        // Keep the acceptance of the current terms so the person isn't asked again immediately.
        localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, prefs: { termsVersion: (H.TERMS || {}).version || '', termsAt: Date.now(), toured: true } }));
      } catch (err) { /* storage blocked */ }
      try { sessionStorage.removeItem('helios.booted'); } catch (err) { /* ignore */ }
      location.reload();
    });
    input.focus();
    el.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = readF();
      if (Date.now() < f.until) { msg.textContent = `Too many attempts — wait ${Math.ceil((f.until - Date.now()) / 1000)} s.`; return; }
      msg.textContent = T('Unlocking…');
      try {
        const data = await H.vault.unlock(input.value);
        writeF({ n: 0, until: 0 });
        Object.keys(store).forEach((k) => delete store[k]);
        Object.assign(store, normalize(data));
        ui.crewId = store.profile ? 'me' : 'nakamura';
        el.remove();
        safeStart();
      } catch (err) {
        input.value = '';
        f.n++;
        if (f.n >= 5) f.until = Date.now() + 30000 * 2 ** Math.min(10, f.n - 5);
        writeF(f);
        msg.textContent = f.n >= 5 ? `Wrong PIN. Locked for ${Math.round((f.until - Date.now()) / 1000)} s.` : `Wrong PIN (${f.n}/5).`;
      }
    });
  }

  // Auto-lock after inactivity when encryption is on.
  let idleTimer = null;
  function armAutoLock() {
    const min = (store.prefs && store.prefs.autoLockMin) || 10;
    clearTimeout(idleTimer);
    if (!(H.vault && H.vault.unlocked())) return;
    idleTimer = setTimeout(async () => { await H.vault.flush(); H.vault.lock(); location.reload(); }, min * 60000);
  }
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, armAutoLock, { passive: true }));
  window.addEventListener('pagehide', () => { if (H.vault) H.vault.flush(); });
  window.addEventListener('error', (e) => { if (e.message && !/ResizeObserver/.test(e.message)) console.warn('HELIOS error:', e.message); });

  // ---------- boot ----------
  H.theme.apply();
  const initial = location.hash.slice(1);
  if (NAV.some((n) => n.id === initial)) ui.view = initial;
  if (H.vault && H.vault.enabled() && !H.vault.unlocked()) { const b = $('#boot'); if (b) b.remove(); showLock(); }
  else safeStart();

  function safeStart() {
    try { start(); } catch (err) {
      console.error(err);
      const b = $('#boot'); if (b) b.remove();
      $('#view').innerHTML = `<div class="empty err"><div><b>HELIOS could not load your saved data.</b><p>${esc(err && err.message)}</p>
        <div class="btns"><button class="btn" data-action="emergency-export">Download raw data</button><button class="btn primary" data-action="emergency-reset">Start fresh</button></div></div></div>`;
    }
  }

  function start() {
  armAutoLock();
  H.bus.emit('boot');
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  recompute();
  if (H.cosmos) H.cosmos.starfield($('#stars'));
  const nominal = H.CREW.filter((c) => A[c.id].overall === 0).length;
  const bootEl = $('#boot');
  if (bootEl && H.cosmos) {
    H.cosmos.boot(bootEl, [
      ['Bio-harness telemetry', `${H.CREW.length} crew linked`],
      ['Actigraphy & sleep', 'synced'],
      ['Personal dosimeters', `${H.fmt(A.nakamura.inds.dose.current, 2)} mSv/day`],
      ['Cabin atmosphere', `CO₂ ${H.fmt(A.nakamura.env.co2.current, 2)} mmHg`],
      ['Personal baselines', `${H.INDICATORS.length} indicators`],
      ['Assessment engine', `${nominal}/${H.CREW.length} crew nominal`],
      ['Earth link', `${Math.floor(M.lightTimeSec / 60)}m ${pad2(M.lightTimeSec % 60)}s one-way`],
    ], () => {});
  }
  render();
  setInterval(tickClock, 1000);
  }
})(window.H);
