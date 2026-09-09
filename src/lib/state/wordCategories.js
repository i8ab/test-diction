/**
 * Word categories for the Baccalaureate Curriculum section — mirrors the
 * textbook's own vocabulary sections (Key Vocabulary, Important Vocabulary,
 * Definitions, ...) so words extracted from the book keep the same grouping
 * inside each Lesson, instead of one flat unsorted list.
 *
 * This is a fixed, app-wide list (unlike academicUnits / unitStructure,
 * which are admin-editable) because it mirrors a fixed textbook layout.
 * An entry carries at most one `categoryId` (see AiPdfExtractModal.jsx and
 * importWordsFromAi in entryMutations.js) — words with no categoryId are
 * simply uncategorized (older words, or words added by hand).
 */

export const WORD_CATEGORIES = [
  { id: "key-vocabulary", en: "Key Vocabulary", ar: "المفردات الرئيسية" },
  { id: "important-vocabulary", en: "Important Vocabulary", ar: "مفردات هامة" },
  { id: "definitions", en: "Definitions", ar: "التعريفات" },
  { id: "synonyms", en: "Synonyms", ar: "المترادفات" },
  { id: "antonyms", en: "Antonyms", ar: "المتضادات" },
  { id: "collocations", en: "Verbal Collocations", ar: "المتلازمات اللفظية" },
  { id: "idioms", en: "Expressions & Idioms", ar: "التعبيرات والمصطلحات" },
  { id: "verb-prep", en: "Verb + Preposition", ar: "فعل + حرف جر" },
  { id: "language-notes", en: "Language Notes", ar: "ملاحظات لغوية" },
];

export function categoryLabel(categoryId, isAr) {
  if (!categoryId) return "";
  const row = WORD_CATEGORIES.find((c) => c.id === categoryId);
  if (!row) return String(categoryId);
  return isAr ? row.ar : row.en;
}

export function findWordCategory(categoryId) {
  return WORD_CATEGORIES.find((c) => c.id === categoryId) || null;
}

/**
 * Best-effort mapping from whatever free-text heading the AI agent detected
 * in the book (e.g. "Important Vocabulary", "Synonyms & Antonyms", "Verb +
 * Preposition") onto one of our fixed categoryIds. Returns null when nothing
 * matches closely enough — the admin can still assign it by hand in the
 * review screen, same as an unresolved Section/Lesson.
 */
export function resolveDetectedCategory(raw) {
  const text = String(raw || "").trim().toLowerCase();
  if (!text) return null;

  const rules = [
    { id: "important-vocabulary", test: /important/ },
    { id: "key-vocabulary", test: /key\s*vocab/ },
    { id: "definitions", test: /definition/ },
    { id: "antonyms", test: /antonym/ },
    { id: "synonyms", test: /synonym/ },
    { id: "collocations", test: /collocation/ },
    { id: "idioms", test: /idiom|expression/ },
    { id: "verb-prep", test: /preposition|verb\s*\+|phrasal/ },
    { id: "language-notes", test: /language\s*note|note/ },
    // generic "vocabulary" fallback, checked last so more specific rules win
    { id: "key-vocabulary", test: /vocab/ },
  ];

  for (const rule of rules) {
    if (rule.test.test(text)) return rule.id;
  }
  return null;
}

/**
 * Which form fields make sense for a given category. Used by AddModal to
 * hide fields that don't belong in that book section — e.g. a word filed
 * under "Synonyms" only needs a synonym list, not a full definition +
 * example + antonyms card. `null` / unknown categoryId (including the two
 * general vocabulary categories) means "show everything", the old behavior.
 */
export function categoryFieldRules(categoryId) {
  const all = {
    meaning: true,
    pos: true,
    definition: true,
    example: true,
    synonyms: true,
    antonyms: true,
    notes: true,
    multiSense: true,
  };
  switch (categoryId) {
    case "definitions":
      return { ...all, synonyms: false, antonyms: false, multiSense: false };
    case "synonyms":
      return {
        meaning: true,
        pos: false,
        definition: false,
        example: false,
        synonyms: true,
        antonyms: false,
        notes: false,
        multiSense: false,
      };
    case "antonyms":
      return {
        meaning: true,
        pos: false,
        definition: false,
        example: false,
        synonyms: false,
        antonyms: true,
        notes: false,
        multiSense: false,
      };
    case "collocations":
    case "idioms":
    case "verb-prep":
      return { ...all, definition: false, synonyms: false, antonyms: false, multiSense: false };
    case "language-notes":
      return {
        meaning: true,
        pos: false,
        definition: false,
        example: false,
        synonyms: false,
        antonyms: false,
        notes: true,
        multiSense: false,
      };
    default:
      return all; // key-vocabulary, important-vocabulary, or no category selected
  }
}
