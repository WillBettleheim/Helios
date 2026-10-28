'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { load } = require('./_helpers');

test('terms: TERMS.md is generated from the in-app source and up to date', () => {
  const file = path.join(__dirname, '..', 'TERMS.md');
  const before = fs.readFileSync(file, 'utf8');
  execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'build-terms.js')]);
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'run `npm run terms` and commit TERMS.md');
});

test('terms: required sections are present', () => {
  const H = load('js/features/terms.js');
  const heads = H.TERMS.sections.map((s) => s[0]).join(' ');
  for (const w of ['medical device', 'privacy', 'Security', 'warranty', 'liability', 'Changes']) assert.match(heads, new RegExp(w, 'i'));
  assert.match(H.TERMS.version, /^\d+\.\d+$/);
});

test('sanitizer keeps terms acceptance and drops junk prefs', () => {
  const H = load('js/data.js', 'js/engine.js', 'js/sanitize.js');
  const s = H.sanitize.store({ prefs: { termsVersion: '1.0', termsAt: 123, evil: '<x>', sync: { url: 'http://x', passphrase: 'leak' } } });
  assert.equal(s.prefs.termsVersion, '1.0');
  assert.equal(s.prefs.termsAt, 123);
  assert.equal(s.prefs.evil, undefined);
  assert.equal(s.prefs.sync.passphrase, undefined, 'passphrase is never persisted');
});
