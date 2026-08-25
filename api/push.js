/**
 * Consolidated Push endpoint (Hobby plan safe).
 *
 * Routes (via vercel.json rewrites OR query):
 *   /api/push-subscribe  → action=subscribe
 *   /api/push-inbox      → action=inbox
 *   /api/push-broadcast  → action=broadcast
 *   /api/push-test       → action=test
 *
 * Direct: /api/push?action=subscribe|inbox|broadcast|test
 *
 * push-send-reminders stays separate (cron job).
 */

import { redisConfigured, redisCommand } from "../lib/redis.js";
import { sendPush, vapidConfigured } from "../lib/webpush.js";
import {
  PREFS_PREFIX,
  CODES_SET_KEY,
  loadSubs,
  upsertSub,
  removeSub,
  removeExpiredEndpoint,
  loadInbox,
  addInboxItem,
  removeInboxItem,
  markInboxItemRead,
  markAllInboxRead,
  clearInbox,
} from "../lib/pushSubs.js";

// ─── Shared helpers ──────────────────────────────────────────────────────────

const ALLOWED_HOURS = new Set([1, 2, 3, 6, 12, 24]);
const DEFAULT_INTERVAL_HOURS = 24;

const DEFAULT_TEST_TITLE = "وقت المراجعة! / Time to review!";
const DEFAULT_TEST_BODY =
  "عدّى وقت من غير ما تراجع — يلا نراجع شوية. / It's been a while since you studied — time for a quick review.";

function getAction(req) {
  const q = req.query?.action;
  if (typeof q === "string" && q.trim()) return q.trim().toLowerCase();
  if (Array.isArray(q) && q[0]) return String(q[0]).trim().toLowerCase();
  return "";
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  return body && typeof body === "object" ? body : null;
}

function getCode(body, query) {
  if (body && typeof body.code === "string" && body.code.trim()) {
    return body.code.trim();
  }
  if (typeof query?.code === "string" && query.code.trim()) {
    return query.code.trim();
  }
  if (Array.isArray(query?.code) && query.code[0]) {
    return String(query.code[0]).trim();
  }
  return "";
}

function normalizePrefs(body) {
  let intervalHours = DEFAULT_INTERVAL_HOURS;

  if (typeof body.intervalHours === "number" && ALLOWED_HOURS.has(body.intervalHours)) {
    intervalHours = body.intervalHours;
  } else if (typeof body.intervalHours === "string") {
    const n = Number(body.intervalHours);
    if (ALLOWED_HOURS.has(n)) intervalHours = n;
  } else if (typeof body.intervalDays === "number") {
    const h = Math.max(1, Math.round(body.intervalDays * 24));
    const allowed = [1, 2, 3, 6, 12, 24];
    intervalHours = allowed.reduce(
      (best, v) => (Math.abs(v - h) < Math.abs(best - h) ? v : best),
      24
    );
  }

  const message = typeof body.message === "string" ? body.message.trim().slice(0, 300) : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  let messages = [];
  if (Array.isArray(body.messages)) {
    messages = body.messages
      .map((m) => (typeof m === "string" ? m.trim().slice(0, 300) : ""))
      .filter(Boolean)
      .slice(0, 20);
  } else if (message) {
    messages = [message];
  }
  const messageOut = messages[0] || message;
  return { intervalHours, message: messageOut, title, messages };
}

async function loadPrefs(code) {
  try {
    const raw = await redisCommand("GET", `${PREFS_PREFIX}${code}`);
    if (!raw) {
      return {
        intervalHours: DEFAULT_INTERVAL_HOURS,
        message: "",
        title: "",
        messages: [],
      };
    }
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return normalizePrefs(parsed || {});
  } catch {
    return {
      intervalHours: DEFAULT_INTERVAL_HOURS,
      message: "",
      title: "",
      messages: [],
    };
  }
}

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

// ─── action=subscribe ────────────────────────────────────────────────────────

