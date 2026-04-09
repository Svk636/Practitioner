/**
 * sw.js — Practitioner Service Worker
 * Cache-first for app shell, network-first for external (fonts/CDN).
 * Bump CACHE_NAME on every deploy to force cache refresh.
 */

const CACHE_NAME = 'practitioner-v3';

/* ── Pre-cache the app shell on install ──
   Use relative URLs so this SW works at any deployment path.
   self.location.href is the SW's own URL, e.g.
   https://user.github.io/Practitioner/sw.js
   → BASE will be https://user.github.io/Practitioner/           */
const BASE = new URL('./', self.location.href).href;

const PRECACHE_URLS = [
  BASE,                         // index.html served at directory root
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
  BASE + 'icon-maskable-192.png',
  BASE + 'icon-maskable-512.png',
  /* apple-touch-icon.png, favicon.ico, icon.svg intentionally omitted —
     these files are not present; the app uses inline SVG instead */
];

/* ── Install ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching app shell at', BASE);
        /* addAll fails if ANY request fails — use individual add() so one
           missing optional asset doesn't block the whole install */
        return Promise.allSettled(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(e => console.warn('[SW] Could not cache:', url, e))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: delete stale caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  if (url.origin !== self.location.origin) {
    /* External (fonts, CDN): network-first */
    event.respondWith(networkFirst(request));
  } else {
    /* Same-origin: cache-first */
    event.respondWith(cacheFirst(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    /* Offline fallback: serve index.html for navigation requests */
    if (request.mode === 'navigate') {
      const fallback = await caches.match(BASE + 'index.html')
                    || await caches.match(BASE);
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(request) || new Response('', { status: 503 });
  }
}

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
