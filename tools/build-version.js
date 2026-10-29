#!/usr/bin/env node
/*
 * Stamps every script and stylesheet URL in index.html and sw.js with a content hash
 * (?v=abcd1234) and names the offline cache after the combined hash. A changed file therefore
 * always has a new URL, so neither the browser cache nor the service worker can serve stale code.
 *   node tools/build-version.js          # rewrite in place
 *   node tools/build-version.js --check  # exit 1 if anything is out of date (used by tests)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const hash = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
const strip = (u) => u.split('?')[0];

function stamp() {
  const indexPath = path.join(ROOT, 'index.html'), swPath = path.join(ROOT, 'sw.js');
  let index = fs.readFileSync(indexPath, 'utf8');
  const assets = [...index.matchAll(/(?:src|href)="((?:js|css)\/[^"?]+)(?:\?v=[0-9a-f]+)?"/g)].map((m) => m[1]);
  const versions = Object.fromEntries(assets.map((a) => [a, hash(fs.readFileSync(path.join(ROOT, a)))]));
  index = index.replace(/((?:src|href)=")((?:js|css)\/[^"?]+)(?:\?v=[0-9a-f]+)?"/g, (_, pre, a) => `${pre}${a}?v=${versions[a]}"`);

  let sw = fs.readFileSync(swPath, 'utf8');
  const all = hash(Object.entries(versions).map(([a, v]) => a + v).join('|'));
  sw = sw.replace(/const CACHE = '[^']*';/, `const CACHE = 'helios-${all}';`);
  sw = sw.replace(/'((?:js|css)\/[^'?]+)(?:\?v=[0-9a-f]+)?'/g, (m, a) => (versions[a] ? `'${a}?v=${versions[a]}'` : m));
  return { index, sw, indexPath, swPath, count: assets.length, all };
}

const out = stamp();
if (process.argv.includes('--check')) {
  const stale = fs.readFileSync(out.indexPath, 'utf8') !== out.index || fs.readFileSync(out.swPath, 'utf8') !== out.sw;
  if (stale) { console.error('Asset versions are stale — run: npm run version'); process.exit(1); }
  console.log('Asset versions up to date.');
} else {
  fs.writeFileSync(out.indexPath, out.index);
  fs.writeFileSync(out.swPath, out.sw);
  console.log(`Stamped ${out.count} assets; cache helios-${out.all}.`);
}