async function handleSubscribe(req, res) {
  if (!redisConfigured()) {
    return res.status(501).json({
      error:
        "Push requires UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN to be configured.",
    });
  }

  try {
    // GET: fetch synced prefs
    if (req.method === "GET") {
      const code = getCode(null, req.query);
      if (!code) return res.status(400).json({ error: "Missing code." });
      const prefs = await loadPrefs(code);
      const subs = await loadSubs(code);
      return res.status(200).json({
        ok: true,
        prefs,
        deviceCount: subs.length,
      });
    }

    if (req.method === "POST") {
      const body = parseBody(req) || {};

      // Admin: clear schedule slots for EVERY subscribed account
      if (body.resetSlotsAll) {
        const adminCode = typeof body.adminCode === "string" ? body.adminCode.trim() : "";
        if (!adminCode) {
          return res.status(400).json({ error: "Missing adminCode." });
        }
        try {
          const accounts = await fetchAccountsDirect();
          const admin = accounts.find((a) => a.code === adminCode && a.role === "admin");
          if (!admin) {
            return res.status(403).json({ error: "Not authorized — admin account required." });
          }
        } catch (e) {
          return res.status(502).json({
            error: "Could not verify admin.",
            message: String((e && e.message) || e),
          });
        }

        const codes = (await redisCommand("SMEMBERS", CODES_SET_KEY)) || [];
        let cleared = 0;
        for (const c of codes) {
          if (!c) continue;
          try {
            await redisCommand("DEL", `twoTongues:push:lastSent:${c}`);
            await redisCommand("DEL", `twoTongues:push:lastSlot:${c}`);
            await redisCommand("DEL", `twoTongues:push:msgIndex:${c}`);
            cleared++;
          } catch {
            /* continue */
          }
        }
        return res.status(200).json({
          ok: true,
          slotsClearedAll: true,
          cleared,
          total: codes.length,
        });
      }

      const { code, subscription, prefsOnly, resetSlots } = body;
      if (!code) {
        return res.status(400).json({ error: "Missing code." });
      }

      if (resetSlots) {
        await redisCommand("DEL", `twoTongues:push:lastSent:${code}`);
        await redisCommand("DEL", `twoTongues:push:lastSlot:${code}`);
        await redisCommand("DEL", `twoTongues:push:msgIndex:${code}`);
        if (prefsOnly || !subscription) {
          return res.status(200).json({ ok: true, slotsCleared: true });
        }
      }

      const hasPrefFields =
        body.message != null ||
        body.messages != null ||
        body.title != null ||
        body.intervalHours != null ||
        body.intervalDays != null;

      let prefs = null;
      if (hasPrefFields || (!prefsOnly && !resetSlots)) {
        prefs = normalizePrefs(body);
        await redisCommand("SET", `${PREFS_PREFIX}${code}`, JSON.stringify(prefs));
      } else if (prefsOnly) {
        try {
          const raw = await redisCommand("GET", `${PREFS_PREFIX}${code}`);
          prefs = raw
            ? normalizePrefs(typeof raw === "string" ? JSON.parse(raw) : raw)
            : normalizePrefs({});
        } catch {
          prefs = normalizePrefs({});
        }
        return res.status(200).json({ ok: true, prefs, slotsCleared: !!resetSlots });
      }

      if (prefsOnly) {
        return res.status(200).json({ ok: true, prefs, slotsCleared: !!resetSlots });
      }

      if (!subscription || !subscription.endpoint) {
        if (resetSlots) {
          return res.status(200).json({ ok: true, slotsCleared: true, prefs });
        }
        return res.status(400).json({ error: "Missing code or subscription." });
      }

      const list = await upsertSub(code, subscription);
      return res.status(200).json({
        ok: true,
        prefs,
        deviceCount: list.length,
        slotsCleared: !!resetSlots,
      });
    }

    if (req.method === "DELETE") {
      const body = parseBody(req) || {};
      const code = typeof body.code === "string" ? body.code.trim() : "";
      if (!code) return res.status(400).json({ error: "Missing code." });

      const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
      const clearPrefs = !!body.clearPrefs;

      if (endpoint) {
        const next = await removeSub(code, endpoint);
        return res.status(200).json({ ok: true, deviceCount: next.length });
      }

      await removeSub(code, null);
      if (clearPrefs) {
        await redisCommand("DEL", `${PREFS_PREFIX}${code}`);
        await redisCommand("DEL", `twoTongues:push:lastSent:${code}`);
        await redisCommand("DEL", `twoTongues:push:lastSlot:${code}`);
        await redisCommand("DEL", `twoTongues:push:msgIndex:${code}`);
      }
      await redisCommand("SREM", CODES_SET_KEY, code);
      return res.status(200).json({ ok: true, deviceCount: 0 });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({
      error: "Server error saving subscription.",
      message: String((e && e.message) || e),
    });
  }
}

// ─── action=inbox ────────────────────────────────────────────────────────────

async function handleInbox(req, res) {
  if (!redisConfigured()) {
    return res.status(501).json({
      error: "Redis not configured.",
      message: "Push inbox requires UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.",
    });
  }

  try {
    if (req.method === "GET") {
      const code = getCode(null, req.query);
      if (!code) return res.status(400).json({ error: "Missing code." });
      const items = await loadInbox(code);
      return res.status(200).json({ ok: true, items });
    }

    const body = parseBody(req);
    const code = getCode(body, req.query);
    if (!code) return res.status(400).json({ error: "Missing code." });

    if (req.method === "POST") {
      const item = body && body.item;
      if (!item || typeof item !== "object") {
        return res.status(400).json({ error: "Missing item." });
      }
      const entry = await addInboxItem(code, item);
      if (!entry) return res.status(400).json({ error: "Invalid item." });
      const items = await loadInbox(code);
      return res.status(200).json({ ok: true, item: entry, items });
    }

    if (req.method === "DELETE") {
      const id = body && typeof body.id === "string" ? body.id.trim() : "";
      if (id) {
        const items = await removeInboxItem(code, id);
        return res.status(200).json({ ok: true, items, removedId: id });
      }
      if (body && body.clearAll === true) {
        await clearInbox(code);
        return res.status(200).json({ ok: true, items: [] });
      }
      return res.status(400).json({
        error: "Provide id to remove one item, or clearAll: true to clear the inbox.",
      });
    }

    if (req.method === "PATCH") {
      if (body && body.markAllRead === true) {
        const items = await markAllInboxRead(code);
        return res.status(200).json({ ok: true, items });
      }
      const id = body && typeof body.id === "string" ? body.id.trim() : "";
      if (!id) {
        return res.status(400).json({ error: "Provide id or markAllRead: true." });
      }
      const items = await markInboxItemRead(code, id);
      return res.status(200).json({ ok: true, items });
    }

    res.setHeader("Allow", "GET, POST, DELETE, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({
      error: "Inbox server error.",
      message: String((e && e.message) || e),
    });
  }
}

