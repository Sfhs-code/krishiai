/**
 * KrishiSathi service worker.
 *
 * App shell: cache-first, so a cold start in a dead zone still paints.
 * API calls:  network-first with a cache fallback, so the farmer sees the last
 *             known weather and prices instead of an error.
 */
const VERSION = 'ks-v1';
const SHELL = `${VERSION}-shell`;
const DATA = `${VERSION}-data`;
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API: network first, fall back to the last good response.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          void caches.open(DATA).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit ?? Response.error())),
    );
    return;
  }

  // Navigations: serve the SPA shell so deep links work offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((hit) => hit ?? Response.error())),
    );
    return;
  }

  // Static assets: cache first, then fill the cache in the background.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            void caches.open(SHELL).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
