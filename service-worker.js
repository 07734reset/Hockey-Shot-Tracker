// service-worker.js
// Solid offline for GitHub Pages + iOS PWA (no fragile redirects)
const SW_VERSION = (new URL(self.location.href)).searchParams.get('v') || 'dev';
const CACHE_NAME = `sogt-cache-v${SW_VERSION}`;

// Scope base (e.g. https://user.github.io/repo/)
const SCOPE_URL = new URL(self.registration.scope);
const abs = (p) => new URL(p, SCOPE_URL).toString();

// Explicitly request index.html (avoid caching "./" which may be a redirect)
const INDEX_REQ = new Request(abs('index.html'), { cache: 'reload' });

// Assets to precache (add your logo if you use it)
const ASSETS = [
  abs('manifest.webmanifest'),
  abs('icons/icon-192.png'),
  abs('icons/icon-512.png'),
  abs('Hounds Logo - no back.avif'), // optional
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Be defensive: add index first, then the rest individually
    try {
      const res = await fetch(INDEX_REQ);
      if (res && res.ok) await cache.put(INDEX_REQ, res.clone());
    } catch (e) {
      // If this fails while online, something is off with the URL; we still continue
    }
    for (const url of ASSETS) {
      try {
        const r = await fetch(new Request(url, { cache: 'reload' }));
        if (r && r.ok) await cache.put(url, r.clone());
      } catch (e) { /* ignore failed assets */ }
    }
    await self.skipWaiting(); // activate immediately
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

// Navigations: network-first, fallback to cached index.html when offline
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Page navigations
  if (req.mode === 'navigate' || (req.destination === 'document')) {
    event.respondWith((async () => {
      try {
        // Always try fresh HTML when online
        return await fetch(req, { cache: 'no-store' });
      } catch (e) {
        // Offline fallback to cached index.html
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(INDEX_REQ);
        if (cached) return cached;
        // Last resort: plain message
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // Other GET requests: cache-first, then network
  if (req.method === 'GET') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        return cached || Response.error();
      }
    })());
  }
});

// Optional: let the page tell a waiting SW to activate now
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
