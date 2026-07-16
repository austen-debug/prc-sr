import {
  GATE_SHELL_CACHE_NAME,
  GATE_STATIC_SHELL_ASSETS,
  isAuthoritativeApiRequest,
  isCacheableShellRequest
} from '/app/offline/cache-policy.mjs';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(GATE_SHELL_CACHE_NAME);
    await cache.addAll(GATE_STATIC_SHELL_ASSETS);
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith('gate-build-2-shell-') && name !== GATE_SHELL_CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (isAuthoritativeApiRequest(request)) {
    event.respondWith(fetch(request));
    return;
  }
  if (!isCacheableShellRequest(request)) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { cacheName: GATE_SHELL_CACHE_NAME });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(GATE_SHELL_CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
