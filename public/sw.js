/* =============================================================================
   Bacaloria Community — offline service worker
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

const CACHE_VERSION = "two-tongues-v9";
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


self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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

/* =============================================================================
   REAL WEB PUSH (arrives even when the tab/site is closed)
   -----------------------------------------------------------------------------
   Fired by the browser's push service when api/push-send-reminders.js (a
   daily Vercel Cron job) sends a message to a subscription this worker
   registered via src/lib/state/push.js. This is what actually shows the
   OS-level notification — the JS in ReminderBanner.jsx only ever showed a
   notification while the page itself was open.
   ============================================================================= */
self.addEventListener("push", (event) => {
  let data = { title: "وقت المراجعة! / Time to review!", body: "", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    // payload wasn't JSON — fall back to the defaults above
  }
  // `tag` collapses duplicate notifications with the same tag into one
  // (replaces the previous). Broadcasts send a shared tag; without it, a
  // device that was registered under two account codes would show two
  // identical banners for one "Notify all".
  // Test pushes send a unique tag + renotify:true so re-tapping "Send test"
  // always shows a fresh banner even with identical title/body.
  const tag = data.tag || `tt-${(data.title || "").slice(0, 40)}|${(data.body || "").slice(0, 80)}`;
  const renotify = data.renotify === true || (typeof tag === "string" && tag.startsWith("test-"));
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag,
      renotify,
      data: { url: data.url || "/" },
    })
  );
});

// Clicking the notification focuses an existing tab if one's open,
// otherwise opens a new one, and closes the notification either way.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => "focus" in c);
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});
