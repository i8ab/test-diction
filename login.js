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
// RATE LIMITING — what this does and doesn't guarantee
// ---------------------------------------------------------------------------
// Attempts are tracked in memory, per serverless instance: up to
// MAX_ATTEMPTS wrong codes from the same IP within WINDOW_MS get a 429
// with a "try again in Ns" message; every failed attempt also gets a small
// artificial delay to slow down scripted guessing.
//
// The honest caveat: Vercel functions run across multiple instances and
// restart on cold starts, so this in-memory counter is a soft deterrent,
// not a hard guarantee — a distributed or very patient attacker can still
// get more than MAX_ATTEMPTS guesses in across different instances. For a
// small shared-code login like this it meaningfully raises the bar (a
// single script hammering the endpoint gets slowed to a crawl); it's not
// bank-grade. If you ever want durable, instance-independent limiting,
// swap the Map below for a small Vercel KV / Upstash Redis counter — same
// logic, just backed by a real store instead of process memory.

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS = 5;      // wrong codes allowed per IP per window
const FAIL_DELAY_MS = 400;   // slows down scripted guessing a bit further

const attempts = new Map(); // ip -> { count, windowStart }

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
  pruneStale(now);

  const entry = attempts.get(ip);
  if (entry && now - entry.windowStart < WINDOW_MS) {
    if (entry.count >= MAX_ATTEMPTS) {
      const retryAfterSec = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        ok: false,
        error: `Too many attempts — try again in ${retryAfterSec}s.`,
      });
    }
  } else {
    attempts.set(ip, { count: 0, windowStart: now });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  const submitted = body && typeof body.code === "string" ? body.code.trim().toLowerCase() : "";

  const ok = submitted.length > 0 && submitted === ACCESS_CODE.trim().toLowerCase();

  if (ok) {
    attempts.delete(ip); // successful login clears this IP's count
    return res.status(200).json({ ok: true });
  }

  const current = attempts.get(ip) || { count: 0, windowStart: now };
  current.count += 1;
  attempts.set(ip, current);

  await sleep(FAIL_DELAY_MS); // throttle failed guesses a little further
  return res.status(200).json({ ok: false });
}
