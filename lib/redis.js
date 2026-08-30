// Minimal Upstash Redis REST helper, shared by any /api function that needs
// a real atomic operation (INCR, or the distributed lock below). Upstash's
// free tier REST API is used directly via `fetch` — no npm package needed,
// which keeps this dependency-free and easy to bundle into any serverless
// function.
//
// Set in Vercel: Project Settings -> Environment Variables
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
// (a free database at https://upstash.com gives you both). Everything in
// this file quietly no-ops / returns "not configured" if they're missing,
// so callers can fall back to a best-effort strategy instead of crashing.

export function redisConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// Sends one command per call as a path-segment array, per
// https://upstash.com/docs/redis/features/restapi
export async function redisCommand(...args) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  const url = `${UPSTASH_REDIS_REST_URL}/${args.map(encodeURIComponent).join("/")}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
  if (!r.ok) throw new Error(`Upstash error ${r.status}`);
  const data = await r.json();
  return data.result;
}

/* ===========================================================================
   DISTRIBUTED LOCK
   ---------------------------------------------------------------------------
   Why this exists: a plain "read version, compare, write" check (optimistic
   locking) is NOT atomic — two requests can both read the same version,
   both pass the comparison, and both write, with the second one silently
   overwriting the first. That's a real, reproducible race when two people
   save within the same handful of milliseconds of each other.

   Redis's SET command with NX (only set if not already set) is atomic even
   under concurrent access — Redis processes commands one at a time — so
   using it as a lock closes that race completely: only one request can ever
   hold the lock at once, so the read-modify-write it protects can no longer
   overlap with anyone else's.
   ========================================================================= */

const LOCK_TTL_MS = 20000;  // safety net: auto-expires if a request dies mid-write. Must be longer than a full clear+rewrite of accounts/entries.
const LOCK_WAIT_MS = 12000; // how long a request will wait for the lock before giving up
const LOCK_POLL_MS = 100;   // how often to retry acquiring while waiting

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Tries to acquire `key` as a lock, waiting/retrying up to LOCK_WAIT_MS.
// Returns a unique token (needed to release it) or null if it timed out.
export async function acquireLock(key) {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (Date.now() < deadline) {
    const result = await redisCommand("SET", key, token, "NX", "PX", String(LOCK_TTL_MS));
    if (result === "OK") return token;
    await sleep(LOCK_POLL_MS);
  }
  return null;
}

// Releases the lock only if we're still the ones holding it (checked via
// the token), so a request that overran its own TTL can't accidentally
// delete a lock some other, later request has since acquired.
export async function releaseLock(key, token) {
  try {
    const current = await redisCommand("GET", key);
    if (current === token) await redisCommand("DEL", key);
  } catch (e) {
    // best-effort — LOCK_TTL_MS's expiry is the real safety net
  }
}

/* ===========================================================================
   LIGHTWEIGHT CACHE (GET helpers for hot scopes)
   ---------------------------------------------------------------------------
   Used by /api/jsonbin for version / bootstrap / accounts list so repeated
   reads from many tabs don't hammer Supabase. Quietly no-ops when Redis is
   not configured.
   ========================================================================= */

export async function cacheGet(key) {
  if (!redisConfigured()) return null;
  try {
    const val = await redisCommand("GET", key);
    if (val == null) return null;
    return JSON.parse(val);
  } catch (_) {
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds = 15) {
  if (!redisConfigured()) return;
  try {
    await redisCommand(
      "SET",
      key,
      JSON.stringify(value),
      "EX",
      String(Math.max(1, Math.floor(ttlSeconds)))
    );
  } catch (_) {}
}

export async function cacheDel(...keys) {
  if (!redisConfigured() || !keys.length) return;
  try {
    const valid = keys.filter(Boolean);
    if (!valid.length) return;
    await redisCommand("DEL", ...valid);
  } catch (_) {}
}

/** Invalidate all hot-scope caches after any successful write / version bump. */
export async function invalidateHotCaches() {
  await cacheDel(
    "tt:version",
    "tt:bootstrap",
    "tt:accounts",
    // entries — every (fields x section) combo we cache (see api/jsonbin.js)
    "tt:entries:F:all",
    "tt:entries:L:all",
    "tt:entries:F:en-ar",
    "tt:entries:L:en-ar",
    "tt:entries:F:ar-ar",
    "tt:entries:L:ar-ar",
    "tt:entries:F:academic",
    "tt:entries:L:academic",
    // settings — default key set only (custom `keys=` combos are not cached)
    "tt:settings:default",
    // logs — default unfiltered list
    "tt:logs:default"
  );
}

/* ===========================================================================
   PER-SCOPE WRITE LOCKS
   ---------------------------------------------------------------------------
   The write path used to serialize on a single global lock, so an unrelated
   accounts write (e.g. a profile edit) would queue behind a dictionary-entry
   edit even though they touch different tables. Splitting the lock by scope
   lets independent write scopes proceed concurrently, while a "full" record
   write (which touches everything at once) still locks every scope, always
   in the same fixed order below, so two full writes can never deadlock
   against each other or against a scoped write.
   ========================================================================= */

export const SCOPE_LOCK_KEYS = {
  accountstatus: "twoTongues:lock:accounts",
  accountdelete: "twoTongues:lock:accounts",
  accountpatch: "twoTongues:lock:accounts",
  accounts: "twoTongues:lock:accounts",
  entrypatch: "twoTongues:lock:entries",
  entrydelete: "twoTongues:lock:entries",
  settingspatch: "twoTongues:lock:settings",
  logsreplace: "twoTongues:lock:logs",
};

// Fixed order used whenever every table must be locked at once (full/legacy
// record writes). Must stay in this exact order everywhere it's used so
// concurrent callers always acquire locks in the same sequence.
export const ALL_SCOPE_LOCK_KEYS = [
  "twoTongues:lock:accounts",
  "twoTongues:lock:entries",
  "twoTongues:lock:logs",
  "twoTongues:lock:settings",
];

/**
 * Resolve which lock key(s) a given write scope needs.
 * Unknown/empty scope (the "full" legacy path) needs every lock, since it
 * can touch accounts + entries + settings + logs in one write.
 * @param {string} scope
 * @returns {string[]}
 */
export function lockKeysForScope(scope) {
  const key = SCOPE_LOCK_KEYS[String(scope || "").toLowerCase()];
  return key ? [key] : ALL_SCOPE_LOCK_KEYS;
}

/**
 * Acquire every lock a scope needs, always in ALL_SCOPE_LOCK_KEYS order.
 * On partial failure, releases whatever it already grabbed and returns null.
 * @param {string} scope
 * @returns {Promise<{keys: string[], tokens: string[]} | null>}
 */
export async function acquireScopeLocks(scope) {
  const keys = lockKeysForScope(scope);
  const tokens = [];
  for (const key of keys) {
    const token = await acquireLock(key);
    if (!token) {
      for (let i = tokens.length - 1; i >= 0; i--) {
        await releaseLock(keys[i], tokens[i]);
      }
      return null;
    }
    tokens.push(token);
  }
  return { keys, tokens };
}

/** Release every lock held by a previous acquireScopeLocks() call. */
export async function releaseScopeLocks(held) {
  if (!held || !Array.isArray(held.keys)) return;
  for (let i = held.keys.length - 1; i >= 0; i--) {
    await releaseLock(held.keys[i], held.tokens[i]);
  }
}
