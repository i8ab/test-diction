/* =============================================================================
   Two Tongues — offline service worker
   -----------------------------------------------------------------------------
   Strategy:
   - HTML / navigation requests: network-first. This is what fixes "I deployed
     but the site still looks old" — the page shell always tries the network
     first so a new deploy shows up on the very next load, not just after a
     second reload. Falls back to the cached shell only when offline.
   - Hashed static assets (JS/CSS/fonts from /assets/*, produced by Vite with
     a content hash in the filename): cache-first, since a changed file always
     gets a new URL — there's no staleness risk, and this is what makes the
     app feel instant / work offline.
   - /api/jsonbin (the word data): network-first, so users always see fresh
     data when online; App.jsx's own localStorage cache (OFFLINE_CACHE_KEY)
     is what serves the words when this fetch fails offline — this worker
     does not need to cache that endpoint itself.
   - Everything else: network-first with cache fallback.

   Bump CACHE_VERSION whenever you want to force old clients to drop every
   previously cached asset (rarely needed now that the shell is
   network-first, but still useful as a hard reset).
   ============================================================================= */

const CACHE_VERSION = "two-tongues-v2";
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

  // HTML / navigations: network-first so a fresh deploy is visible right
  // away instead of waiting for a stale cached shell to be replaced in the
  // background on some later visit.
  const isNavigation = request.mode === "navigate" || request.headers.get("accept")?.includes("text/html");
  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/index.html")))
    );
    return;
  }

  // Hashed static assets: cache-first, refresh cache in the background.
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
