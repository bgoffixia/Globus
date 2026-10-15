const CACHE_NAME = "globus-app-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const shellUrl = new URL("index.html", self.registration.scope);
      try {
        const response = await fetch(shellUrl, { cache: "reload" });
        if (response.ok) await cache.put(shellUrl, response);
      } catch {
        // A first offline visit has no shell to fall back to.
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("globus-app-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);

  if (
    request.method !== "GET" ||
    url.origin !== scope.origin ||
    !url.pathname.startsWith(scope.pathname) ||
    url.pathname.startsWith(`${scope.pathname}api/`)
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const shellUrl = new URL("index.html", self.registration.scope);
        return (await caches.match(shellUrl)) ?? Response.error();
      }),
    );
  }
});
