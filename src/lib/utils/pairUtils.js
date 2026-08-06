// Synonym / antonym pair list helpers.

export function normalizePairs(pairs, cfg) {
  if (!Array.isArray(pairs)) return [];
  return pairs
    .map((p) => {
      if (typeof p === "string") return { word: p, meaning: "" };
      return {
        word: (p && p.word) || "",
        meaning: (p && p.meaning) || "",
      };
    })
    .filter((p) => p.word.trim());
}

export function cleanPairs(pairs) {
  if (!Array.isArray(pairs)) return [];
  return pairs
    .map((p) => ({
      word: String(p.word || "").trim(),
      meaning: String(p.meaning || "").trim(),
    }))
    .filter((p) => p.word);
}
