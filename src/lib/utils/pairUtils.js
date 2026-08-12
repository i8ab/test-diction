// Synonym / antonym pair list helpers.

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function normalizePairs(pairs, cfg) {
  if (!Array.isArray(pairs)) return [];
  return pairs
    .map((p) => {
      if (typeof p === "string") {
        return { id: makeId(), word: p, meaning: "" };
      }
      return {
        id: (p && p.id) || makeId(),
        word: (p && p.word) || "",
        meaning: (p && p.meaning) || "",
      };
    })
    .filter((p) => p.word.trim() || p.meaning.trim());
}

export function cleanPairs(pairs) {
  if (!Array.isArray(pairs)) return [];
  return pairs
    .map((p) => ({
      id: (p && p.id) || makeId(),
      word: String((p && p.word) || "").trim(),
      meaning: String((p && p.meaning) || "").trim(),
    }))
    .filter((p) => p.word);
}
