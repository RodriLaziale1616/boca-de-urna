const CACHE_NAME = "bdu-offline-shell-v1";
const CACHE_PREFIX = "bdu-offline-shell-";

async function precacheCurrentShell() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch("/", { cache: "reload" });
  if (!response.ok) return;

  const html = await response.clone().text();
  await cache.put("/", response.clone());

  const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(match => match[1])
    .filter(url => url.startsWith("/") && !url.startsWith("/api/"));

  await Promise.all(urls.map(async url => {
    try {
      const asset = await fetch(url, { cache: "reload" });
      if (asset.ok) await cache.put(url, asset);
    } catch {
      // One missing optional asset must not prevent offline installation.
    }
  }));
}

self.addEventListener("install", event => {
  event.waitUntil(precacheCurrentShell().catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
        if (request.mode === "navigate") await cache.put("/", response.clone());
      }
      return response;
    } catch {
      const cached = request.mode === "navigate"
        ? await cache.match("/")
        : await cache.match(request);
      return cached || Response.error();
    }
  })());
});
