/**
 * Dedicated Todo sync endpoint (per-account).
 * Uses Redis so it stays separate from the big dictionary record.
 *
 * GET  /api/todos?code=XXXX   → { todos: [...] }
 * PUT  /api/todos             → body: { code, todos }  → { ok: true, todos }
 *
 * Key: twoTongues:todos:<code>
 */

import { redisConfigured, redisCommand } from "../lib/redis.js";

const KEY_PREFIX = "twoTongues:todos:";
const MAX_TODOS = 200;

function normalizeTodo(t) {
  if (!t || typeof t !== "object") return null;
  if (typeof t.text !== "string" || !t.text.trim()) return null;
  return {
    id: typeof t.id === "string" && t.id ? t.id : Math.random().toString(36).slice(2) + Date.now().toString(36),
    text: String(t.text).slice(0, 70),
    done: !!t.done,
    createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
    workedMs: typeof t.workedMs === "number" ? Math.max(0, t.workedMs) : 0,
    // Keep active timer so it can continue on another device
    activeSince: typeof t.activeSince === "number" && t.activeSince > 0 ? t.activeSince : null,
    priority: ["high", "medium", "low"].includes(t.priority) ? t.priority : "medium",
    dueDate: typeof t.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) ? t.dueDate : null,
    note: typeof t.note === "string" ? String(t.note).slice(0, 800) : "",
  };
}

function normalizeList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const t = normalizeTodo(raw);
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
    if (out.length >= MAX_TODOS) break;
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");

  if (!redisConfigured()) {
    return res.status(503).json({ error: "redis_not_configured", message: "Redis is not configured on the server" });
  }

  if (req.method === "GET") {
    const code = String(req.query.code || "").trim();
    if (!code) return res.status(400).json({ error: "missing_code" });
    try {
      const raw = await redisCommand("GET", `${KEY_PREFIX}${code}`);
      let list = [];
      if (raw) {
        try {
          list = normalizeList(typeof raw === "string" ? JSON.parse(raw) : raw);
        } catch (_) {
          list = [];
        }
      }
      return res.status(200).json({ todos: list });
    } catch (e) {
      return res.status(500).json({ error: "read_failed", message: String(e.message || e) });
    }
  }

  if (req.method === "PUT") {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (_) {
        return res.status(400).json({ error: "invalid_json" });
      }
    }
    const code = String((body && body.code) || "").trim();
    if (!code) return res.status(400).json({ error: "missing_code" });
    const list = normalizeList(body && body.todos);
    try {
      await redisCommand("SET", `${KEY_PREFIX}${code}`, JSON.stringify(list));
      return res.status(200).json({ ok: true, todos: list });
    } catch (e) {
      return res.status(500).json({ error: "write_failed", message: String(e.message || e) });
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "method_not_allowed" });
}
