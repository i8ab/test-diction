// Web Push subscription helpers + local reminder prefs.
// API contract (api/push-subscribe.js):
//   POST { code, subscription?, prefsOnly?, title?, message?, intervalHours? }
//   DELETE { code }
//
// Resilience notes (important for mobile browsers / PWAs):
// - Every async browser API (serviceWorker.ready, pushManager.subscribe,
//   fetch) is wrapped with a timeout so the UI can never stay "busy" forever.
// - When enabling, we prefer a clean re-subscribe (unsubscribe → subscribe)
//   if the previous subscription looks stale or force is requested. This is
//   the most reliable way to fix "toggle is On but notifications never arrive".

const REMINDERS_KEY = "twoTongues.remindersEnabled.";
const TITLE_KEY = "twoTongues.reminderTitle.";
const MSG_KEY = "twoTongues.reminderMessage.";
const MESSAGES_KEY = "twoTongues.reminderMessages.";
const INTERVAL_KEY = "twoTongues.reminderIntervalHours.";
const SUB_KEY = "twoTongues.pushSub.";

export const ALLOWED_INTERVAL_HOURS = [1, 2, 3, 6, 12, 24];
export const DEFAULT_INTERVAL_HOURS = 24;

/** Default timeouts (ms). Mobile browsers can be slow; don't go too low. */
const SW_READY_TIMEOUT_MS = 12000;
const SUBSCRIBE_TIMEOUT_MS = 15000;
const FETCH_TIMEOUT_MS = 12000;

/**
 * Reject a promise after `ms` with a clear error so callers can recover.
 * Never leaves the UI spinning forever.
 */
function withTimeout(promise, ms, label = "operation") {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`timeout:${label}`));
    }, ms);
    Promise.resolve(promise)
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getPushStatus() {
  if (!pushSupported()) return "unsupported";
  const perm = Notification.permission;
  if (perm === "granted") return "granted";
  if (perm === "denied") return "denied";
  return "default";
}

/**
 * SW sets a cache flag when pushsubscriptionchange fires while no page is
 * open. The page reads it on startup / visibility and force-repairs.
 */
export async function checkNeedsResubscribeFlag() {
  if (typeof caches === "undefined") return false;
  try {
    const keys = await caches.keys();
    for (const key of keys) {
      const cache = await caches.open(key);
      const res = await cache.match("/__push_needs_resubscribe");
      if (res) return true;
    }
  } catch (_) {}
  return false;
}

export async function clearNeedsResubscribeFlag() {
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    for (const key of keys) {
      const cache = await caches.open(key);
      try {
        await cache.delete("/__push_needs_resubscribe");
      } catch (_) {}
    }
  } catch (_) {}
}

/**
 * Persist account + VAPID key so the Service Worker can repair the
 * subscription by itself when pushsubscriptionchange fires while the
 * app is closed. Without this, the subscription dies until the user
 * opens the app again.
 */
const PUSH_META_URL = "/__push_account_meta";

export async function savePushMetaForSW(accountCode) {
  if (typeof caches === "undefined" || !accountCode) return;
  const vapid = getVapidPublicKey();
  if (!vapid) return;
  try {
    // Prefer the current CACHE_VERSION if we can discover it; otherwise
    // write into every existing cache so the SW always finds it.
    const keys = await caches.keys();
    const payload = JSON.stringify({
      code: String(accountCode),
      vapidPublicKey: vapid,
      at: Date.now(),
    });
    const response = new Response(payload, {
      headers: { "Content-Type": "application/json" },
    });
    if (keys.length === 0) {
      const cache = await caches.open("two-tongues-push-meta");
      await cache.put(PUSH_META_URL, response.clone());
      return;
    }
    await Promise.all(
      keys.map(async (key) => {
        try {
          const cache = await caches.open(key);
          await cache.put(PUSH_META_URL, response.clone());
        } catch (_) {}
      })
    );
  } catch (_) {}
}

export async function clearPushMetaForSW() {
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    for (const key of keys) {
      try {
        const cache = await caches.open(key);
        await cache.delete(PUSH_META_URL);
      } catch (_) {}
    }
  } catch (_) {}
}

/**
 * Lightweight check: is there currently a browser PushSubscription?
 * Used to decide whether a quiet re-sync is enough or we need force.
 */
