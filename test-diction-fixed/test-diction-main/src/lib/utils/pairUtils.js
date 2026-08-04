// Synonym/antonym "pair" normalization — see normalizePairs() for the
// shapes it accepts and upgrades.
import { uid } from "./quizHelpers";

function normalizePairs(list, cfg) {
  if (!Array.isArray(list)) return [];
  const wordIsLtr = !cfg || cfg.wordDir === "ltr";
  return list
    .map((item) => {
      if (item && typeof item === "object") {
        if ("word" in item || "meaning" in item) {
          return { id: item.id || uid(), word: item.word || "", meaning: item.meaning || "" };
        }
        // legacy {en, ar} shape
        if (wordIsLtr) return { id: item.id || uid(), word: item.en || "", meaning: item.ar || "" };
        return { id: item.id || uid(), word: item.ar || item.en || "", meaning: item.ar ? "" : item.en || "" };
      }
      const str = String(item || "").trim();
      if (!str) return null;
      return { id: uid(), word: str, meaning: "" };
    })
    .filter(Boolean)
    .filter((p) => p.word || p.meaning);
}

export { normalizePairs };
