const CACHE="xiaomai-growth-bb7985420ea2c0";
const BASE=self.registration.scope;
const assets=["app.js","assets/icon-180.png","assets/icon-192.png","assets/icon-512.png","assets/wheat-field.webp","cards.json","index.html","manifest.webmanifest","notes.js","styles.css"].map(file=>new URL(file,BASE).href);
self.addEventListener("install",event=>{event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(assets.map(url=>new Request(url,{cache:"reload"})));
})());});
self.addEventListener("activate",event=>{event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith("xiaomai-growth-")&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})());});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);const root=new URL(BASE);
  if(url.origin!==root.origin||!url.pathname.startsWith(root.pathname))return;
  const key=event.request.mode==="navigate" ? new URL("index.html",BASE).href : url.href;
  if(!assets.includes(key))return;
  event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(key)||await fetch(event.request);})());
});
