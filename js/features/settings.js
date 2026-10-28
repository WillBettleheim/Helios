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

  const prefs = () => (store.prefs = store.prefs || { glove: false, sync: { url: 'http://localhost:8787', device: 'Tablet-1', delay: false } });
  const applyPrefs = () => document.body.classList.toggle('glove', !!prefs().glove);

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });

  // ---------- voice control ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function startVoice() {
    if (!SR) { app.toast('Voice control is not supported in this browser.'); return; }
    if (rec) { rec.onend = null; try { rec.stop(); } catch (err) { /* not running */ } }
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
  // The passphrase lives only in memory for this session; it is never written to storage.
  let syncPass = '';
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const pbkdf2 = async (pass, salt, bits) => {
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
    return { base, salt };
  };
  async function key(pass, salt) {
    const { base } = await pbkdf2(pass, salt);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  // Channel id: slow (PBKDF2) derivation, so a server cannot cheaply test passphrase guesses.
  const channelCache = new Map();
  async function channel(pass) {
    if (channelCache.has(pass)) return channelCache.get(pass);
    const { base } = await pbkdf2(pass);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode('helios-channel-v2'), iterations: 210000, hash: 'SHA-256' }, base, 128);
    const id = [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
    channelCache.set(pass, id);
    return id;
  }

  const PERSONAL = ['checkins', 'pvt', 'labs', 'cog', 'outcomes', 'medlog', 'planner'];
  // What a device shares: its owner's record (tagged with a stable person id) plus crew-shared state.
  function bundle() {
    const me = {};
    PERSONAL.forEach((k) => { if (store[k] && store[k].me) me[k] = store[k].me; });
    return {
      person: store.profile ? { uid: store.profile.uid, profile: store.profile, personal: store.personal, ...me } : null,
      shared: { medkit: store.medkit || null },
    };
  }

  const byKey = (a, b, kf) => { const m = new Map(); a.concat(b).forEach((x) => { const k = kf(x); const cur = m.get(k); if (!cur || (x.ts || x.t || 0) > (cur.ts || cur.t || 0)) m.set(k, x); }); return [...m.values()]; };
  // Same person, another device: merge record by record; the newer entry wins.
  function mergePerson(local, remote) {
    if (!local || !remote) return;
    if ((remote.profile.updated || 0) > (store.profile.updated || 0)) store.profile = remote.profile;
    const recs = (store.personal = store.personal || { records: {} }).records;
    Object.entries((remote.personal || {}).records || {}).forEach(([d, v]) => { recs[d] = Object.assign({}, v, recs[d] || {}); });
    const mine = (k) => ((store[k] = store[k] || {}).me = store[k].me || (k === 'checkins' || k === 'planner' ? {} : []));
    if (remote.checkins) { const c = mine('checkins'); Object.entries(remote.checkins).forEach(([d, e]) => { if (!c[d] || (e.t || 0) > (c[d].t || 0)) c[d] = e; }); }
    if (remote.planner && !Object.keys(mine('planner')).length) { store.planner.me = remote.planner; }
    const KEYS = { pvt: (x) => x.ts, cog: (x) => x.ts, outcomes: (x) => `${x.protocol}@${x.ts}`, medlog: (x) => `${x.name}@${x.t}`, labs: (x) => x.id };
    Object.entries(KEYS).forEach(([k, kf]) => { if (remote[k]) { const merged = byKey(mine(k), remote[k], kf); store[k].me = merged; } });
  }
  // Crew-shared medical kit: per item, the most recently updated count wins.
  function mergeKit(remote) {
    if (!Array.isArray(remote)) return;
    if (!store.medkit) { store.medkit = remote; return; }
    remote.forEach((r) => {
      const l = store.medkit.find((x) => x.name === r.name);
      if (!l) store.medkit.push(r);
      else if ((r.updated || 0) > (l.updated || 0)) Object.assign(l, r);
    });
  }

  async function push() {
    const s = prefs().sync;
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(syncPass, salt), enc.encode(JSON.stringify(bundle())));
    const r = await fetch(`${s.url}/v1/bundle/${await channel(syncPass)}`, { method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device: s.device, t: Date.now(), salt: b64(salt), iv: b64(iv), ct: b64(ct), delay: !!s.delay }) });
    if (!r.ok) throw new Error(`Server replied ${r.status}`);
    return r.json();
  }

  async function pull() {
    const s = prefs().sync;
    const r = await fetch(`${s.url}/v1/bundle/${await channel(syncPass)}`);
    if (!r.ok) throw new Error(`Server replied ${r.status}`);
    const { bundles } = await r.json();
    const res = { mine: 0, crew: 0, bad: 0 };
    for (const b of bundles) {
      if (b.device === s.device) continue;
      let data;
      try {
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(b.iv) }, await key(syncPass, unb64(b.salt)), unb64(b.ct));
        data = JSON.parse(dec.decode(pt));
      } catch (e) { res.bad++; continue; }
      // Everything from outside goes through the sanitizer before it can touch the record.
      const clean = H.sanitize.store({ profile: data.person && data.person.profile, personal: data.person && data.person.personal,
        ...Object.fromEntries(PERSONAL.map((k) => [k, data.person && data.person[k] ? { me: data.person[k] } : undefined])), medkit: data.shared && data.shared.medkit });
      const person = clean.profile ? { profile: clean.profile, personal: clean.personal, ...Object.fromEntries(PERSONAL.map((k) => [k, clean[k] && clean[k].me])) } : null;
      if (person && store.profile && person.profile.uid === store.profile.uid) { mergePerson(store.profile, person); res.mine++; }
      else if (person) res.crew++;          // a crewmate's record stays theirs
      mergeKit(clean.medkit);
    }
    return res;
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
        <p class="muted small">Keeps your record in step across your own devices and shares the crew medical-kit inventory. Each bundle is encrypted on this device with AES-256-GCM (key from the crew passphrase via PBKDF2); the server only sees ciphertext and a slow-hashed channel id. Crewmates' records are never merged into yours. Run <code>node tools/sync-server.js</code> for a local server.</p>
        <div class="vitals">
          <div class="field"><label for="sy-url">Server</label><input id="sy-url" name="url" type="text" value="${esc(s.url)}"></div>
          <div class="field"><label for="sy-dev">This device</label><input id="sy-dev" name="device" type="text" value="${esc(s.device)}"></div>
          <div class="field"><label for="sy-pass">Crew passphrase <small>kept in memory only</small></label><input id="sy-pass" name="passphrase" type="password" autocomplete="off" minlength="12" value="${esc(syncPass)}"></div>
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
    syncPass = String(fd.get('passphrase') || ''); s.delay = fd.get('delay') === 'on';
    app.save(); app.toast('Sync settings saved.');
  });
  const ready = () => { if (syncPass.length < 12) { app.toast('Enter a crew passphrase of at least 12 characters, then Save.'); return false; } return true; };
  H.bus.on('action:sync-push', async () => {
    if (!ready()) return;
    try { const r = await push(); prefs().lastSync = `pushed ${new Date().toLocaleString()}${r.deliverAt ? ` · delivered to ground ${new Date(r.deliverAt).toLocaleTimeString()}` : ''}`; app.save(); app.log('Encrypted record pushed to sync server', 'sync'); app.toast('Encrypted bundle sent.'); app.render(); }
    catch (e) { app.toast(`Sync failed: ${e.message}`); }
  });
  H.bus.on('action:sync-pull', async () => {
    if (!ready()) return;
    try {
      const r = await pull();
      prefs().lastSync = `pulled ${new Date().toLocaleString()} · ${r.mine} of your devices merged · ${r.crew} crewmate bundle${r.crew === 1 ? '' : 's'} kept separate${r.bad ? ` · ${r.bad} unreadable` : ''}`;
      app.save(); app.recompute(); app.toast(`Merged ${r.mine} of your own device${r.mine === 1 ? '' : 's'}; crewmates' records stay on their devices.`); app.render();
    }
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

  H.sync = { mergePerson, mergeKit, bundle, channel, command, setPass: (p) => { syncPass = p; } };
});
