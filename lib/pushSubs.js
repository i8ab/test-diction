/**
 * Multi-device push subscriptions + account-level inbox (Redis via Upstash REST).
 *
 * Uses lib/redis.js (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) —
 * no ioredis / TCP client, so it works in Vercel serverless without extra deps.
 *
 * Key patterns (must stay stable — production data already uses these):
 *   twoTongues:push:codes          → SET of account codes with subscriptions
 *   twoTongues:push:subs:<code>    → JSON array of PushSubscription objects
 *   twoTongues:push:prefs:<code>   → JSON prefs (title, messages, intervalHours)
 *   twoTongues:push:inbox:<code>   → JSON array of inbox items (newest first)
 *   twoTongues:push:lastSent:<code>
 *   twoTongues:push:lastSlot:<code>
 *   twoTongues:push:msgIndex:<code>
 */

import { redisCommand } from "./redis.js";

export const CODES_SET_KEY = "twoTongues:push:codes";
export const PREFS_PREFIX = "twoTongues:push:prefs:";
export const SUBS_PREFIX = "twoTongues:push:subs:";
export const INBOX_PREFIX = "twoTongues:push:inbox:";
const MAX_INBOX = 80;
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

// ---------- Account-level inbox (synced across devices) ----------

function normalizeInboxItem(item) {
  if (!item || typeof item !== "object") return null;
  const title = typeof item.title === "string" ? item.title.trim().slice(0, 160) : "";
  if (!title) return null;
  return {
    id: typeof item.id === "string" && item.id ? item.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: typeof item.type === "string" && item.type ? item.type : "system",
    title,
    body: typeof item.body === "string" ? item.body.slice(0, 400) : "",
    url: typeof item.url === "string" && item.url ? item.url : "/",
    at: typeof item.at === "number" && Number.isFinite(item.at) ? item.at : Date.now(),
    read: !!item.read,
  };
}

export async function loadInbox(code) {
  if (!code) return [];
  try {
    const raw = await redisCommand("GET", `${INBOX_PREFIX}${code}`);
    if (!raw) return [];
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeInboxItem).filter(Boolean).slice(0, MAX_INBOX);
  } catch (_) {
    return [];
  }
}

async function saveInbox(code, list) {
  const clean = (list || []).map(normalizeInboxItem).filter(Boolean).slice(0, MAX_INBOX);
  if (clean.length === 0) {
    try {
      await redisCommand("DEL", `${INBOX_PREFIX}${code}`);
    } catch (_) {}
    return [];
  }
  await redisCommand("SET", `${INBOX_PREFIX}${code}`, JSON.stringify(clean));
  return clean;
}

/**
 * Prepend one inbox item for this account (newest first). Dedupes same
 * title+body within 2 minutes. Used by cron/broadcast and client sync.
 */
export async function addInboxItem(code, item) {
  if (!code) return null;
  const entry = normalizeInboxItem(item);
  if (!entry) return null;
  const list = await loadInbox(code);
  const recent = list.find(
    (x) =>
      x.title === entry.title &&
      x.body === entry.body &&
      Math.abs((x.at || 0) - entry.at) < 120000
  );
  if (recent) return recent;
  const next = [entry, ...list].slice(0, MAX_INBOX);
  await saveInbox(code, next);
  return entry;
}

/** Remove a single inbox item by id. Does not touch anything else on the account. */
export async function removeInboxItem(code, id) {
  if (!code || !id) return loadInbox(code);
  const list = await loadInbox(code);
  const next = list.filter((x) => x.id !== id);
  return saveInbox(code, next);
}

export async function markInboxItemRead(code, id) {
  if (!code || !id) return loadInbox(code);
  const list = await loadInbox(code);
  const next = list.map((x) => (x.id === id ? { ...x, read: true } : x));
  return saveInbox(code, next);
}

export async function markAllInboxRead(code) {
  if (!code) return [];
  const list = await loadInbox(code);
  const next = list.map((x) => ({ ...x, read: true }));
  return saveInbox(code, next);
}

export async function clearInbox(code) {
  if (!code) return [];
  return saveInbox(code, []);
}

export default {
  CODES_SET_KEY,
  PREFS_PREFIX,
  SUBS_PREFIX,
  INBOX_PREFIX,
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
};
