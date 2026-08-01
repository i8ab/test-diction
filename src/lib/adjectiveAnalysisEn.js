import { ADJ_SUFFIXES, ADJ_PREFIXES } from "./englishLexicon.js";

// Undoes the basic English spelling changes that happen when a suffix is
// attached, so we can show a plausible root (e.g. "beauty" -> "beautiful",
// "care" -> "careless", "response" -> "responsible").
function unstripSuffix(word, suffix) {
  let root = word.slice(0, -suffix.length);
  if (!root) return null;
  // e.g. "beautiful" -> stem "beauti" -> root "beauty"
  if (/i$/.test(root) && suffix !== "ing") return root.slice(0, -1) + "y";
  // e.g. "responsible" -> stem "respons" -> plausibly "response"
  if (suffix === "ible" && !/e$/.test(root)) return root + "e";
  return root;
}

export function analyzeEnglishAdjective(rawWord) {
  const word = rawWord.trim().toLowerCase();
  if (!word) return null;

  // Prefixes are checked first — they're unambiguous markers (un-, dis-,
  // im-...), whereas some short suffixes like "-y" can appear at the end
  // of a word that isn't actually derived that way (e.g. "unhappy").
  for (const { prefix, label, note } of ADJ_PREFIXES) {
    if (word.length > prefix.length + 2 && word.startsWith(prefix)) {
      const root = word.slice(prefix.length);
      return { word, affixType: "prefix", affix: label, note, root };
    }
  }
  // Suffixes checked longest-first (already ordered that way in the table)
  // so "-ability" wins over the shorter "-able" when both would match.
  for (const { suffix, label, note } of ADJ_SUFFIXES) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
      const root = unstripSuffix(word, suffix);
      if (root && root.length >= 2) {
        return { word, affixType: "suffix", affix: label, note, root };
      }
    }
  }
  return { word, affixType: "none", root: word };
}
