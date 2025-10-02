// service-worker.js
// Robust offline shell for GitHub Pages + subpaths
const SW_VERSION = (new URL(location.href)).searchParams.get('v') || 'dev';
const STATIC_CACHE = `sogt-static-v${SW_VERSION}`;

// Build absolute URLs relative to the SW scope
const SCOPE_URL = new URL(self.registration.scope);
const abs = (p) => new URL(p, SCOPE_URL).toString();

// Cache both "/" and "index.html" forms to be safe on GitHub Pages
const INDEX_URLS = [abs('./'), abs('index.html')];

// List the static files you want available offline
const PRECACHE = [
  ...INDEX_URLS,
  abs('manifest.webmanifest'),
  abs('icons/icon-192.png'),
  abs('icons/icon-512.png'),
  abs('Hounds Logo - no back.avif'), // optional if you use it
];

// INSTALL: cache app shell & assets
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // Use addAll with absolute URLs
    await cache.addAll(PRECACHE);
    await self.skipWaiting(); // activate immediately
  })());
});

// ACTIVATE: clean old caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map(k => (k !== STATIC_CACHE ? caches.delete(k) : Promise.resolve()))
    );
    await self.clients.claim();
  })());
});

// FETCH: navigations = network-first, fallback to cached index; others = cache-first
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Navigation requests (user opens/refreshes the page)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // Prefer a fresh index when online
        return await fetch(req, { cache: 'no-store' });
      } catch (err) {
        // Offline fallback: serve cached app shell
        const cache = await caches.open(STATIC_CACHE);
        for (const url of INDEX_URLS) {
          const cached = await cache.match(url);
          if (cached) return cached;
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // Non-navigation GETs: cache-first, then network
  if (req.method === 'GET') {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        // If offline and not in cache, error out
        return cached || Response.error();
      }
    })());
  }
});

// Allow client to force-activate a waiting SW (optional)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
