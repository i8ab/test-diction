// Server-side check for the shared access code, with basic brute-force
// protection.
//
// Runs on Vercel's servers only — the real code lives in the ACCESS_CODE
// env var and is never sent to the browser. The client posts what the user
// typed; this returns { ok: true } or { ok: false }, nothing else.
//
// Set in Vercel: Project Settings -> Environment Variables
//   ACCESS_CODE   the shared code your users type to sign in
//
// After adding/changing the env var you must redeploy for it to take effect.
//
// ---------------------------------------------------------------------------
// RATE LIMITING — durable when configured, in-memory otherwise
// ---------------------------------------------------------------------------
// Two backends, picked automatically:
//
// 1. DURABLE (preferred) — if UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//    are set (a free Upstash Redis database gives you both), attempt counts
//    are stored there via plain `fetch` calls to Upstash's REST API — no npm
//    package needed. This survives cold starts and is shared correctly
//    across every Vercel serverless instance, so the limit is a real,
//    instance-independent guarantee.
//
//    To enable: create a free database at https://upstash.com (Redis),
//    copy its REST URL + token into Vercel's env vars under those exact
//    names, redeploy. Nothing else changes.
//
// 2. IN-MEMORY (fallback) — if those env vars aren't set, attempts are
//    tracked in a plain Map per serverless instance instead. Vercel
//    functions run across multiple instances and restart on cold starts, so
//    this is a soft deterrent, not a hard guarantee — a distributed or very
//    patient attacker can still get more than MAX_ATTEMPTS guesses in
//    across different instances. It still meaningfully raises the bar for
//    casual scripted guessing; it's just not bank-grade on its own.

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS = 5;      // wrong codes allowed per IP per window
const FAIL_DELAY_MS = 400;   // slows down scripted guessing a bit further

const attempts = new Map(); // ip -> { count, windowStart }  (in-memory fallback)

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return fwd.split(",")[0].trim();
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Prevents the Map from growing forever on a long-lived warm instance.
function pruneStale(now) {
  if (attempts.size < 5000) return;
  for (const [ip, entry] of attempts) {
    if (now - entry.windowStart > WINDOW_MS) attempts.delete(ip);
  }
}

function redisConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// Minimal Upstash REST helper — sends one command per call as a path
// segment array, per https://upstash.com/docs/redis/features/restapi.
async function redisCommand(...args) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  const url = `${UPSTASH_REDIS_REST_URL}/${args.map(encodeURIComponent).join("/")}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
  if (!r.ok) throw new Error(`Upstash error ${r.status}`);
  const data = await r.json();
  return data.result;
}

// Returns { blocked, retryAfterSec } using an atomic INCR + EXPIRE-if-new
// so concurrent requests from the same IP can't race past the limit.
async function checkAndBumpDurable(ip) {
  const key = `twoTongues:loginAttempts:${ip}`;
  const count = await redisCommand("INCR", key);
  if (count === 1) {
    // First failure in a fresh window — set the window to expire on its own.
    await redisCommand("EXPIRE", key, String(Math.ceil(WINDOW_MS / 1000)));
  }
  if (count > MAX_ATTEMPTS) {
    const ttl = await redisCommand("TTL", key);
    return { blocked: true, retryAfterSec: ttl && ttl > 0 ? ttl : Math.ceil(WINDOW_MS / 1000) };
  }
  return { blocked: false };
}

async function clearDurable(ip) {
  await redisCommand("DEL", `twoTongues:loginAttempts:${ip}`).catch(() => {});
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { ACCESS_CODE } = process.env;
  if (!ACCESS_CODE) {
    return res.status(500).json({ error: "Server not configured: missing ACCESS_CODE env var." });
  }

  const ip = getClientIp(req);
  const now = Date.now();
  const durable = redisConfigured();

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  const submitted = body && typeof body.code === "string" ? body.code.trim().toLowerCase() : "";
  const ok = submitted.length > 0 && submitted === ACCESS_CODE.trim().toLowerCase();

  if (durable) {
    try {
      if (ok) {
        await clearDurable(ip);
        return res.status(200).json({ ok: true });
      }
      const { blocked, retryAfterSec } = await checkAndBumpDurable(ip);
      if (blocked) {
        res.setHeader("Retry-After", String(retryAfterSec));
        return res.status(429).json({ ok: false, error: `Too many attempts — try again in ${retryAfterSec}s.` });
      }
      await sleep(FAIL_DELAY_MS);
      return res.status(200).json({ ok: false });
    } catch (e) {
      // Upstash unreachable — don't lock users out entirely; fall through
      // to the in-memory path below as a best-effort backstop for this
      // request instead of failing closed.
    }
  }

  // --- in-memory fallback (also used if the durable path threw above) ---
  pruneStale(now);
  const entry = attempts.get(ip);
  if (entry && now - entry.windowStart < WINDOW_MS) {
    if (entry.count >= MAX_ATTEMPTS) {
      const retryAfterSec = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({ ok: false, error: `Too many attempts — try again in ${retryAfterSec}s.` });
    }
  } else {
    attempts.set(ip, { count: 0, windowStart: now });
  }

  if (ok) {
    attempts.delete(ip);
    return res.status(200).json({ ok: true });
  }

  const current = attempts.get(ip) || { count: 0, windowStart: now };
  current.count += 1;
  attempts.set(ip, current);

  await sleep(FAIL_DELAY_MS);
  return res.status(200).json({ ok: false });
}
