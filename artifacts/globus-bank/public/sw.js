const CACHE_NAME = "globus-app-shell-v3";

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
      // Let updates wait until the current page session ends. This avoids
      // switching the app shell while a member is completing sign-in or email
      // verification in another app.
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
      // Do not take control of already-open tabs during activation. They keep
      // their current document until the member navigates or opens the app again.
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

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    const parsed = event.data ? event.data.json() : {};
    payload = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    payload = { title: "Globus account notice", body: "You have an account update." };
  }

  const title =
    typeof payload.title === "string" && payload.title
      ? payload.title
      : "Globus account notice";
  const body =
    typeof payload.body === "string" && payload.body
      ? payload.body
      : "You have an account update.";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: new URL("globus-mark-transparent.png", self.registration.scope).toString(),
      badge: new URL("globus-mark-transparent.png", self.registration.scope).toString(),
      data: { url: new URL("notifications", self.registration.scope).toString() },
      tag: typeof payload.notificationId === "string" ? payload.notificationId : "globus-account-update",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL("notifications", self.registration.scope).toString();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const matchingClient = clients.find((client) => client.url.startsWith(self.registration.scope));
      if (matchingClient) {
        return matchingClient.focus().then(() => matchingClient.navigate(targetUrl));
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
