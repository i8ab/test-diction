// Called by Vercel Cron (or external cron like cron-job.org) on a schedule.
// With external cron every hour, each user receives a reminder according to
// their own intervalHours preference (1 / 2 / 3 / 6 / 12 / 24).
//
// Per-account prefs (custom title/message + intervalHours) live in Redis under
// twoTongues:push:prefs:<code> — set via api/push-subscribe.js.
// Last-sent timestamp lives under twoTongues:push:lastSent:<code>.
//
// Protect this endpoint: set CRON_SECRET in Vercel env vars.
// External cron must send: Authorization: Bearer <CRON_SECRET>

import { redisConfigured, redisCommand } from "../lib/redis.js";
import { sendPush, vapidConfigured } from "../lib/webpush.js";

const CODES_SET_KEY = "twoTongues:push:codes";
const SUB_PREFIX = "twoTongues:push:sub:";
const PREFS_PREFIX = "twoTongues:push:prefs:";
const LAST_SENT_PREFIX = "twoTongues:push:lastSent:";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const DEFAULT_INTERVAL_HOURS = 24;
const ALLOWED_HOURS = new Set([1, 2, 3, 6, 12, 24]);

const DEFAULT_TITLE = "وقت المراجعة! / Time to review!";
const DEFAULT_BODY_TEMPLATE = (daysSince) =>
  `عدّى ${daysSince} يوم من غير ما تراجع. / It's been ${daysSince} day${daysSince === 1 ? "" : "s"} since you studied.`;

/**
 * Load the shared dictionary record straight from Supabase (server-side).
 * Avoids fetching our own /api/jsonbin which can 401 under Vercel
 * Deployment Protection and caused the cron job to 500.
 */
async function fetchRecordDirect() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error("missing SUPABASE_URL or key");
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };

  const get = async (path) => {
    const r = await fetch(`${url}/rest/v1/${path}`, { headers });
    if (!r.ok) throw new Error(`Supabase ${path} → ${r.status}`);
    return r.json();
  };

  const [entriesRows, accountsRows, logsRows, settingsRows] = await Promise.all([
    get("entries?select=data"),
    get("accounts?select=data"),
    get("logs?select=*"),
    get("settings?select=key,value"),
  ]);

  const entries = (entriesRows || []).map((r) => r.data).filter(Boolean);
  const accounts = (accountsRows || []).map((r) => r.data).filter(Boolean);
  const logs = (logsRows || []).map((row) => ({
    id: row.id,
    action: row.action || "",
    message: row.message || "",
    actorName: row.actor_name || "",
    actorCode: row.actor_code || "",
    at: typeof row.at === "number" ? row.at : Number(row.at) || 0,
  }));

  let version = 0;
  let siteBanner = null;
  for (const row of settingsRows || []) {
    if (row.key === "version") {
      version = typeof row.value === "number" ? row.value : Number(row.value) || 0;
    }
    if (row.key === "site_banner" && row.value) {
      siteBanner = row.value;
    }
  }

  return { entries, accounts, logs, siteBanner, version };
}

async function clearStaleLogsDirect(record) {
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const logs = record.logs || [];
    const hasStale = logs.some((entry) => (entry.at || 0) < cutoff);
    if (!hasStale) return { cleared: false };

    const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY;
    if (!url || !key) return { cleared: false };

    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };

    const nextLogs = logs.filter((entry) => (entry.at || 0) >= cutoff);
    const nextVersion = (record.version || 0) + 1;

    await fetch(`${url}/rest/v1/settings?on_conflict=key`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ key: "version", value: nextVersion }]),
    });

    await fetch(`${url}/rest/v1/logs?id=not.is.null`, {
      method: "DELETE",
      headers,
    });
    if (nextLogs.length) {
      const rows = nextLogs.map((log) => ({
        id: log.id,
        action: log.action || "",
        message: log.message || "",
        actor_name: log.actorName || log.actor_name || "",
        actor_code: log.actorCode || log.actor_code || "",
        at: typeof log.at === "number" ? log.at : Date.now(),
      }));
      await fetch(`${url}/rest/v1/logs`, {
        method: "POST",
        headers,
        body: JSON.stringify(rows),
      });
    }
    return { cleared: true };
  } catch (_) {
    return { cleared: false };
  }
}

