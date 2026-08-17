// UI language helpers (site chrome — not dictionary content).
// Supports: English, Arabic only.
//
// tr() is backward-compatible with the old boolean form:
//   tr(isAr, en, ar)           // legacy
//   tr(lang, en, ar, de, fr)   // de/fr args ignored (kept for call-site compatibility)

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
 * @param {boolean|string} locale - true/false (legacy isAr) or 'en'|'ar'
 * @param {string} en
 * @param {string} [ar]
 * @param {string} [de] - ignored (compat)
 * @param {string} [fr] - ignored (compat)
 */
export function tr(locale, en, ar, de, fr) {
  let lang = "en";
  if (typeof locale === "boolean") {
    lang = locale ? "ar" : "en";
  } else if (typeof locale === "string" && locale) {
    lang = locale;
  }
  if (lang === "ar") return ar != null && ar !== "" ? ar : en;
  // de/fr no longer selectable — fall back to English
  return en;
}

export default tr;
