// Bump version mỗi khi thay đổi SW logic — trình duyệt sẽ xóa cache cũ và active SW mới.
const CACHE_VERSION = "shopii-cache-v2";
const OFFLINE_URL = "/";

// Chỉ cache static assets có content-hash (JS, CSS, font, image từ _next/static/)
// KHÔNG cache API responses.
const isStaticAsset = (url) => {
  try {
    const u = new URL(url);
    return (
      u.pathname.startsWith("/_next/static/") ||
      u.pathname.startsWith("/static/") ||
      /\.(woff2?|ttf|eot|otf|ico)(\?.*)?$/.test(u.pathname)
    );
  } catch {
    return false;
  }
};

// Bất kỳ request nào tới API backend → không cache
const isApiCall = (url) => {
  try {
    const u = new URL(url);
    // /api/... hoặc cùng origin với path bắt đầu bằng /api
    return u.pathname.startsWith("/api/");
  } catch {
    return false;
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll([OFFLINE_URL])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Xóa tất cả cache phiên bản cũ (bao gồm v1 đã cache API responses)
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

  // Chỉ xử lý GET
  if (request.method !== "GET") return;

  // API calls: để trình duyệt fetch thẳng — không intercept
  if (isApiCall(request.url)) return;

  // Static assets với content-hash: cache-first (an toàn vì URL thay đổi khi nội dung thay đổi)
  if (isStaticAsset(request.url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches
              .open(CACHE_VERSION)
              .then((cache) => cache.put(request, clone))
              .catch(() => {});
          }
          return networkResponse;
        });
      }),
    );
    return;
  }

  // Navigation (HTML pages): network-first → nếu offline thì trả OFFLINE_URL
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  // Mọi request khác (images, v.v.): network-first, không cache
  // Không gọi event.respondWith → trình duyệt tự xử lý bình thường
});