export async function hasActiveBrowserSubscription() {
  if (!pushSupported()) return false;
  try {
    const reg = await withTimeout(navigator.serviceWorker.ready, SW_READY_TIMEOUT_MS, "sw.ready");
    const sub = await getCurrentSubscription(reg);
    return !!(sub && sub.endpoint);
  } catch (_) {
    return false;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function getVapidPublicKey() {
  try {
    const k = import.meta.env && import.meta.env.VITE_VAPID_PUBLIC_KEY;
    return k && String(k).trim() ? String(k).trim() : "";
  } catch (_) {
    return "";
  }
}

/**
 * Wait for the service worker to be ready, with a hard timeout.
 * Returns the ServiceWorkerRegistration or throws.
 */
async function getServiceWorkerRegistration() {
  return withTimeout(navigator.serviceWorker.ready, SW_READY_TIMEOUT_MS, "sw.ready");
}

/**
 * Safely get the current PushSubscription (or null). Never hangs forever.
 */
async function getCurrentSubscription(reg) {
  try {
    return await withTimeout(reg.pushManager.getSubscription(), 8000, "getSubscription");
  } catch (_) {
    return null;
  }
}

function prefsFromObject(prefs = {}) {
  let intervalHours = DEFAULT_INTERVAL_HOURS;
  if (typeof prefs.intervalHours === "number" && ALLOWED_INTERVAL_HOURS.includes(prefs.intervalHours)) {
    intervalHours = prefs.intervalHours;
  } else if (typeof prefs.intervalDays === "number") {
    // Legacy fallback
    const h = Math.max(1, Math.round(prefs.intervalDays * 24));
    intervalHours = ALLOWED_INTERVAL_HOURS.reduce((best, v) =>
      Math.abs(v - h) < Math.abs(best - h) ? v : best
    , 24);
  }
  let messages = [];
  if (Array.isArray(prefs.messages)) {
    messages = prefs.messages
      .map((m) => (typeof m === "string" ? m.trim() : ""))
      .filter(Boolean)
      .slice(0, 20);
  } else if (typeof prefs.message === "string" && prefs.message.trim()) {
    messages = [prefs.message.trim()];
  }
  return {
    title: typeof prefs.title === "string" ? prefs.title : "",
    message: typeof prefs.message === "string" ? prefs.message : (messages[0] || ""),
    messages,
    intervalHours,
  };
}

/**
 * Core subscribe logic. Options:
 *   force: true → always drop any existing browser subscription and create a
 *           brand-new one. This is the most reliable fix when the toggle is
 *           "On" but notifications never arrive (stale endpoint).
 */
export async function subscribeToPush(accountCode, prefs = {}, options = {}) {
  const force = !!(options && options.force);

  if (!pushSupported()) return { ok: false, reason: "unsupported", error: "unsupported" };
  if (!accountCode) return { ok: false, reason: "no_code", error: "no_code" };

  try {
    // 1) Permission
    let perm = Notification.permission;
    if (perm !== "granted") {
      try {
        perm = await withTimeout(Notification.requestPermission(), 20000, "requestPermission");
      } catch (e) {
        return {
          ok: false,
          reason: "permission_timeout",
          error: "permission_timeout",
          message: "Permission dialog timed out or was dismissed",
        };
      }
    }
    if (perm === "denied") {
      return { ok: false, reason: "denied", error: "denied" };
    }
    if (perm !== "granted") {
      return { ok: false, reason: "default", error: "default" };
    }

    // 2) Service worker (hard timeout so we never hang the UI)
    let reg;
    try {
      reg = await getServiceWorkerRegistration();
    } catch (e) {
      return {
        ok: false,
        reason: "sw_timeout",
        error: "sw_timeout",
        message: "Service worker not ready — try closing and reopening the app",
      };
    }

    // 3) Existing subscription handling
    let sub = await getCurrentSubscription(reg);

    // When force-rotating: remove the OLD endpoint from the server FIRST,
    // then unsubscribe locally. Otherwise every re-subscribe leaves a dead
    // endpoint in Redis and "devices" grows (10, 20, …) for 1–2 real phones.
    if (force && sub) {
      let oldEndpoint = "";
      try {
        oldEndpoint = sub.endpoint || "";
      } catch (_) {}
      if (oldEndpoint && accountCode) {
        try {
          await withTimeout(
            fetch("/api/push-subscribe", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: accountCode, endpoint: oldEndpoint }),
            }),
            FETCH_TIMEOUT_MS,
            "push-delete-old"
          );
        } catch (_) {
          /* best-effort — still continue to create a fresh sub */
        }
      }
      try {
        await withTimeout(sub.unsubscribe(), 8000, "unsubscribe");
      } catch (_) {
        /* continue — we will try to create a new one anyway */
      }
      sub = null;
    }

    if (!sub) {
      const vapidKey = getVapidPublicKey();
      if (!vapidKey) {
        return {
          ok: false,
          reason: "no_vapid",
          error: "no_vapid",
          message: "VAPID public key missing",
        };
      }
      try {
        sub = await withTimeout(
          reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          }),
          SUBSCRIBE_TIMEOUT_MS,
          "pushManager.subscribe"
        );
      } catch (e) {
        const msg = String((e && e.message) || e);
        // Common on Android when the user previously denied or the browser is in a bad state
        if (/permission|denied|abort/i.test(msg)) {
          return { ok: false, reason: "denied", error: "denied", message: msg };
        }
        return {
          ok: false,
          reason: "subscribe_failed",
          error: msg.includes("timeout:") ? "subscribe_timeout" : "subscribe_failed",
          message: msg,
        };
      }
    }

    if (!sub || !sub.endpoint) {
      return {
        ok: false,
        reason: "no_subscription",
        error: "no_subscription",
        message: "Browser did not return a valid subscription",
      };
    }

    // 4) Persist to server (with timeout)
    const payload = {
      code: accountCode,
      subscription: sub.toJSON(),
      ...prefsFromObject(prefs),
    };

    let r;
    try {
      r = await withTimeout(
        fetch("/api/push-subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
        FETCH_TIMEOUT_MS,
        "push-subscribe"
      );
    } catch (e) {
      return {
        ok: false,
        reason: "network",
        error: "network_timeout",
        message: "Could not reach the server — check your connection and try again",
      };
    }

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return {
        ok: false,
        reason: "server",
        error: data.error || "server_error",
        message: data.message || data.error || `HTTP ${r.status}`,
      };
    }

    try {
      localStorage.setItem(SUB_KEY + accountCode, JSON.stringify(sub.toJSON()));
    } catch (_) {}

    // Let the Service Worker repair the subscription by itself if the
    // browser rotates it while the app is closed.
    try {
      await savePushMetaForSW(accountCode);
    } catch (_) {}

    return {
      ok: true,
      subscription: sub,
      prefs: data.prefs,
      deviceCount: data.deviceCount,
      forced: force,
    };
  } catch (e) {
    const msg = String((e && e.message) || e);
    return {
      ok: false,
      reason: "exception",
      error: msg.includes("timeout:") ? "timeout" : msg,
      message: msg,
    };
  }
}

