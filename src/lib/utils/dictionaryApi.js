// Free English dictionary lookup (dictionaryapi.dev).
// Auto-fill returns ONE definition + ONE example that best match the
// user-provided meaning (when available), taken from the same sense.

export class DictionaryLookupError extends Error {
  constructor(message) {
    super(message);
    this.name = "DictionaryLookupError";
  }
}

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s) {
  return normalizeText(s).split(" ").filter((w) => w.length > 1);
}

/** Score how well a definition matches a meaning string (higher = better). */
function scoreMatch(definition, meaning) {
  const def = normalizeText(definition);
  const mean = normalizeText(meaning);
  if (!def || !mean) return 0;
  if (def === mean) return 1000;
  if (def.includes(mean) || mean.includes(def)) return 500;

  const defTokens = new Set(tokenize(def));
  const meanTokens = tokenize(mean);
  if (!meanTokens.length || !defTokens.size) return 0;

  let overlap = 0;
  for (const t of meanTokens) {
    if (defTokens.has(t)) overlap += 1;
    // partial stem-ish: token starts with same 4 chars
    else if (t.length >= 4) {
      for (const d of defTokens) {
        if (d.length >= 4 && (d.startsWith(t.slice(0, 4)) || t.startsWith(d.slice(0, 4)))) {
          overlap += 0.5;
          break;
        }
      }
    }
  }
  return overlap / meanTokens.length;
}

function looksArabic(s) {
  return /[\u0600-\u06FF]/.test(String(s || ""));
}

/** Best-effort translate Arabic → English via MyMemory (no API key). */
async function translateArToEn(text) {
  const q = String(text || "").trim();
  if (!q) return "";
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=ar|en`;
    const res = await fetch(url);
    if (!res.ok) return "";
    const data = await res.json();
    const translated = data && data.responseData && data.responseData.translatedText;
    if (!translated || /MYMEMORY WARNING/i.test(translated)) return "";
    return String(translated).trim();
  } catch (_) {
    return "";
  }
}

/**
 * Auto-fill payload: exactly one definition + one example.
 * Prefer the sense whose definition matches `meaning` (Arabic or English).
 * The example is always taken from the same definition object when possible.
 *
 * @param {string} word
 * @param {{ meaning?: string }} [opts]
 * @returns {Promise<{ definition: string, example: string, definitions: string[], examples: string[] }>}
 */
export async function fetchDictionarySuggestion(word, opts = {}) {
  const q = String(word || "").trim();
  if (!q) throw new DictionaryLookupError("empty");
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q)}`;
  let res;
  try {
    res = await fetch(url);
  } catch (_) {
    throw new DictionaryLookupError("network");
  }
  if (res.status === 404) throw new DictionaryLookupError("not_found");
  if (!res.ok) throw new DictionaryLookupError("http");
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) throw new DictionaryLookupError("not_found");

  // Collect senses as pairs so example stays tied to its definition.
  /** @type {{ definition: string, example: string, pos: string }[]} */
  const senses = [];
  for (const entry of data) {
    for (const m of entry.meanings || []) {
      const pos = String(m.partOfSpeech || "").trim();
      for (const d of m.definitions || []) {
        const def = String(d.definition || "").trim();
        if (!def) continue;
        const ex = String(d.example || "").trim();
        senses.push({ definition: def, example: ex, pos });
      }
    }
  }

  if (!senses.length) {
    return { definition: "", example: "", definitions: [], examples: [] };
  }

  const rawMeaning = String(opts.meaning || "").trim();
  let matchAgainst = rawMeaning;

  // If the user wrote an Arabic meaning, translate it so we can score English defs.
  if (rawMeaning && looksArabic(rawMeaning)) {
    const translated = await translateArToEn(rawMeaning);
    if (translated) matchAgainst = translated;
  }

  let best = senses[0];
  let bestScore = -1;

  if (matchAgainst) {
    for (const s of senses) {
      let score = scoreMatch(s.definition, matchAgainst);
      // Small bonus if this sense has an example (prefer usable pairs)
      if (s.example) score += 0.05;
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    // If nothing meaningfully matched, fall back to first sense that has an example, else first.
    if (bestScore <= 0) {
      best = senses.find((s) => s.example) || senses[0];
    }
  } else {
    // No meaning provided → first sense with an example, else first definition.
    best = senses.find((s) => s.example) || senses[0];
  }

  return {
    definition: best.definition || "",
    example: best.example || "",
    // Keep arrays for backward compatibility, but only the chosen pair.
    definitions: best.definition ? [best.definition] : [],
    examples: best.example ? [best.example] : [],
  };
}
