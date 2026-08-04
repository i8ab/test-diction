// Stores (POST) or removes (DELETE) a Web Push subscription for one
// account, keyed by the account's personal code. Backed by the same
// Upstash Redis used for locking/rate-limiting elsewhere (lib/redis.js) —
// Web Push needs a real durable store (subscriptions must survive cold
// starts and be readable by the daily cron job in api/push-send-reminders.js),
// so this endpoint requires Redis to be configured and returns a clear
// error otherwise instead of silently no-op'ing.
//
// Body (POST): { code: "<personal code>", subscription: <PushSubscription JSON> }
// Body (DELETE): { code: "<personal code>" }

import { redisConfigured, redisCommand } from "../lib/redis.js";

const KEY_PREFIX = "twoTongues:push:sub:"; // + account code
const CODES_SET_KEY = "twoTongues:push:codes"; // Redis SET of every code with an active subscription
// (Upstash's free REST API has no cheap "list keys by prefix", so this set
// is what api/push-send-reminders.js iterates over instead of scanning.)

export default async function handler(req, res) {
  if (!redisConfigured()) {
    return res.status(501).json({ error: "Push requires UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN to be configured." });
  }

  try {
    if (req.method === "POST") {
      const { code, subscription } = req.body || {};
      if (!code || !subscription || !subscription.endpoint) {
        return res.status(400).json({ error: "Missing code or subscription." });
      }
      await redisCommand("SET", `${KEY_PREFIX}${code}`, JSON.stringify(subscription));
      await redisCommand("SADD", CODES_SET_KEY, code);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const { code } = req.body || {};
      if (!code) return res.status(400).json({ error: "Missing code." });
      await redisCommand("DEL", `${KEY_PREFIX}${code}`);
      await redisCommand("SREM", CODES_SET_KEY, code);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "Server error saving subscription." });
  }
}
