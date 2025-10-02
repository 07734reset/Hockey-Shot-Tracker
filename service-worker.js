// service-worker.js
// Instant-start PWA for GitHub Pages: offline-first for navigations, background update
const SW_VERSION = (new URL(self.location.href)).searchParams.get('v') || 'dev';
const CACHE_NAME = `sogt-cache-v${SW_VERSION}`;

// Scope base (e.g. https://user.github.io/repo/)
const SCOPE_URL = new URL(self.registration.scope);
const abs = (p) => new URL(p, SCOPE_URL).toString();

// Explicit index.html request (avoid "./" redirects on Pages)
const INDEX_URL = abs('index.html');
const INDEX_REQ = new Request(INDEX_URL, { cache: 'reload' });

// Assets to precache (add/remove as needed)
const ASSETS = [
  abs('manifest.webmanifest'),
  abs('icons/icon-192.png'),
  abs('icons/icon-512.png'),
  abs('Hounds Logo - no back.avif'), // optional if you use it
];

// Precache index + assets on install
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const res = await fetch(INDEX_REQ);
      if (res && res.ok) await cache.put(INDEX_REQ, res.clone());
    } catch (_) { /* ignore; will fetch later */ }

    for (const url of ASSETS) {
      try {
        const r = await fetch(new Request(url, { cache: 'reload' }));
        if (r && r.ok) await cache.put(url, r.clone());
      } catch (_) { /* ignore individual asset failures */ }
    }

    await self.skipWaiting();
  })());
});

// Clean old caches & take control
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

// Navigations: offline-first (serve cached index immediately), then update in background
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Treat navigations / documents as app shell
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(INDEX_REQ);

      // Always kick off a background update when online
      event.waitUntil((async () => {
        try {
          const fresh = await fetch(INDEX_REQ, { cache: 'reload' });
          if (fresh && fresh.ok) await cache.put(INDEX_REQ, fresh.clone());
        } catch (_) { /* offline or failed; keep cached */ }
      })());

      // If we have a cached shell, return it immediately (instant start)
      if (cached) return cached;

      // First run / no cache yet: try network, else show basic offline
      try {
        const fresh = await fetch(INDEX_REQ, { cache: 'reload' });
        if (fresh && fresh.ok) {
          await cache.put(INDEX_REQ, fresh.clone());
          return fresh;
        }
      } catch (_) { /* ignore */ }

      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })());
    return;
  }

  // Static assets & other GETs: cache-first with network fallback
  if (req.method === 'GET') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        return cached || Response.error();
      }
    })());
  }
});

// Optional: allow page to force-activate a waiting SW
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
