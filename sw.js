/**
 * sw.js — Practitioner Service Worker
 * Strategy: Cache-first for shell assets, network-first for fonts/external.
 * Version bump the CACHE_NAME to force a full cache refresh on deploy.
 */

const CACHE_NAME = 'practitioner-v1';

/* ── Assets to pre-cache on install ── */
const PRECACHE_URLS = [
  '/Practitioner/',
  '/Practitioner/index.html',
  '/Practitioner/manifest.json',
  '/Practitioner/icon-192.png',
  '/Practitioner/icon-512.png',
  '/Practitioner/apple-touch-icon.png',
  '/Practitioner/favicon.ico',
];

/* ── Install: pre-cache the app shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

/* ── Activate: delete old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keyList =>
      Promise.all(
        keyList
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: cache-first for same-origin, network-first for external ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* Skip non-GET requests and browser-extension requests */
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  /* External resources (fonts, CDN): network-first, fall back to cache */
  if (url.origin !== self.location.origin) {
    event.respondWith(networkFirstThenCache(request));
    return;
  }

  /* Same-origin: cache-first, fall back to network then offline page */
  event.respondWith(cacheFirstThenNetwork(request));
});

/* ── Cache-first strategy ── */
async function cacheFirstThenNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    /* Only cache valid 2xx responses */
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    /* Last resort: serve the app shell for navigation requests */
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/Practitioner/index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

/* ── Network-first strategy (for external resources) ── */
async function networkFirstThenCache(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

/* ── Background sync: notify open clients of SW updates ── */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
