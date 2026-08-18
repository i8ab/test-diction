// Test endpoint — send one push to the caller's device subscription(s) now.
//
// POST body: {
//   code: "<personal account code>",
//   title?: string,
//   body?: string,
//   endpoint?: string,  // optional: only this device; otherwise all devices
// }

import { redisConfigured, redisCommand } from "../lib/redis.js";
import { sendPush, vapidConfigured } from "../lib/webpush.js";
import { PREFS_PREFIX, loadSubs, removeExpiredEndpoint } from "../lib/pushSubs.js";

const DEFAULT_TITLE = "وقت المراجعة! / Time to review!";
const DEFAULT_BODY =
  "عدّى وقت من غير ما تراجع — يلا نراجع شوية. / It's been a while since you studied — time for a quick review.";

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
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = null;
    }
  }
  const code = body && typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return res.status(400).json({ error: "Missing code." });
  }

  try {
    let subscriptions = await loadSubs(code);
    const onlyEndpoint =
      body && typeof body.endpoint === "string" ? body.endpoint.trim() : "";
    if (onlyEndpoint) {
      subscriptions = subscriptions.filter((s) => s.endpoint === onlyEndpoint);
    }
    if (!subscriptions.length) {
      return res.status(404).json({
        error: "no_subscription",
        message:
          "No push subscription saved for this account. Turn reminders On first and allow notifications.",
      });
    }

    let prefs = {};
    try {
      const prefsRaw = await redisCommand("GET", `${PREFS_PREFIX}${code}`);
      if (prefsRaw) prefs = typeof prefsRaw === "string" ? JSON.parse(prefsRaw) : prefsRaw;
    } catch (_) {
      /* ignore */
    }

    const clientTitle = body && typeof body.title === "string" ? body.title.trim() : "";
    const clientBody = body && typeof body.body === "string" ? body.body.trim() : "";
    const title = clientTitle || (prefs && prefs.title) || DEFAULT_TITLE;
    const notifBody = clientBody || (prefs && prefs.message) || DEFAULT_BODY;

    const payload = {
      title,
      body: notifBody,
      url: "/",
      tag: `test-${Date.now().toString(36)}`,
      renotify: true,
    };

    let sent = 0;
    let lastError = null;
    for (const subscription of subscriptions) {
      const result = await sendPush(subscription, payload);
      if (result.ok) {
        sent++;
      } else if (result.expired) {
        await removeExpiredEndpoint(code, subscription.endpoint);
        lastError = "subscription_expired";
      } else {
        lastError = result.error || result.message || "send_failed";
      }
    }

    if (sent > 0) {
      return res.status(200).json({ ok: true, payload, sent, devices: subscriptions.length });
    }
    if (lastError === "subscription_expired") {
      return res.status(410).json({
        error: "subscription_expired",
        message: "Subscription expired — turn reminders Off then On again.",
      });
    }
    return res.status(502).json({
      error: lastError || "send_failed",
      message: lastError || "send_failed",
    });
  } catch (e) {
    return res.status(500).json({
      error: "Server error sending test push.",
      message: String((e && e.message) || e),
    });
  }
}
