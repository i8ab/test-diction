// Share / external dictionary links for a word entry.

export function cambridgeUrl(word) {
  const q = encodeURIComponent(String(word || "").trim());
  return `https://dictionary.cambridge.org/dictionary/english/${q}`;
}

export async function shareWordCard(entry, isAr) {
  if (!entry) return false;
  const title = entry.word || "";
  const text = isAr
    ? `${entry.word}\n${entry.meaning}${entry.example ? `\nمثال: ${entry.example}` : ""}`
    : `${entry.word}\n${entry.meaning}${entry.example ? `\nExample: ${entry.example}` : ""}`;

  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch (_) {
      /* user cancelled */
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    return false;
  }
}
