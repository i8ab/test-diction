/**
 * HTTP helpers for /api/jsonbin — CORS, security headers, request id,
 * rate-limit headers, payload guards. No business logic.
 */

const DEFAULT_MAX_BODY_BYTES = 1_500_000; // ~1.5MB (avatars as data-URL)

/**
 * @param {import('http').IncomingMessage} req
 * @returns {string}
 */
export function requestId(req) {
  const incoming =
    req.headers?.["x-request-id"] ||
    req.headers?.["x-vercel-id"] ||
    "";
  if (typeof incoming === "string" && incoming.trim()) {
    return incoming.trim().slice(0, 64);
  }
  return `tt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Apply baseline security headers on every response.
 * @param {import('http').ServerResponse} res
 * @param {string} rid
 */
export function applySecurityHeaders(res, rid) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Request-Id", rid);
  // API responses must not be stored by shared caches
  if (!res.getHeader("Cache-Control")) {
    res.setHeader("Cache-Control", "private, no-store");
  }
}

/**
 * CORS: allow configured production origin(s), or reflect none in prod without env.
 * ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
 * Local dev (no env): allow any origin so Vite preview works.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export function applyCors(req, res) {
  const origin = String(req.headers?.origin || "");
  const raw = process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || "";
  const allowed = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowed.length === 0) {
    // Dev / unset: permissive for same-site and local tooling
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
  } else if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, If-None-Match, X-Request-Id"
  );
  res.setHeader("Access-Control-Expose-Headers", "ETag, X-Request-Id, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining");
  res.setHeader("Access-Control-Max-Age", "86400");
}

/**
 * @param {import('http').ServerResponse} res
 * @param {{ limit?: number, remaining?: number, windowMs?: number }} rl
 */
export function applyRateLimitHeaders(res, rl = {}) {
  if (typeof rl.limit === "number") {
    res.setHeader("X-RateLimit-Limit", String(rl.limit));
  }
  if (typeof rl.remaining === "number") {
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, rl.remaining)));
  }
  if (typeof rl.windowMs === "number") {
    res.setHeader("X-RateLimit-Window", String(Math.ceil(rl.windowMs / 1000)));
  }
}

/**
 * Estimate body size for already-parsed JSON (Vercel may parse before us).
 * @param {unknown} body
 * @param {number} [maxBytes]
 * @returns {{ ok: true } | { ok: false, status: number, payload: object }}
 */
export function guardBodySize(body, maxBytes = DEFAULT_MAX_BODY_BYTES) {
  if (body == null) return { ok: true };
  let size = 0;
  try {
    size = Buffer.byteLength(JSON.stringify(body), "utf8");
  } catch (_) {
    return {
      ok: false,
      status: 400,
      payload: {
        ok: false,
        error: "invalid_body",
        message: "Request body could not be measured.",
      },
    };
  }
  if (size > maxBytes) {
    return {
      ok: false,
      status: 413,
      payload: {
        ok: false,
        error: "payload_too_large",
        message: `Request body exceeds ${maxBytes} bytes.`,
        maxBytes,
        size,
      },
    };
  }
  return { ok: true };
}

/**
 * Soft validation for actorCode shape (does not prove identity — DB does).
 * @param {unknown} code
 * @returns {string} trimmed code or ""
 */
export function normalizeActorCode(code) {
  const s = String(code || "").trim();
  if (!s) return "";
  // Personal codes in this app are short alphanumeric-ish tokens
  if (s.length > 64) return "";
  if (!/^[A-Za-z0-9._:-]+$/.test(s)) return "";
  return s;
}

/**
 * Unified JSON send.
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {object} payload
 */
export function sendJson(res, status, payload) {
  res.status(status).json(payload);
}
