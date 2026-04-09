/* ═══════════════════════════════════════════════════════════════════
   sw.js — Practitioner Service Worker v3
   Cache version bumped to v3 to force-evict all stale caches.
   ═══════════════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'v3';
const SHELL_CACHE   = `practitioner-shell-${CACHE_VERSION}`;
const FONT_CACHE    = `practitioner-fonts-${CACHE_VERSION}`;
const RUNTIME_CACHE = `practitioner-runtime-${CACHE_VERSION}`;

const BASE = '/Practitioner';
const SHELL_ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/manifest.json`,
  `${BASE}/apple-touch-icon.png`,
  `${BASE}/icon-192.png`,
  `${BASE}/icon-512.png`,
  `${BASE}/icon-512-maskable.png`,
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  const KEEP = [SHELL_CACHE, FONT_CACHE, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !KEEP.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.hostname === 'fonts.googleapis.com') { event.respondWith(networkFirst(request, FONT_CACHE)); return; }
  if (url.hostname === 'fonts.gstatic.com')    { event.respondWith(cacheFirst(request, FONT_CACHE)); return; }
  if (url.origin === self.location.origin)      { event.respondWith(staleWhileRevalidate(request)); return; }
  event.respondWith(networkFirst(request, RUNTIME_CACHE));
});

async function staleWhileRevalidate(request) {
  const cache  = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const fresh  = fetch(request).then(r => { if (r && r.status===200) cache.put(request, r.clone()); return r; }).catch(()=>null);
  return cached || await fresh || new Response('Offline', { status: 503 });
}

async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const r = await fetch(request).catch(()=>null);
  if (r && r.status===200) cache.put(request, r.clone());
  return r || new Response('', { status: 503 });
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const r = await fetch(request);
    if (r && r.status===200) cache.put(request, r.clone());
    return r;
  } catch {
    return await cache.match(request) || new Response('Offline', { status: 503 });
  }
}

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
