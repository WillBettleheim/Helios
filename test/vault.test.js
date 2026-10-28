'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./_helpers');

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}

test('vault: encrypts, removes plaintext, and only the right PIN decrypts', async () => {
  global.localStorage = memoryStorage();
  localStorage.setItem('helios.v1', JSON.stringify({ v: 1, profile: { name: 'Plain' } }));
  const H = load('js/vault.js');
  const record = { v: 1, profile: { name: 'Joe' }, checkins: { me: { 3: { mood: 6 } } } };

  await H.vault.enable('4826', record);
  assert.equal(localStorage.getItem('helios.v1'), null, 'plaintext removed');
  const raw = localStorage.getItem('helios.vault');
  assert.ok(raw && !raw.includes('Joe'), 'stored as ciphertext');

  H.vault.lock();
  await assert.rejects(() => H.vault.unlock('0000'));
  assert.equal(H.vault.unlocked(), false);
  assert.deepEqual(await H.vault.unlock('4826'), record);
  assert.equal(H.vault.unlocked(), true);

  record.profile.name = 'Joe G';
  H.vault.save(record);
  await H.vault.flush();
  H.vault.lock();
  assert.equal((await H.vault.unlock('4826')).profile.name, 'Joe G');

  await H.vault.disable(record);
  assert.equal(H.vault.enabled(), false);
  assert.equal(JSON.parse(localStorage.getItem('helios.v1')).profile.name, 'Joe G');
});
