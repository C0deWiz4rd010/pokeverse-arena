/* PokéVerse Arena — service worker.
 *
 * Strategy:
 *  - Install: precache the app shell — index.html plus every script/style it
 *    references (list injected at build time by tools/postbuild.mjs) — so the very
 *    first visit is already fully offline-capable.
 *  - Navigations: network-first, falling back to the cached shell.
 *  - Hashed JS/CSS: stale-while-revalidate in a cache that is versioned per build,
 *    so every deploy starts clean (no pile-up of dead chunks).
 *  - Other same-origin files (tilesets, icons): stale-while-revalidate in a stable cache.
 *  - PokéAPI data + sprite CDNs: cache-first, size-capped.
 */

// Replaced at build time by tools/postbuild.mjs (the values below are the dev fallbacks).
const BUILD_ID = 'dev';
const PRECACHE = [];

const SHELL_CACHE = `pv-shell-${BUILD_ID}`;
const ASSET_CACHE = `pv-assets-${BUILD_ID}`; // hashed chunks: tied to one build
const STATIC_CACHE = 'pv-static-v1'; // unhashed same-origin files: survive deploys
const DATA_CACHE = 'pv-data-v1';
// Soft caps so a long-lived install can't grow without bound (oldest entries go first).
const MAX_DATA_ENTRIES = 800;
const MAX_ASSET_ENTRIES = 150;
const MAX_STATIC_ENTRIES = 120;
const KEEP = new Set([SHELL_CACHE, ASSET_CACHE, STATIC_CACHE, DATA_CACHE]);

const DATA_HOSTS = new Set(['pokeapi.co', 'raw.githubusercontent.com', 'api.dicebear.com']);
const HASHED = /-[A-Za-z0-9_-]{8}\.(?:js|css)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
  self.skipWaiting();
});

async function precache() {
  const shell = await caches.open(SHELL_CACHE);
  const assets = await caches.open(ASSET_CACHE);
  const statics = await caches.open(STATIC_CACHE);
  const put = async (path) => {
    const url = new URL(path, self.registration.scope).href;
    const response = await fetch(url, { cache: 'reload' });
    if (!response.ok) return;
    await (HASHED.test(path) ? assets : statics).put(url, response);
  };
  // The shell document itself (stored under the key navigations look up).
  try {
    const index = await fetch(new URL('./index.html', self.registration.scope).href, { cache: 'reload' });
    if (index.ok) await shell.put('./index.html', index);
  } catch {
    /* offline during install: the first online navigation fills it */
  }
  await Promise.allSettled(PRECACHE.map(put));
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // App navigations → network-first with cached-shell fallback.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request));
    return;
  }

  // PokéAPI / sprite / avatar data → cache-first.
  if (DATA_HOSTS.has(url.hostname)) {
    event.respondWith(cacheFirst(request, DATA_CACHE));
    return;
  }

  // Same-origin assets → stale-while-revalidate (hashed chunks per build, the rest stable).
  if (url.origin === self.location.origin) {
    const hashed = HASHED.test(url.pathname);
    event.respondWith(
      staleWhileRevalidate(request, hashed ? ASSET_CACHE : STATIC_CACHE, hashed ? MAX_ASSET_ENTRIES : MAX_STATIC_ENTRIES),
    );
  }
});

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    // Only a healthy HTML shell may replace the cached one — never a 404/5xx page
    // or a captive-portal response, or the app can no longer boot offline.
    const isHtml = (response.headers.get('content-type') || '').includes('text/html');
    if (response.ok && isHtml) cache.put('./index.html', response.clone());
    return response;
  } catch {
    return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
  }
}

/** Evict the oldest entries (cache keys iterate in insertion order). */
async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/**
 * Third-party images are requested in no-cors mode, which yields *opaque*
 * responses: browsers pad each to several MB of quota, so a few hundred sprites
 * exhaust storage. These hosts all send CORS headers, so refetch with CORS and
 * cache a real, correctly sized response; fall back to the original request.
 */
async function fetchCacheable(request) {
  if (request.mode === 'no-cors') {
    try {
      const response = await fetch(new Request(request.url, { mode: 'cors', credentials: 'omit' }));
      if (response.ok) return response;
    } catch {
      /* fall through to the plain request */
    }
  }
  return fetch(request);
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetchCacheable(request);
    // Opaque responses are served but never stored (see fetchCacheable).
    if (response.ok) {
      cache.put(request, response.clone()).then(() => trim(cache, MAX_DATA_ENTRIES), () => undefined);
    }
    return response;
  } catch {
    return Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone()).then(() => trim(cache, max), () => undefined);
      }
      return response;
    })
    .catch(() => cached || Response.error());
  return cached || network;
}