/**
 * Unsubscribe this device only. Always clears local state even if network fails.
 * Protected by timeouts so the UI never freezes.
 */
export async function unsubscribeFromPush(accountCode) {
  let endpoint = "";
  try {
    if (pushSupported()) {
      try {
        const reg = await getServiceWorkerRegistration();
        const sub = await getCurrentSubscription(reg);
        if (sub) {
          try {
            endpoint = sub.endpoint || "";
          } catch (_) {}
          try {
            await withTimeout(sub.unsubscribe(), 8000, "unsubscribe");
          } catch (_) {}
        }
      } catch (_) {
        /* SW not ready — still try to clean server + localStorage */
      }
    }
  } catch (_) {}

  try {
    if (accountCode) {
      // Remove only this device; keep prefs + other phones for the same account
      await withTimeout(
        fetch("/api/push-subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: accountCode,
            ...(endpoint ? { endpoint } : {}),
          }),
        }),
        FETCH_TIMEOUT_MS,
        "push-unsubscribe"
      );
    }
  } catch (_) {}

  try {
    if (accountCode) localStorage.removeItem(SUB_KEY + accountCode);
  } catch (_) {}
  try {
    await clearPushMetaForSW();
  } catch (_) {}
}

export async function savePushPrefs(accountCode, prefs) {
  if (!accountCode) return;
  try {
    await withTimeout(
      fetch("/api/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: accountCode,
          prefsOnly: true,
          ...prefsFromObject(prefs),
        }),
      }),
      FETCH_TIMEOUT_MS,
      "savePushPrefs"
    );
  } catch (_) {}
}

/**
 * Clear reminder schedule markers (lastSent / lastSlot / message rotation index)
 * so the next cron can fire on a clean slate. Does not disable push or prefs.
 */
export async function resetPushSlots(accountCode) {
  if (!accountCode) return { ok: false, error: "no_code" };
  try {
    const r = await withTimeout(
      fetch("/api/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: accountCode,
          prefsOnly: true,
          resetSlots: true,
        }),
      }),
      FETCH_TIMEOUT_MS,
      "resetPushSlots"
    );
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return { ok: false, error: data.error || `HTTP ${r.status}` };
    }
    return { ok: true, slotsCleared: !!data.slotsCleared };
  } catch (e) {
    const msg = String((e && e.message) || e);
    return { ok: false, error: msg.includes("timeout:") ? "timeout" : msg };
  }
}

/**
 * Fetch reminder prefs from the server (shared across all devices for this account).
 * Returns normalized prefs or null on failure / missing.
 */
