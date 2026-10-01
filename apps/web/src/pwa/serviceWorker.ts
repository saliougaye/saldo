/** What the worker keeps: the offline page and the icon it draws. Nothing else, ever. */
export const PRECACHE_URLS = ['/offline', '/icons/icon-192.png'] as const;

export const CACHE_PREFIX = 'saldo-offline-';

/**
 * The source of `/sw.js` (§17.1.7). Hand-written, no Workbox, because the whole policy is one rule:
 * a *navigation* that cannot reach the server gets the offline page. The web app is online-only by
 * decision, so everything else passes through untouched and is never cached — API responses, Server
 * Actions, RSC payloads, scripts, and above all anything a signed-in page rendered.
 *
 * The cache name carries the app version, so a deployment that changes the offline page installs a
 * fresh cache and `activate` removes every older one (and only ours: the prefix is checked).
 */
export function serviceWorkerSource(version: string): string {
  return `'use strict';
const CACHE = ${JSON.stringify(CACHE_PREFIX + version)};
const PREFIX = ${JSON.stringify(CACHE_PREFIX)};
const PRECACHE = ${JSON.stringify(PRECACHE_URLS)};
const OFFLINE = '/offline';

async function precache() {
  const cache = await caches.open(CACHE);
  // \`reload\` skips the HTTP cache, so the page kept is the server's current one.
  await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith(PREFIX) && name !== CACHE).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Not a page load: not ours. No \`respondWith\`, so the browser does what it would have done.
  if (request.mode !== 'navigate') return;
  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(OFFLINE)) ?? Response.error();
    }),
  );
});
`;
}
