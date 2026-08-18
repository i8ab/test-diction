// Shared helpers for multi-device Web Push subscriptions (one account → many endpoints).
// Legacy single key `twoTongues:push:sub:<code>` is still read and written (first device)
// so a rolling deploy does not drop older server instances mid-flight.

import { redisCommand } from "./redis.js";

export const SUB_PREFIX = "twoTongues:push:sub:"; // legacy single
export const SUBS_PREFIX = "twoTongues:push:subs:"; // multi-device array
export const PREFS_PREFIX = "twoTongues:push:prefs:";
export const CODES_SET_KEY = "twoTongues:push:codes";

function parseMaybeJson(raw) {
  if (raw == null) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/** Load all push subscriptions for an account (array, possibly empty). */
export async function loadSubs(code) {
  if (!code) return [];
  const multiRaw = await redisCommand("GET", `${SUBS_PREFIX}${code}`);
  const multi = parseMaybeJson(multiRaw);
  if (Array.isArray(multi) && multi.length) {
    return multi.filter((s) => s && typeof s.endpoint === "string" && s.endpoint);
  }
  const singleRaw = await redisCommand("GET", `${SUB_PREFIX}${code}`);
  const single = parseMaybeJson(singleRaw);
  if (single && typeof single.endpoint === "string" && single.endpoint) {
    return [single];
  }
  return [];
}

/** Persist subscription list; empty list removes keys and drops code from the set. */
export async function saveSubs(code, subs) {
  if (!code) return;
  const list = (Array.isArray(subs) ? subs : [])
    .filter((s) => s && typeof s.endpoint === "string" && s.endpoint)
    // Dedup by endpoint
    .filter((s, i, arr) => arr.findIndex((x) => x.endpoint === s.endpoint) === i);

  if (!list.length) {
    await redisCommand("DEL", `${SUBS_PREFIX}${code}`);
    await redisCommand("DEL", `${SUB_PREFIX}${code}`);
    await redisCommand("SREM", CODES_SET_KEY, code);
    return;
  }

  await redisCommand("SET", `${SUBS_PREFIX}${code}`, JSON.stringify(list));
  // Legacy mirror (first device) for any old code path still reading single key
  await redisCommand("SET", `${SUB_PREFIX}${code}`, JSON.stringify(list[0]));
  await redisCommand("SADD", CODES_SET_KEY, code);
}

/**
 * Add or replace one device subscription under this account.
 * Also strips the same endpoint from any *other* account (device switched accounts).
 */
export async function upsertSub(code, subscription) {
  if (!code || !subscription || !subscription.endpoint) return [];
  const endpoint = subscription.endpoint;

  // Remove this endpoint from other accounts
  try {
    const allCodes = (await redisCommand("SMEMBERS", CODES_SET_KEY)) || [];
    for (const other of allCodes) {
      if (!other || other === code) continue;
      const others = await loadSubs(other);
      const filtered = others.filter((s) => s.endpoint !== endpoint);
      if (filtered.length !== others.length) {
        await saveSubs(other, filtered);
      }
    }
  } catch (_) {
    // best-effort
  }

  const current = await loadSubs(code);
  const without = current.filter((s) => s.endpoint !== endpoint);
  without.push(subscription);
  // Cap devices per account to avoid runaway growth
  const capped = without.slice(-15);
  await saveSubs(code, capped);
  return capped;
}

/** Remove one device (by endpoint). If endpoint omitted, clear all devices for the code. */
export async function removeSub(code, endpoint) {
  if (!code) return [];
  if (!endpoint) {
    await saveSubs(code, []);
    return [];
  }
  const current = await loadSubs(code);
  const next = current.filter((s) => s.endpoint !== endpoint);
  await saveSubs(code, next);
  return next;
}

/** Remove a single expired endpoint from an account's list (keep other devices). */
export async function removeExpiredEndpoint(code, endpoint) {
  if (!code || !endpoint) return;
  const current = await loadSubs(code);
  const next = current.filter((s) => s.endpoint !== endpoint);
  await saveSubs(code, next);
}
