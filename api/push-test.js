// TEMPORARY test endpoint — send one push to the caller's subscription now.
// Remove this file (and the menu button / App.jsx handler / vite route) after testing.
//
// POST body: { code: "<personal account code>" }
// Requires Redis + VAPID env vars, same as the daily cron.

import { redisConfigured, redisCommand } from "../lib/redis.js";
import { sendPush, vapidConfigured } from "../lib/webpush.js";

const SUB_PREFIX = "twoTongues:push:sub:";

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

    const payload = {
      title: "تجربة إشعار / Test notification",
      body: "لو وصلك ده، الإشعارات شغالة ✓ / If you got this, push works ✓",
      url: "/",
    };

    const result = await sendPush(subscription, payload);
    if (result.ok) {
      return res.status(200).json({ ok: true });
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
