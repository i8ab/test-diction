// Part-of-speech tags for dictionary entries (single or multi-sense).

export const WORD_TYPES = [
  { id: "noun", en: "Noun", ar: "اسم" },
  { id: "verb", en: "Verb", ar: "فعل" },
  { id: "adjective", en: "Adjective", ar: "صفة" },
  { id: "adverb", en: "Adverb", ar: "حال" },
  { id: "preposition", en: "Preposition", ar: "حرف جر" },
  { id: "conjunction", en: "Conjunction", ar: "حرف عطف" },
  { id: "pronoun", en: "Pronoun", ar: "ضمير" },
  { id: "interjection", en: "Interjection", ar: "تعجب" },
  { id: "phrase", en: "Phrase", ar: "تعبير / جملة" },
  { id: "other", en: "Other", ar: "أخرى" },
  { id: "unclassified", en: "Unclassified", ar: "غير مصنّف" },
];

export function posLabel(pos, isAr) {
  if (!pos) return "";
  const row = WORD_TYPES.find((t) => t.id === pos);
  if (!row) return String(pos);
  return isAr ? row.ar : row.en;
}

function normalizePairs(items) {
  if (!Array.isArray(items) || !items.length) return [];
  return items
    .map((item) => {
      if (typeof item === "string" && item.trim()) return { word: item.trim() };
      if (item && typeof item === "object" && item.word) return { word: String(item.word).trim() };
      return null;
    })
    .filter(Boolean);
}

/**
 * Normalize an entry into a list of rich senses:
 * [{ id, pos, meaning, definition, example, examples, synonyms, antonyms }]
 *
 * Legacy entries (only top-level meaning) become one sense and inherit
 * top-level definition / examples / synonyms / antonyms.
 * Multi-sense entries prefer per-sense fields; top-level is used as fallback
 * only when there is a single sense.
 */
export function getEntrySenses(entry) {
  if (!entry) return [];

  if (Array.isArray(entry.senses) && entry.senses.length) {
    const multi = entry.senses.length > 1;
    return entry.senses
      .map((s, i) => {
        const meaning = String(s.meaning || "").trim();
        if (!meaning) return null;

        let examples = [];
        if (Array.isArray(s.examples) && s.examples.length) {
          examples = s.examples.map(String).filter(Boolean);
        } else if (s.example) {
          examples = [String(s.example)];
        } else if (!multi) {
          if (Array.isArray(entry.examples) && entry.examples.length) {
            examples = entry.examples.map(String).filter(Boolean);
          } else if (entry.example) {
            examples = [String(entry.example)];
          }
        }

        return {
          id: s.id || `s${i}`,
          pos: s.pos || entry.pos || "",
          meaning,
          definition:
            String(s.definition || (!multi ? entry.definition : "") || "").trim() || null,
          example: examples[0] || null,
          examples,
          synonyms: normalizePairs(
            s.synonyms || (!multi ? entry.synonyms : [])
          ),
          antonyms: normalizePairs(
            s.antonyms || (!multi ? entry.antonyms : [])
          ),
        };
      })
      .filter(Boolean);
  }

  const meaning = String(entry.meaning || "").trim();
  if (!meaning) return [];

  const examples =
    Array.isArray(entry.examples) && entry.examples.length
      ? entry.examples.map(String).filter(Boolean)
      : entry.example
        ? [String(entry.example)]
        : [];

  return [
    {
      id: "main",
      pos: entry.pos || "",
      meaning,
      definition: String(entry.definition || "").trim() || null,
      example: examples[0] || null,
      examples,
      synonyms: normalizePairs(entry.synonyms),
      antonyms: normalizePairs(entry.antonyms),
    },
  ];
}

/** Unique POS tags present on an entry (for badges). */
export function entryPosList(entry) {
  const senses = getEntrySenses(entry);
  const seen = [];
  for (const s of senses) {
    if (s.pos && !seen.includes(s.pos)) seen.push(s.pos);
  }
  if (!seen.length && entry && entry.pos) seen.push(entry.pos);
  return seen;
}
