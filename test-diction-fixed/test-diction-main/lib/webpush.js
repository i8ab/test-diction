// Thin wrapper around the `web-push` npm package (you need to run
// `npm install web-push` — it's a small, dependency-free lib for sending
// Web Push messages via VAPID, no external service needed).
//
// Set in Vercel (Project Settings -> Environment Variables) AND in
// .env.local for local dev:
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT        e.g. mailto:you@example.com
//   VITE_VAPID_PUBLIC_KEY   <- same value as VAPID_PUBLIC_KEY, but this one
//                              MUST be prefixed with VITE_ so Vite exposes it
//                              to the browser bundle (src/lib/state/push.js
//                              reads it via import.meta.env).
//
// Generate a keypair once with:
//   npx web-push generate-vapid-keys
// then paste the two keys into VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (and
// copy the public one again into VITE_VAPID_PUBLIC_KEY).

import webpush from "web-push";

let configured = false;

export function vapidConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

function ensureConfigured() {
  if (configured) return;
  if (!vapidConfigured()) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  configured = true;
}

// Sends one push message to one subscription. Returns { ok: true } or
// { ok: false, expired: true } when the subscription is dead (410/404 —
// the browser unsubscribed, e.g. user cleared site data) so the caller can
// drop it from storage instead of retrying forever.
export async function sendPush(subscription, payload) {
  ensureConfigured();
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (e) {
    const status = e && e.statusCode;
    if (status === 404 || status === 410) return { ok: false, expired: true };
    return { ok: false, expired: false, error: (e && e.message) || String(e) };
  }
}

export { webpush };
