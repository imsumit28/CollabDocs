// CollabDocs service worker — app-shell offline support.
// Bump CACHE_VERSION to invalidate old caches on deploy.
const CACHE_VERSION = 'collabdocs-v1';
const OFFLINE_URL = '/offline.html';

const PRECACHE = [OFFLINE_URL, '/favicon.svg', '/favicon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GET requests; never touch APIs or websockets.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;

  // Immutable hashed build assets → cache-first.
  if (url.pathname.startsWith('/_next/static') || /\.(?:js|css|woff2?|png|svg|jpg|jpeg|gif|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return res;
        }).catch(() => cached)
      )
    );
    return;
  }

  // Navigations (HTML) → network-first, fall back to cache, then offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)))
    );
  }
});
