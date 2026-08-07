export function stretchArabicText(text, amount) {
  if (!text || !amount) return text;
  const isArabicLetter = (ch) => /[\u0600-\u06FF]/.test(ch);
  const isNonConnecting = (ch) => /[ادذرزوآأإؤةء]/.test(ch);
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    result += ch;
    if (i < text.length - 1) {
      const nextCh = text[i + 1];
      if (isArabicLetter(ch) && !isNonConnecting(ch) && isArabicLetter(nextCh) && nextCh !== " " && nextCh !== "ـ") {
        result += "ـ".repeat(amount);
      }
    }
  }
  return result;
}

export const hasArabic = (text) => /[\u0600-\u06FF]/.test(text || "");
