/* PokéVerse Arena — lightweight service worker (no build-time manifest needed).
 *
 * Strategy:
 *  - App shell / navigations: network-first, fall back to the cached shell so the
 *    app still boots offline.
 *  - Same-origin static assets (hashed JS/CSS/fonts): stale-while-revalidate.
 *  - PokéAPI data + sprite CDNs: cache-first (these resources are effectively
 *    immutable), so revisited Pokémon load instantly and work offline.
 */

const VERSION = 'v2'; // bumped so installed clients refresh the cached shell + manifest (orientation fix)
const SHELL_CACHE = `pv-shell-${VERSION}`;
const ASSET_CACHE = `pv-assets-${VERSION}`;
const DATA_CACHE = `pv-data-${VERSION}`;
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
    cache.put('./index.html', response.clone());
    return response;
  } catch {
    return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
    return response;
  } catch {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}
