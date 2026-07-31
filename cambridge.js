// Server-side proxy for Cambridge Dictionary lookups.
//
// Cambridge's site doesn't send CORS headers, so the browser can't fetch it
// directly — this runs on Vercel's servers and does the fetch + HTML parsing,
// then hands the client back small, clean JSON:
//   { word, entries: [ { pos, examples: [...] }, ... ] }
//
// `pos` is the part of speech (noun, verb, adjective, ...) as Cambridge
// classifies it, and `examples` are real example sentences pulled straight
// from the dictionary entry for that part of speech. No API key needed —
// this is just an HTML fetch + parse, same as opening the page in a browser.

import * as cheerio from "cheerio";

export default async function handler(req, res) {
  const word = (req.query.word || "").toString().trim().toLowerCase();
  if (!word) {
    return res.status(400).json({ error: "Missing 'word' query parameter" });
  }

  const url = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word)}`;

  try {
    const r = await fetch(url, {
      headers: {
        // A normal browser UA — Cambridge blocks obvious bot/empty user agents.
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (r.status === 404) {
      return res.status(404).json({ error: "Word not found in Cambridge Dictionary" });
    }
    if (!r.ok) {
      console.error(`[api/cambridge] upstream fetch failed: ${r.status} ${r.statusText}`);
      return res.status(502).json({ error: "Upstream fetch failed" });
    }

    const html = await r.text();
    const $ = cheerio.load(html);

    const entries = [];
    const MAX_EXAMPLES_PER_POS = 4;

    // Each "entry-body__el" block is one part-of-speech entry for the word
    // (e.g. "run" has separate blocks for verb and noun).
    $(".pr.entry-body__el").each((_, el) => {
      const pos = $(el).find(".posgram .pos").first().text().trim();
      if (!pos) return;

      const examples = [];
      $(el)
        .find(".def-block .examp .eg")
        .each((__, exEl) => {
          if (examples.length >= MAX_EXAMPLES_PER_POS) return;
          const text = $(exEl).text().trim();
          if (text) examples.push(text);
        });

      const existing = entries.find((e) => e.pos === pos);
      if (existing) {
        for (const ex of examples) {
          if (existing.examples.length >= MAX_EXAMPLES_PER_POS) break;
          if (!existing.examples.includes(ex)) existing.examples.push(ex);
        }
      } else {
        entries.push({ pos, examples });
      }
    });

    // Fallback for pages whose markup doesn't split cleanly into
    // entry-body blocks — just grab any example sentences on the page.
    if (entries.length === 0) {
      const examples = [];
      $(".examp .eg").each((_, exEl) => {
        if (examples.length >= MAX_EXAMPLES_PER_POS) return;
        const text = $(exEl).text().trim();
        if (text) examples.push(text);
      });
      const pos = $(".posgram .pos").first().text().trim();
      if (examples.length || pos) entries.push({ pos, examples });
    }

    if (entries.length === 0) {
      return res.status(404).json({ error: "No dictionary entry found for that word" });
    }

    return res.status(200).json({ word, entries });
  } catch (e) {
    console.error("[api/cambridge] unexpected error:", e);
    return res.status(500).json({ error: "Lookup failed" });
  }
}
