// Best-effort conjugation for a regular (سالم) triliteral Arabic verb given
// in the ماضي (هو) form, e.g. "كتب", "لعب", "درس". Weak/hollow/doubled
// verbs (معتل، أجوف، مضعّف) don't follow these exact rules, so the result
// is clearly labeled as an approximation rather than presented as certain.

const PAST_SUFFIXES = [
  { key: "هو", suffix: "", label: "هو" },
  { key: "هي", suffix: "َتْ", label: "هي" },
  { key: "أنتَ", suffix: "ْتَ", label: "أنتَ" },
  { key: "أنتِ", suffix: "ْتِ", label: "أنتِ" },
  { key: "أنا", suffix: "ْتُ", label: "أنا" },
  { key: "نحن", suffix: "ْنَا", label: "نحن" },
  { key: "هما", suffix: "َا", label: "هما" },
  { key: "هم", suffix: "ُوا", label: "هم" },
  { key: "أنتم", suffix: "ْتُمْ", label: "أنتم" },
];

const PRESENT_PREFIXES = [
  { key: "هو", prefix: "يَ", suffix: "ُ", label: "هو" },
  { key: "هي", prefix: "تَ", suffix: "ُ", label: "هي" },
  { key: "أنتَ", prefix: "تَ", suffix: "ُ", label: "أنتَ" },
  { key: "أنتِ", prefix: "تَ", suffix: "ِينَ", label: "أنتِ" },
  { key: "أنا", prefix: "أَ", suffix: "ُ", label: "أنا" },
  { key: "نحن", prefix: "نَ", suffix: "ُ", label: "نحن" },
  { key: "هما", prefix: "يَ", suffix: "َانِ", label: "هما" },
  { key: "هم", prefix: "يَ", suffix: "ُونَ", label: "هم" },
];

const IMPERATIVE = [
  { key: "أنتَ", prefix: "اِ", suffix: "ْ", label: "أنتَ" },
  { key: "أنتِ", prefix: "اِ", suffix: "ِي", label: "أنتِ" },
  { key: "أنتم", prefix: "اِ", suffix: "ُوا", label: "أنتم" },
];

function triConsonantRoot(word) {
  // Strip common diacritics, keep the bare letters.
  const bare = word.replace(/[\u064B-\u0652]/g, "");
  return bare;
}

export function conjugateArabicVerb(rawWord) {
  const past = triConsonantRoot(rawWord.trim());
  if (past.length < 3) return null;
  const stem = past; // treat the whole given form as the ماضي هو stem, and
  // reuse it as-is for المضارع/الأمر — a reasonable approximation for the
  // regular (سالم) triliteral pattern, e.g. كتب -> يكتب / اكتب.

  const pastTable = PAST_SUFFIXES.map((p) => ({ label: p.label, form: stem + p.suffix }));
  const presentTable = PRESENT_PREFIXES.map((p) => ({
    label: p.label,
    form: p.prefix + stem + p.suffix,
  }));
  const imperativeTable = IMPERATIVE.map((p) => ({
    label: p.label,
    form: p.prefix + stem + p.suffix,
  }));

  return {
    root: stem,
    approximate: true,
    tenses: [
      { name: "الماضي", rows: pastTable },
      { name: "المضارع", rows: presentTable },
      { name: "الأمر", rows: imperativeTable },
    ],
  };
}
