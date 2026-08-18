/**
 * GET  → fetch prefs + inbox + device count
 * POST → save prefs / subscribe / unsubscribe / inbox actions
 *
 * Body actions:
 *   - subscribe: { code, subscription }
 *   - unsubscribe: { code, endpoint }
 *   - savePrefs: { code, prefs }          ← includes messages list
 *   - clearSchedule: { code }
 *   - clearAllSchedules: { code, adminCode }  (admin only)
 *   - getInbox: { code }
 *   - markInboxRead: { code, ids? }
 *   - deleteInbox: { code, ids }           ← ids = ["id1","id2"] or "all"
 *   - clearMessages: { code }              ← wipe reminder messages only
 */

import {
  getSubs,
  addSub,
  removeSub,
  getPrefs,
  savePrefs,
  clearSchedule,
  clearAllSchedules,
  getInbox,
  markInboxRead,
  deleteInboxItems,
} from "../lib/pushSubs.js";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const code = req.query.code;
      if (!code) return res.status(400).json({ error: "code required" });

      const [prefs, subs, inbox] = await Promise.all([
        getPrefs(code),
        getSubs(code),
        getInbox(code),
      ]);

      return res.status(200).json({
        prefs: prefs || {},
        devices: subs.length,
        inbox: inbox || [],
        unread: (inbox || []).filter((i) => !i.read).length,
      });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { action, code } = body;

      if (!code) return res.status(400).json({ error: "code required" });

      // ---------- subscribe ----------
      if (action === "subscribe") {
        const { subscription } = body;
        if (!subscription?.endpoint) return res.status(400).json({ error: "subscription required" });
        const subs = await addSub(code, subscription);
        return res.status(200).json({ ok: true, devices: subs.length });
      }

      // ---------- unsubscribe (one device) ----------
      if (action === "unsubscribe") {
        const { endpoint } = body;
        if (!endpoint) return res.status(400).json({ error: "endpoint required" });
        const subs = await removeSub(code, endpoint);
        return res.status(200).json({ ok: true, devices: subs.length });
      }

      // ---------- save prefs (messages + settings) ----------
      if (action === "savePrefs") {
        const { prefs } = body;
        if (!prefs) return res.status(400).json({ error: "prefs required" });
        // merge carefully – keep schedule fields if not sent
        const current = (await getPrefs(code)) || {};
        const merged = {
          ...current,
          ...prefs,
          // never let client wipe schedule by accident unless explicit
          lastSent: prefs.lastSent !== undefined ? prefs.lastSent : current.lastSent,
          lastSlot: prefs.lastSlot !== undefined ? prefs.lastSlot : current.lastSlot,
          msgIndex: prefs.msgIndex !== undefined ? prefs.msgIndex : current.msgIndex,
        };
        await savePrefs(code, merged);
        return res.status(200).json({ ok: true, prefs: merged });
      }

      // ---------- clear schedule (this account) ----------
      if (action === "clearSchedule") {
        const prefs = await clearSchedule(code);
        return res.status(200).json({ ok: true, prefs });
      }

      // ---------- clear ALL schedules (admin) ----------
      if (action === "clearAllSchedules") {
        const { adminCode } = body;
        // simple admin check – adjust to your real admin logic
        if (!adminCode || adminCode !== process.env.ADMIN_CODE) {
          return res.status(403).json({ error: "admin only" });
        }
        const count = await clearAllSchedules();
        return res.status(200).json({ ok: true, cleared: count });
      }

      // ---------- clear reminder messages only ----------
      if (action === "clearMessages") {
        const current = (await getPrefs(code)) || {};
        current.messages = [];
        current.msgIndex = 0;
        await savePrefs(code, current);
        return res.status(200).json({ ok: true, prefs: current });
      }

      // ---------- Inbox: get ----------
      if (action === "getInbox") {
        const inbox = await getInbox(code);
        return res.status(200).json({
          inbox,
          unread: inbox.filter((i) => !i.read).length,
        });
      }

      // ---------- Inbox: mark read ----------
      if (action === "markInboxRead") {
        const { ids } = body; // null or array
        const inbox = await markInboxRead(code, ids || null);
        return res.status(200).json({
          ok: true,
          inbox,
          unread: inbox.filter((i) => !i.read).length,
        });
      }

      // ---------- Inbox: delete ----------
      if (action === "deleteInbox") {
        const { ids } = body; // "all" or array of ids
        const inbox = await deleteInboxItems(code, ids === "all" ? "all" : ids || []);
        return res.status(200).json({
          ok: true,
          inbox,
          unread: inbox.filter((i) => !i.read).length,
        });
      }

      return res.status(400).json({ error: "unknown action" });
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    console.error("push-subscribe error:", err);
    return res.status(500).json({ error: err.message });
  }
}
