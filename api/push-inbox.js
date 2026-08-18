// Account-level notification inbox (synced across devices via Redis).
//
// GET    ?code=<personal code>              → { ok, items }
// POST   body: { code, item }               → add one item
// DELETE body: { code, id? }                → remove one (id) or clear all
// PATCH  body: { code, id?, markAllRead? }  → mark one/all read
//
// Deleting one item only removes that inbox entry for the account —
// never touches subscriptions, prefs, words, or any other account data.

import { redisConfigured } from "../lib/redis.js";
import {
  loadInbox,
  addInboxItem,
  removeInboxItem,
  markInboxItemRead,
  markAllInboxRead,
  clearInbox,
} from "../lib/pushSubs.js";

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

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = null;
    }
  }
  return body && typeof body === "object" ? body : null;
}

export default async function handler(req, res) {
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
        // Single item only — never clears the whole inbox by accident
        const items = await removeInboxItem(code, id);
        return res.status(200).json({ ok: true, items, removedId: id });
      }
      // Explicit clear-all (client must omit id on purpose)
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
