const CACHE = 'nazca-static-v1';

function localPath(relative) {
  return new URL(relative, self.registration.scope).toString();
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      const urls = [
        localPath('./'),
        localPath('./wiki/Nazca_Railway_(Los_Sengas_Division)'),
        localPath('./social-preview.png'),
        localPath('./provenance.json'),
      ];
      for (const url of urls) {
        try {
          const response = await fetch(url, { cache: 'reload' });
          if (response.ok) await cache.put(url, response);
        } catch {
          // A partial install remains useful. Missing entries retry on normal use.
        }
      }
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
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
