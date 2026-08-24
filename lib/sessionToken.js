/**
 * Minimal HS256-style session tokens (server-side only).
 * No external dependency — uses Node crypto.
 *
 * Wire-up is gradual: see docs/JWT_DESIGN.md.
 * Do not require tokens on all routes until migration phase C.
 */

import crypto from "crypto";

const DEFAULT_TTL_SEC = 12 * 60 * 60; // 12 hours

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function fromB64url(str) {
  const pad = 4 - (str.length % 4 || 4);
  const s = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad === 4 ? 0 : pad);
  return Buffer.from(s, "base64");
}

function getSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) return null;
  return s;
}

/**
 * @param {{ sub: string, role?: string, sid?: string }} claims
 * @param {{ ttlSec?: number }} [opts]
 * @returns {{ token: string, expiresAt: number } | null}
 */
export function signSession(claims, opts = {}) {
  const secret = getSecret();
  if (!secret) return null;
  const ttl = opts.ttlSec || DEFAULT_TTL_SEC;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: String(claims.sub || ""),
    role: claims.role || "user",
    sid: claims.sid || "",
    iat: now,
    exp: now + ttl,
  };
  if (!payload.sub) return null;
  const data = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return { token: `${data}.${sig}`, expiresAt: payload.exp * 1000 };
}

/**
 * @param {string} token
 * @returns {{ ok: true, claims: object } | { ok: false, error: string }}
 */
export function verifySession(token) {
  const secret = getSecret();
  if (!secret) return { ok: false, error: "SESSION_SECRET not configured" };
  if (!token || typeof token !== "string") return { ok: false, error: "missing token" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, error: "malformed token" };
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = crypto.createHmac("sha256", secret).update(data).digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const a = Buffer.from(s);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: "invalid signature" };
  }
  let claims;
  try {
    claims = JSON.parse(fromB64url(p).toString("utf8"));
  } catch {
    return { ok: false, error: "bad payload" };
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp < now) {
    return { ok: false, error: "expired" };
  }
  if (!claims.sub) return { ok: false, error: "missing sub" };
  return { ok: true, claims };
}

/** Extract Bearer token from a Node/Vercel request. */
export function bearerFromReq(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || "";
  if (typeof h === "string" && h.toLowerCase().startsWith("bearer ")) {
    return h.slice(7).trim();
  }
  return "";
}
