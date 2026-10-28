/*
 * HELIOS feature — settings: language, glove mode, voice control, offline install and
 * end-to-end encrypted sync between crew devices and the ground.
 */
window.H = window.H || {};
(H.features = H.features || []).push(function (app) {
  'use strict';
  const { esc, store } = app;
  const T = app.T;
  let installEvt = null, rec = null, listening = false, lastHeard = '';
  const ui = { pinForm: false };

  app.addIcon('settings', '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>');
  app.addView({ id: 'settings', label: 'Settings', group: 'me', icon: 'settings', render });

  const prefs = () => (store.prefs = store.prefs || { glove: false, sync: { url: 'http://localhost:8787', passphrase: '', device: 'Tablet-1', delay: false } });
  const applyPrefs = () => document.body.classList.toggle('glove', !!prefs().glove);

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });

  // ---------- voice control ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function startVoice() {
    if (!SR) { app.toast('Voice control is not supported in this browser.'); return; }
    rec = new SR();
    rec.continuous = true; rec.interimResults = false; rec.lang = { en: 'en-US', fr: 'fr-FR', de: 'de-DE', ja: 'ja-JP', ru: 'ru-RU', hi: 'hi-IN' }[H.getLang()] || 'en-US';
    rec.onresult = (e) => { const t = e.results[e.results.length - 1][0].transcript.trim().toLowerCase(); lastHeard = t; command(t); };
    rec.onend = () => { if (listening) try { rec.start(); } catch (err) { /* already started */ } };
    rec.onerror = (e) => { if (e.error === 'not-allowed') { listening = false; app.toast('Microphone permission was denied.'); app.render(); } };
    listening = true; rec.start(); app.render();
  }
  function stopVoice() { listening = false; if (rec) rec.stop(); app.render(); }

  // "open trends", "go to medical kit", "start check-in", "briefing", "night mode", "help"
  function command(t) {
    const say = (m) => app.toast(`🎙 “${t}” → ${m}`);
    if (/brief/.test(t)) { document.querySelector('[data-action="brief"]') ? document.querySelector('[data-action="brief"]').click() : app.go('overview'); return say('briefing'); }
    if (/night|sleep mode|dark/.test(t)) { document.querySelector('[data-action="night"]').click(); return say('sleep-period display'); }
    if (/check.?in/.test(t)) { app.go('checkin'); return say('check-in'); }
    if (/emergency|triage|help me/.test(t)) { app.go('triage'); return say('triage'); }
    const nav = document.querySelectorAll('#nav [data-view]');
    for (const a of nav) {
      const label = a.querySelector('.nl') ? a.querySelector('.nl').textContent.toLowerCase() : '';
      const words = label.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3);
      if (label && (t.includes(label) || words.some((w) => t.includes(w)))) { app.go(a.dataset.view); return say(label); }
    }
    say('not recognised — try “open trends” or “briefing”');
  }

  // ---------- encrypted sync ----------
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function key(pass, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  // Channel id is a hash of the passphrase, so the server can route bundles without learning it.
  async function channel(pass) { return b64(await crypto.subtle.digest('SHA-256', enc.encode('helios-channel:' + pass))).replace(/[^a-z0-9]/gi, '').slice(0, 32); }
  const SYNC_KEYS = ['profile', 'personal', 'checkins', 'pvt', 'labs', 'cog', 'outcomes', 'medlog', 'medkit', 'queue', 'log'];

  async function push() {
    const s = prefs().sync;
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const body = Object.fromEntries(SYNC_KEYS.filter((k) => store[k] != null).map((k) => [k, store[k]]));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(s.passphrase, salt), enc.encode(JSON.stringify(body)));
    const r = await fetch(`${s.url}/v1/bundle/${await channel(s.passphrase)}`, { method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device: s.device, t: Date.now(), salt: b64(salt), iv: b64(iv), ct: b64(ct), delay: !!s.delay }) });
    if (!r.ok) throw new Error(`Server replied ${r.status}`);
    return (await r.json());
  }

  // Merge rule: objects merge key by key; arrays are unioned by JSON identity; scalars keep local.
  function merge(local, remote) {
    if (Array.isArray(local) && Array.isArray(remote)) {
      const seen = new Set(local.map((x) => JSON.stringify(x)));
      return local.concat(remote.filter((x) => !seen.has(JSON.stringify(x))));
    }
    if (local && remote && typeof local === 'object' && typeof remote === 'object') {
      const out = Object.assign({}, local);
      Object.keys(remote).forEach((k) => { out[k] = k in local ? merge(local[k], remote[k]) : remote[k]; });
      return out;
    }
    return local === undefined ? remote : local;
  }

  async function pull() {
    const s = prefs().sync;
    const r = await fetch(`${s.url}/v1/bundle/${await channel(s.passphrase)}`);
    if (!r.ok) throw new Error(`Server replied ${r.status}`);
    const { bundles } = await r.json();
    let n = 0;
    for (const b of bundles) {
      if (b.device === s.device) continue;
      try {
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(b.iv) }, await key(s.passphrase, unb64(b.salt)), unb64(b.ct));
        const data = JSON.parse(dec.decode(pt));
        SYNC_KEYS.forEach((k) => { if (data[k] != null) store[k] = merge(store[k], data[k]); });
        n++;
      } catch (e) { /* wrong passphrase or tampered bundle: skip */ }
    }
    return n;
  }

  function render() {
    const p = prefs(), s = p.sync;
    const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    const swOn = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
    return `<div class="page-head"><div><p class="eyebrow">${T('Settings')}</p><h1>${T('Settings')}</h1></div></div>
      <div class="grid-2">
        <div class="card"><h3>${T('Language')}</h3>
          <div class="choice">${H.LANGS.map(([k, n]) => `<label><input type="radio" name="lang" value="${k}" data-change="set-lang" ${H.getLang() === k ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
          <p class="muted small">Navigation, headings and common controls are translated; detailed medical text is still English.</p></div>
        <div class="card"><h3>${T('Guided tour')}</h3><p class="muted small">${T('A one-minute walk through the dashboard.')}</p><button class="btn" data-action="tour-start">${T('Take the tour')}</button></div>
        <div class="card"><h3>${T('Glove mode')}</h3>
          <label class="switch"><input type="checkbox" data-change="glove" ${p.glove ? 'checked' : ''}><span></span>${T('Larger touch targets and text for use with gloves or in turbulence')}</label></div>
        <div class="card"><h3>🎙 ${T('Voice control')}</h3>
          <p class="muted small">Say “open trends”, “start check-in”, “briefing”, “night mode” or “triage”. Uses the browser's speech recognition, which in Chrome is processed online — it won't work without a connection.</p>
          <button class="btn ${listening ? 'on' : 'primary'}" data-action="voice-toggle" ${SR ? '' : 'disabled'}>${listening ? 'Stop listening' : SR ? 'Start listening' : 'Not supported in this browser'}</button>
          ${lastHeard ? `<p class="small">Last heard: “${esc(lastHeard)}”</p>` : ''}</div>
        <div class="card"><h3>⤓ ${T('Install app')}</h3>
          <p class="muted small">${standalone ? 'HELIOS is running as an installed app.' : 'Install HELIOS so it opens like a native app and keeps working with no connection.'} Offline cache: <b>${swOn ? 'active' : 'not active yet (reload once)'}</b>.</p>
          ${installEvt ? '<button class="btn primary" data-action="install">Install HELIOS</button>' : standalone ? '' : '<p class="muted small">If no install button appears, use your browser menu → “Install app” / “Add to Home Screen”.</p>'}</div>
      </div>
      <div class="card">
        <h3>🔒 ${T('Privacy lock')}</h3>
        ${H.vault.enabled()
          ? `<p class="small">${T('On')} — your record is stored only as AES-256-GCM ciphertext. Auto-lock after
              <select class="input inline" data-change="autolock" aria-label="Auto-lock minutes">${[2, 5, 10, 30, 60].map((m) => `<option value="${m}" ${(p.autoLockMin || 10) === m ? 'selected' : ''}>${m} min</option>`).join('')}</select> idle.</p>
            <div class="btns"><button class="btn" data-action="lock-now">Lock now</button><button class="btn" data-action="pin-change">Change PIN</button><button class="btn ghost" data-action="pin-off">Turn off</button></div>`
          : `<p class="muted small">Encrypt your health record on this device with a PIN. Without the PIN the data cannot be read — <b>if you forget it, the data is lost</b> (keep an exported backup). A short PIN stops casual access, not a determined attacker with your device.</p>
            <button class="btn primary" data-action="pin-on">Set a PIN</button>`}
        ${ui.pinForm ? `<form id="pin-form" class="pin-form"><input name="pin" type="password" inputmode="numeric" minlength="4" maxlength="32" placeholder="New PIN (4+ digits)" required aria-label="New PIN"><input name="pin2" type="password" inputmode="numeric" minlength="4" maxlength="32" placeholder="Repeat PIN" required aria-label="Repeat PIN"><button class="btn primary" type="submit">Save PIN</button></form>` : ''}
      </div>
      <form id="sync-form" class="card form">
        <h3>⇅ ${T('Sync')} · end-to-end encrypted</h3>
        <p class="muted small">Shares your record between crew devices and the ground copy. Data is encrypted on this device with AES-256-GCM using a key derived from the crew passphrase; the server only ever sees ciphertext. Run <code>node tools/sync-server.js</code> for a local server.</p>
        <div class="vitals">
          <div class="field"><label for="sy-url">Server</label><input id="sy-url" name="url" type="text" value="${esc(s.url)}"></div>
          <div class="field"><label for="sy-dev">This device</label><input id="sy-dev" name="device" type="text" value="${esc(s.device)}"></div>
          <div class="field"><label for="sy-pass">Crew passphrase</label><input id="sy-pass" name="passphrase" type="password" autocomplete="off" value="${esc(s.passphrase)}"></div>
        </div>
        <label class="switch"><input type="checkbox" name="delay" ${s.delay ? 'checked' : ''}><span></span>Simulate ${Math.floor(H.MISSION.lightTimeSec / 60)}-minute light-time delay on the ground link (server holds bundles before delivery)</label>
        <div class="form-foot"><button type="submit" class="btn">Save</button><button type="button" class="btn" data-action="sync-pull">Pull</button><button type="button" class="btn primary" data-action="sync-push">Push now</button></div>
        ${p.lastSync ? `<p class="muted small">Last sync: ${esc(p.lastSync)}</p>` : ''}
      </form>`;
  }

  H.bus.on('change:set-lang', (el) => { H.setLang(el.value); app.render(); });
  H.bus.on('change:glove', (el) => { prefs().glove = el.checked; applyPrefs(); app.save(); app.render(); });
  H.bus.on('action:voice-toggle', () => (listening ? stopVoice() : startVoice()));
  H.bus.on('action:install', async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; app.render(); });
  H.bus.on('submit:sync-form', (f) => {
    const fd = new FormData(f), s = prefs().sync;
    s.url = String(fd.get('url') || '').replace(/\/+$/, ''); s.device = String(fd.get('device') || 'Device').slice(0, 40);
    s.passphrase = String(fd.get('passphrase') || ''); s.delay = fd.get('delay') === 'on';
    app.save(); app.toast('Sync settings saved.');
  });
  const ready = () => { const s = prefs().sync; if (!s.passphrase || s.passphrase.length < 8) { app.toast('Set a crew passphrase of at least 8 characters, then Save.'); return false; } return true; };
  H.bus.on('action:sync-push', async () => {
    if (!ready()) return;
    try { const r = await push(); prefs().lastSync = `pushed ${new Date().toLocaleString()}${r.deliverAt ? ` · delivered to ground ${new Date(r.deliverAt).toLocaleTimeString()}` : ''}`; app.save(); app.log('Encrypted record pushed to sync server', 'sync'); app.toast('Encrypted bundle sent.'); app.render(); }
    catch (e) { app.toast(`Sync failed: ${e.message}`); }
  });
  H.bus.on('action:sync-pull', async () => {
    if (!ready()) return;
    try { const n = await pull(); prefs().lastSync = `pulled ${new Date().toLocaleString()} · ${n} device bundle${n === 1 ? '' : 's'} merged`; app.save(); app.recompute(); app.toast(`Merged ${n} bundle${n === 1 ? '' : 's'}.`); app.render(); }
    catch (e) { app.toast(`Sync failed: ${e.message}`); }
  });
  H.bus.on('boot', applyPrefs);

  // ---------- privacy lock ----------
  H.bus.on('action:pin-on', () => { ui.pinForm = true; app.render(); });
  H.bus.on('action:pin-change', () => { ui.pinForm = true; app.render(); });
  H.bus.on('submit:pin-form', async (f) => {
    const fd = new FormData(f), pin = String(fd.get('pin')), pin2 = String(fd.get('pin2'));
    if (pin.length < 4) { app.toast('Use at least 4 digits.'); return; }
    if (pin !== pin2) { app.toast('The PINs do not match.'); return; }
    await H.vault.enable(pin, store);
    ui.pinForm = false; app.log('Privacy lock turned on', 'privacy'); app.armAutoLock();
    app.toast('Encrypted. The plain-text copy was removed from this device.'); app.render();
  });
  H.bus.on('action:pin-off', async () => {
    if (!window.confirm('Turn off the privacy lock? Your record will be stored unencrypted on this device.')) return;
    await H.vault.disable(store); app.log('Privacy lock turned off', 'privacy'); app.render();
  });
  H.bus.on('action:lock-now', async () => { await H.vault.flush(); H.vault.lock(); location.reload(); });
  H.bus.on('change:autolock', (el) => { prefs().autoLockMin = +el.value; app.save(); app.armAutoLock(); });

  H.sync = { merge, channel, command };
});
