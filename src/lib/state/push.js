// Web Push subscription helpers + local reminder prefs.
// API contract (api/push-subscribe.js):
//   POST { code, subscription?, prefsOnly?, title?, message?, intervalHours? }
//   DELETE { code }

const REMINDERS_KEY = "twoTongues.remindersEnabled.";
const TITLE_KEY = "twoTongues.reminderTitle.";
const MSG_KEY = "twoTongues.reminderMessage.";
const MESSAGES_KEY = "twoTongues.reminderMessages.";
const INTERVAL_KEY = "twoTongues.reminderIntervalHours.";
const SUB_KEY = "twoTongues.pushSub.";

export const ALLOWED_INTERVAL_HOURS = [1, 2, 3, 6, 12, 24];
export const DEFAULT_INTERVAL_HOURS = 24;

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

export async function subscribeToPush(accountCode, prefs = {}) {
  if (!pushSupported()) return { ok: false, reason: "unsupported", error: "unsupported" };
  if (!accountCode) return { ok: false, reason: "no_code", error: "no_code" };

  try {
    let perm = Notification.permission;
    if (perm !== "granted") {
      perm = await Notification.requestPermission();
    }
    if (perm === "denied") {
      return { ok: false, reason: "denied", error: "denied" };
    }
    if (perm !== "granted") {
      return { ok: false, reason: "default", error: "default" };
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

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
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const payload = {
      code: accountCode,
      subscription: sub.toJSON(),
      ...prefsFromObject(prefs),
    };

    const r = await fetch("/api/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
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

    return { ok: true, subscription: sub, prefs: data.prefs };
  } catch (e) {
    return {
      ok: false,
      reason: "exception",
      error: String((e && e.message) || e),
    };
  }
}

export async function unsubscribeFromPush(accountCode) {
  let endpoint = "";
  try {
    if (pushSupported()) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        try {
          endpoint = sub.endpoint || "";
        } catch (_) {}
        await sub.unsubscribe();
      }
    }
  } catch (_) {}
  try {
    if (accountCode) {
      // Remove only this device; keep prefs + other phones for the same account
      await fetch("/api/push-subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: accountCode,
          ...(endpoint ? { endpoint } : {}),
        }),
      });
    }
  } catch (_) {}
  try {
    if (accountCode) localStorage.removeItem(SUB_KEY + accountCode);
  } catch (_) {}
}

export async function savePushPrefs(accountCode, prefs) {
  if (!accountCode) return;
  try {
    await fetch("/api/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: accountCode,
        prefsOnly: true,
        ...prefsFromObject(prefs),
      }),
    });
  } catch (_) {}
}

/**
 * Clear reminder schedule markers (lastSent / lastSlot / message rotation index)
 * so the next cron can fire on a clean slate. Does not disable push or prefs.
 */
export async function resetPushSlots(accountCode) {
  if (!accountCode) return { ok: false, error: "no_code" };
  try {
    const r = await fetch("/api/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: accountCode,
        prefsOnly: true,
        resetSlots: true,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return { ok: false, error: data.error || `HTTP ${r.status}` };
    }
    return { ok: true, slotsCleared: !!data.slotsCleared };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/**
 * Fetch reminder prefs from the server (shared across all devices for this account).
 * Returns normalized prefs or null on failure / missing.
 */
export async function fetchPushPrefs(accountCode) {
  if (!accountCode) return null;
  try {
    const r = await fetch(
      `/api/push-subscribe?code=${encodeURIComponent(accountCode)}&_t=${Date.now()}`,
      {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      }
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
