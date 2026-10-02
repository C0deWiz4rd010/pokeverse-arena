/* PokéVerse Arena — lightweight service worker (no build-time manifest needed).
 *
 * Strategy:
 *  - App shell / navigations: network-first, fall back to the cached shell so the
 *    app still boots offline.
 *  - Same-origin static assets (hashed JS/CSS/fonts): stale-while-revalidate.
 *  - PokéAPI data + sprite CDNs: cache-first (these resources are effectively
 *    immutable), so revisited Pokémon load instantly and work offline.
 */

const VERSION = 'v4'; // v2.0: clears caches that predate the Ninja Adventure art swap
const SHELL_CACHE = `pv-shell-${VERSION}`;
const ASSET_CACHE = `pv-assets-${VERSION}`;
const DATA_CACHE = `pv-data-${VERSION}`;
// Soft caps so a long-lived install can't grow without bound (oldest entries go first).
const MAX_DATA_ENTRIES = 800;
const MAX_ASSET_ENTRIES = 150;
const KEEP = new Set([SHELL_CACHE, ASSET_CACHE, DATA_CACHE]);

const DATA_HOSTS = new Set(['pokeapi.co', 'raw.githubusercontent.com', 'api.dicebear.com']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(['./', './index.html'])).catch(() => undefined),
  );
  self.skipWaiting();
});

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

  // Same-origin static assets → stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
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

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone()).then(() => trim(cache, MAX_ASSET_ENTRIES), () => undefined);
      }
      return response;
    })
    .catch(() => cached || Response.error());
  return cached || network;
}
