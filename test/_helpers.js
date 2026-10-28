'use strict';
/*
 * Loads the browser scripts into Node with a minimal `window` so the engine, data model and
 * feature logic can be tested without a browser.
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');

function load(...files) {
  global.window = global;
  if (!global.addEventListener) global.addEventListener = () => {};
  if (!global.document) global.document = { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { classList: { toggle() {}, contains: () => false } } };
  delete global.H;
  for (const f of files) {
    const p = path.join(ROOT, f);
    delete require.cache[require.resolve(p)];
    require(p);
  }
  return global.H;
}

// Enough of the app API for feature modules to register and expose their logic.
function fakeApp(H, overrides = {}) {
  const handlers = {};
  H.bus = { on: (e, fn) => (handlers[e] = handlers[e] || []).push(fn), emit: (e, ...a) => (handlers[e] || []).map((fn) => fn(...a)) };
  return Object.assign({
    store: {}, ui: { crewId: 'me' }, ICON: {}, M: { day: 30, plannedDays: 180, startISO: '2026-01-01' },
    esc: (s) => String(s), pill: () => '', lv: (n) => ['nominal', 'monitor', 'action', 'urgent'][n], T: (s) => s,
    save() {}, log() {}, toast() {}, go() {}, render() {}, recompute() {}, addIcon() {}, addView() {},
  }, overrides);
}

const isoDays = (d) => { const t = new Date(); t.setUTCHours(0, 0, 0, 0); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };

module.exports = { load, fakeApp, isoDays };
