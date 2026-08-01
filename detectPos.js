import { PRONOUNS_EN, ADJ_SUFFIXES, NOUN_SUFFIXES, ADVERB_SUFFIX, VERB_SUFFIXES } from "./englishLexicon.js";
import { PRONOUNS_AR, ADJECTIVE_PATTERNS_AR, looksLikeArabicVerb } from "./arabicLexicon.js";

// Only these five classes are surfaced to the UI — anything else the
// dictionary reports (preposition, conjunction, interjection…) is folded
// into "other" so the badge stays meaningful.
const KNOWN = new Set(["noun", "pronoun", "adjective", "adverb", "verb"]);

function normalizeApiPos(raw) {
  const p = String(raw || "").toLowerCase();
  if (p.startsWith("noun")) return "noun";
  if (p.startsWith("pronoun")) return "pronoun";
  if (p.startsWith("adjective")) return "adjective";
  if (p.startsWith("adverb")) return "adverb";
  if (p.startsWith("verb")) return "verb";
  return null;
}

function heuristicPosEnglish(word) {
  const w = word.toLowerCase();
  if (PRONOUNS_EN.has(w)) return "pronoun";
  if (w.endsWith(ADVERB_SUFFIX) && w.length > 4) return "adverb";
  for (const { suffix } of ADJ_SUFFIXES) {
    if (w.endsWith(suffix) && w.length > suffix.length + 1) return "adjective";
  }
  for (const suf of VERB_SUFFIXES) {
    if (w.endsWith(suf) && w.length > suf.length + 1) return "verb";
  }
  for (const suf of NOUN_SUFFIXES) {
    if (w.endsWith(suf) && w.length > suf.length + 1) return "noun";
  }
  return "noun";
}

// Looks the word up in a real, free dictionary (dictionaryapi.dev) and
// picks the sense with the most definitions — this is a genuine
// classification, not a guess. Falls back to the rule-based heuristic
// above only if the network/API is unavailable or the word isn't listed.
export async function detectPartOfSpeechEnglish(word) {
  const w = word.trim().toLowerCase();
  if (!w) return null;
  if (PRONOUNS_EN.has(w)) return { pos: "pronoun", source: "lookup" };

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);
    if (res.ok) {
      const data = await res.json();
      const tally = {};
      for (const entry of data || []) {
        for (const m of entry.meanings || []) {
          const p = normalizeApiPos(m.partOfSpeech);
          if (!p) continue;
          tally[p] = (tally[p] || 0) + Math.max(1, (m.definitions || []).length);
        }
      }
      const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
      if (best) return { pos: KNOWN.has(best[0]) ? best[0] : "other", source: "dictionary" };
    }
  } catch (e) {
    // offline / network hiccup — fall through to the heuristic
  }
  return { pos: heuristicPosEnglish(w), source: "heuristic" };
}

// Arabic has no free, reliable public POS-tagging API, so this is a
// rule-based morphological heuristic: fixed pronoun list first (closed
// class, always exact), then verb-shape checks, then common adjective
// awzān/patterns, then the adverbial تنوين النصب ending, defaulting to noun
// (the most common entry class in a bilingual dictionary) otherwise.
export function detectPartOfSpeechArabic(word) {
  const w = word.trim();
  if (!w) return null;
  if (PRONOUNS_AR.has(w)) return { pos: "pronoun", source: "lookup" };
  if (looksLikeArabicVerb(w)) return { pos: "verb", source: "heuristic" };
  for (const pattern of ADJECTIVE_PATTERNS_AR) {
    if (pattern.test(w)) return { pos: "adjective", source: "heuristic", note: pattern.label };
  }
  if (/(اً|ًا)$/.test(w)) return { pos: "adverb", source: "heuristic" };
  return { pos: "noun", source: "heuristic" };
}

export async function detectPartOfSpeech(word, isEnglish) {
  return isEnglish ? detectPartOfSpeechEnglish(word) : detectPartOfSpeechArabic(word);
}

export const POS_LABELS = {
  noun: { en: "Noun", ar: "اسم" },
  pronoun: { en: "Pronoun", ar: "ضمير" },
  adjective: { en: "Adjective", ar: "صفة" },
  adverb: { en: "Adverb", ar: "ظرف/حال" },
  verb: { en: "Verb", ar: "فعل" },
  other: { en: "Other", ar: "أخرى" },
};
