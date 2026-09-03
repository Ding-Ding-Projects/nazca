// Bump this when the deployed shell or its offline precache contract changes.
// The versioned name lets activation retire the cache from the previous shell.
const CACHE_PREFIX = 'nazca-static-';
const CACHE = 'nazca-static-reader-1b-v2';

function localPath(relative) {
  return new URL(relative, self.registration.scope).toString();
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const urls = [
        localPath('./'),
        localPath('./wiki/Nazca_Railway_(Los_Sengas_Division)'),
        localPath('./social-preview.png'),
        localPath('./provenance.json'),
      ];
      for (const url of urls) {
        try {
          const response = await fetch(url, { cache: 'no-store' });
          if (response.ok) await cache.put(url, response);
        } catch {
          // A partial install remains useful. Missing entries retry on normal use.
        }
      }
      // Activate this exact cache only after precaching has settled.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  event.respondWith(
    // Do not let an intermediary HTTP cache hide a newly deployed shell.
    // The original request remains the cache key, preserving its query string.
    fetch(event.request, { cache: 'no-store' })
      .then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, response.clone());
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return (
            (await caches.match(localPath('./'))) ||
            new Response('Offline page unavailable.', { status: 503 })
          );
        }
        return new Response('Offline resource unavailable.', { status: 503 });
      }),
  );
});
