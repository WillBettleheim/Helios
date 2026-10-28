/*
 * HELIOS — optional encryption at rest.
 * With a PIN set, the record is stored only as AES-256-GCM ciphertext; the key is derived from
 * the PIN (PBKDF2-SHA-256) and lives in memory while the app is unlocked.
 * A short PIN protects against casual access to the device, not a determined attacker with the
 * device in hand — the settings page says so.
 */
window.H = window.H || {};
(function (H) {
  'use strict';
  const KEY = 'helios.vault', PLAIN = 'helios.v1', ITER = 310000;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };

  let key = null, salt = null, pending = null, timer = null;

  async function derive(pin, s) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: s, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function write(data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
    localStorage.setItem(KEY, JSON.stringify({ v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) }));
  }

  H.vault = {
    enabled: () => !!read(),
    unlocked: () => !!key,
    // Returns the decrypted record, or throws on a wrong PIN.
    async unlock(pin) {
      const v = read();
      salt = unb64(v.salt);
      const k = await derive(pin, salt);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(v.iv) }, k, unb64(v.ct));
      key = k;
      return JSON.parse(dec.decode(pt));
    },
    // Turn encryption on: encrypt the current record and remove the plaintext copy.
    async enable(pin, data) {
      salt = crypto.getRandomValues(new Uint8Array(16));
      key = await derive(pin, salt);
      await write(data);
      localStorage.removeItem(PLAIN);
    },
    async disable(data) {
      localStorage.setItem(PLAIN, JSON.stringify(data));
      localStorage.removeItem(KEY);
      key = null;
    },
    async changePin(pin, data) { await H.vault.enable(pin, data); },
    // Debounced save while unlocked.
    save(data) {
      if (!key) return;
      pending = data;
      clearTimeout(timer);
      timer = setTimeout(() => { const d = pending; pending = null; write(d).catch(() => {}); }, 300);
    },
    async flush() { if (pending && key) { clearTimeout(timer); const d = pending; pending = null; await write(d); } },
    lock() { key = null; },
  };
})(window.H);
