// Admin-only: send one Web Push notification to every account that has an
// active push subscription (same Redis set as the daily study reminders).
//
// POST body: {
//   adminCode: "<personal code of an admin account>",
//   title: string,
//   body: string,
// }
//
// Verifies the caller is an admin by looking up adminCode in the shared
// JSONBin accounts list. No shared secret beyond that — anyone who knows an
// admin personal code can already do everything in the Admin panel.
//
// IMPORTANT — endpoint dedup: the same browser/device can end up registered
// under several account codes (user switched accounts, re-enabled reminders,
// etc.). Without dedup, one physical device would receive the broadcast once
// per code that points at its push endpoint → double/triple notifications.

import { redisConfigured, redisCommand } from "../lib/redis.js";
import { sendPush, vapidConfigured } from "../lib/webpush.js";
import { CODES_SET_KEY, loadSubs, removeExpiredEndpoint, addInboxItem } from "../lib/pushSubs.js";

/** Accounts only — avoids pulling the full dictionary just to verify admin. */
async function fetchAccountsDirect() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error("missing SUPABASE_URL or key");
  const r = await fetch(`${url}/rest/v1/accounts?select=data`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) throw new Error(`Supabase accounts → ${r.status}`);
  const rows = await r.json();
  return (rows || []).map((row) => row.data).filter(Boolean);
}

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

  const adminCode = body && typeof body.adminCode === "string" ? body.adminCode.trim() : "";
  const title = body && typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  const notifBody = body && typeof body.body === "string" ? body.body.trim().slice(0, 300) : "";

  if (!adminCode) {
    return res.status(400).json({ error: "Missing adminCode." });
  }
  if (!title && !notifBody) {
    return res.status(400).json({ error: "Provide a title or body." });
  }

  try {
    const accounts = await fetchAccountsDirect();
    const admin = accounts.find((a) => a.code === adminCode && a.role === "admin");
    if (!admin) {
      return res.status(403).json({ error: "Not authorized — admin account required." });
    }

    const codes = (await redisCommand("SMEMBERS", CODES_SET_KEY)) || [];
    if (!codes.length) {
      return res.status(200).json({ sent: 0, skipped: 0, expired: 0, message: "No push subscriptions." });
    }

    const tag = `broadcast-${Date.now().toString(36)}`;
    const payload = {
      title: title || "Two Tongues",
      body: notifBody || "",
      url: "/",
      tag, // service worker uses this so OS collapses duplicates
    };

    let sent = 0, skipped = 0, expired = 0;
    // One send per unique push endpoint — same device under multiple account
    // codes must only ring once.
    const seenEndpoints = new Set();

    for (const code of codes) {
      const subscriptions = await loadSubs(code);
      if (!subscriptions.length) {
        skipped++;
        continue;
      }

      let anySentForCode = false;
      for (const subscription of subscriptions) {
        const endpoint = subscription && subscription.endpoint;
        if (!endpoint) {
          skipped++;
          continue;
        }
        if (seenEndpoints.has(endpoint)) {
          // Same browser already queued for this broadcast — skip duplicate
          skipped++;
          continue;
        }
        seenEndpoints.add(endpoint);

        const result = await sendPush(subscription, payload);
        if (result.ok) {
          sent++;
          anySentForCode = true;
        } else if (result.expired) {
          expired++;
          await removeExpiredEndpoint(code, endpoint);
        } else {
          skipped++;
        }
      }
      // One inbox row per account (not per device) so the bell stays in sync
      if (anySentForCode) {
        try {
          await addInboxItem(code, {
            type: "admin",
            title: payload.title,
            body: payload.body,
            url: "/",
            at: Date.now(),
            id: tag,
          });
        } catch (_) {}
      }
    }

    return res.status(200).json({ sent, skipped, expired });
  } catch (e) {
    return res.status(500).json({ error: "Failed to broadcast push.", message: String((e && e.message) || e) });
  }
}
