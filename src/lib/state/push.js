// Client side of real Web Push (arrives even when the site/tab is closed —
// unlike the old Notification-API-only reminder, which only fired while the
// app was open). Talks to api/push-subscribe.js to register/unregister the
// browser's subscription, and to the service worker (public/sw.js) which
// actually displays the notification when Vercel Cron's
// api/push-send-reminders.js sends one.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

// localStorage flag for whether the person opted into study reminders —
// shared between the header-menu toggle and the in-list reminder banner so
// both reflect the same on/off state.
// Keys are scoped per account code so two people sharing a device (or
// switching accounts on the same browser) never inherit each other's
// custom notification title/body or on/off preference.
export const REMINDER_PREF_KEY = "twoTongues.remindersEnabled"; // legacy global fallback
export const REMINDER_MESSAGE_KEY = "twoTongues.reminderMessage"; // legacy
export const REMINDER_TITLE_KEY = "twoTongues.reminderTitle"; // legacy

function prefKey(code) {
  return code ? `twoTongues.remindersEnabled.${code}` : REMINDER_PREF_KEY;
}
function messageKey(code) {
  return code ? `twoTongues.reminderMessage.${code}` : REMINDER_MESSAGE_KEY;
}
function titleKey(code) {
  return code ? `twoTongues.reminderTitle.${code}` : REMINDER_TITLE_KEY;
}

const DEFAULT_TITLE = "وقت المراجعة! / Time to review!";
const DEFAULT_BODY = "تذكير يومي بالمراجعة — يلا نراجع شوية. / Daily review reminder — time for a quick study.";

export function loadRemindersEnabled(code) {
  try {
    if (code) {
      const v = localStorage.getItem(prefKey(code));
      if (v === "1" || v === "0") return v === "1";
    }
    // No per-account value yet — do NOT fall back to another account's
    // preference; default is off.
    return false;
  } catch (e) {
    return false;
  }
}

export function saveRemindersEnabled(code, on) {
  try {
    if (code) localStorage.setItem(prefKey(code), on ? "1" : "0");
  } catch (e) {}
}

export function loadReminderMessage(code) {
  try {
    if (code) {
      const v = localStorage.getItem(messageKey(code));
      return typeof v === "string" ? v : "";
    }
    return "";
  } catch (e) {
    return "";
  }
}

export function saveReminderMessage(msg, code) {
  try {
    const key = messageKey(code);
    if (msg && msg.trim()) localStorage.setItem(key, msg.trim());
    else localStorage.removeItem(key);
  } catch (e) {}
}

export function loadReminderTitle(code) {
  try {
    if (code) {
      const v = localStorage.getItem(titleKey(code));
      return typeof v === "string" ? v : "";
    }
    return "";
  } catch (e) {
    return "";
  }
}

export function saveReminderTitle(title, code) {
  try {
    const key = titleKey(code);
    if (title && title.trim()) localStorage.setItem(key, title.trim());
    else localStorage.removeItem(key);
  } catch (e) {}
}

/** Final payload the user will actually see (custom or default). */
export function buildReminderPayload({ title, body, daysSince } = {}) {
  const t = (title && String(title).trim()) || DEFAULT_TITLE;
  let b = (body && String(body).trim()) || "";
  if (!b) {
    if (typeof daysSince === "number" && daysSince >= 1) {
      b = `عدّى ${daysSince} يوم من غير ما تراجع. / It's been ${daysSince} day${daysSince === 1 ? "" : "s"} since you studied.`;
    } else {
      b = DEFAULT_BODY;
    }
  }
  return { title: t, body: b, url: "/" };
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY;
}

// PushManager wants the VAPID public key as a Uint8Array, but env vars can
// only hold strings — this is the standard base64url -> Uint8Array decode.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Returns "granted" | "denied" | "default" | "unsupported" without
// prompting — used to render the right UI state on load.
export async function getPushStatus() {
  if (!pushSupported()) return "unsupported";
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission; // "granted" | "denied" | "default"
}

// Asks for permission (if needed), subscribes this browser with the push
// service, and saves the subscription server-side under `code`. Optionally
// ships reminder prefs (interval + custom message) so the daily/hourly cron
// can honour them. Returns { ok: true } or { ok: false, error }.
export async function subscribeToPush(code, prefs = null) {
  if (!pushSupported()) return { ok: false, error: "unsupported" };
  try {
    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return { ok: false, error: "denied" };
    }
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const body = {
      code,
      subscription: subscription.toJSON(),
    };
    if (prefs && typeof prefs === "object") {
      if (typeof prefs.message === "string") body.message = prefs.message;
      if (typeof prefs.title === "string") body.title = prefs.title;
    } else {
      body.message = loadReminderMessage(code);
      body.title = loadReminderTitle(code);
    }
    const r = await fetch("/api/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return { ok: false, error: "server" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e && e.message) || String(e) };
  }
}

/** Save only the reminder prefs (interval / message) without re-subscribing. */
export async function savePushPrefs(code, prefs) {
  if (!code) return { ok: false, error: "no_code" };
  try {
    const r = await fetch("/api/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        prefsOnly: true,
        message: prefs.message || "",
        title: prefs.title || "",
      }),
    });
    if (!r.ok) return { ok: false, error: "server" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e && e.message) || String(e) };
  }
}

// Unsubscribes this browser both locally and server-side.
export async function unsubscribeFromPush(code) {
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
    }
  } catch (e) {
    // ignore — still tell the server to drop it below
  }
  try {
    await fetch("/api/push-subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
  } catch (e) {}
}
