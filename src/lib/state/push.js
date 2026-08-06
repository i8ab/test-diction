// Web Push subscription helpers + local reminder prefs.

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

export async function subscribeToPush(accountCode, prefs = {}) {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      // VAPID public key should come from env; fallback attempts server
      let vapidKey = null;
      try {
        const r = await fetch("/api/push-subscribe");
        if (r.ok) {
          const j = await r.json();
          vapidKey = j.publicKey || j.vapidPublicKey;
        }
      } catch (_) {}
      if (!vapidKey) {
        // Without a VAPID key we can still request permission for local notifs
        const perm = await Notification.requestPermission();
        return { ok: perm === "granted", reason: perm === "granted" ? "local" : perm };
      }
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }
    try {
      await fetch("/api/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountCode,
          subscription: sub.toJSON(),
          prefs,
        }),
      });
    } catch (_) {}
    try {
      localStorage.setItem(SUB_KEY + accountCode, JSON.stringify(sub.toJSON()));
    } catch (_) {}
    return { ok: true, subscription: sub };
  } catch (e) {
    return { ok: false, reason: String(e && e.message ? e.message : e) };
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
    localStorage.removeItem(SUB_KEY + accountCode);
  } catch (_) {}
}

export async function savePushPrefs(accountCode, prefs) {
  try {
    await fetch("/api/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountCode, prefsOnly: true, prefs }),
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

export function buildReminderPayload({ title, message, dueCount }) {
  return {
    title: title || "Study reminder",
    body: message || (dueCount ? `${dueCount} words due for review` : "Time to review your words"),
    dueCount: dueCount || 0,
  };
}
