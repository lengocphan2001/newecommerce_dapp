const CACHE_VERSION = "shopii-cache-v1";
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll([OFFLINE_URL])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((networkResponse) => {
          const isHttp =
            request.url.startsWith("http://") ||
            request.url.startsWith("https://");
          if (isHttp && networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches
              .open(CACHE_VERSION)
              .then((cache) => cache.put(request, responseClone))
              .catch(() => {
                // Ignore cache write errors for unsupported requests.
              });
          }
          return networkResponse;
        })
        .catch(() => {
          if (request.mode === "navigate") {
            return caches.match(OFFLINE_URL);
          }
          return new Response("Offline", {
            status: 503,
            statusText: "Offline",
          });
        });
    }),
  );
});
