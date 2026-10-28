/*
 * HELIOS service worker — keeps the whole app available offline.
 * Network-first for the app files (so updates arrive when online), falling back to cache.
 */
const CACHE = 'helios-v1';
const FILES = [
  './',
  'index.html',
  'css/styles.css',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'js/i18n.js',
  'js/cosmos.js',
  'js/data.js',
  'js/engine.js',
  'js/protocols.js',
  'js/charts.js',
  'js/validation-data.js',
  'js/lab-model.js',
  'js/features/labs.js',
  'js/features/wearables.js',
  'js/features/outcomes.js',
  'js/features/triage.js',
  'js/features/medkit.js',
  'js/features/planner.js',
  'js/features/cognition.js',
  'js/features/nutrition.js',
  'js/features/spaceweather.js',
  'js/features/settings.js',
  'js/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
