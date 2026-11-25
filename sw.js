const CACHE = "xiaomai-growth-3ac2fe7ff83ac2";
const base = self.registration.scope;
const resources = new Set(["app.js","assets/icon-180.png","assets/icon-192.png","assets/icon-512.png","assets/stage-m1.webp","assets/stage-m2.webp","assets/stage-m3.webp","assets/stage-m4.webp","assets/stage-m5.webp","assets/stage-m6.webp","assets/stage-m7.webp","assets/stage-t12.webp","assets/stage-t18.webp","assets/stage-t24.webp","assets/stage-t30.webp","assets/wheat-field.webp","cards.json","care-trends.css","care-trends.js","checkins.js","device-tools.js","diary.js","growth-store.js","growth.css","growth.js","health-data.js","health-growth.js","health.css","health.js","index.html","legacy-tasks.js","library.js","manifest.webmanifest","notes.js","styles.css"].map((name) => new URL(name, base).href));
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(
        [...resources].map((url) => new Request(url, { cache: "reload" })),
      );
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const oldCaches = (await caches.keys()).filter(
        (key) => key.startsWith("xiaomai-growth-") && key !== CACHE,
      );
      for (const key of oldCaches) {
        await caches.delete(key);
      }
      await self.clients.claim();
      // A parent following the update link may have received the old cached homepage.
      if (oldCaches.length) {
        for (const client of await self.clients.matchAll({ type: "window" })) {
          const url = new URL(client.url);
          if (
            url.pathname === new URL(base).pathname &&
            ["checkin", "growth", "timeline", "knowledge"].includes(url.searchParams.get("open"))
          ) {
            // Navigation fetches are released once activation completes.
            void client.navigate(client.url).catch(() => {});
          }
        }
      }
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (!url.href.startsWith(base)) return;
  const key =
    event.request.mode === "navigate"
      ? new URL("index.html", base).href
      : url.href;
  if (!resources.has(key)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(key)) || (await fetch(event.request));
    })(),
  );
});
