/**
 * Admin broadcast to ALL accounts that have subscriptions
 * Also adds the message to every account's synced Inbox
 */

import webpush from "web-push";
import { getSubs, addInboxItem, saveSubs } from "../lib/pushSubs.js";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:admin@example.com",
  process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { adminCode, title = "إعلان", body: msgBody = "" } = body;

    // simple admin check
    if (!adminCode || adminCode !== process.env.ADMIN_CODE) {
      return res.status(403).json({ error: "admin only" });
    }

    const Redis = (await import("ioredis")).default;
    const redis = new Redis(process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL);

    // all accounts that have subs
    const keys = [];
    let cursor = "0";
    do {
      const [next, found] = await redis.scan(cursor, "MATCH", "push:subs:*", "COUNT", 100);
      cursor = next;
      keys.push(...found);
    } while (cursor !== "0");

    let totalSent = 0;
    let totalFailed = 0;
    let accounts = 0;

    const payload = JSON.stringify({
      title,
      body: msgBody,
      icon: "/icon-192.png",
      data: { url: "/", type: "broadcast" },
    });

    for (const key of keys) {
      const code = key.replace("push:subs:", "");
      const subs = await getSubs(code);
      if (!subs.length) continue;

      accounts++;
      const stillValid = [];

      for (const sub of subs) {
        try {
          await webpush.sendNotification(sub, payload);
          totalSent++;
          stillValid.push(sub);
        } catch (err) {
          totalFailed++;
          if (err.statusCode !== 404 && err.statusCode !== 410) {
            stillValid.push(sub);
          }
        }
      }

      if (stillValid.length !== subs.length) {
        await saveSubs(code, stillValid);
      }

      // add to this account's inbox
      await addInboxItem(code, {
        title,
        body: msgBody,
        type: "broadcast",
        ts: Date.now(),
      });
    }

    return res.status(200).json({
      ok: true,
      accounts,
      sent: totalSent,
      failed: totalFailed,
    });
  } catch (err) {
    console.error("push-broadcast error:", err);
    return res.status(500).json({ error: err.message });
  }
}
