const CACHE = "xiaomai-growth-__VERSION__";
const base = self.registration.scope;
const resources = new Set(__FILES__.map((name) => new URL(name, base).href));
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
