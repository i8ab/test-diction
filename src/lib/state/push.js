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
export const REMINDER_PREF_KEY = "twoTongues.remindersEnabled";

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
// service, and saves the subscription server-side under `code`. Returns
// { ok: true } or { ok: false, error }.
export async function subscribeToPush(code) {
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
    const r = await fetch("/api/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, subscription: subscription.toJSON() }),
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
