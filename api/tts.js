// /api/tts — Vercel serverless proxy for text-to-speech audio.
import { beginApi, handleOptions } from "../lib/apiBootstrap.js";
import { rateLimit, clientIp } from "../lib/rateLimit.js";
import { applyRateLimitHeaders } from "../lib/apiBootstrap.js";

export default async function handler(req, res) {
  const { rid } = beginApi(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ ok: false, error: "method_not_allowed", requestId: rid });
  }

  const ip = clientIp(req);
  const rl = await rateLimit(`tts:${ip}`, { limit: 60, windowMs: 60_000 });
  applyRateLimitHeaders(res, rl);
  if (!rl.allowed) {
    res.setHeader("Retry-After", "30");
    return res.status(429).json({ ok: false, error: "rate_limited", requestId: rid });
  }

  const { text, lang } = req.query;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ ok: false, error: "Missing 'text' query param", requestId: rid });
  }

  const trimmed = text.trim().slice(0, 200);
  if (!trimmed) {
    return res.status(400).json({ ok: false, error: "Empty 'text' query param", requestId: rid });
  }

  const voiceLang = lang === "en" ? "en" : "ar";

  const url =
    "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob" +
    "&tl=" + encodeURIComponent(voiceLang) +
    "&q=" + encodeURIComponent(trimmed);

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
    });

    if (!upstream.ok) {
      return res.status(502).json({
        ok: false,
        error: "Upstream TTS request failed",
        status: upstream.status,
        requestId: rid,
      });
    }

    const audioBuffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
    res.setHeader("Vary", "Accept-Encoding");
    return res.status(200).send(audioBuffer);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "TTS proxy error",
      message: String(e && e.message || e),
      requestId: rid,
    });
  }
}
