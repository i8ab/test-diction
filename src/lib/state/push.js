// Web Push subscription helpers + local reminder prefs.
// API contract (api/push-subscribe.js):
//   POST { code, subscription?, prefsOnly?, title?, message?, intervalDays? }
//   DELETE { code }

const REMINDERS_KEY = "twoTongues.remindersEnabled.";
const TITLE_KEY = "twoTongues.reminderTitle.";
const MSG_KEY = "twoTongues.reminderMessage.";
const SUB_KEY = "twoTongues.pushSub.";

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
    // Vite injects env at build time
    const k = import.meta.env && import.meta.env.VITE_VAPID_PUBLIC_KEY;
    return k && String(k).trim() ? String(k).trim() : "";
  } catch (_) {
    return "";
  }
}

function prefsFromObject(prefs = {}) {
  return {
    title: typeof prefs.title === "string" ? prefs.title : "",
    message: typeof prefs.message === "string" ? prefs.message : "",
    intervalDays:
      typeof prefs.intervalDays === "number" ? prefs.intervalDays : 1,
  };
}

export async function subscribeToPush(accountCode, prefs = {}) {
  if (!pushSupported()) return { ok: false, reason: "unsupported", error: "unsupported" };
  if (!accountCode) return { ok: false, reason: "no_code", error: "no_code" };

  try {
    // Request permission first
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
          message: "VITE_VAPID_PUBLIC_KEY missing",
        };
      }
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const body = {
      code: accountCode,
      subscription: sub.toJSON(),
      ...prefsFromObject(prefs),
    };

    const res = await fetch("/api/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        ok: false,
        reason: data.error || `http_${res.status}`,
        error: data.error || `http_${res.status}`,
        message: data.message || data.error,
      };
    }

    try {
      localStorage.setItem(SUB_KEY + accountCode, JSON.stringify(sub.toJSON()));
    } catch (_) {}

    return { ok: true, subscription: sub };
  } catch (e) {
    return {
      ok: false,
      reason: String(e && e.message ? e.message : e),
      error: String(e && e.message ? e.message : e),
    };
  }
}

export async function unsubscribeFromPush(accountCode) {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch (_) {}
  try {
    if (accountCode) {
      await fetch("/api/push-subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accountCode }),
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
