/* ═══════════════════════════════════════════════════════════════════
   sw.js — Practitioner Service Worker
   Strategy:
     • App shell (HTML, icons, manifest)  → Cache-first, stale-while-revalidate
     • Google Fonts stylesheets           → Network-first, fallback to cache
     • Google Fonts gstatic (woff2)       → Cache-first (immutable assets)
     • Everything else                    → Network-first, fallback to cache
   ═══════════════════════════════════════════════════════════════════ */

const CACHE_VERSION   = 'v1';
const SHELL_CACHE     = `practitioner-shell-${CACHE_VERSION}`;
const FONT_CACHE      = `practitioner-fonts-${CACHE_VERSION}`;
const RUNTIME_CACHE   = `practitioner-runtime-${CACHE_VERSION}`;

/* All local files that make up the app shell */
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

/* ── Install: pre-cache shell ─────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())   // activate immediately
  );
});

/* ── Activate: prune old caches ──────────────────────────────────── */
self.addEventListener('activate', event => {
  const KEEP = [SHELL_CACHE, FONT_CACHE, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => !KEEP.includes(key))
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())  // take control of open tabs
  );
});

/* ── Fetch: routing logic ─────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  /* 1. Google Fonts CSS — network-first, fallback to cache */
  if (url.hostname === 'fonts.googleapis.com') {
    event.respondWith(networkFirstWithCache(request, FONT_CACHE));
    return;
  }

  /* 2. Google Fonts gstatic (actual woff2 files) — cache-first (immutable) */
  if (url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirstWithNetwork(request, FONT_CACHE));
    return;
  }

  /* 3. App shell assets — stale-while-revalidate */
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  /* 4. Everything else — network-first */
  event.respondWith(networkFirstWithCache(request, RUNTIME_CACHE));
});

/* ═══════════════════════════════════════════════════════════════════
   Strategy helpers
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Stale-while-revalidate
 * Returns cached version immediately; fetches fresh copy in background.
 * Best for the app shell — instant loads, always eventually up-to-date.
 */
async function staleWhileRevalidate(request) {
  const cache    = await caches.open(SHELL_CACHE);
  const cached   = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || await fetchPromise || new Response('Offline', { status: 503 });
}

/**
 * Cache-first → network fallback
 * Best for immutable assets (font files, versioned bundles).
 */
async function cacheFirstWithNetwork(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

/**
 * Network-first → cache fallback
 * Best for frequently updated resources (Font CSS, API calls).
 */
async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

/* ── Message: force update from client ───────────────────────────── */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
