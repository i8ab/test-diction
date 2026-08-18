/**
 * Push prefs + multi-device helpers
 * Messages & settings live on the server → synced across devices.
 * Local storage is used as a fast offline cache per account.
 */

const API = "/api/push-subscribe";

export const DEFAULT_INTERVAL_HOURS = 24;

// ---------- Local storage keys (per-account) ----------
function key(code, suffix) {
  return `twoTongues.push.${code || "anon"}.${suffix}`;
}

function readLocal(code, suffix, fallback) {
  try {
    const raw = localStorage.getItem(key(code, suffix));
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeLocal(code, suffix, value) {
  try {
    localStorage.setItem(key(code, suffix), JSON.stringify(value));
  } catch (_) {}
}

// ---------- Local prefs cache ----------
export function loadRemindersEnabled(code) {
  return !!readLocal(code, "enabled", false);
}

export function saveRemindersEnabled(code, on) {
  writeLocal(code, "enabled", !!on);
}

export function loadReminderTitle(code) {
  return String(readLocal(code, "title", "") || "");
}

export function saveReminderTitle(title, code) {
  writeLocal(code, "title", String(title || ""));
}

export function loadReminderMessage(code) {
  return String(readLocal(code, "message", "") || "");
}

export function saveReminderMessage(message, code) {
  writeLocal(code, "message", String(message || ""));
}

export function loadReminderMessages(code) {
  const v = readLocal(code, "messages", []);
  return Array.isArray(v) ? v.map(String) : [];
}

export function saveReminderMessages(messages, code) {
  const list = (Array.isArray(messages) ? messages : [])
    .map((m) => String(m || "").trim())
    .filter(Boolean)
    .slice(0, 20);
  writeLocal(code, "messages", list);
}

export function loadReminderIntervalHours(code) {
  const n = Number(readLocal(code, "intervalHours", DEFAULT_INTERVAL_HOURS));
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_INTERVAL_HOURS;
}

export function saveReminderIntervalHours(hours, code) {
  const n = Number(hours);
  writeLocal(code, "intervalHours", Number.isFinite(n) && n > 0 ? n : DEFAULT_INTERVAL_HOURS);
}

/** Apply cloud prefs into localStorage so the UI stays consistent offline. */
export function applyPushPrefsLocally(code, cloud) {
  if (!code || !cloud) return;
  if (cloud.title != null) saveReminderTitle(cloud.title, code);
  if (cloud.message != null) saveReminderMessage(cloud.message, code);
  if (Array.isArray(cloud.messages)) saveReminderMessages(cloud.messages, code);
  if (cloud.intervalHours != null) saveReminderIntervalHours(cloud.intervalHours, code);
  if (cloud.enabled != null) saveRemindersEnabled(code, cloud.enabled);
}

export function buildReminderPayload({ title, message } = {}) {
  const t = (title && String(title).trim()) || "وقت المراجعة! / Time to review!";
  const b = (message && String(message).trim()) || "افتح التطبيق وراجع كلماتك / Open the app and review your words";
  return { title: t, body: b };
}

// ---------- Web Push helpers ----------
export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getPushStatus() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission; // "granted" | "denied" | "default"
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    // Prefer the existing registration (sw.js is registered by the app)
    const reg = await navigator.serviceWorker.ready;
    return reg;
  } catch {
    try {
      return await navigator.serviceWorker.register("/sw.js");
    } catch {
      return null;
    }
  }
}

/**
 * Subscribe this device and send the subscription to the server.
 * @returns {{ ok: boolean, error?: string, message?: string, reason?: string }}
 */
