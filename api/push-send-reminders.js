// Called on a schedule by Vercel Cron (see vercel.json) to send a REAL push
// notification (arrives even if the browser/tab is closed, unlike the old
// in-app-only Notification in ReminderBanner.jsx) to every account that:
//   - has an active push subscription (api/push-subscribe.js), AND
//   - hasn't studied anything within their chosen interval (default 24h), AND
//   - hasn't already been sent a reminder within that same interval (dedup).
//
// Per-account prefs (intervalHours, custom title/message) live in Redis under
// twoTongues:push:prefs:<code> — set via api/push-subscribe.js when the user
// enables reminders or changes Notification settings in the header menu.
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
const PREFS_PREFIX = "twoTongues:push:prefs:";
const NOTIFIED_PREFIX = "twoTongues:push:notifiedAt:"; // + code -> unix ms string, TTL'd
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_INTERVAL_HOURS = 24;
const ALLOWED_INTERVALS = new Set([6, 12, 24, 48, 72]);

const DEFAULT_TITLE = "وقت المراجعة! / Time to review!";
const DEFAULT_BODY_TEMPLATE = (hoursSince) => {
  if (hoursSince >= 48) {
    const days = Math.floor(hoursSince / 24);
    return `عدّى ${days} يوم من غير ما تراجع. / It's been ${days} day${days === 1 ? "" : "s"} since you studied.`;
  }
  if (hoursSince >= 24) {
    return `عدّى يوم من غير ما تراجع. / It's been a day since you studied.`;
  }
  return `عدّى ${hoursSince} ساعة من غير ما تراجع. / It's been ${hoursSince} hour${hoursSince === 1 ? "" : "s"} since you studied.`;
};

async function fetchRecord(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const r = await fetch(`${proto}://${host}/api/jsonbin`);
  if (!r.ok) throw new Error("Could not load dictionary record");
  return r.json();
}

async function clearStaleLogs(req, record) {
  const now = new Date();
  const isToday = (ts) => {
    const d = new Date(ts);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };
  const logs = record.logs || [];
  const hasStale = logs.some((entry) => entry.action !== "first_sign_in" && !isToday(entry.at));
  if (!hasStale) return { cleared: false };

  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const nextLogs = logs.filter((entry) => entry.action === "first_sign_in" || isToday(entry.at));
  const r = await fetch(`${proto}://${host}/api/jsonbin`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entries: record.entries || [],
      accounts: record.accounts || [],
      logs: nextLogs,
      expectedVersion: record.version || 0,
    }),
  });
  return { cleared: r.ok };
}

async function loadPrefs(code) {
  try {
    const raw = await redisCommand("GET", `${PREFS_PREFIX}${code}`);
    if (!raw) return { intervalHours: DEFAULT_INTERVAL_HOURS, message: "", title: "" };
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const hours = ALLOWED_INTERVALS.has(parsed.intervalHours) ? parsed.intervalHours : DEFAULT_INTERVAL_HOURS;
    return {
      intervalHours: hours,
      message: typeof parsed.message === "string" ? parsed.message : "",
      title: typeof parsed.title === "string" ? parsed.title : "",
    };
  } catch (e) {
    return { intervalHours: DEFAULT_INTERVAL_HOURS, message: "", title: "" };
  }
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  let logsCleared = false;
  let record = null;
  try {
    record = await fetchRecord(req);
    const result = await clearStaleLogs(req, record);
    logsCleared = result.cleared;
  } catch (e) {
    // Best-effort
  }

  if (!redisConfigured()) {
    return res.status(200).json({ sent: 0, skipped: 0, expired: 0, logsCleared, pushSkipped: "Redis not configured." });
  }
  if (!vapidConfigured()) {
    return res.status(200).json({ sent: 0, skipped: 0, expired: 0, logsCleared, pushSkipped: "VAPID keys not configured." });
  }

  try {
    const codes = (await redisCommand("SMEMBERS", CODES_SET_KEY)) || [];
    if (!codes.length) return res.status(200).json({ sent: 0, skipped: 0, expired: 0, logsCleared });

    if (!record) record = await fetchRecord(req);
    const accounts = record.accounts || [];
    const now = Date.now();

    let sent = 0, skipped = 0, expired = 0;

    for (const code of codes) {
      const account = accounts.find((a) => a.code === code);
      if (!account) { skipped++; continue; }

      const prefs = await loadPrefs(code);
      const intervalMs = prefs.intervalHours * HOUR_MS;

      const studiedAt = account.studiedAt || {};
      const values = Object.values(studiedAt);
      const lastStudied = values.length ? Math.max(...values) : null;
      if (lastStudied == null) { skipped++; continue; }
      const msSinceStudy = now - lastStudied;
      if (msSinceStudy < intervalMs) { skipped++; continue; }

      const lastNotifiedRaw = await redisCommand("GET", `${NOTIFIED_PREFIX}${code}`);
      if (lastNotifiedRaw) {
        const lastNotified = Number(lastNotifiedRaw);
        if (Number.isFinite(lastNotified) && now - lastNotified < intervalMs) {
          skipped++;
          continue;
        }
      }

      const subRaw = await redisCommand("GET", `${SUB_PREFIX}${code}`);
      if (!subRaw) { skipped++; continue; }
      const subscription = typeof subRaw === "string" ? JSON.parse(subRaw) : subRaw;

      const hoursSince = Math.max(1, Math.floor(msSinceStudy / HOUR_MS));
      const title = (prefs.title && prefs.title.trim()) || DEFAULT_TITLE;
      const body = (prefs.message && prefs.message.trim()) || DEFAULT_BODY_TEMPLATE(hoursSince);

      const payload = { title, body, url: "/" };

      const result = await sendPush(subscription, payload);
      if (result.ok) {
        sent++;
        const ttlSec = Math.ceil((intervalMs / 1000) * 1.5) + 3600;
        await redisCommand("SET", `${NOTIFIED_PREFIX}${code}`, String(now), "EX", String(ttlSec));
      } else if (result.expired) {
        expired++;
        await redisCommand("DEL", `${SUB_PREFIX}${code}`);
        await redisCommand("SREM", CODES_SET_KEY, code);
      } else {
        skipped++;
      }
    }

    return res.status(200).json({ sent, skipped, expired, logsCleared });
  } catch (e) {
    return res.status(500).json({ error: "Failed sending reminders." });
  }
}
