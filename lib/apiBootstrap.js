/**
 * Shared bootstrap for all /api/* handlers.
 * Applies CORS + security headers + request id consistently.
 */
import {
  requestId,
  applySecurityHeaders,
  applyCors,
  applyRateLimitHeaders,
} from "./jsonbinHttp.js";

/**
 * Call at the top of every API handler.
 * @returns {{ rid: string }}
 */
export function beginApi(req, res) {
  const rid = requestId(req);
  applyCors(req, res);
  applySecurityHeaders(res, rid);
  return { rid };
}

/**
 * Handle OPTIONS preflight; returns true if response was sent.
 */
export function handleOptions(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

export { applyRateLimitHeaders };
