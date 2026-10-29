#!/usr/bin/env node
/*
 * Downloads only the small daily files HELIOS needs from PMData (16 people, ~5 months; CC BY 4.0)
 * via the OSF API (osf.io/vx4bk) — about 10 MB instead of the 1.4 GB archive — and verifies each
 * file against the SHA-256 that OSF publishes. Data lands in data/pmdata/ (never committed).
 *   Attribution: Thambawita V. et al. "PMData: a sports logging dataset", Proc. ACM MMSys 2020,
 *   https://doi.org/10.1145/3339825.3394926 — licensed CC BY 4.0.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUT = path.join(__dirname, '..', 'data', 'pmdata');
const WANT = {
  fitbit: ['resting_heart_rate.json', 'sleep.json', 'sleep_score.csv', 'very_active_minutes.json'],
  pmsys: ['wellness.csv', 'injury.csv'],
  googledocs: ['reporting.csv'],
};
async function get(u) {
  for (let attempt = 1; ; attempt++) {                         // OSF's API is occasionally flaky (5xx)
    const r = await fetch(u, { headers: { 'User-Agent': 'helios-fetch' } });
    if (r.ok) return r.json();
    if (r.status < 500 || attempt >= 5) throw new Error(`${r.status} ${u}`);
    await new Promise((res) => setTimeout(res, 2000 * attempt));
  }
}
async function list(href) {
  const out = [];
  for (let u = href + (href.includes('?') ? '&' : '?') + 'page[size]=100'; u; ) { const j = await get(u); out.push(...j.data); u = j.links && j.links.next; }
  return out;
}
const child = (items, name) => items.find((x) => x.attributes.name === name);

(async () => {
  const root = await list('https://api.osf.io/v2/nodes/vx4bk/files/osfstorage/');
  const pm = child(root, 'pmdata');
  const people = (await list(pm.relationships.files.links.related.href)).filter((x) => /^p\d\d$/.test(x.attributes.name));
  let n = 0, bytes = 0;
  for (const p of people) {
    const folders = await list(p.relationships.files.links.related.href);
    for (const [folder, files] of Object.entries(WANT)) {
      const f = child(folders, folder);
      if (!f) continue;
      const items = await list(f.relationships.files.links.related.href);
      for (const name of files) {
        const it = child(items, name);
        if (!it) continue;
        const dest = path.join(OUT, p.attributes.name, folder, name);
        const want = it.attributes.extra && it.attributes.extra.hashes && it.attributes.extra.hashes.sha256;
        if (fs.existsSync(dest) && want && crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex') === want) { n++; continue; }
        let r;
        for (let attempt = 1; attempt <= 4; attempt++) {           // OSF occasionally returns 5xx
          r = await fetch(it.links.download, { headers: { 'User-Agent': 'helios-fetch' } });
          if (r.ok || r.status < 500) break;
          await new Promise((res) => setTimeout(res, 1500 * attempt));
        }
        if (!r.ok) throw new Error(`${r.status} ${p.attributes.name}/${folder}/${name}`);
        const buf = Buffer.from(await r.arrayBuffer());
        if (want && crypto.createHash('sha256').update(buf).digest('hex') !== want) throw new Error(`Checksum mismatch: ${p.attributes.name}/${folder}/${name}`);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
        n++; bytes += buf.length;
      }
    }
  }
  console.log(`PMData: ${n} files verified (SHA-256) in data/pmdata/ — ${(bytes / 1e6).toFixed(1)} MB downloaded this run.`);
})().catch((e) => { console.error(e.message); process.exit(1); });
