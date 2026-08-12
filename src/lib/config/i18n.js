// UI language helpers (site chrome — not dictionary content).
// Supports: English, Arabic, German, French.
//
// tr() is backward-compatible with the old boolean form:
//   tr(isAr, en, ar)           // legacy
//   tr(lang, en, ar, de, fr)   // preferred — missing de/fr fall back to en

export const UI_LANGS = [
  { id: "en", native: "English",  labelEn: "English" },
  { id: "ar", native: "العربية",  labelEn: "Arabic" },
  { id: "de", native: "Deutsch",  labelEn: "German" },
  { id: "fr", native: "Français", labelEn: "French" },
];

export const UI_LANG_IDS = UI_LANGS.map((l) => l.id);

export function isRtlLang(lang) {
  return lang === "ar";
}

/**
 * Pick a translated string.
 * @param {boolean|string} locale - true/false (legacy isAr) or 'en'|'ar'|'de'|'fr'
 * @param {string} en
 * @param {string} [ar]
 * @param {string} [de]
 * @param {string} [fr]
 */
export function tr(locale, en, ar, de, fr) {
  let lang = "en";
  if (typeof locale === "boolean") {
    lang = locale ? "ar" : "en";
  } else if (typeof locale === "string" && locale) {
    lang = locale;
  }
  if (lang === "ar") return ar != null && ar !== "" ? ar : en;
  if (lang === "de") return de != null && de !== "" ? de : en;
  if (lang === "fr") return fr != null && fr !== "" ? fr : en;
  return en;
}

export default tr;
