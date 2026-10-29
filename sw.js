/*
 * HELIOS service worker — keeps the whole app available offline.
 * Network-first for the app files (so updates arrive when online), falling back to cache.
 */
const CACHE = 'helios-5d70dc4d';
const FILES = [
  './',
  'index.html',
  'css/styles.css?v=9a0d91fc',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'js/i18n.js?v=cedc8a7c',
  'js/vault.js?v=e56757c0',
  'js/cosmos.js?v=99aa4d90',
  'js/data.js?v=1e5ae3f9',
  'js/engine.js?v=e4087fcc',
  'js/protocols.js?v=68ec6eeb',
  'js/weekly.js?v=3ea3d4bf',
  'js/sanitize.js?v=04db9c06',
  'js/charts.js?v=acb07032',
  'js/validation-data.js?v=83e35b2b',
  'js/lab-model.js?v=d2e147a4',
  'js/features/labs.js?v=5ffb5b7b',
  'js/features/wearables.js?v=fee008fd',
  'js/features/outcomes.js?v=d48cef61',
  'js/features/triage.js?v=7ae6a7fe',
  'js/features/medkit.js?v=f627035f',
  'js/features/planner.js?v=919cece5',
  'js/features/cognition.js?v=9884f700',
  'js/features/nutrition.js?v=02d82789',
  'js/features/spaceweather.js?v=e12b8728',
  'js/features/settings.js?v=b0a0f5dc',
  'js/features/replay.js?v=c0c8cddf',
  'js/features/eva.js?v=586302e9',
  'js/features/live.js?v=15aba7b5',
  'js/features/blackout.js?v=456ce39d',
  'js/features/cohesion.js?v=65ea2325',
  'js/features/fhir.js?v=fa4fbd4d',
  'js/features/weekly.js?v=5a8e6453',
  'js/features/terms.js?v=8af9a6c1',
  'js/features/tour.js?v=31bc7dbb',
  'js/app.js?v=e72292ad',
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
    fetch(e.request, { cache: 'no-cache' }).then((res) => {   // revalidate so updates arrive
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match(e.request, { ignoreSearch: true })).then((r) => r || caches.match('index.html')))
  );
});
