const CACHE = "xiaomai-growth-bd4aea8494967c";
const base = self.registration.scope;
const resources = new Set(["app.js","assets/icon-180.png","assets/icon-192.png","assets/icon-512.png","assets/stage-m1.webp","assets/stage-m2.webp","assets/stage-m3.webp","assets/stage-m4.webp","assets/stage-m5.webp","assets/stage-m6.webp","assets/stage-m7.webp","assets/wheat-field.webp","cards.json","checkins.js","device-tools.js","index.html","library.js","manifest.webmanifest","notes.js","styles.css"].map((name) => new URL(name, base).href));
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
            url.searchParams.get("open") === "checkin"
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
