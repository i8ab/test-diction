// Called once a day by Vercel Cron (see vercel.json — 04:00 UTC = 7:00 AM Egypt (Hobby ±1h → arrives ~8 AM)
// in summer EEST/UTC+3; with Hobby's ±1h window it lands around 8 AM).
// Sends a REAL push notification to every account that has an active push
// subscription (api/push-subscribe.js). No once-per-day lock — every run
// (scheduled or manual) attempts delivery so testing stays flexible.
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
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INTERVAL_DAYS = 1;
const ALLOWED_DAYS = new Set([1, 2, 3, 5, 7]);

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
    const now = new Date();
    const isToday = (ts) => {
      const d = new Date(ts);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    };
    const logs = record.logs || [];
    const hasStale = logs.some((entry) => entry.action !== "first_sign_in" && !isToday(entry.at));
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

    const nextLogs = logs.filter((entry) => entry.action === "first_sign_in" || isToday(entry.at));
    const nextVersion = (record.version || 0) + 1;

    // Update version
    await fetch(`${url}/rest/v1/settings?on_conflict=key`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ key: "version", value: nextVersion }]),
    });

    // Replace logs
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
    const reasons = { noSub: 0, badSub: 0, dupEndpoint: 0, sendError: 0 };
    const errors = [];
    // Same device under multiple account codes → only one push per endpoint
    // (still kept — otherwise one phone gets N identical banners).
    const seenEndpoints = new Set();

    for (const code of codes) {
      // Subscription alone is enough. Account lookup is only used for
      // days-since-studied in the default body text.
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

      // Unique tag + renotify every time so a re-run always shows a fresh banner
      // (SW collapses identical tags when renotify is false).
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

    const body = {
      sent, skipped, expired, failed, logsCleared,
      codes: codes.length, reasons, errors: errors.length ? errors : undefined,
    };
    // Visible in Vercel → Logs → Messages column (the 200 alone is not enough).
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
