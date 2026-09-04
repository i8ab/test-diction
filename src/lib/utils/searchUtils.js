// Search, letter keys, and text direction helpers.
import { getEntrySenses } from "./wordTypes";

export const EN_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const AR_LETTERS = [
  "ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش",
  "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي",
];

export function firstLetterKey(word, section) {
  if (!word) return "";
  const ch = String(word).trim().charAt(0);
  if (section === "ar-ar" || /[\u0600-\u06FF]/.test(ch)) {
    // Normalize Arabic alef variants
    const n = ch.replace(/[أإآٱ]/g, "ا").replace(/[ى]/g, "ي");
    return n;
  }
  return ch.toUpperCase();
}

function normalizeForSearch(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function fuzzyIncludes(haystack, needle) {
  const h = normalizeForSearch(haystack);
  const n = normalizeForSearch(needle);
  if (!n) return true;
  if (h.includes(n)) return true;
  // simple subsequence match for typos
  let i = 0;
  for (const ch of h) {
    if (ch === n[i]) i += 1;
    if (i >= n.length) return true;
  }
  return false;
}

export function matchScore(entry, query) {
  if (!query) return 0;
  const q = normalizeForSearch(query);
  const word = normalizeForSearch(entry.word);
  if (word === q) return 100;
  if (word.startsWith(q)) return 90;
  if (word.includes(q)) return 70;

  // A word can have several meanings/senses (multi-sense entries) — search
  // every one of them, not just the top-level (first) meaning, or a match
  // on a second/third meaning silently disappears from results.
  const senses = getEntrySenses(entry);
  const meanings = senses.length ? senses.map((s) => s.meaning) : [entry.meaning];
  const definitions = senses.length
    ? senses.map((s) => s.definition).filter(Boolean)
    : [entry.definition].filter(Boolean);

  let best = 0;
  for (const m of meanings) {
    const meaning = normalizeForSearch(m);
    if (meaning.startsWith(q)) best = Math.max(best, 60);
    else if (meaning.includes(q)) best = Math.max(best, 50);
    else if (fuzzyIncludes(meaning, q)) best = Math.max(best, 15);
  }
  for (const d of definitions) {
    const def = normalizeForSearch(d);
    if (def.includes(q)) best = Math.max(best, 30);
  }
  if (best) return best;
  if (fuzzyIncludes(word, q)) return 25;
  return 0;
}

export function detectDir(text) {
  if (!text) return "ltr";
  return /[\u0600-\u06FF]/.test(text) ? "rtl" : "ltr";
}

export function detectFont(text) {
  return detectDir(text) === "rtl" ? "'Amiri', serif" : "'Fraunces', serif";
}
