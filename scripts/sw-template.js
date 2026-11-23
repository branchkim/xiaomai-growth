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
            ["checkin", "growth"].includes(url.searchParams.get("open"))
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
