// Third Eye minimal service worker — enables PWA installability.
// Strategy: network-first passthrough (no stale globe tiles, ever).
const CACHE = 'third-eye-shell-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([
    '/icon-192.png', '/icon-512.png', '/manifest.webmanifest',
  ])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Same-origin static shell pieces may fall back to cache when offline.
  if (event.request.method === 'GET' && url.origin === self.location.origin
      && /\/(icon-\d+\.png|manifest\.webmanifest|logo\.svg|pin\.svg|mic\.svg|location\.svg|visual-presets\.svg)$/.test(url.pathname)) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request)),
    );
    return;
  }
  // Everything else (tiles, APIs, bundles): pure network — freshness first.
});
