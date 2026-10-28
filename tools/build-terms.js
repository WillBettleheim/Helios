#!/usr/bin/env node
/* Writes TERMS.md from the single source of truth in js/features/terms.js. */
'use strict';
const fs = require('fs');
const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'js', 'features', 'terms.js'));
const T = global.H.TERMS;
const md = [
  '# HELIOS — Terms & Conditions',
  '',
  `Version ${T.version} · effective ${T.effective}`,
  '',
  '## The short version',
  '',
  ...T.summary.map((s) => `- ${s}`),
  '',
  ...T.sections.flatMap(([h, ps]) => [`## ${h}`, '', ...ps.flatMap((p) => [p, ''])]),
  '_Generated from `js/features/terms.js` by `tools/build-terms.js`. Edit the source, not this file._',
  '',
].join('\n');
fs.writeFileSync(path.join(__dirname, '..', 'TERMS.md'), md);
console.log(`TERMS.md written (v${T.version}).`);