async function loadPrefs(code) {
  try {
    const raw = await redisCommand("GET", `${PREFS_PREFIX}${code}`);
    if (!raw) return { intervalHours: DEFAULT_INTERVAL_HOURS, message: "", title: "" };
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

    let hours = DEFAULT_INTERVAL_HOURS;
    if (ALLOWED_HOURS.has(parsed.intervalHours)) {
      hours = parsed.intervalHours;
    } else if (typeof parsed.intervalHours === "number") {
      // Snap to nearest allowed
      const allowed = [1, 2, 3, 6, 12, 24];
      hours = allowed.reduce((best, v) =>
        Math.abs(v - parsed.intervalHours) < Math.abs(best - parsed.intervalHours) ? v : best
      , 24);
    } else if (typeof parsed.intervalDays === "number") {
      // Legacy conversion
      const h = Math.max(1, Math.round(parsed.intervalDays * 24));
      const allowed = [1, 2, 3, 6, 12, 24];
      hours = allowed.reduce((best, v) =>
        Math.abs(v - h) < Math.abs(best - h) ? v : best
      , 24);
    }

    return {
      intervalHours: hours,
      message: typeof parsed.message === "string" ? parsed.message : "",
      title: typeof parsed.title === "string" ? parsed.title : "",
    };
  } catch (e) {
    return { intervalHours: DEFAULT_INTERVAL_HOURS, message: "", title: "" };
  }
}

async function getLastSent(code) {
  try {
    const raw = await redisCommand("GET", `${LAST_SENT_PREFIX}${code}`);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch (_) {
    return null;
  }
}

async function setLastSent(code, ts) {
  try {
    // Keep for 60 days so stale keys don't accumulate forever
    await redisCommand("SET", `${LAST_SENT_PREFIX}${code}`, String(ts), "EX", 60 * 24 * 3600);
  } catch (_) {}
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
    const body = { sent: 0, skipped: 0, expired: 0, logsCleared, pushSkipped: "Redis not configured." };
    console.log("[push-send-reminders]", JSON.stringify(body));
    return res.status(200).json(body);
  }
  if (!vapidConfigured()) {
    const body = { sent: 0, skipped: 0, expired: 0, logsCleared, pushSkipped: "VAPID keys not configured." };
    console.log("[push-send-reminders]", JSON.stringify(body));
    return res.status(200).json(body);
  }

  try {
    const codes = (await redisCommand("SMEMBERS", CODES_SET_KEY)) || [];
    if (!codes.length) {
      const body = {
        sent: 0, skipped: 0, expired: 0, logsCleared,
        message: "No push subscriptions. User must turn Reminders On and allow notifications first.",
      };
      console.log("[push-send-reminders]", JSON.stringify(body));
      return res.status(200).json(body);
    }

    const accounts = (record && record.accounts) || [];
    const now = Date.now();

    let sent = 0, skipped = 0, expired = 0, failed = 0;
    const reasons = { noSub: 0, badSub: 0, dupEndpoint: 0, tooSoon: 0, sendError: 0 };
    const errors = [];
    // Same device under multiple account codes → only one push per endpoint
    const seenEndpoints = new Set();

    for (const code of codes) {
      const account = accounts.find((a) => a.code === code) || null;
      const prefs = await loadPrefs(code);

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

      // Respect per-user intervalHours
      const intervalHours = prefs.intervalHours || DEFAULT_INTERVAL_HOURS;
      const lastSent = await getLastSent(code);
      if (lastSent != null && (now - lastSent) < intervalHours * HOUR_MS) {
        skipped++;
        reasons.tooSoon++;
        continue;
      }

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
        tag: `reminder-${code}-${now}`,
        renotify: true,
      };

      const result = await sendPush(subscription, payload);
      if (result.ok) {
        sent++;
        await setLastSent(code, now);
      } else if (result.expired) {
        expired++;
        await redisCommand("DEL", `${SUB_PREFIX}${code}`);
        await redisCommand("SREM", CODES_SET_KEY, code);
        await redisCommand("DEL", `${LAST_SENT_PREFIX}${code}`);
      } else {
        skipped++;
        failed++;
        reasons.sendError++;
        if (errors.length < 5) {
          errors.push({ code, error: result.error || result.message || "send_failed" });
        }
      }
    }

    const body = {
      sent, skipped, expired, failed, logsCleared,
      codes: codes.length, reasons, errors: errors.length ? errors : undefined,
    };
    console.log("[push-send-reminders]", JSON.stringify(body));
    return res.status(200).json(body);
  } catch (e) {
    console.error("[push-send-reminders] error", String((e && e.message) || e));
    return res.status(500).json({
      error: "Failed sending reminders.",
      message: String((e && e.message) || e),
    });
  }
}
