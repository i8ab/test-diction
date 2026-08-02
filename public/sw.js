/* =============================================================================
   Two Tongues — offline service worker
   -----------------------------------------------------------------------------
   Strategy:
   - App shell (HTML/CSS/JS/fonts): cache-first, falling back to network, so
     the app itself opens instantly even with no connection.
   - /api/jsonbin (the word data): network-first, so users always see fresh
     data when online; App.jsx's own localStorage cache (OFFLINE_CACHE_KEY)
     is what serves the words when this fetch fails offline — this worker
     does not need to cache that endpoint itself.
   - Everything else: network-first with cache fallback.

   Bump CACHE_VERSION whenever you deploy a new build so old clients pick up
   the new shell instead of serving a stale cached one forever.
   ============================================================================= */

const CACHE_VERSION = "two-tongues-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
      // If a shell asset 404s at install time, don't block activation —
      // the worker will just fetch it from the network on first request.
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never intercept writes (PUT /api/jsonbin, etc.)

  const url = new URL(request.url);

  // Data API: network-first, no caching here — App.jsx owns the fallback.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(() => new Response(null, { status: 503 })));
    return;
  }

  // App shell / static assets: cache-first, refresh cache in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
