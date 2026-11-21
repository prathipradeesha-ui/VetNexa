/*
 * VetNexa service worker: lets the app be installed and keeps emergency help working without
 * an internet connection.
 *
 * - When installed it saves every file of the current build (the build fills in BUILD_FILES),
 *   so the app itself can open offline.
 * - Pages always come from the network first, so people get the latest version. Offline,
 *   /emergency opens from the saved app (saved clinic list, red-flag check, first-aid guides);
 *   other pages show the offline page, which links to it.
 * - Nothing from /api/ or /uploads/ is ever saved by this worker: health records, wound photos
 *   and account details stay off the device.
 */
const BUILD_ID = 'dev';
const BUILD_FILES = [];
const CACHE = `vetnexa-${BUILD_ID}`;
const APP_SHELL = '/index.html';
const OFFLINE_PAGE = '/offline.html';
const OFFLINE_ROUTES = ['/emergency'];
const STATIC_FILES = [
  APP_SHELL,
  OFFLINE_PAGE,
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  ...BUILD_FILES,
];
const PRIVATE_PATHS = ['/api/', '/uploads/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // 'reload' skips the browser's HTTP cache so the saved copies match this build.
      .then((cache) =>
        cache.addAll(STATIC_FILES.map((url) => new Request(url, { cache: 'reload' }))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('vetnexa-') && name !== CACHE)
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
    event.respondWith(openPage(url));
  } else if (url.pathname.startsWith('/assets/') || STATIC_FILES.includes(url.pathname)) {
    event.respondWith(savedFirst(request));
  }
});

/** True for pages that are built to work offline. */
function worksOffline(pathname) {
  return OFFLINE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/** Load the page from the network; offline, open the saved app or the offline page. */
async function openPage(url) {
  try {
    return await fetch(url, { credentials: 'same-origin' });
  } catch {
    const saved = await caches.match(worksOffline(url.pathname) ? APP_SHELL : OFFLINE_PAGE);
    return saved ?? (await caches.match(OFFLINE_PAGE)) ?? Response.error();
  }
}

/** Use the saved copy if there is one; otherwise download it and save it for next time. */
async function savedFirst(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}