// ─── action=broadcast ────────────────────────────────────────────────────────

async function handleBroadcast(req, res) {
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

  const body = parseBody(req) || {};
  const adminCode = typeof body.adminCode === "string" ? body.adminCode.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  const notifBody = typeof body.body === "string" ? body.body.trim().slice(0, 300) : "";

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
      return res.status(200).json({
        sent: 0,
        skipped: 0,
        expired: 0,
        message: "No push subscriptions.",
      });
    }

    const tag = `broadcast-${Date.now().toString(36)}`;
    const payload = {
      title: title || "Two Tongues",
      body: notifBody || "",
      url: "/",
      tag,
    };

    let sent = 0;
    let skipped = 0;
    let expired = 0;
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
        } catch {
          /* ignore */
        }
      }
    }

    return res.status(200).json({ sent, skipped, expired });
  } catch (e) {
    return res.status(500).json({
      error: "Failed to broadcast push.",
      message: String((e && e.message) || e),
    });
  }
}

// ─── action=test ─────────────────────────────────────────────────────────────

async function handleTest(req, res) {
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

  const body = parseBody(req) || {};
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return res.status(400).json({ error: "Missing code." });
  }

  try {
    let subscriptions = await loadSubs(code);
    const onlyEndpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
    if (onlyEndpoint) {
      subscriptions = subscriptions.filter((s) => s.endpoint === onlyEndpoint);
    }
    if (!subscriptions.length) {
      return res.status(404).json({
        error: "no_subscription",
        message:
          "No push subscription saved for this account. Turn reminders On first and allow notifications.",
      });
    }

    let prefs = {};
    try {
      const prefsRaw = await redisCommand("GET", `${PREFS_PREFIX}${code}`);
      if (prefsRaw) prefs = typeof prefsRaw === "string" ? JSON.parse(prefsRaw) : prefsRaw;
    } catch {
      /* ignore */
    }

    const clientTitle = typeof body.title === "string" ? body.title.trim() : "";
    const clientBody = typeof body.body === "string" ? body.body.trim() : "";
    const title = clientTitle || (prefs && prefs.title) || DEFAULT_TEST_TITLE;
    const notifBody = clientBody || (prefs && prefs.message) || DEFAULT_TEST_BODY;

    const payload = {
      title,
      body: notifBody,
      url: "/",
      tag: `test-${Date.now().toString(36)}`,
      renotify: true,
    };

    let sent = 0;
    let expired = 0;
    let lastError = null;

    for (let i = 0; i < subscriptions.length; i++) {
      const subscription = subscriptions[i];
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 150));
      }
      const result = await sendPush(subscription, payload);
      if (result.ok) {
        sent++;
      } else if (result.expired) {
        expired++;
        await removeExpiredEndpoint(code, subscription.endpoint);
        lastError = "subscription_expired";
      } else {
        lastError = result.error || result.message || "send_failed";
      }
    }

    if (sent > 0) {
      return res.status(200).json({
        ok: true,
        payload,
        sent,
        expired,
        devices: subscriptions.length,
      });
    }
    if (lastError === "subscription_expired") {
      return res.status(410).json({
        error: "subscription_expired",
        message: "Subscription expired — turn reminders Off then On again.",
      });
    }
    return res.status(502).json({
      error: lastError || "send_failed",
      message: lastError || "send_failed",
    });
  } catch (e) {
    return res.status(500).json({
      error: "Server error sending test push.",
      message: String((e && e.message) || e),
    });
  }
}


