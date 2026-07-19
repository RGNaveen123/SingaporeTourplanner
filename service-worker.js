const CACHE = "sgtp-shell-v2";
const SHELL = ["./", "./index.html", "./app.jsx", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const isShell = url.origin === self.location.origin;
  if (!isShell) return; // let CDN scripts, the Anthropic API, map tiles, and Wikipedia photos hit the network directly

  // Network-first for the app shell: always try to get the latest deployed
  // code first. Only fall back to the cached copy if the network fails
  // (offline). This is the app you're actively iterating on, so a stale
  // cache silently masking new edits is worse than an extra network hop.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
