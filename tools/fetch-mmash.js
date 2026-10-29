#!/usr/bin/env node
/*
 * Downloads PhysioNet MMASH v1.0.0 (ODbL 1.0, ~25 MB), verifies its SHA-256 against PhysioNet's
 * published checksum, and extracts it to data/mmash/extracted/. The data is never committed
 * (see .gitignore); run this before `node tools/mmash-check.js` or the MMASH tests.
 *   Attribution: Rossi A, Da Pozzo E, Menicagli D, et al. Multilevel Monitoring of Activity and Sleep
 *   in Healthy People (version 1.0.0). PhysioNet (2020). https://doi.org/10.13026/cerq-fc86
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const URL = 'https://physionet.org/files/mmash/1.0.0/MMASH.zip';
const SHA256 = 'ef91ee1b36b5849a6366b1918de82686ab278915d33c7f62133f07f741f70726';
const DIR = path.join(__dirname, '..', 'data', 'mmash');
const ZIP = path.join(DIR, 'MMASH.zip');

function get(url, dest, redirects = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects) { res.resume(); return resolve(get(new URL(res.headers.location, url).toString(), dest, redirects - 1)); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => out.close(resolve));
      out.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const have = fs.existsSync(ZIP) && crypto.createHash('sha256').update(fs.readFileSync(ZIP)).digest('hex') === SHA256;
  if (!have) { console.log(`Downloading ${URL} …`); await get(URL, ZIP); }
  const sum = crypto.createHash('sha256').update(fs.readFileSync(ZIP)).digest('hex');
  if (sum !== SHA256) { fs.unlinkSync(ZIP); throw new Error(`Checksum mismatch (${sum}) — file removed.`); }
  const names = execFileSync('unzip', ['-Z1', ZIP], { encoding: 'utf8' }).split('\n').filter(Boolean);
  if (names.some((n) => n.startsWith('/') || n.includes('..'))) throw new Error('Archive contains unsafe paths — not extracted.');
  execFileSync('unzip', ['-q', '-o', ZIP, '-d', path.join(DIR, 'extracted')]);
  console.log(`MMASH verified (SHA-256 OK) and extracted: ${names.filter((n) => n.endsWith('.csv')).length} CSV files.`);
})().catch((e) => { console.error(e.message); process.exit(1); });
