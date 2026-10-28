/*
 * HELIOS feature — solar particle event (SPE) warning and storm-shelter timer.
 * A warning gives a countdown to proton arrival; once sheltered, HELIOS tracks time in the
 * shelter and estimates the dose received and avoided, then logs the event on all-clear.
 */
window.H = window.H || {};
(H.features = H.features || []).push(function (app) {
  'use strict';
  const { esc, store } = app;
  const T = app.T;
  const RATE_OUT = 3.0, RATE_SHELTER = 0.45;   // mSv/h during a strong event, outside vs. in the water-wall shelter
  let tick = null;

  const sw = () => (store.spaceWeather = store.spaceWeather || { state: 'quiet', events: [] });

  function fmtT(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function overlay() {
    const w = sw();
    let el = document.getElementById('spe');
    if (w.state === 'quiet') { if (el) el.remove(); clearInterval(tick); tick = null; return; }
    if (!el) { el = document.createElement('div'); el.id = 'spe'; el.setAttribute('role', 'alertdialog'); document.body.appendChild(el); }
    const now = Date.now();
    if (w.state === 'warning') {
      const left = w.arrival - now;
      el.className = 'spe warning';
      el.innerHTML = `<div class="spe-box">
        <span class="spe-k">☢ ${T('SOLAR PARTICLE EVENT WARNING')}</span>
        <h2>${T('Proton arrival in')}</h2>
        <div class="spe-clock mono">${fmtT(left)}</div>
        <p>${T('Ground forecast: S3 radiation storm. Outside the shelter you would receive about')} <b>${RATE_OUT} mSv/h</b>. ${T('Move to the storm shelter now — run P-RAD-01.')}</p>
        <div class="btns"><button class="btn primary big" data-action="spe-shelter">${T("I'm in the shelter")}</button><button class="btn" data-action="spe-protocol">${T('Open P-RAD-01')}</button></div>
        <small>${T('Demo: this warning was triggered manually.')} <button class="link" data-action="spe-cancel">${T('Cancel')}</button></small></div>`;
    } else {
      const inMs = now - w.shelteredAt, h = inMs / 3.6e6;
      el.className = 'spe shelter';
      el.innerHTML = `<div class="spe-box">
        <span class="spe-k">${T('IN STORM SHELTER')}</span>
        <div class="spe-clock mono">${fmtT(inMs)}</div>
        <div class="spe-stats"><div><span>${T('Dose so far')}</span><b class="mono">${(h * RATE_SHELTER).toFixed(2)} mSv</b></div><div><span>${T('Dose avoided')}</span><b class="mono">${(h * (RATE_OUT - RATE_SHELTER)).toFixed(2)} mSv</b></div></div>
        <p>${T('Stay until the all-clear (dose rate below 3 mSv/day for 6 h). Keep your dosimeter on.')}</p>
        <div class="btns"><button class="btn primary big" data-action="spe-clear">${T('All-clear received')}</button><button class="btn" data-action="spe-min">${T('Minimise')}</button></div></div>`;
    }
    if (w.minimised) { el.classList.add('min'); el.dataset.action = 'spe-show'; } else delete el.dataset.action;
    if (!tick) tick = setInterval(() => {
      const c = document.querySelector('#spe .spe-clock');
      const w2 = sw();
      if (!c || w2.state === 'quiet') return;
      if (w2.state === 'warning') { c.textContent = fmtT(w2.arrival - Date.now()); }
      else overlay();
    }, 1000);
  }

  H.bus.on('slot:overview-side-top', () => {
    const w = sw(), last = w.events.slice(-1)[0];
    return `<div class="card sw-card ${w.state !== 'quiet' ? 'live' : ''}"><h3>☀ ${T('Space weather')}</h3>
      <ul class="kv">
        <li><span>${T('Status')}</span>${w.state === 'quiet' ? app.pill(0, T('Quiet')) : w.state === 'warning' ? app.pill(3, T('SPE warning')) : app.pill(2, T('Sheltering'))}</li>
        <li><span>${T('Background (GCR)')}</span><span class="mono">${H.fmt(app.me().inds.dose.current, 2)} mSv/day</span></li>
        ${last ? `<li><span>${T('Last event')}</span><span class="mono">D${last.day} · ${last.hours.toFixed(1)} h · ${last.dose.toFixed(2)} mSv</span></li>` : ''}
      </ul>
      ${w.state === 'quiet' ? `<button class="link" data-action="spe-sim">${T('Simulate SPE warning')} ${app.ICON.arrow}</button>` : `<button class="link" data-action="spe-show">${T('Show alert')} ${app.ICON.arrow}</button>`}
    </div>`;
  });

  H.bus.on('action:spe-sim', () => { Object.assign(sw(), { state: 'warning', arrival: Date.now() + 30 * 60 * 1000, minimised: false }); app.log('SPE warning received (simulated)', 'radiation'); overlay(); app.render(); });
  H.bus.on('action:spe-cancel', () => { sw().state = 'quiet'; app.save(); overlay(); app.render(); });
  H.bus.on('action:spe-shelter', () => { Object.assign(sw(), { state: 'shelter', shelteredAt: Date.now(), minimised: false }); app.log('Entered storm shelter', 'radiation'); overlay(); app.render(); });
  H.bus.on('action:spe-min', () => { sw().minimised = true; app.save(); overlay(); });
  H.bus.on('action:spe-show', () => { sw().minimised = false; app.save(); overlay(); });
  H.bus.on('action:spe-protocol', () => { sw().minimised = true; app.save(); overlay(); app.ui.protocol = 'P-RAD-01'; app.go('protocols'); });
  H.bus.on('action:spe-clear', () => {
    const w = sw(), hours = (Date.now() - w.shelteredAt) / 3.6e6;
    const ev = { day: app.M.day, hours, dose: hours * RATE_SHELTER, avoided: hours * (RATE_OUT - RATE_SHELTER), crew: app.ui.crewId };
    w.events.push(ev); w.state = 'quiet';
    app.log(`SPE all-clear: ${hours.toFixed(2)} h in shelter, ~${ev.dose.toFixed(2)} mSv received, ~${ev.avoided.toFixed(2)} mSv avoided`, 'radiation');
    app.toast(`Shelter exit logged: ${ev.dose.toFixed(2)} mSv received, ${ev.avoided.toFixed(2)} mSv avoided.`);
    overlay(); app.render();
  });
  H.bus.on('boot', () => setTimeout(overlay, 0));
});