export async function fetchPushPrefs(accountCode) {
  if (!accountCode) return null;
  try {
    const r = await withTimeout(
      fetch(
        `/api/push-subscribe?code=${encodeURIComponent(accountCode)}&_t=${Date.now()}`,
        {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        }
      ),
      FETCH_TIMEOUT_MS,
      "fetchPushPrefs"
    );
    if (!r.ok) return null;
    const data = await r.json().catch(() => null);
    if (!data || !data.prefs) return null;
    return prefsFromObject(data.prefs);
  } catch (_) {
    return null;
  }
}

/** Write server prefs into localStorage so offline UI matches cloud. */
export function applyPushPrefsLocally(accountCode, prefs) {
  if (!accountCode || !prefs) return;
  const n = prefsFromObject(prefs);
  try {
    if (n.title) saveReminderTitle(n.title, accountCode);
    else saveReminderTitle("", accountCode);
    if (n.messages && n.messages.length) {
      saveReminderMessages(n.messages, accountCode);
    } else if (n.message) {
      saveReminderMessages([n.message], accountCode);
    }
    if (ALLOWED_INTERVAL_HOURS.includes(n.intervalHours)) {
      saveReminderIntervalHours(n.intervalHours, accountCode);
    }
  } catch (_) {}
}

export function loadRemindersEnabled(accountCode) {
  try {
    return localStorage.getItem(REMINDERS_KEY + accountCode) === "1";
  } catch (_) {
    return false;
  }
}

export function saveRemindersEnabled(accountCode, on) {
  try {
    if (on) localStorage.setItem(REMINDERS_KEY + accountCode, "1");
    else localStorage.removeItem(REMINDERS_KEY + accountCode);
  } catch (_) {}
}

export function loadReminderTitle(accountCode) {
  try {
    return localStorage.getItem(TITLE_KEY + accountCode) || "";
  } catch (_) {
    return "";
  }
}

export function saveReminderTitle(title, accountCode) {
  try {
    localStorage.setItem(TITLE_KEY + accountCode, title || "");
  } catch (_) {}
}

export function loadReminderMessage(accountCode) {
  try {
    return localStorage.getItem(MSG_KEY + accountCode) || "";
  } catch (_) {
    return "";
  }
}

export function saveReminderMessage(message, accountCode) {
  try {
    localStorage.setItem(MSG_KEY + accountCode, message || "");
  } catch (_) {}
}

export function loadReminderIntervalHours(accountCode) {
  try {
    const raw = localStorage.getItem(INTERVAL_KEY + accountCode);
    const n = Number(raw);
    if (ALLOWED_INTERVAL_HOURS.includes(n)) return n;
    return DEFAULT_INTERVAL_HOURS;
  } catch (_) {
    return DEFAULT_INTERVAL_HOURS;
  }
}

export function saveReminderIntervalHours(hours, accountCode) {
  try {
    const n = Number(hours);
    if (ALLOWED_INTERVAL_HOURS.includes(n)) {
      localStorage.setItem(INTERVAL_KEY + accountCode, String(n));
    }
  } catch (_) {}
}


export function loadReminderMessages(accountCode) {
  try {
    const raw = localStorage.getItem(MESSAGES_KEY + accountCode);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return arr.map((m) => String(m || "").trim()).filter(Boolean).slice(0, 20);
      }
    }
    // migrate single message → list
    const one = localStorage.getItem(MSG_KEY + accountCode);
    if (one && one.trim()) return [one.trim()];
    return [];
  } catch (_) {
    return [];
  }
}

export function saveReminderMessages(messages, accountCode) {
  try {
    const list = (Array.isArray(messages) ? messages : [])
      .map((m) => String(m || "").trim())
      .filter(Boolean)
      .slice(0, 20);
    localStorage.setItem(MESSAGES_KEY + accountCode, JSON.stringify(list));
    // keep legacy single field in sync with first message
    localStorage.setItem(MSG_KEY + accountCode, list[0] || "");
  } catch (_) {}
}

export function buildReminderPayload({ title, message, body, dueCount, examDays } = {}) {
  const custom =
    (typeof message === "string" && message.trim()) ||
    (typeof body === "string" && body.trim()) ||
    "";
  let examBit = "";
  if (typeof examDays === "number") {
    if (examDays < 0) examBit = "";
    else if (examDays === 0) examBit = "Exam is today! ";
    else if (examDays === 1) examBit = "1 day until the exam. ";
    else examBit = `${examDays} days until the exam. `;
  }
  return {
    title: (title && String(title).trim()) || "Study reminder",
    body:
      custom ||
      (examBit
        ? `${examBit}${dueCount ? `${dueCount} weak/due words to review` : "Time to review"}`
        : dueCount
          ? `${dueCount} words due for review`
          : "Time to review your words"),
    dueCount: dueCount || 0,
  };
}
