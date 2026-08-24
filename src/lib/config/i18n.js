// UI language helpers (site chrome — not dictionary content).
// Supported languages: English and Arabic only.
//
// tr() remains backward-compatible with the legacy boolean form used throughout
// the codebase (hundreds of call sites):
//   tr(isAr, en, ar)     // legacy boolean
//   tr(lang, en, ar)     // preferred string form ('en' | 'ar')
//
// German / French parameters that previously existed are intentionally removed.
// They were never selectable and created dead code.

export const UI_LANGS = [
  { id: "en", native: "English",  labelEn: "English" },
  { id: "ar", native: "العربية",  labelEn: "Arabic" },
];

export const UI_LANG_IDS = UI_LANGS.map((l) => l.id);

export function isRtlLang(lang) {
  return lang === "ar";
}

/**
 * Pick a translated string.
 * @param {boolean|string} locale - true/false (legacy isAr) or 'en' | 'ar'
 * @param {string} en - English string
 * @param {string} [ar] - Arabic string (falls back to English when missing)
 * @returns {string}
 */
export function tr(locale, en, ar) {
  let lang = "en";
  if (typeof locale === "boolean") {
    lang = locale ? "ar" : "en";
  } else if (typeof locale === "string" && locale) {
    lang = locale;
  }
  if (lang === "ar") return ar != null && ar !== "" ? ar : en;
  return en;
}

export default tr;
