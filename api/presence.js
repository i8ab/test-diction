/**
 * Lightweight "who else is here" check for an account.
 * Used only to decide whether it's worth pulling the shared todo list at
 * all — if no other device has checked in recently, there is nothing to
 * sync down, so the client can skip the (bigger) GET on /api/todos.
 *
 * This never carries the todos themselves — just a tiny map of
 * deviceId -> lastSeen, so it's cheap even when called on every open.
 *
 * POST /api/presence   body: { code, deviceId }
 *   -> { others: boolean }   (true if some *other* deviceId checked in
 *                             within the last PRESENCE_TTL_MS)
 *
 * Key: twoTongues:presence:<code>
 */

import { redisConfigured, redisCommand } from "../lib/redis.js";

const KEY_PREFIX = "twoTongues:presence:";
const PRESENCE_TTL_MS = 12 * 60 * 60 * 1000; // a device counts as "here" for 12h after check-in
const MAX_DEVICES = 20; // safety cap so the blob can't grow unbounded

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");

  if (!redisConfigured()) {
    // No Redis -> we can't know who else is around; assume "others" so the
    // caller falls back to the normal (safe) full-sync behavior.
    return res.status(200).json({ others: true });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (_) {
      return res.status(400).json({ error: "invalid_json" });
    }
  }
  const code = String((body && body.code) || "").trim();
  const deviceId = String((body && body.deviceId) || "").trim();
  if (!code || !deviceId) return res.status(400).json({ error: "missing_code_or_device" });

  const key = `${KEY_PREFIX}${code}`;
  const now = Date.now();

  try {
    const raw = await redisCommand("GET", key);
    let map = {};
    if (raw) {
      try {
        map = JSON.parse(raw);
      } catch (_) {
        map = {};
      }
    }
    // Prune stale entries
    for (const id of Object.keys(map)) {
      if (typeof map[id] !== "number" || now - map[id] > PRESENCE_TTL_MS) delete map[id];
    }
    // Is anyone *else* still here, before we add ourselves?
    const others = Object.keys(map).some((id) => id !== deviceId);

    map[deviceId] = now;
    // Cap size defensively (drop oldest if somehow over the limit)
    const ids = Object.keys(map);
    if (ids.length > MAX_DEVICES) {
      ids
        .sort((a, b) => map[a] - map[b])
        .slice(0, ids.length - MAX_DEVICES)
        .forEach((id) => delete map[id]);
    }

    await redisCommand("SET", key, JSON.stringify(map), "EX", String(Math.ceil(PRESENCE_TTL_MS / 1000) + 30));
    return res.status(200).json({ others });
  } catch (e) {
    // Best-effort — if presence tracking fails, don't block the app;
    // just assume others might be there so the client stays safe and syncs.
    return res.status(200).json({ others: true });
  }
}
