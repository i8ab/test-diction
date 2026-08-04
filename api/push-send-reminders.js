// Called once a day by Vercel Cron (see vercel.json) to send a REAL push
// notification (arrives even if the browser/tab is closed, unlike the old
// in-app-only Notification in ReminderBanner.jsx) to every account that:
//   - has an active push subscription (api/push-subscribe.js), AND
//   - hasn't studied anything in the last 24h+ (same rule ReminderBanner
//     already uses client-side, just re-checked here server-side), AND
//   - hasn't already been sent a reminder today (dedup key, in case the
//     cron is ever triggered twice in the same day).
//
// Protect this endpoint so randoms on the internet can't trigger mass
// notifications: set CRON_SECRET in Vercel env vars, and Vercel's Cron
// automatically sends it as `Authorization: Bearer <CRON_SECRET>` when you
// configure it that way (see vercel.json comment). Manual calls must send
// the same header.
//
// Set in Vercel: CRON_SECRET (any random string)

import { redisConfigured, redisCommand } from "../lib/redis.js";
import { sendPush, vapidConfigured } from "../lib/webpush.js";

const CODES_SET_KEY = "twoTongues:push:codes";
const SUB_PREFIX = "twoTongues:push:sub:";
const NOTIFIED_PREFIX = "twoTongues:push:notifiedOn:"; // + code -> "YYYY-MM-DD", TTL'd
const NOTIFIED_TTL_SECONDS = 60 * 60 * 30; // 30h, comfortably covers one day + clock drift
const DAY_MS = 24 * 60 * 60 * 1000;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchRecord(req) {
  // Reuse api/jsonbin.js rather than re-implementing the JSONBin call here,
  // so there is exactly one place that knows how to read the shared record.
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const r = await fetch(`${proto}://${host}/api/jsonbin`);
  if (!r.ok) throw new Error("Could not load dictionary record");
  return r.json();
}

export default async function handler(req, res) {
  if (!redisConfigured()) {
    return res.status(501).json({ error: "Push requires Redis to be configured." });
  }
  if (!vapidConfigured()) {
    return res.status(501).json({ error: "Push requires VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT to be configured." });
  }
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const codes = (await redisCommand("SMEMBERS", CODES_SET_KEY)) || [];
    if (!codes.length) return res.status(200).json({ sent: 0, skipped: 0, expired: 0 });

    const record = await fetchRecord(req);
    const accounts = record.accounts || [];
    const today = todayKey();

    let sent = 0, skipped = 0, expired = 0;

    for (const code of codes) {
      const account = accounts.find((a) => a.code === code);
      if (!account) { skipped++; continue; } // account deleted since subscribing

      const studiedAt = account.studiedAt || {};
      const values = Object.values(studiedAt);
      const lastStudied = values.length ? Math.max(...values) : null;
      const daysSince = lastStudied == null ? null : Math.floor((Date.now() - lastStudied) / DAY_MS);
      if (daysSince === null || daysSince < 1) { skipped++; continue; } // studied recently, or never studied at all (nothing to remind about yet)

      const alreadyNotified = await redisCommand("GET", `${NOTIFIED_PREFIX}${code}`);
      if (alreadyNotified === today) { skipped++; continue; }

      const subRaw = await redisCommand("GET", `${SUB_PREFIX}${code}`);
      if (!subRaw) { skipped++; continue; }
      const subscription = JSON.parse(subRaw);

      // No per-account language is stored server-side (appLang lives only in
      // the browser), so the push text is bilingual rather than guessing.
      const payload = {
        title: "وقت المراجعة! / Time to review!",
        body: `عدّى ${daysSince} يوم من غير ما تراجع. / It's been ${daysSince} day${daysSince === 1 ? "" : "s"} since you studied.`,
        url: "/",
      };

      const result = await sendPush(subscription, payload);
      if (result.ok) {
        sent++;
        await redisCommand("SET", `${NOTIFIED_PREFIX}${code}`, today, "EX", String(NOTIFIED_TTL_SECONDS));
      } else if (result.expired) {
        expired++;
        await redisCommand("DEL", `${SUB_PREFIX}${code}`);
        await redisCommand("SREM", CODES_SET_KEY, code);
      } else {
        skipped++;
      }
    }

    return res.status(200).json({ sent, skipped, expired });
  } catch (e) {
    return res.status(500).json({ error: "Failed sending reminders." });
  }
}
