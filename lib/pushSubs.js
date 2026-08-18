/**
 * Multi-device push subscriptions helpers (Redis via Upstash REST).
 *
 * Uses lib/redis.js (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) —
 * no ioredis / TCP client, so it works in Vercel serverless without extra deps.
 *
 * Key patterns (must stay stable — production data already uses these):
 *   twoTongues:push:codes          → SET of account codes with subscriptions
 *   twoTongues:push:subs:<code>    → JSON array of PushSubscription objects
 *   twoTongues:push:prefs:<code>   → JSON prefs (title, messages, intervalHours)
 *   twoTongues:push:lastSent:<code>
 *   twoTongues:push:lastSlot:<code>
 *   twoTongues:push:msgIndex:<code>
 */

import { redisCommand } from "./redis.js";

export const CODES_SET_KEY = "twoTongues:push:codes";
export const PREFS_PREFIX = "twoTongues:push:prefs:";
export const SUBS_PREFIX = "twoTongues:push:subs:";

/**
 * Load all push subscriptions for an account code.
 * @returns {Promise<object[]>}
 */
export async function loadSubs(code) {
  if (!code) return [];
  try {
    const raw = await redisCommand("GET", `${SUBS_PREFIX}${code}`);
    if (!raw) return [];
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.filter((s) => s && s.endpoint) : [];
  } catch (_) {
    return [];
  }
}

/**
 * Persist subscription list for a code. Empty list → delete key + remove from codes set.
 * @returns {Promise<object[]>} the stored list
 */
async function saveSubs(code, subs) {
  const unique = [];
  const seen = new Set();
  for (const s of subs || []) {
    if (!s || !s.endpoint || seen.has(s.endpoint)) continue;
    seen.add(s.endpoint);
    unique.push(s);
  }

  if (unique.length === 0) {
    try {
      await redisCommand("DEL", `${SUBS_PREFIX}${code}`);
    } catch (_) {}
    try {
      await redisCommand("SREM", CODES_SET_KEY, code);
    } catch (_) {}
    return [];
  }

  await redisCommand("SET", `${SUBS_PREFIX}${code}`, JSON.stringify(unique));
  try {
    await redisCommand("SADD", CODES_SET_KEY, code);
  } catch (_) {}
  return unique;
}

/**
 * Add or replace a subscription for this device endpoint.
 * @returns {Promise<object[]>} updated list
 */
export async function upsertSub(code, subscription) {
  if (!code || !subscription || !subscription.endpoint) {
    return loadSubs(code);
  }
  const current = await loadSubs(code);
  const next = current.filter((s) => s.endpoint !== subscription.endpoint);
  next.push(subscription);
  return saveSubs(code, next);
}

/**
 * Remove one device by endpoint, or all devices if endpoint is null/empty.
 * @returns {Promise<object[]>} remaining list
 */
export async function removeSub(code, endpoint) {
  if (!code) return [];
  if (!endpoint) {
    return saveSubs(code, []);
  }
  const current = await loadSubs(code);
  const next = current.filter((s) => s.endpoint !== endpoint);
  return saveSubs(code, next);
}

/**
 * Remove a subscription that web-push reported as expired (410 / gone).
 * Same as removeSub for a single endpoint.
 */
export async function removeExpiredEndpoint(code, endpoint) {
  return removeSub(code, endpoint);
}

export default {
  CODES_SET_KEY,
  PREFS_PREFIX,
  SUBS_PREFIX,
  loadSubs,
  upsertSub,
  removeSub,
  removeExpiredEndpoint,
};
