// /api/tts — Vercel serverless proxy for text-to-speech audio.
//
// Why this exists: the browser can't call Google Translate's TTS endpoint
// directly (it rejects third-party/browser CORS requests). A server-to-server
// request has no such restriction, so we fetch the audio here and stream it
// back to the client ourselves.
//
// Usage from the browser: GET /api/tts?text=مرحبا&lang=ar
export default async function handler(req, res) {
  const { text, lang } = req.query;

  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "Missing 'text' query param" });
    return;
  }

  const trimmed = text.trim().slice(0, 200);
  if (!trimmed) {
    res.status(400).json({ error: "Empty 'text' query param" });
    return;
  }

  const voiceLang = lang === "en" ? "en" : "ar";

  const url =
    "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob" +
    "&tl=" + encodeURIComponent(voiceLang) +
    "&q=" + encodeURIComponent(trimmed);

  try {
    const upstream = await fetch(url, {
      headers: {
        // Google's endpoint checks for a browser-like User-Agent and will
        // reject requests without one.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
    });

    if (!upstream.ok) {
      res.status(502).json({ error: "Upstream TTS request failed", status: upstream.status });
      return;
    }

    const audioBuffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader("Content-Type", "audio/mpeg");
    // Cache each phrase for a day — same word/lang combo will always sound
    // the same, so no need to hit Google again on repeat plays.
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.status(200).send(audioBuffer);
  } catch (e) {
    res.status(500).json({ error: "TTS proxy error", message: String(e && e.message || e) });
  }
}
