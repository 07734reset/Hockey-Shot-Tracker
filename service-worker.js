/* service-worker.js */
const params = new URL(self.location).searchParams;
const BUILD = params.get('v') || 'dev';
const CACHE_VERSION = `sogt-v${BUILD}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './Hounds Logo - no back.avif' // optional; SW will skip if missing
];

// Install: pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE.filter(Boolean)).catch(()=>{}))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k === CACHE_VERSION ? null : caches.delete(k))))
    ).then(() => self.clients.claim())
  );
});

// Fetch: same-origin cache-first, then network; runtime cache new responses
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        return resp;
      }).catch(() => cached)
    )
  );
});