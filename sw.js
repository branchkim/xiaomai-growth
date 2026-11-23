const CACHE = "xiaomai-growth-909ba1c4f36efd";
const base = self.registration.scope;
const resources = new Set(["app.js","assets/icon-180.png","assets/icon-192.png","assets/icon-512.png","assets/stage-m1.webp","assets/stage-m2.webp","assets/stage-m3.webp","assets/stage-m4.webp","assets/stage-m5.webp","assets/stage-m6.webp","assets/stage-m7.webp","assets/wheat-field.webp","cards.json","device-tools.js","index.html","library.js","manifest.webmanifest","notes.js","styles.css"].map((name) => new URL(name, base).href));
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
      for (const key of await caches.keys()) {
        if (key.startsWith("xiaomai-growth-") && key !== CACHE)
          await caches.delete(key);
      }
      await self.clients.claim();
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
