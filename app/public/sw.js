// Bump these names whenever application assets change so existing clients do
// not remain pinned to an obsolete Comp Database bundle indefinitely.
const APP_CACHE = "rsos-app-shell-v3-20260809";
const STATIC_CACHE = "rsos-static-v3-20260809";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name !== APP_CACHE && name !== STATIC_CACHE)
        .map((name) => caches.delete(name)),
    );
    await self.clients.claim();
  })());
});

function isApiRequest(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/api/");
}

function isStaticRequest(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  return ["style", "script", "image", "font"].includes(request.destination);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (isApiRequest(url)) {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        if (request.method === "GET") {
          return new Response(JSON.stringify({
            ok: false,
            offline: true,
            message: "RSOS is offline. Viewing cached interface only. Changes cannot be saved."
          }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          ok: false,
          offline: true,
          message: "RSOS is offline. Viewing cached interface only. Changes cannot be saved."
        }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
    })());
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        const cache = await caches.open(APP_CACHE);
        cache.put(request, networkResponse.clone());
        return networkResponse;
      } catch {
        const cached = await caches.match(request);
        return cached || caches.match("/offline.html");
      }
    })());
    return;
  }

  if (isStaticRequest(request, url)) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      const networkPromise = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        networkPromise.catch(() => null);
        return cached;
      }

      return networkPromise || fetch(request);
    })());
  }
});
