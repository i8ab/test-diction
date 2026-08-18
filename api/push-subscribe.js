// Stores (POST) or removes (DELETE) Web Push subscription(s) for one
// account, keyed by the account's personal code. Supports multiple devices
// per account. Prefs (title / messages / interval) sync across devices.
//
// GET  ?code=<personal code>  → { ok, prefs, deviceCount }
// Body (POST): {
//   code: "<personal code>",
//   subscription?: <PushSubscription JSON>,  // omit when prefsOnly: true
//   prefsOnly?: boolean,
//   intervalHours?: number,
//   intervalDays?: number,   // legacy
//   message?: string,
//   messages?: string[],
//   title?: string,
// }
// Body (DELETE): {
//   code: "<personal code>",
//   endpoint?: string,       // if set: remove this device only; keep prefs
//   clearPrefs?: boolean,    // if true and no endpoint: also delete prefs
// }

import { redisConfigured, redisCommand } from "../lib/redis.js";
import {
  PREFS_PREFIX,
  CODES_SET_KEY,
  loadSubs,
  upsertSub,
  removeSub,
} from "../lib/pushSubs.js";

const ALLOWED_HOURS = new Set([1, 2, 3, 6, 12, 24]);
const DEFAULT_INTERVAL_HOURS = 24;

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
  } catch (_) {
    return {
      intervalHours: DEFAULT_INTERVAL_HOURS,
      message: "",
      title: "",
      messages: [],
    };
  }
}

export default async function handler(req, res) {
  if (!redisConfigured()) {
    return res.status(501).json({
      error:
        "Push requires UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN to be configured.",
    });
  }

  try {
    // ── GET: fetch synced prefs for this account (any device) ──────────
    if (req.method === "GET") {
      const code =
        typeof req.query?.code === "string"
          ? req.query.code.trim()
          : typeof req.query?.code === "object" && req.query.code?.[0]
            ? String(req.query.code[0]).trim()
            : "";
      if (!code) {
        return res.status(400).json({ error: "Missing code." });
      }
      const prefs = await loadPrefs(code);
      const subs = await loadSubs(code);
      return res.status(200).json({
        ok: true,
        prefs,
        deviceCount: subs.length,
      });
    }

    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch (e) {
          body = null;
        }
      }
      const { code, subscription, prefsOnly } = body || {};
      if (!code) {
        return res.status(400).json({ error: "Missing code." });
      }

      const prefs = normalizePrefs(body || {});
      await redisCommand("SET", `${PREFS_PREFIX}${code}`, JSON.stringify(prefs));

      if (prefsOnly) {
        return res.status(200).json({ ok: true, prefs });
      }

      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: "Missing code or subscription." });
      }

      const list = await upsertSub(code, subscription);
      return res.status(200).json({
        ok: true,
        prefs,
        deviceCount: list.length,
      });
    }

    if (req.method === "DELETE") {
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch (e) {
          body = null;
        }
      }
      const code = body && typeof body.code === "string" ? body.code.trim() : "";
      if (!code) return res.status(400).json({ error: "Missing code." });

      const endpoint =
        body && typeof body.endpoint === "string" ? body.endpoint.trim() : "";
      const clearPrefs = !!(body && body.clearPrefs);

      if (endpoint) {
        // Device-only unsubscribe: keep prefs + other devices
        const next = await removeSub(code, endpoint);
        return res.status(200).json({ ok: true, deviceCount: next.length });
      }

      // Full clear for this account (legacy callers)
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
