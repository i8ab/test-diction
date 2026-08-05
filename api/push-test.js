// Test endpoint — send one push to the caller's subscription now, using the
// same final payload shape the real reminder cron would send (custom title/
// body from Redis prefs, or values the client passes in the body).
//
// POST body: {
//   code: "<personal account code>",
//   title?: string,   // optional override (e.g. live preview before saving)
//   body?: string,    // optional override
// }
// Requires Redis + VAPID env vars, same as the daily cron.

import { redisConfigured, redisCommand } from "../lib/redis.js";
import { sendPush, vapidConfigured } from "../lib/webpush.js";

const SUB_PREFIX = "twoTongues:push:sub:";
const PREFS_PREFIX = "twoTongues:push:prefs:";

const DEFAULT_TITLE = "وقت المراجعة! / Time to review!";
const DEFAULT_BODY = "عدّى وقت من غير ما تراجع — يلا نراجع شوية. / It's been a while since you studied — time for a quick review.";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!redisConfigured()) {
    return res.status(501).json({ error: "Redis not configured." });
  }
  if (!vapidConfigured()) {
    return res.status(501).json({ error: "VAPID keys not configured." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  const code = body && typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return res.status(400).json({ error: "Missing code." });
  }

  try {
    const subRaw = await redisCommand("GET", `${SUB_PREFIX}${code}`);
    if (!subRaw) {
      return res.status(404).json({
        error: "no_subscription",
        message: "No push subscription saved for this account. Turn reminders On first and allow notifications.",
      });
    }

    let subscription;
    try {
      subscription = typeof subRaw === "string" ? JSON.parse(subRaw) : subRaw;
    } catch (e) {
      return res.status(500).json({ error: "Invalid stored subscription." });
    }

    // Prefer explicit title/body from the client (live preview of what they
    // typed), then fall back to saved Redis prefs, then defaults.
    let prefs = {};
    try {
      const prefsRaw = await redisCommand("GET", `${PREFS_PREFIX}${code}`);
      if (prefsRaw) prefs = typeof prefsRaw === "string" ? JSON.parse(prefsRaw) : prefsRaw;
    } catch (_) { /* ignore */ }

    const clientTitle = body && typeof body.title === "string" ? body.title.trim() : "";
    const clientBody = body && typeof body.body === "string" ? body.body.trim() : "";
    const title = clientTitle || (prefs && prefs.title) || DEFAULT_TITLE;
    const notifBody = clientBody || (prefs && prefs.message) || DEFAULT_BODY;

    const payload = {
      title,
      body: notifBody,
      url: "/",
    };

    const result = await sendPush(subscription, payload);
    if (result.ok) {
      return res.status(200).json({ ok: true, payload });
    }
    if (result.expired) {
      try {
        await redisCommand("DEL", `${SUB_PREFIX}${code}`);
        await redisCommand("SREM", "twoTongues:push:codes", code);
      } catch (_) { /* ignore */ }
      return res.status(410).json({ error: "subscription_expired", message: "Subscription expired — turn reminders Off then On again." });
    }
    return res.status(502).json({
      error: result.error || "send_failed",
      message: result.message || result.error || "send_failed",
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error sending test push.", message: String((e && e.message) || e) });
  }
}
