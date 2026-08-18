/**
 * Cron / manual trigger: send due reminders to all devices of each account
 * Also pushes every successful send into the synced Inbox.
 */

import webpush from "web-push";
import {
  getSubs,
  getPrefs,
  savePrefs,
  addInboxItem,
  removeSub,
} from "../lib/pushSubs.js";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:admin@example.com",
  process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function getCurrentSlot(intervalHours) {
  const now = Date.now();
  const intervalMs = intervalHours * 60 * 60 * 1000;
  return Math.floor(now / intervalMs);
}

export default async function handler(req, res) {
  // protect cron
  const secret = req.headers["authorization"]?.replace("Bearer ", "") || req.query.secret;
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    // find all accounts that have prefs
    const Redis = (await import("ioredis")).default;
    const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
    if (!url) {
      return res.status(500).json({ error: "Redis not configured. Set REDIS_URL or UPSTASH_REDIS_URL." });
    }
    const redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 8000,
      commandTimeout: 8000,
      enableReadyCheck: false,
      lazyConnect: false,
      retryStrategy: (times) => (times > 2 ? null : Math.min(times * 200, 1000)),
    });

    const keys = [];
    let cursor = "0";
    do {
      const [next, found] = await redis.scan(cursor, "MATCH", "push:prefs:*", "COUNT", 100);
      cursor = next;
      keys.push(...found);
    } while (cursor !== "0");

    let sent = 0;
    let skipped = 0;
    let expired = 0;
    let failed = 0;
    const details = [];
    const reasons = { noSub: 0, badSub: 0, dupEndpoint: 0, tooSoon: 0, sendError: 0 };

    for (const key of keys) {
      const code = key.replace("push:prefs:", "");
      const prefs = await getPrefs(code);
      if (!prefs || prefs.enabled === false) {
        skipped++;
        continue;
      }

      const messages = Array.isArray(prefs.messages) ? prefs.messages.filter(Boolean) : [];
      if (messages.length === 0) {
        skipped++;
        continue;
      }

      const intervalHours = Number(prefs.intervalHours) || 24;
      const slot = getCurrentSlot(intervalHours);

      // already sent this slot?
      if (prefs.lastSlot === slot) {
        reasons.tooSoon++;
        skipped++;
        continue;
      }

      const subs = await getSubs(code);
      if (!subs.length) {
        reasons.noSub++;
        skipped++;
        continue;
      }

      // pick message (rotate)
      let msgIndex = Number(prefs.msgIndex) || 0;
      if (msgIndex >= messages.length) msgIndex = 0;
      const msg = messages[msgIndex];
      const title = typeof msg === "string" ? "تذكير" : msg.title || "تذكير";
      const body = typeof msg === "string" ? msg : msg.body || msg.text || "";

      const payload = JSON.stringify({
        title,
        body,
        icon: "/icon-192.png",
        badge: "/badge.png",
        data: { url: "/", type: "reminder", code },
      });

      let deviceSuccess = 0;
      const stillValid = [];

      for (const sub of subs) {
        try {
          await webpush.sendNotification(sub, payload);
          deviceSuccess++;
          stillValid.push(sub);
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            // expired
            expired++;
            reasons.badSub++;
          } else {
            failed++;
            reasons.sendError++;
            stillValid.push(sub); // keep for now
          }
        }
      }

      // update subs (remove expired)
      if (stillValid.length !== subs.length) {
        const { saveSubs } = await import("../lib/pushSubs.js");
        await saveSubs(code, stillValid);
      }

      if (deviceSuccess > 0) {
        // advance schedule
        prefs.lastSent = Date.now();
        prefs.lastSlot = slot;
        prefs.msgIndex = (msgIndex + 1) % messages.length;
        await savePrefs(code, prefs);

        // ★ add to synced Inbox
        await addInboxItem(code, {
          title,
          body,
          type: "reminder",
          ts: Date.now(),
        });

        sent++;
        details.push({
          code,
          status: "sent",
          slot,
          intervalHours,
          devices: deviceSuccess,
          messageIndex: msgIndex + 1,
          messageTotal: messages.length,
          title,
          bodyPreview: body.slice(0, 60),
        });
      } else {
        skipped++;
      }
    }

    return res.status(200).json({
      sent,
      skipped,
      expired,
      failed,
      logsCleared: false,
      codes: keys.length,
      reasons,
      details,
    });
  } catch (err) {
    console.error("push-send-reminders error:", err);
    return res.status(500).json({ error: err.message });
  }
}