export async function subscribeToPush(code, prefs = {}) {
  if (!code) return { ok: false, error: "no_code" };
  if (!pushSupported()) return { ok: false, error: "unsupported" };

  const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapid) return { ok: false, error: "no_vapid", message: "VITE_VAPID_PUBLIC_KEY missing" };

  try {
    if (Notification.permission === "denied") {
      return { ok: false, error: "denied" };
    }
    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return { ok: false, error: "denied" };
    }

    const reg = await getRegistration();
    if (!reg) return { ok: false, error: "no_sw", message: "Service worker not ready" };

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
    }

    const json = sub.toJSON();
    const result = await subscribePush(code, json);
    if (!result || result.error) {
      return { ok: false, error: result?.error || "server", message: result?.message };
    }

    // Persist enabled + optional prefs locally
    saveRemindersEnabled(code, true);
    if (prefs && typeof prefs === "object") {
      if (prefs.title != null) saveReminderTitle(prefs.title, code);
      if (prefs.message != null) saveReminderMessage(prefs.message, code);
      if (Array.isArray(prefs.messages)) saveReminderMessages(prefs.messages, code);
      if (prefs.intervalHours != null) saveReminderIntervalHours(prefs.intervalHours, code);
      // Also push to server so other devices stay in sync
      await savePushPrefs(code, {
        enabled: true,
        title: prefs.title,
        message: prefs.message,
        messages: prefs.messages,
        intervalHours: prefs.intervalHours,
      }).catch(() => {});
    }

    return { ok: true, subscription: json, devices: result.devices };
  } catch (err) {
    console.warn("subscribeToPush", err);
    return { ok: false, error: "exception", message: String(err?.message || err) };
  }
}

/** Unsubscribe this device only (other devices keep working). */
export async function unsubscribeFromPush(code) {
  if (!code) return { ok: false };
  try {
    const reg = await getRegistration();
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe().catch(() => {});
        await unsubscribePush(code, endpoint);
      }
    }
    saveRemindersEnabled(code, false);
    return { ok: true };
  } catch (err) {
    console.warn("unsubscribeFromPush", err);
    return { ok: false, error: String(err?.message || err) };
  }
}

/** Clear schedule slots on the server so the next reminder can fire fresh. */
export async function resetPushSlots(code) {
  if (!code) return { ok: false, error: "no_code" };
  try {
    const prefs = await clearSchedule(code);
    return { ok: true, prefs };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

// ---------- Server API wrappers (already present, kept for compatibility) ----------

export async function fetchPushPrefs(code) {
  if (!code) return null;
  try {
    const res = await fetch(`${API}?code=${encodeURIComponent(code)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ...data.prefs,
      devices: data.devices || 0,
      inbox: data.inbox || [],
      unread: data.unread || 0,
    };
  } catch (err) {
    console.warn("fetchPushPrefs", err);
    return null;
  }
}

export async function savePushPrefs(code, prefs) {
  if (!code) return null;
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "savePrefs", code, prefs }),
    });
    const data = await res.json();
    return data.prefs;
  } catch (err) {
    console.warn("savePushPrefs", err);
    return null;
  }
}

/** Clear only the reminder messages list (synced) */
export async function clearReminderMessages(code) {
  if (!code) return null;
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clearMessages", code }),
    });
    const data = await res.json();
    // also clear local cache
    saveReminderMessages([], code);
    saveReminderMessage("", code);
    return data.prefs;
  } catch (err) {
    console.warn("clearReminderMessages", err);
    return null;
  }
}

export async function clearSchedule(code) {
  if (!code) return null;
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clearSchedule", code }),
    });
    const data = await res.json();
    return data.prefs;
  } catch (err) {
    console.warn("clearSchedule", err);
    return null;
  }
}

export async function subscribePush(code, subscription) {
  if (!code || !subscription) return null;
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "subscribe", code, subscription }),
    });
    return res.json();
  } catch (err) {
    console.warn("subscribePush", err);
    return null;
  }
}

export async function unsubscribePush(code, endpoint) {
  if (!code || !endpoint) return null;
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unsubscribe", code, endpoint }),
    });
    return res.json();
  } catch (err) {
    console.warn("unsubscribePush", err);
    return null;
  }
}
