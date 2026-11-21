/*
 * VetNexa service worker: lets the app open quickly and show first-aid advice when there is no
 * internet connection.
 *
 * - Pages: always come from the network so people get the latest version; without a connection
 *   the offline page with first-aid steps is shown instead (the app cannot load data offline).
 * - Built files in /assets/ have a content hash in their name, so a saved copy is always right.
 * - Nothing from /api/ or /uploads/ is ever saved: health records, wound photos and account
 *   details stay off the device.
 */
const VERSION = 'v1';
const STATIC_CACHE = `vetnexa-static-${VERSION}`;
const ASSET_CACHE = `vetnexa-assets-${VERSION}`;
const MAX_ASSETS = 80;
const OFFLINE_PAGE = '/offline.html';
const PRECACHE = [
  OFFLINE_PAGE,
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];
const PRIVATE_PATHS = ['/api/', '/uploads/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const keep = [STATIC_CACHE, ASSET_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('vetnexa-') && !keep.includes(name))
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (PRIVATE_PATHS.some((path) => url.pathname.startsWith(path))) return;

  if (request.mode === 'navigate') {
    event.respondWith(openPage(request));
  } else if (url.pathname.startsWith('/assets/') || PRECACHE.includes(url.pathname)) {
    event.respondWith(savedFirst(request));
  }
});

/** Load the page from the network; without a connection, show the saved offline page. */
async function openPage(request) {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match(OFFLINE_PAGE);
    return offline ?? Response.error();
  }
}

/** Use the saved copy if there is one; otherwise download it and save it for next time. */
async function savedFirst(request) {
  const cacheName = new URL(request.url).pathname.startsWith('/assets/')
    ? ASSET_CACHE
    : STATIC_CACHE;
  const cache = await caches.open(cacheName);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    if (cacheName === ASSET_CACHE) await trim(cache);
  }
  return response;
}

/** Keep the asset cache small: drop the oldest entries after a few releases. */
async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(
    keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((key) => cache.delete(key)),
  );
}
