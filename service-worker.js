// service-worker.js
const SW_VERSION = (new URL(location.href)).searchParams.get('v') || 'dev';
const STATIC_CACHE = `sogt-static-v${SW_VERSION}`;

// Files you want cached (don’t include index.html)
const PRECACHE = [
  './',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // add your logo if you want it cached:
  './Hounds Logo - no back.avif',
];

/** Install: cache static assets */
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(PRECACHE);
    // Activate immediately
    await self.skipWaiting();
  })());
});

/** Activate: clean old caches */
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map(k => (k !== STATIC_CACHE ? caches.delete(k) : null))
    );
    await self.clients.claim();
  })());
});

/** Fetch strategy:
 *  - Navigations (index.html): network-first, fallback to cache/offline shell
 *  - Static assets (css/js/img): cache-first, fallback to network
 */
self.addEventListener('fetch', event => {
  const req = event.request;

  // Handle page navigations network-first
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        return fresh;
      } catch (_) {
        // Fallback to cached shell if available
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match('./');
        return cached || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // For other requests: cache-first
  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      // Optionally cache GET requests
      if (req.method === 'GET' && fresh.ok) {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (_) {
      return cached || Response.error();
    }
  })());
});

/** Allow client to force activate a waiting SW */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
