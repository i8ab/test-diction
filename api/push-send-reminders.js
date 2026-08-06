// Called once a day by Vercel Cron (see vercel.json — 03:00 UTC = 5 AM Egypt)
// to send a REAL push notification to every account that:
//   - has an active push subscription (api/push-subscribe.js), AND
//   - hasn't already been sent today's daily reminder (dedup).
// Study activity is intentionally ignored: this is a fixed daily nudge.
//
// Per-account prefs (custom title/message) live in Redis under
// twoTongues:push:prefs:<code> — set via api/push-subscribe.js.
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
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INTERVAL_DAYS = 1;
const ALLOWED_DAYS = new Set([1, 2, 3, 5, 7]);

const DEFAULT_TITLE = "وقت المراجعة! / Time to review!";
const DEFAULT_BODY_TEMPLATE = (daysSince) =>
  `عدّى ${daysSince} يوم من غير ما تراجع. / It's been ${daysSince} day${daysSince === 1 ? "" : "s"} since you studied.`;


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
    if (!raw) return { intervalDays: DEFAULT_INTERVAL_DAYS, message: "", title: "" };
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    let days = DEFAULT_INTERVAL_DAYS;
    if (ALLOWED_DAYS.has(parsed.intervalDays)) days = parsed.intervalDays;
    else if (typeof parsed.intervalHours === "number") {
      const d = Math.max(1, Math.round(parsed.intervalHours / 24));
      if (ALLOWED_DAYS.has(d)) days = d;
    }
    return {
      intervalDays: days,
      message: typeof parsed.message === "string" ? parsed.message : "",
      title: typeof parsed.title === "string" ? parsed.title : "",
    };
  } catch (e) {
    return { intervalDays: DEFAULT_INTERVAL_DAYS, message: "", title: "" };
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
    // Same device under multiple account codes → only one push per endpoint.
    const seenEndpoints = new Set();

    for (const code of codes) {
      const account = accounts.find((a) => a.code === code);
      if (!account) { skipped++; continue; }

      const prefs = await loadPrefs(code);

      // Dedup: one daily reminder per account (TTL ~30h covers the day + drift).
      const lastNotifiedRaw = await redisCommand("GET", `${NOTIFIED_PREFIX}${code}`);
      if (lastNotifiedRaw) {
        const lastNotified = Number(lastNotifiedRaw);
        if (Number.isFinite(lastNotified) && now - lastNotified < DAY_MS) {
          skipped++;
          continue;
        }
      }

      const subRaw = await redisCommand("GET", `${SUB_PREFIX}${code}`);
      if (!subRaw) { skipped++; continue; }
      let subscription;
      try {
        subscription = typeof subRaw === "string" ? JSON.parse(subRaw) : subRaw;
      } catch (_) {
        skipped++;
        continue;
      }

      const endpoint = subscription && subscription.endpoint;
      if (!endpoint) { skipped++; continue; }
      if (seenEndpoints.has(endpoint)) {
        skipped++;
        continue;
      }
      seenEndpoints.add(endpoint);

      const studiedAt = account.studiedAt || {};
      const values = Object.values(studiedAt);
      const lastStudied = values.length ? Math.max(...values) : null;
      const daysSince = lastStudied == null ? null : Math.max(0, Math.floor((now - lastStudied) / DAY_MS));

      const title = (prefs.title && prefs.title.trim()) || DEFAULT_TITLE;
      let body = (prefs.message && prefs.message.trim()) || "";
      if (!body) {
        body = daysSince == null
          ? "يلا نراجع شوية النهارده. / Time for today's review."
          : DEFAULT_BODY_TEMPLATE(Math.max(1, daysSince || 1));
      }

      const payload = {
        title,
        body,
        url: "/",
        tag: `reminder-${code}`,
      };

      const result = await sendPush(subscription, payload);
      if (result.ok) {
        sent++;
        const ttlSec = 60 * 60 * 30; // 30h
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
