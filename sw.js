// Reign of Swords — Service Worker v4
const CACHE = "ros-shell-v4";

// On install: cache the app shell
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(["./", "./index.html"]).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// On activate: clear old caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - External (APIs, fonts, CDN): network-first, fall back to cache
// - Same-origin (our HTML): cache-first, update in background
self.addEventListener("fetch", e => {
  // Skip non-GET and chrome-extension requests
  if (e.request.method !== "GET") return;
  if (!e.request.url.startsWith("http")) return;

  const url = new URL(e.request.url);
  const isExternal = url.hostname !== self.location.hostname;

  if (isExternal) {
    // Network-first for CDN, Anthropic API, Google Fonts
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Cache successful font/CDN responses
          if (res.ok && (url.hostname.includes("fonts") || url.hostname.includes("cdnjs"))) {
            const clone = res.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Cache-first for same-origin (the HTML shell)
    e.respondWith(
      caches.match(e.request).then(cached => {
        const net = fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
  }
});
