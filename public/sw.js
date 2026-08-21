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

const CACHE_VERSION = "two-tongues-v20";
const NAVIGATION_TIMEOUT_MS = 8000;
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
    // Explicit reload / hard-refresh must always hit the network so the user
    // can refresh normally even while the previous load was still pending.
    const isReload =
      request.cache === "reload" ||
      request.headers.get("cache-control") === "no-cache" ||
      request.headers.get("pragma") === "no-cache";
    if (isReload) {
      event.respondWith(
        fetch(request)
          .then((res) => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put("/index.html", clone));
            }
            return res;
          })
          .catch(() => caches.match("/index.html").then((cached) => cached || Promise.reject()))
      );
      return;
    }
    event.respondWith(
      Promise.race([
        fetch(request),
        new Promise((_, reject) => setTimeout(() => reject(new Error("navigation-timeout")), NAVIGATION_TIMEOUT_MS)),
      ])
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put("/index.html", clone));
          }
          return res;
        })
        .catch(() => caches.match("/index.html").then((cached) => cached || fetch(request)))
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
    (async () => {
      // Stronger, more persistent notification options so the banner is more
      // likely to appear and stay visible even when the app is fully closed
      // (especially on Android Chrome / non-PWA and under battery restrictions).
      const options = {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag,
        renotify: true,                 // always replace previous with same tag
        requireInteraction: true,       // stay until user interacts (helps a lot)
        silent: false,                  // force sound/vibration if allowed
        vibrate: [200, 100, 200, 100, 200],
        data: { url: data.url || "/" },
        dir: "auto",
        lang: "ar",
      };

      try {
        await self.registration.showNotification(data.title || "إشعار", options);
      } catch (err) {
        // Fallback without the stricter options if the browser rejects them
        try {
          await self.registration.showNotification(data.title || "إشعار", {
            body: data.body || "",
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            tag,
            renotify: true,
            data: { url: data.url || "/" },
          });
        } catch (_) {}
      }

      // Forward to open app tabs so the in-app inbox can collect the same push
      try {
        const clientsArr = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        const payload = {
          type: "INBOX_PUSH",
          title: data.title || "",
          body: data.body || "",
          url: data.url || "/",
          at: Date.now(),
          notifType: (typeof tag === "string" && tag.startsWith("broadcast-"))
            ? "admin"
            : "push",
        };
        for (const c of clientsArr) {
          try { c.postMessage(payload); } catch (_) {}
        }
      } catch (_) {}
    })()
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

/* =============================================================================
   PUSH SUBSCRIPTION CHANGE (critical for stability when the app is closed)
   -----------------------------------------------------------------------------
   Browsers periodically rotate or invalidate push subscriptions (after long
   idle time, browser updates, clearing site data, etc.). If we don't react,
   the server keeps the OLD dead endpoint → notifications stop arriving until
   the user opens the app again.

   Strategy (works even if the user never opens the app):
   1) Read account code + VAPID public key that the page stored in Cache
      when it last subscribed successfully (/__push_account_meta).
   2) Obtain a fresh PushSubscription (prefer event.newSubscription; else
      subscribe with the stored VAPID key).
   3) POST the new subscription to /api/push-subscribe so the server has a
      live endpoint again — no need for the user to open the app.
   4) Still flag + notify open clients as a backup.
   ============================================================================= */

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function readPushMetaFromCaches() {
  try {
    const keys = await caches.keys();
    for (const key of keys) {
      try {
        const cache = await caches.open(key);
        const res = await cache.match("/__push_account_meta");
        if (!res) continue;
        const data = await res.json();
        if (data && data.code && data.vapidPublicKey) return data;
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      // ── 1) Try to repair from the Service Worker itself (app can stay closed)
      let repaired = false;
      try {
        const meta = await readPushMetaFromCaches();
        if (meta && meta.code && meta.vapidPublicKey) {
          // Drop the old endpoint from the server so zombies don't accumulate
          try {
            const oldSub = event.oldSubscription;
            const oldEndpoint = oldSub && oldSub.endpoint;
            if (oldEndpoint) {
              await fetch("/api/push-subscribe", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: meta.code, endpoint: oldEndpoint }),
              });
            }
          } catch (_) {}

          let sub = event.newSubscription || null;
          if (!sub) {
            try {
              sub = await self.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(meta.vapidPublicKey),
              });
            } catch (_) {
              sub = null;
            }
          }
          if (sub && sub.endpoint) {
            try {
              const r = await fetch("/api/push-subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  code: meta.code,
                  subscription: sub.toJSON(),
                }),
              });
              if (r.ok) repaired = true;
            } catch (_) {}
          }
        }
      } catch (_) {}

      // ── 2) Backup: flag for the page if repair failed or meta was missing
      if (!repaired) {
        try {
          const cache = await caches.open(CACHE_VERSION);
          await cache.put(
            new Request("/__push_needs_resubscribe"),
            new Response(JSON.stringify({ at: Date.now() }), {
              headers: { "Content-Type": "application/json" },
            })
          );
        } catch (_) {}
      } else {
        // Clear any previous needs-resubscribe flag
        try {
          const keys = await caches.keys();
          for (const key of keys) {
            try {
              const cache = await caches.open(key);
              await cache.delete("/__push_needs_resubscribe");
            } catch (_) {}
          }
        } catch (_) {}
      }

      // ── 3) Notify any open tabs so they stay in sync
      try {
        const clientsArr = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        for (const c of clientsArr) {
          try {
            c.postMessage({
              type: "PUSH_SUBSCRIPTION_CHANGE",
              at: Date.now(),
              repaired,
            });
          } catch (_) {}
        }
      } catch (_) {}
    })()
  );
});
