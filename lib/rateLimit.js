/**
 * Sliding-window rate limit via Upstash Redis REST.
 * Fail-open when Redis is not configured (local dev must keep working).
 *
 * Usage:
 *   const { allowed, remaining } = await rateLimit(`login:${ip}`, { limit: 20, windowMs: 60_000 });
 *   if (!allowed) return res.status(429).json({ error: "rate_limited" });
 */

import { redisConfigured, redisCommand } from "./redis.js";

/**
 * @param {string} key - logical bucket, e.g. "login:1.2.3.4"
 * @param {{ limit?: number, windowMs?: number }} opts
 * @returns {Promise<{ allowed: boolean, remaining: number, configured: boolean }>}
 */
export async function rateLimit(key, opts = {}) {
  const limit = Math.max(1, Number(opts.limit) || 30);
  const windowMs = Math.max(1000, Number(opts.windowMs) || 60_000);

  if (!redisConfigured()) {
    return { allowed: true, remaining: limit, configured: false };
  }

  const redisKey = `rl:${String(key || "anon").slice(0, 180)}`;
  try {
    const count = Number(await redisCommand("INCR", redisKey)) || 1;
    if (count === 1) {
      // First hit in window — set TTL in seconds
      const ttlSec = Math.ceil(windowMs / 1000);
      await redisCommand("EXPIRE", redisKey, String(ttlSec));
    }
    const remaining = Math.max(0, limit - count);
    return {
      allowed: count <= limit,
      remaining,
      configured: true,
    };
  } catch (err) {
    console.warn("[rateLimit] Redis error — fail open:", err?.message || err);
    return { allowed: true, remaining: limit, configured: true };
  }
}

/** Best-effort client IP on Vercel / Node. */
export function clientIp(req) {
  const xf = req.headers?.["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    return xf.split(",")[0].trim();
  }
  if (Array.isArray(xf) && xf[0]) return String(xf[0]).trim();
  const real = req.headers?.["x-real-ip"];
  if (typeof real === "string" && real.trim()) return real.trim();
  return req.socket?.remoteAddress || "unknown";
}
