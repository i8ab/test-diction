// Stores (POST) or removes (DELETE) a Web Push subscription for one
// account, keyed by the account's personal code. Backed by the same
// Upstash Redis used for locking/rate-limiting elsewhere (lib/redis.js) —
// Web Push needs a real durable store (subscriptions must survive cold
// starts and be readable by the daily cron job in api/push-send-reminders.js),
// so this endpoint requires Redis to be configured and returns a clear
// error otherwise instead of silently no-op'ing.
//
// Body (POST): {
//   code: "<personal code>",
//   subscription?: <PushSubscription JSON>,  // omit when prefsOnly: true
//   prefsOnly?: boolean,
//   intervalDays?: number,    // days without study before reminder (default 1)
//   message?: string,         // custom notification body
//   title?: string,           // custom notification title
// }
// Body (DELETE): { code: "<personal code>" }

import { redisConfigured, redisCommand } from "../lib/redis.js";

const KEY_PREFIX = "twoTongues:push:sub:"; // + account code
const PREFS_PREFIX = "twoTongues:push:prefs:"; // + account code -> JSON
const CODES_SET_KEY = "twoTongues:push:codes"; // Redis SET of every code with an active subscription
// (Upstash's free REST API has no cheap "list keys by prefix", so this set
// is what api/push-send-reminders.js iterates over instead of scanning.)

const ALLOWED_DAYS = new Set([1, 2, 3, 5, 7]);

function normalizePrefs(body) {
  let intervalDays = 1;
  // Prefer explicit intervalDays; fall back to legacy intervalHours (÷24).
  if (typeof body.intervalDays === "number" && ALLOWED_DAYS.has(body.intervalDays)) {
    intervalDays = body.intervalDays;
  } else if (typeof body.intervalDays === "string") {
    const n = Number(body.intervalDays);
    if (ALLOWED_DAYS.has(n)) intervalDays = n;
  } else if (typeof body.intervalHours === "number") {
    const d = Math.max(1, Math.round(body.intervalHours / 24));
    if (ALLOWED_DAYS.has(d)) intervalDays = d;
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 300) : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  return { intervalDays, message, title };
}

export default async function handler(req, res) {
  if (!redisConfigured()) {
    return res.status(501).json({ error: "Push requires UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN to be configured." });
  }

  try {
    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (e) { body = null; }
      }
      const { code, subscription, prefsOnly } = body || {};
      if (!code) {
        return res.status(400).json({ error: "Missing code or subscription." });
      }

      const prefs = normalizePrefs(body || {});
      await redisCommand("SET", `${PREFS_PREFIX}${code}`, JSON.stringify(prefs));

      if (prefsOnly) {
        // Prefs-only update (user changed interval/message while already subscribed).
        return res.status(200).json({ ok: true, prefs });
      }

      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: "Missing code or subscription." });
      }

      // One physical browser/device has one push endpoint. If that endpoint
      // was previously saved under a *different* account code (user switched
      // accounts on the same phone and turned reminders on again), strip the
      // stale ownership so broadcast/cron don't send the same notification
      // twice to one device.
      try {
        const allCodes = (await redisCommand("SMEMBERS", CODES_SET_KEY)) || [];
        for (const other of allCodes) {
          if (!other || other === code) continue;
          const raw = await redisCommand("GET", `${KEY_PREFIX}${other}`);
          if (!raw) continue;
          let parsed;
          try {
            parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
          } catch (_) {
            continue;
          }
          if (parsed && parsed.endpoint === subscription.endpoint) {
            await redisCommand("DEL", `${KEY_PREFIX}${other}`);
            await redisCommand("SREM", CODES_SET_KEY, other);
          }
        }
      } catch (_) {
        // Best-effort cleanup — still save the new subscription below.
      }

      await redisCommand("SET", `${KEY_PREFIX}${code}`, JSON.stringify(subscription));
      await redisCommand("SADD", CODES_SET_KEY, code);
      return res.status(200).json({ ok: true, prefs });
    }

    if (req.method === "DELETE") {
      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (e) { body = null; }
      }
      const { code } = body || {};
      if (!code) return res.status(400).json({ error: "Missing code." });
      await redisCommand("DEL", `${KEY_PREFIX}${code}`);
      await redisCommand("DEL", `${PREFS_PREFIX}${code}`);
      await redisCommand("SREM", CODES_SET_KEY, code);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "Server error saving subscription." });
  }
}
