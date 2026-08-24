/**
 * Session token issuance (JWT-like HS256).
 * See docs/JWT_DESIGN.md — migration is phased; this endpoint is additive.
 *
 * POST body: { code, passwordHash }  // same hash form the client already computes
 * Returns: { ok, token, expiresAt } or error.
 *
 * Does not yet revoke legacy personal-code access.
 */

import { rateLimit, clientIp } from "../lib/rateLimit.js";
import { signSession } from "../lib/sessionToken.js";

function sbHeaders() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  return {
    url: url.replace(/\/$/, ""),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  };
}

async function loadAccountByCode(code) {
  const sb = sbHeaders();
  if (!sb) return null;
  const r = await fetch(
    `${sb.url}/rest/v1/accounts?code=eq.${encodeURIComponent(code)}&select=code,data&limit=1`,
    { headers: sb.headers }
  );
  if (!r.ok) return null;
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows[0]) return null;
  const data = rows[0].data && typeof rows[0].data === "object" ? rows[0].data : {};
  return { code: rows[0].code, ...data };
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  return body && typeof body === "object" ? body : {};
}

export default async function handler(req, res) {
  res.setHeader("Allow", "POST");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const ip = clientIp(req);
  const rl = await rateLimit(`session:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ ok: false, error: "rate_limited" });
  }

  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) {
    return res.status(503).json({
      ok: false,
      error: "Session tokens are not configured (SESSION_SECRET).",
    });
  }

  if (!sbHeaders()) {
    return res.status(500).json({ ok: false, error: "Database not configured" });
  }

  const body = parseBody(req);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const passwordHash =
    typeof body.passwordHash === "string" ? body.passwordHash.trim() : "";

  if (!code || !passwordHash) {
    return res.status(400).json({ ok: false, error: "code and passwordHash required" });
  }

  try {
    const account = await loadAccountByCode(code);
    if (!account) {
      return res.status(401).json({ ok: false, error: "invalid credentials" });
    }
    if (account.status === "blocked" || account.status === "rejected") {
      return res.status(403).json({ ok: false, error: "account not allowed" });
    }
    if (account.status === "pending") {
      return res.status(403).json({ ok: false, error: "account pending approval" });
    }
    // Constant-time-ish compare of stored hash
    const stored = String(account.passwordHash || "");
    if (!stored || stored !== passwordHash) {
      return res.status(401).json({ ok: false, error: "invalid credentials" });
    }

    const role =
      account.role === "admin" || account.role === "teacher"
        ? account.role
        : "user";
    const signed = signSession({
      sub: account.code,
      role,
      sid: account.sessionId || "",
    });
    if (!signed) {
      return res.status(500).json({ ok: false, error: "could not sign token" });
    }
    return res.status(200).json({
      ok: true,
      token: signed.token,
      expiresAt: signed.expiresAt,
    });
  } catch (err) {
    console.error("[session]", err);
    return res.status(500).json({ ok: false, error: "session issue failed" });
  }
}
