'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync } = require('child_process');

test('asset URLs carry current content hashes (no stale code after updates)', () => {
  assert.doesNotThrow(() => execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'build-version.js'), '--check'], { stdio: 'pipe' }),
    'run `npm run version` after changing any script or stylesheet');
});
