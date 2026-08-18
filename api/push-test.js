/**
 * Test push to current account (all its devices) + add to Inbox
 */

import webpush from "web-push";
import { getSubs, addInboxItem } from "../lib/pushSubs.js";

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
    const { code, title = "اختبار", body: msgBody = "هذا إشعار تجريبي" } = body;

    if (!code) return res.status(400).json({ error: "code required" });

    const subs = await getSubs(code);
    if (!subs.length) return res.status(404).json({ error: "no subscriptions" });

    const payload = JSON.stringify({
      title,
      body: msgBody,
      icon: "/icon-192.png",
      data: { url: "/", type: "test" },
    });

    let sent = 0;
    let failed = 0;
    const stillValid = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub, payload);
        sent++;
        stillValid.push(sub);
      } catch (err) {
        failed++;
        if (err.statusCode !== 404 && err.statusCode !== 410) {
          stillValid.push(sub);
        }
      }
    }

    // update subs if needed
    if (stillValid.length !== subs.length) {
      const { saveSubs } = await import("../lib/pushSubs.js");
      await saveSubs(code, stillValid);
    }

    // add to synced inbox
    if (sent > 0) {
      await addInboxItem(code, {
        title,
        body: msgBody,
        type: "test",
        ts: Date.now(),
      });
    }

    return res.status(200).json({
      ok: true,
      sent,
      failed,
      devices: stillValid.length,
    });
  } catch (err) {
    console.error("push-test error:", err);
    return res.status(500).json({ error: err.message });
  }
}
