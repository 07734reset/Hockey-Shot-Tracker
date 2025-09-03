/* service-worker.js */
const CACHE_VERSION = 'sogt-v1'; // bump when you change files
const PRECACHE = [
  './',
  './shots-on-goal-tracker.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './Hounds Logo - no back.avif' // optional; if missing, SW skips it
];

// Install: pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      cache.addAll(PRECACHE.filter(Boolean)).catch(() => {}) // ignore missing optional file
    ).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k === CACHE_VERSION ? null : caches.delete(k))))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for same-origin, network fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (new URL(req.url).origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(resp => {
        // Runtime cache new same-origin responses
        const copy = resp.clone();
        caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        return resp;
      }).catch(() => cached)) // if offline and not cached, give up
    );
  }
});