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

const LOCK_TTL_MS = 8000;   // safety net: auto-expires if a request dies mid-write, so the app can never wedge itself
const LOCK_WAIT_MS = 6000;  // how long a request will wait for the lock before giving up
const LOCK_POLL_MS = 120;   // how often to retry acquiring while waiting

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
