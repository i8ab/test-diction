// /api/ai-agent — server-side proxy to the external AI agent
// (Railway service used for PDF vocabulary extraction + tutor chat).
//
// WHY THIS FILE EXISTS:
// The client used to call the AI agent directly from the browser with a
// hardcoded `X-API-Secret` baked into the bundle (visible to anyone via
// DevTools / view-source). That secret protected nothing. This proxy keeps
// the real secret in a server-only env var (AI_AGENT_SECRET) and forwards
// the request server-to-server.
//
// POST /api/ai-agent?action=extract-pdf   (multipart/form-data — same fields
//                                           the AI agent expects: file,
//                                           section, page_from, page_to)
// POST /api/ai-agent?action=tutor-chat    (application/json — { question,
//                                           user_context, history })

import { beginApi, handleOptions, applyRateLimitHeaders } from "../lib/apiBootstrap.js";
import { rateLimit, clientIp } from "../lib/rateLimit.js";

// Vercel: keep the raw body so multipart PDF uploads pass through untouched.
export const config = {
  api: { bodyParser: false },
};

const AI_AGENT_URL = process.env.AI_AGENT_URL || "https://web-production-40a8e.up.railway.app";
const MAX_BODY_BYTES = 15_000_000; // ~15MB, generous for a scanned textbook PDF

async function readRawBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const err = new Error("payload_too_large");
      err.code = "PAYLOAD_TOO_LARGE";
      throw err;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  const { rid } = beginApi(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ ok: false, error: "method_not_allowed", requestId: rid });
  }

  const secret = process.env.AI_AGENT_SECRET;
  if (!secret) {
    // Fail closed: never silently call the upstream agent without auth.
    return res.status(503).json({
      ok: false,
      error: "ai_agent_not_configured",
      message: "AI_AGENT_SECRET is not set on the server.",
      requestId: rid,
    });
  }

  const action = String(req.query.action || "").trim();
  const routes = {
    "extract-pdf": { path: "/extract-pdf", limit: 6, windowMs: 60_000 },
    "tutor-chat": { path: "/tutor-chat", limit: 20, windowMs: 60_000 },
  };
  const route = routes[action];
  if (!route) {
    return res.status(400).json({ ok: false, error: "unknown_action", requestId: rid });
  }

  const ip = clientIp(req);
  const rl = await rateLimit(`ai-agent:${action}:${ip}`, { limit: route.limit, windowMs: route.windowMs });
  applyRateLimitHeaders(res, rl);
  if (!rl.allowed) {
    res.setHeader("Retry-After", "30");
    return res.status(429).json({ ok: false, error: "rate_limited", requestId: rid });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (e) {
    if (e && e.code === "PAYLOAD_TOO_LARGE") {
      return res.status(413).json({ ok: false, error: "payload_too_large", requestId: rid });
    }
    return res.status(400).json({ ok: false, error: "bad_request", requestId: rid });
  }

  try {
    const upstreamRes = await fetch(`${AI_AGENT_URL}${route.path}`, {
      method: "POST",
      headers: {
        "X-API-Secret": secret,
        // Forward Content-Type as-is (carries the multipart boundary for
        // extract-pdf, or application/json for tutor-chat).
        ...(req.headers["content-type"] ? { "Content-Type": req.headers["content-type"] } : {}),
      },
      body: rawBody,
    });

    const contentType = upstreamRes.headers.get("content-type") || "application/json";
    const buf = Buffer.from(await upstreamRes.arrayBuffer());
    res.status(upstreamRes.status);
    res.setHeader("Content-Type", contentType);
    return res.send(buf);
  } catch (e) {
    return res.status(502).json({
      ok: false,
      error: "ai_agent_proxy_error",
      message: String((e && e.message) || e),
      requestId: rid,
    });
  }
}
