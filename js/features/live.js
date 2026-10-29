/*
 * HELIOS feature — live heart-rate sensor.
 * Connects to any Bluetooth LE heart-rate strap or watch that uses the standard Heart Rate
 * profile (0x180D), streams heart rate and RR intervals, computes HRV (RMSSD) live, and judges
 * both against the person's own baseline. A clearly-labelled simulator stands in where the
 * browser has no Web Bluetooth (Safari, Firefox) so the demo always runs.
 */
window.H = window.H || {};
(H.features = H.features || []).push(function (app) {
  'use strict';
  const { esc, store } = app;
  const T = app.T;
  const WINDOW_S = 120;
  const st = { source: null, device: null, char: null, hr: [], rr: [], started: 0, sim: null, error: '' };

  app.addIcon('live', '<path d="M3 12h4l2-6 4 12 2-6h6"/>');
  app.addView({ id: 'live', label: 'Live sensor', short: 'Live', group: 'monitor', icon: 'live', render, mount });

  const hasBT = typeof navigator !== 'undefined' && !!navigator.bluetooth;

  // Heart Rate Measurement characteristic (0x2A37): flags, HR (8/16-bit), optional energy, RR (1/1024 s).
  function parseHRM(dv) {
    const flags = dv.getUint8(0);
    let i = 1;
    const hr = flags & 0x01 ? dv.getUint16(i, true) : dv.getUint8(i);
    i += flags & 0x01 ? 2 : 1;
    if (flags & 0x08) i += 2;
    const rr = [];
    if (flags & 0x10) for (; i + 1 < dv.byteLength; i += 2) rr.push((dv.getUint16(i, true) / 1024) * 1000);
    return { hr, rr, contact: flags & 0x04 ? !!(flags & 0x02) : null };
  }

  // Beat quality: a beat is valid if it is physiological (300–2000 ms) and within 20 % of the median
  // of its neighbours. Comparing with the neighbourhood (not just the previous beat) stops one
  // artefact from also rejecting the good beat after it. Tested on real PhysioNet MMASH recordings.
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };
  function validBeats(rr) {
    return rr.map((x, i) => {
      if (!(x >= 300 && x <= 2000)) return false;
      const nb = rr.slice(Math.max(0, i - 2), i).concat(rr.slice(i + 1, i + 3)).filter((y) => y >= 300 && y <= 2000);
      if (!nb.length) return true;
      const m = med(nb);
      return Math.abs(x - m) / m <= 0.2;
    });
  }
  const MIN_QUALITY = 0.8;
  function quality(rr) { if (!rr.length) return null; const ok = validBeats(rr); return ok.filter(Boolean).length / rr.length; }

  // RMSSD from successive differences of *adjacent* valid beats only; null when fewer than 10 pairs
  // or when over 20 % of beats are artefacts (the value would not be trustworthy).
  function rmssd(rr) {
    if (rr.length < 11) return null;
    const ok = validBeats(rr);
    if (ok.filter(Boolean).length / rr.length < MIN_QUALITY) return null;
    let s = 0, n = 0;
    for (let i = 1; i < rr.length; i++) if (ok[i] && ok[i - 1]) { s += (rr[i] - rr[i - 1]) ** 2; n++; }
    return n >= 10 ? Math.sqrt(s / n) : null;
  }

  function push(sample) {
    const t = Date.now();
    st.hr.push([t, sample.hr]);
    sample.rr.forEach((r) => st.rr.push([t, r]));
    const cut = t - WINDOW_S * 1000;
    st.hr = st.hr.filter((x) => x[0] >= cut);
    st.rr = st.rr.filter((x) => x[0] >= cut);
    update();
  }

  async function connect() {
    st.error = '';
    try {
      const device = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
      const server = await device.gatt.connect();
      const svc = await server.getPrimaryService('heart_rate');
      const ch = await svc.getCharacteristic('heart_rate_measurement');
      ch.addEventListener('characteristicvaluechanged', (e) => push(parseHRM(e.target.value)));
      await ch.startNotifications();
      device.addEventListener('gattserverdisconnected', () => { st.source = null; st.error = 'Sensor disconnected.'; app.render(); });
      Object.assign(st, { source: 'ble', device, char: ch, hr: [], rr: [], started: Date.now() });
      app.log(`Live sensor connected: ${device.name || 'heart-rate sensor'}`, 'sensor');
    } catch (e) {
      st.error = e && e.name === 'NotFoundError' ? 'No sensor selected.' : `Could not connect: ${e && e.message}`;
    }
    app.render();
  }

  // Simulator: plausible resting HR with respiratory sinus arrhythmia and slow drift.
  function simulate() {
    stop();
    Object.assign(st, { source: 'sim', hr: [], rr: [], started: Date.now() });
    let phase = 0, base = 62 + Math.random() * 6;
    st.sim = setInterval(() => {
      const rr = [];
      for (let k = 0; k < 1; k++) {
        phase += 0.9;
        const hr = base + 4 * Math.sin(phase / 4) + (Math.random() - 0.5) * 2;
        rr.push(60000 / hr + (Math.random() - 0.5) * 30);
      }
      base += (Math.random() - 0.5) * 0.15;
      push({ hr: Math.round(60000 / rr[0]), rr });
    }, 1000);
    app.render();
  }

  function stop() {
    clearInterval(st.sim); st.sim = null;
    if (st.char) { try { st.char.stopNotifications(); } catch (e) { /* ignore */ } }
    if (st.device && st.device.gatt && st.device.gatt.connected) st.device.gatt.disconnect();
    Object.assign(st, { source: null, device: null, char: null });
  }

  function stats() {
    const hrs = st.hr.map((x) => x[1]);
    const sorted = hrs.slice().sort((a, b) => a - b);
    const rr = st.rr.map((x) => x[1]);
    return { now: hrs[hrs.length - 1], median: sorted.length ? sorted[sorted.length >> 1] : null, hrv: rmssd(rr), quality: quality(rr), beats: rr.length, secs: st.started ? Math.round((Date.now() - st.started) / 1000) : 0 };
  }

  function compare(id, v) {
    const r = app.me().inds[id], B = r.base;
    if (v == null || !B || B.mean == null) return { text: 'learning your baseline', lvl: 0 };
    const z = (v - B.mean) / B.sd, bad = (id === 'hrv' ? -z : z);
    return { text: `${z > 0 ? '+' : ''}${z.toFixed(1)} SD vs your ${H.fmt(B.mean, 0)}`, lvl: bad >= 3 ? 2 : bad >= 2 ? 1 : 0 };
  }

  function spark() {
    if (st.hr.length < 2) return '<svg class="live-spark" viewBox="0 0 600 120"></svg>';
    const t1 = Date.now(), t0 = t1 - WINDOW_S * 1000, ys = st.hr.map((x) => x[1]);
    const lo = Math.min(...ys) - 3, hi = Math.max(...ys) + 3;
    const X = (t) => ((t - t0) / (t1 - t0)) * 600, Y = (v) => 110 - ((v - lo) / (hi - lo || 1)) * 100;
    const d = st.hr.map((x, i) => `${i ? 'L' : 'M'}${X(x[0]).toFixed(1)},${Y(x[1]).toFixed(1)}`).join('');
    return `<svg class="live-spark" viewBox="0 0 600 120" preserveAspectRatio="none" role="img" aria-label="Heart rate over the last 2 minutes"><path d="${d}"/></svg>`;
  }

  function readings() {
    const s = stats(), hrC = compare('rhr', s.median), hvC = compare('hrv', s.hrv);
    return `<div class="live-grid">
      <div class="live-big lvl-${app.lv(hrC.lvl)}"><span class="eyebrow">${T('Heart rate')}</span><b class="mono">${s.now ?? '—'}<small> bpm</small></b><span class="small">${T('2-min median')} ${s.median ?? '—'} · ${esc(hrC.text)}</span></div>
      <div class="live-big lvl-${app.lv(hvC.lvl)}"><span class="eyebrow">${T('HRV (RMSSD)')}</span><b class="mono">${s.hrv != null ? Math.round(s.hrv) : '—'}<small> ms</small></b><span class="small">${s.hrv != null ? esc(hvC.text) : s.beats >= 30 && s.quality != null && s.quality < MIN_QUALITY ? `<span class="t-monitor">${T('Signal too noisy')} (${Math.round(s.quality * 100)}% ${T('clean beats')}) — ${T('moisten the strap electrodes and keep still')}</span>` : st.source === 'ble' ? T('needs RR intervals — keep still, ~20 s') : ''}</span></div>
      <div class="live-big"><span class="eyebrow">${T('Recording')}</span><b class="mono">${Math.floor(s.secs / 60)}:${String(s.secs % 60).padStart(2, '0')}</b><span class="small">${st.hr.length} ${T('samples')}</span></div>
    </div>${spark()}`;
  }

  function update() {
    const el = document.getElementById('live-readings');
    if (el) el.innerHTML = readings();
    const save = document.querySelector('[data-action="live-save"]');
    if (save) save.disabled = stats().secs < 60;
  }

  function render() {
    const name = st.source === 'ble' ? esc(st.device && st.device.name || 'Bluetooth sensor') : st.source === 'sim' ? T('Simulated sensor (demo)') : '';
    return `<div class="page-head"><div><p class="eyebrow">${T('Live sensor')}</p><h1>${T('Your heart, right now')}</h1>
      <p class="lede">Connect a Bluetooth heart-rate strap or watch (Polar, Garmin, Wahoo and most chest straps). HELIOS reads heart rate and beat-to-beat intervals, computes HRV live and compares both with your own baseline. Sit still for two minutes for a resting reading.</p></div></div>
      <div class="card">
        <div class="live-head">
          ${st.source ? `<span class="live-dot ${st.source}"></span><b>${name}</b>` : `<span class="muted">${T('No sensor connected')}</span>`}
          <div class="btns">
            ${st.source ? `<button class="btn" data-action="live-stop">${T('Disconnect')}</button><button class="btn primary" data-action="live-save" disabled title="Available after 60 seconds">${T('Save as resting reading')}</button>`
              : `${hasBT ? `<button class="btn primary" data-action="live-connect">${T('Connect Bluetooth sensor')}</button>` : ''}<button class="btn ${hasBT ? '' : 'primary'}" data-action="live-sim">${T('Use simulated sensor')}</button>`}
          </div>
        </div>
        ${!hasBT ? `<p class="muted small">${T('This browser has no Web Bluetooth (Safari and Firefox). Use Chrome or Edge on desktop or Android for a real sensor.')}</p>` : ''}
        ${st.error ? `<p class="t-action small" role="alert">${esc(st.error)}</p>` : ''}
        <div id="live-readings" aria-live="off">${st.source ? readings() : ''}</div>
      </div>`;
  }

  function mount() { update(); }

  H.bus.on('action:live-connect', connect);
  H.bus.on('action:live-sim', simulate);
  H.bus.on('action:live-stop', () => { stop(); app.render(); });
  H.bus.on('action:live-save', () => {
    const s = stats();
    if (s.secs < 60 || s.median == null) return;
    if (st.source === 'sim') { app.toast('Simulated readings are not saved to your record.'); return; }
    if (!store.profile || app.ui.crewId !== 'me') { app.toast('Create your profile to save real sensor readings.'); return; }
    const date = new Date(); const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const recs = (store.personal = store.personal || { records: {} }).records;
    recs[iso] = Object.assign(recs[iso] || {}, { rhr: s.median }, s.hrv != null ? { hrv: Math.round(s.hrv) } : {});
    app.log(`Resting reading from sensor: ${s.median} bpm${s.hrv != null ? `, HRV ${Math.round(s.hrv)} ms` : ''}`, 'sensor');
    app.recompute(); app.toast('Saved as today\'s resting reading.'); app.render();
  });
  H.bus.on('leave', (v) => { if (v === 'live' && st.source === 'sim') stop(); });

  H.live = { parseHRM, rmssd, quality, validBeats };
});
