// /api/cambridge-audio — proxy Cambridge Dictionary US / UK pronunciation MP3s.
//
// Browser cannot hit dictionary.cambridge.org for audio (CORS + hotlink rules),
// so we resolve the word's audio URL server-side and stream the MP3 back.
//
// GET /api/cambridge-audio?word=hello&accent=us
// GET /api/cambridge-audio?word=hello&accent=uk
//
// accent: "us" | "uk" (default "us")

function normalizeWord(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    // Keep letters, spaces, hyphens, apostrophes — Cambridge slug uses hyphens.
    .replace(/[^a-z0-9\s'\-]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toSlug(word) {
  return word
    .replace(/'/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function extractAudioUrl(html, accent) {
  if (!html) return null;
  const needle = accent === "uk" ? "uk_pron" : "us_pron";
  // Most common: data-src-mp3="https://dictionary.cambridge.org/media/english/us_pron/..."
  const reData = new RegExp(
    `data-src-mp3="(https://dictionary\\.cambridge\\.org/media/english/${needle}[^"]+\\.mp3)"`,
    "i"
  );
  let m = html.match(reData);
  if (m) return m[1];

  // Fallback: plain src on <source> / <audio>
  const reSrc = new RegExp(
    `src="(https://dictionary\\.cambridge\\.org/media/english/${needle}[^"]+\\.mp3)"`,
    "i"
  );
  m = html.match(reSrc);
  if (m) return m[1];

  // Relative paths
  const reRel = new RegExp(
    `(?:data-src-mp3|src)="(/media/english/${needle}[^"]+\\.mp3)"`,
    "i"
  );
  m = html.match(reRel);
  if (m) return `https://dictionary.cambridge.org${m[1]}`;

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const word = normalizeWord(req.query.word);
  const accentRaw = String(req.query.accent || "us").toLowerCase();
  const accent = accentRaw === "uk" || accentRaw === "gb" || accentRaw === "br" ? "uk" : "us";

  if (!word) {
    return res.status(400).json({ error: "Missing word" });
  }
  // Single-token English words work best; multi-word phrases often have no entry.
  const slug = toSlug(word.split(" ")[0]).slice(0, 64);
  if (!slug) {
    return res.status(400).json({ error: "Invalid word" });
  }

  const pageUrl = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(slug)}`;
  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  try {
    const pageRes = await fetch(pageUrl, {
      headers: {
        "User-Agent": ua,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://dictionary.cambridge.org/",
      },
      redirect: "follow",
    });

    if (!pageRes.ok) {
      return res.status(404).json({ error: "Word not found on Cambridge", status: pageRes.status });
    }

    const html = await pageRes.text();
    let audioUrl = extractAudioUrl(html, accent);
    // If preferred accent missing, try the other one so the speaker still works.
    if (!audioUrl) {
      audioUrl = extractAudioUrl(html, accent === "us" ? "uk" : "us");
    }
    if (!audioUrl) {
      return res.status(404).json({ error: "No pronunciation audio for this word" });
    }

    const audioRes = await fetch(audioUrl, {
      headers: {
        "User-Agent": ua,
        Referer: pageUrl,
        Accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.5",
      },
    });

    if (!audioRes.ok) {
      return res.status(502).json({ error: "Failed to fetch Cambridge audio", status: audioRes.status });
    }

    const buf = Buffer.from(await audioRes.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
    res.setHeader("X-Cambridge-Accent", accent);
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({
      error: "Cambridge audio proxy error",
      message: String((e && e.message) || e),
    });
  }
}
