// Called once a day by Vercel Cron (see vercel.json — 04:00 UTC = 7:00 AM Egypt (Hobby ±1h → arrives ~8 AM)
// in summer EEST/UTC+3; with Hobby's ±1h window it lands around 8 AM).
// Sends a REAL push notification to every account that:
//   - has an active push subscription (api/push-subscribe.js), AND
//   - hasn't already been sent today's daily reminder (dedup).
// Study activity is intentionally ignored: this is a fixed daily nudge.
//
// Per-account prefs (custom title/message) live in Redis under
// twoTongues:push:prefs:<code> — set via api/push-subscribe.js.
//
// Protect this endpoint so randoms on the internet can't trigger mass
// notifications: set CRON_SECRET in Vercel env vars, and Vercel's Cron
// automatically sends it as `Authorization: Bearer <CRON_SECRET>`.
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

/**
 * Load the shared dictionary record straight from JSONBin (server-side).
 * Avoids fetching our own /api/jsonbin which can 401 under Vercel
 * Deployment Protection and caused the cron job to 500.
 */
async function fetchRecordDirect() {
  const { JSONBIN_BIN_ID, JSONBIN_MASTER_KEY } = process.env;
  if (!JSONBIN_BIN_ID || !JSONBIN_MASTER_KEY) {
    throw new Error("missing JSONBIN_BIN_ID or JSONBIN_MASTER_KEY");
  }
  const r = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
    headers: { "X-Master-Key": JSONBIN_MASTER_KEY },
  });
  if (!r.ok) throw new Error(`JSONBin fetch failed: ${r.status}`);
  const data = await r.json();
  const rec = data.record || {};
  return {
    entries: rec.entries || [],
    accounts: rec.accounts || [],
    logs: rec.logs || [],
    siteBanner: rec.siteBanner || null,
    version: rec.version || 0,
  };
}

async function clearStaleLogsDirect(record) {
  try {
    const now = new Date();
    const isToday = (ts) => {
      const d = new Date(ts);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    };
    const logs = record.logs || [];
    const hasStale = logs.some((entry) => entry.action !== "first_sign_in" && !isToday(entry.at));
    if (!hasStale) return { cleared: false };

    const { JSONBIN_BIN_ID, JSONBIN_MASTER_KEY } = process.env;
    if (!JSONBIN_BIN_ID || !JSONBIN_MASTER_KEY) return { cleared: false };

    const nextLogs = logs.filter((entry) => entry.action === "first_sign_in" || isToday(entry.at));
    const nextVersion = (record.version || 0) + 1;
    const payload = {
      entries: record.entries || [],
      accounts: record.accounts || [],
      logs: nextLogs,
      version: nextVersion,
      siteBanner: record.siteBanner || null,
    };
    const r = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": JSONBIN_MASTER_KEY,
      },
      body: JSON.stringify(payload),
    });
    return { cleared: r.ok };
  } catch (_) {
    return { cleared: false };
  }
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
  // Vercel Cron sends Authorization: Bearer $CRON_SECRET automatically when
  // CRON_SECRET is set. Also accept the platform's x-vercel-cron marker so a
  // misconfigured/missing Bearer header doesn't silently kill the daily job.
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization || "";
    const isVercelCron = req.headers["x-vercel-cron"] === "1";
    if (auth !== `Bearer ${process.env.CRON_SECRET}` && !isVercelCron) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  // ?force=1 bypasses the once-per-day dedup so a manual test (or a second
  // "Run" the same day) still delivers. Scheduled cron omits it and keeps dedup.
  let force = false;
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    force = url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true";
  } catch (_) { /* ignore */ }

  let logsCleared = false;
  let record = null;
  try {
    record = await fetchRecordDirect();
    const result = await clearStaleLogsDirect(record);
    logsCleared = result.cleared;
  } catch (e) {
    // Best-effort — reminders can still go out without the accounts list
    record = { entries: [], accounts: [], logs: [], version: 0 };
  }

  if (!redisConfigured()) {
    return res.status(200).json({ sent: 0, skipped: 0, expired: 0, logsCleared, pushSkipped: "Redis not configured." });
  }
  if (!vapidConfigured()) {
    return res.status(200).json({ sent: 0, skipped: 0, expired: 0, logsCleared, pushSkipped: "VAPID keys not configured." });
  }

  try {
    const codes = (await redisCommand("SMEMBERS", CODES_SET_KEY)) || [];
    if (!codes.length) {
      return res.status(200).json({
        sent: 0, skipped: 0, expired: 0, logsCleared, force,
        message: "No push subscriptions. User must turn Reminders On and allow notifications first.",
      });
    }

    const accounts = (record && record.accounts) || [];
    const now = Date.now();

    let sent = 0, skipped = 0, expired = 0, failed = 0;
    const reasons = { noAccount: 0, dedup: 0, noSub: 0, badSub: 0, dupEndpoint: 0, sendError: 0 };
    const errors = [];
    // Same device under multiple account codes → only one push per endpoint.
    const seenEndpoints = new Set();

    for (const code of codes) {
      // If we have accounts loaded, prefer matching ones; if the list is
      // empty/unavailable still try to send (subscription alone is enough
      // for a daily nudge).
      const account = accounts.find((a) => a.code === code) || null;
      if (accounts.length > 0 && !account) {
        skipped++;
        reasons.noAccount++;
        continue;
      }

      const prefs = await loadPrefs(code);

      // Dedup: one daily reminder per account (TTL ~30h covers the day + drift).
      // Skipped when force=true (manual ?force=1 test run).
      if (!force) {
        const lastNotifiedRaw = await redisCommand("GET", `${NOTIFIED_PREFIX}${code}`);
        if (lastNotifiedRaw) {
          const lastNotified = Number(lastNotifiedRaw);
          if (Number.isFinite(lastNotified) && now - lastNotified < DAY_MS) {
            skipped++;
            reasons.dedup++;
            continue;
          }
        }
      }

      const subRaw = await redisCommand("GET", `${SUB_PREFIX}${code}`);
      if (!subRaw) { skipped++; reasons.noSub++; continue; }
      let subscription;
      try {
        subscription = typeof subRaw === "string" ? JSON.parse(subRaw) : subRaw;
      } catch (_) {
        skipped++;
        reasons.badSub++;
        continue;
      }

      const endpoint = subscription && subscription.endpoint;
      if (!endpoint) { skipped++; reasons.badSub++; continue; }
      if (seenEndpoints.has(endpoint)) {
        skipped++;
        reasons.dupEndpoint++;
        continue;
      }
      seenEndpoints.add(endpoint);

      const studiedAt = (account && account.studiedAt) || {};
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
        // Unique tag on force runs so a re-test isn't collapsed by the SW.
        tag: force ? `reminder-${code}-${now}` : `reminder-${code}`,
        renotify: !!force,
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
        failed++;
        reasons.sendError++;
        if (errors.length < 5) {
          errors.push({ code, error: result.error || result.message || "send_failed" });
        }
      }
    }

    return res.status(200).json({
      sent, skipped, expired, failed, logsCleared, force,
      codes: codes.length, reasons, errors: errors.length ? errors : undefined,
    });
  } catch (e) {
    return res.status(500).json({
      error: "Failed sending reminders.",
      message: String((e && e.message) || e),
    });
  }
}