/**
 * POST { code }
 * Send Web Push NOW for any day-achievement items that are due and not yet notified.
 * Used by the client for near–real-time alerts (e.g. ~10 min), without waiting for cron.
 */
async function handleDayAchNotifyDue(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  if (!redisConfigured()) {
    return res.status(503).json({ error: "Redis not configured." });
  }
  if (!vapidConfigured()) {
    return res.status(503).json({ error: "VAPID not configured." });
  }

  const body = parseBody(req) || {};
  const code = getCode(body, req.query);
  if (!code) return res.status(400).json({ error: "Missing code." });

  const DAY_ACH_PREFIX = "twoTongues:dayAchDue:";
  let schedule = null;
  try {
    const raw = await redisCommand("GET", `${DAY_ACH_PREFIX}${code}`);
    if (!raw) return res.status(200).json({ ok: true, sent: 0, reason: "no_schedule" });
    schedule = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (_) {
    return res.status(200).json({ ok: true, sent: 0, reason: "parse_error" });
  }

  const items = (schedule && Array.isArray(schedule.items)) ? schedule.items : [];
  const now = Date.now();
  const subscriptions = await loadSubs(code);
  if (!subscriptions.length) {
    return res.status(200).json({ ok: true, sent: 0, reason: "no_sub" });
  }

  let sent = 0;
  let changed = false;

  for (const it of items) {
    if (!it || typeof it.dueAt !== "number") continue;
    if (it.dueAt > now) continue;
    if (it.notifiedDueAt != null && Number(it.notifiedDueAt) === Number(it.dueAt)) continue;

    const title = (it.title && String(it.title).trim()) || "وقت المراجعة / Review Time";
    const notifBody =
      "حان وقت مراجعة إنجازك (تكرار متباعد). / Time to review your day achievement.";
    const payload = {
      title,
      body: notifBody,
      url: "/",
      tag: `day-ach-${code}-${it.id}-${it.dueAt}`,
      renotify: true,
      type: "day-achievement-srs",
    };

    let anyOk = false;
    for (const subscription of subscriptions) {
      if (!subscription || !subscription.endpoint) continue;
      const result = await sendPush(subscription, payload);
      if (result.ok) {
        anyOk = true;
        sent++;
      } else if (result.expired) {
        await removeExpiredEndpoint(code, subscription.endpoint);
      }
    }
    if (anyOk) {
      it.notifiedDueAt = it.dueAt;
      changed = true;
      try {
        await addInboxItem(code, {
          type: "day-achievement-srs",
          title,
          body: notifBody,
          url: "/",
          at: now,
          id: `day-ach-${it.id}-${it.dueAt}`,
        });
      } catch (_) {}
    }
  }

  if (changed) {
    try {
      await redisCommand(
        "SET",
        `${DAY_ACH_PREFIX}${code}`,
        JSON.stringify({ items, updatedAt: now }),
        "EX",
        60 * 24 * 3600
      );
    } catch (_) {}
  }

  return res.status(200).json({ ok: true, sent });
}

// ─── Main router ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const action = getAction(req);

  switch (action) {
    case "subscribe":
      return handleSubscribe(req, res);
    case "inbox":
      return handleInbox(req, res);
    case "broadcast":
      return handleBroadcast(req, res);
    case "test":
      return handleTest(req, res);
    case "dayach":
    case "dayAchSchedule":
      return handleDayAchSchedule(req, res);
    case "dayAchNotifyDue":
    case "dayachnotify":
      return handleDayAchNotifyDue(req, res);
    default:
      return res.status(400).json({
        error: 'Missing or invalid action. Use "subscribe", "inbox", "broadcast", "test", "dayAchSchedule", or "dayAchNotifyDue".',
      });
  }
}

