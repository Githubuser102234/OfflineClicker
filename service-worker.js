// Simple robust SW: precache core + runtime caching for everything fetched, with an offline fallback
const CACHE_NAME = 'offline-clicker-v1';
const CORE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : Promise.resolve())
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // network-first for HTML / start_url, cache-first for other resources
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  // prefer network for navigation requests (so new versions load), fallback to cache
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req).then(res => {
        // put a clone in cache and return original
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
    );
    return;
  }

  // For other requests, try cache first then network (so it works offline)
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // cache useful assets
        if (res && res.status === 200 && res.type !== 'opaque') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => {
        // fallback: if it's an image request return a small SVG placeholder
        if ((req.headers.get('accept') || '').includes('image')) {
          return new Response(`<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%25' height='100%25' fill='%230b1220'/><text x='50%25' y='50%25' fill='%23ffd85a' font-size='20' text-anchor='middle' alignment-baseline='middle'>Offline</text></svg>`, { headers: { 'Content-Type': 'image/svg+xml' }});
        }
        // otherwise return cached index as universal fallback
        return caches.match('./index.html');
      });
    })
  );
});
