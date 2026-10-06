const CACHE_NAME = "qsprint-admin-v3";
const APP_SHELL = [
  "/admin/",
  "/admin/login",
  "/admin/no-access",
  "/admin/manifest.json",
  "/admin/icons/icon-192.png",
  "/admin/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  // 逐一快取、個別失敗不擋住整體安裝（例如「/admin/」在未登入狀態下會是 redirect，
  // 快取失敗也沒關係，不影響其他公開資源的快取）。
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) => cache.add(url).catch(() => undefined)),
      ),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API 資料一律走網路，不快取，確保管理後台看到的是最新資料
  if (url.pathname.startsWith("/admin/api/") || url.pathname.startsWith("/admin/auth/")) {
    return;
  }

  // App shell（HTML/CSS/JS/圖示）：network-first，離線或網路失敗時退回快取，
  // 確保「加入主畫面」後仍可開啟基本畫面。
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/admin/login"))),
  );
});
