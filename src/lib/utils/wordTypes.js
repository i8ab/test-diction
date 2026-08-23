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

/**
 * Normalize an entry into a list of senses: [{ id, pos, meaning }].
 * Legacy entries with only top-level meaning become one sense.
 */
export function getEntrySenses(entry) {
  if (!entry) return [];
  if (Array.isArray(entry.senses) && entry.senses.length) {
    return entry.senses
      .map((s, i) => ({
        id: s.id || `s${i}`,
        pos: s.pos || entry.pos || "",
        meaning: String(s.meaning || "").trim(),
      }))
      .filter((s) => s.meaning);
  }
  const meaning = String(entry.meaning || "").trim();
  if (!meaning) return [];
  return [{ id: "main", pos: entry.pos || "", meaning }];
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
