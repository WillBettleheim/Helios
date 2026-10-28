#!/usr/bin/env node
/*
 * HELIOS — minimal sync relay for end-to-end encrypted bundles.
 * The server stores ciphertext only (one latest bundle per device per channel) and can hold
 * bundles back to simulate the Earth–spacecraft light-time delay.
 *
 *   node tools/sync-server.js            # http://localhost:8787
 *   PORT=9000 LIGHT_TIME_SEC=846 node tools/sync-server.js
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = +process.env.PORT || 8787;
const LIGHT_MS = (+process.env.LIGHT_TIME_SEC || 846) * 1000;
const FILE = process.env.SYNC_FILE || path.join(__dirname, '..', 'data', 'sync-store.json');
const MAX = 8 * 1024 * 1024;

let db = {};
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { /* first run */ }
const persist = () => fs.writeFile(FILE, JSON.stringify(db), () => {});

function send(res, code, body) {
  res.writeHead(code, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, PUT, OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const m = req.url.match(/^\/v1\/bundle\/([A-Za-z0-9]{8,64})$/);
  if (!m) return send(res, 404, { error: 'not found' });
  const ch = m[1];

  if (req.method === 'GET') {
    const now = Date.now();
    const bundles = Object.values(db[ch] || {}).filter((b) => b.deliverAt <= now);
    return send(res, 200, { bundles, pending: Object.values(db[ch] || {}).length - bundles.length });
  }
  if (req.method === 'PUT') {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX) { send(res, 413, { error: 'too large' }); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (size > MAX) return;
      let b;
      try { b = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return send(res, 400, { error: 'bad json' }); }
      if (!b || typeof b.ct !== 'string' || typeof b.iv !== 'string' || typeof b.salt !== 'string') return send(res, 400, { error: 'expected {device, iv, salt, ct}' });
      const device = String(b.device || 'unknown').slice(0, 40);
      const deliverAt = Date.now() + (b.delay ? LIGHT_MS : 0);
      (db[ch] = db[ch] || {})[device] = { device, t: +b.t || Date.now(), iv: b.iv, salt: b.salt, ct: b.ct, deliverAt };
      persist();
      send(res, 200, { ok: true, deliverAt });
    });
    return;
  }
  send(res, 405, { error: 'method not allowed' });
});

server.listen(PORT, () => console.log(`HELIOS sync relay on http://localhost:${PORT} (stores ciphertext only; light-time ${LIGHT_MS / 1000}s when requested)`));
