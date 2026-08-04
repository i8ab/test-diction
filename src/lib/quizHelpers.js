// Pure helper functions for building and scoring MCQ/typing quizzes,
// spaced-repetition (SRS) bookkeeping, and small id/date utilities.
// No React/JSX here — safe to import from any component.

import { tr } from "./i18n";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function quizRangeStart(key, customMinutes, sessionStart) {
  const now = Date.now();
  if (key === "all") return null;
  if (key === "session") return sessionStart || now;
  if (key === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (key === "custom") {
    const mins = Math.max(1, Math.min(10080, Number(customMinutes) || 0));
    return now - mins * 60000;
  }
  const presetMinutes = { "10": 10, "30": 30, "60": 60, "180": 180, "1440": 1440 };
  const mins = presetMinutes[key];
  return mins ? now - mins * 60000 : null;
}

// Studied entries whose "marked as studied" timestamp falls within the
// chosen range. Entries studied before this feature existed have no
// timestamp — they only show up under "Any time".
function selectQuizEntries(entries, studiedIds, studiedAt, rangeStart) {
  return entries.filter((e) => {
    if (!studiedIds.has(e.id)) return false;
    if (rangeStart == null) return true;
    const at = studiedAt[e.id];
    return typeof at === "number" && at >= rangeStart;
  });
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

// Picks up to `count` unique, non-empty values from `pool` that aren't in
// `excludeValues` (case-insensitive) — used to build plausible wrong
// answers for a multiple-choice question.
function pickDistractors(pool, excludeValues, count) {
  const excludeSet = new Set(excludeValues.filter(Boolean).map((v) => v.toLowerCase()));
  const seen = new Set();
  const unique = [];
  for (const v of pool) {
    if (!v) continue;
    const key = v.toLowerCase();
    if (excludeSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    unique.push(v);
  }
  return shuffleArray(unique).slice(0, count);
}

// Turns typed/target text into a comparable form: trimmed, lowercased,
// Arabic diacritics stripped. Shared by the typing-mode grader and by
// anything else that needs to compare two answers loosely.
function normalizeForTyping(s) {
  return (s || "").trim().toLowerCase().replace(/[\u064B-\u065F\u0670]/g, "");
}

// Typing-mode grading: correct if the normalized answer matches ANY of the
// accepted answers exactly, OR is a close-enough typo of one of them (using
// the same fuzzy-typo budget the search box uses). This is what makes
// typing mode forgiving of small spelling slips instead of demanding a
// keystroke-perfect match.
function isTypingCorrect(typed, acceptedAnswers) {
  const t = normalizeForTyping(typed);
  if (!t) return false;
  const list = (Array.isArray(acceptedAnswers) ? acceptedAnswers : [acceptedAnswers]).filter(Boolean);
  return list.some((raw) => {
    const a = normalizeForTyping(raw);
    if (!a) return false;
    if (t === a) return true;
    const budget = typoBudget(a.length);
    return budget > 0 && Math.abs(t.length - a.length) <= budget && levenshtein(t, a) <= budget;
  });
}

// Builds every applicable question for one studied entry — meaning,
// definition, a fill-in-the-blank from its example sentence (when one is
// available and actually contains the word), and synonyms/antonyms.
//
// `mode` changes how synonyms/antonyms are asked:
//  - "mcq": one question per synonym/antonym (as before) — no ambiguity,
//    since the user just picks from a fixed list of options.
//  - "typing": ONE combined question per word for "a synonym" / "an
//    antonym", accepting ANY word from that list as correct — because a
//    word can have several valid synonyms/antonyms and the user shouldn't
//    have to guess which single one the quiz had in mind.
function buildQuestionsForEntry(entry, allEntries, mode) {
  const sectionCfg = SECTIONS[entry.section] || SECTIONS["en-ar"];
  const sameSection = allEntries.filter((e) => e.section === entry.section && e.id !== entry.id);
  const otherPool = sameSection.length >= 3 ? sameSection : allEntries.filter((e) => e.id !== entry.id);
  const questions = [];

  // Word's own script/direction — stapled onto every question (regardless
  // of type) so the results review can always show the word correctly,
  // even for a "meaning_word" question whose prompt was the meaning.
  const wordDir = sectionCfg.wordDir, wordFont = sectionCfg.wordFont;

  const meaningDistractors = pickDistractors(otherPool.map((e) => e.meaning), [entry.meaning], 3);
  if (meaningDistractors.length >= 1) {
    questions.push({
      id: uid(), entryId: entry.id, word: entry.word, wordDir, wordFont, type: "word_meaning",
      promptText: entry.word, promptDir: sectionCfg.wordDir, promptFont: sectionCfg.wordFont,
      options: shuffleArray([entry.meaning, ...meaningDistractors]), correct: entry.meaning,
      acceptedAnswers: [entry.meaning],
      optionDir: sectionCfg.meaningDir, optionFont: sectionCfg.meaningFont,
    });
  }

  const wordDistractors = pickDistractors(otherPool.map((e) => e.word), [entry.word], 3);
  if (wordDistractors.length >= 1) {
    questions.push({
      id: uid(), entryId: entry.id, word: entry.word, wordDir, wordFont, type: "meaning_word",
      promptText: entry.meaning, promptDir: sectionCfg.meaningDir, promptFont: sectionCfg.meaningFont,
      options: shuffleArray([entry.word, ...wordDistractors]), correct: entry.word,
      acceptedAnswers: [entry.word],
      optionDir: sectionCfg.wordDir, optionFont: sectionCfg.wordFont,
    });
  }

  // Definition -> word. Only generated when the entry actually has a
  // written definition, so this doesn't fire for most words.
  if (entry.definition && entry.definition.trim()) {
    const defDistractors = pickDistractors(otherPool.map((e) => e.word), [entry.word], 3);
    if (defDistractors.length >= 1) {
      questions.push({
        id: uid(), entryId: entry.id, word: entry.word, wordDir, wordFont, type: "definition_word",
        promptText: entry.definition.trim(), promptDir: "rtl", promptFont: "'Amiri', serif",
        options: shuffleArray([entry.word, ...defDistractors]), correct: entry.word,
        acceptedAnswers: [entry.word],
        optionDir: sectionCfg.wordDir, optionFont: sectionCfg.wordFont,
      });
    }
  }

  // Fill-in-the-blank from the example sentence — only generated when an
  // example exists AND the word literally appears in it (no example, or a
  // conjugated/inflected form that doesn't match, means this is skipped).
  if (entry.example && entry.example.trim() && entry.word) {
    const idx = entry.example.toLowerCase().indexOf(entry.word.toLowerCase());
    if (idx !== -1) {
      const blanked = entry.example.slice(0, idx) + "ـــــ" + entry.example.slice(idx + entry.word.length);
      const blankDistractors = pickDistractors(otherPool.map((e) => e.word), [entry.word], 3);
      if (blankDistractors.length >= 1) {
        questions.push({
          id: uid(), entryId: entry.id, word: entry.word, wordDir, wordFont, type: "fill_blank",
          promptText: blanked, promptDir: wordDir, promptFont: wordFont,
          options: shuffleArray([entry.word, ...blankDistractors]), correct: entry.word,
          acceptedAnswers: [entry.word],
          optionDir: sectionCfg.wordDir, optionFont: sectionCfg.wordFont,
        });
      }
    }
  }

  // Synonyms/antonyms are stored as { word, meaning } pairs. The quiz asks
  // "which of these is a synonym/antonym of this word" — that's a
  // same-language question (e.g. an English word's English synonym), so
  // the word-language side is used here, never the Arabic meaning side.
  const synonymPairs = normalizePairs(entry.synonyms, sectionCfg).map((p) => p.word || p.meaning).filter(Boolean);
  const antonymPairs = normalizePairs(entry.antonyms, sectionCfg).map((p) => p.word || p.meaning).filter(Boolean);

  if (mode === "typing") {
    if (synonymPairs.length) {
      questions.push({
        id: uid(), entryId: entry.id, word: entry.word, wordDir, wordFont, type: "synonym",
        promptText: entry.word, promptDir: sectionCfg.wordDir, promptFont: sectionCfg.wordFont,
        options: [], correct: synonymPairs.join(" / "), acceptedAnswers: synonymPairs,
        optionDir: sectionCfg.wordDir, optionFont: sectionCfg.wordFont,
      });
    }
    if (antonymPairs.length) {
      questions.push({
        id: uid(), entryId: entry.id, word: entry.word, wordDir, wordFont, type: "antonym",
        promptText: entry.word, promptDir: sectionCfg.wordDir, promptFont: sectionCfg.wordFont,
        options: [], correct: antonymPairs.join(" / "), acceptedAnswers: antonymPairs,
        optionDir: sectionCfg.wordDir, optionFont: sectionCfg.wordFont,
      });
    }
  } else {
    for (const correct of synonymPairs) {
      const pool = [...antonymPairs, ...otherPool.map((e) => e.word)];
      const distractors = pickDistractors(pool, [...synonymPairs, entry.word], 3);
      if (distractors.length >= 1) {
        questions.push({
          id: uid(), entryId: entry.id, word: entry.word, wordDir, wordFont, type: "synonym",
          promptText: entry.word, promptDir: sectionCfg.wordDir, promptFont: sectionCfg.wordFont,
          options: shuffleArray([correct, ...distractors]), correct, acceptedAnswers: synonymPairs,
          optionDir: sectionCfg.wordDir, optionFont: sectionCfg.wordFont,
        });
      }
    }

    for (const correct of antonymPairs) {
      const pool = [...synonymPairs, ...otherPool.map((e) => e.word)];
      const distractors = pickDistractors(pool, [...antonymPairs, entry.word], 3);
      if (distractors.length >= 1) {
        questions.push({
          id: uid(), entryId: entry.id, word: entry.word, wordDir, wordFont, type: "antonym",
          promptText: entry.word, promptDir: sectionCfg.wordDir, promptFont: sectionCfg.wordFont,
          options: shuffleArray([correct, ...distractors]), correct, acceptedAnswers: antonymPairs,
          optionDir: sectionCfg.wordDir, optionFont: sectionCfg.wordFont,
        });
      }
    }
  }

  return questions;
}

// Builds the full shuffled question set for a quiz session. No cap on
// count — every question generated for the studied words is included, so
// nothing gets left untested, just shuffled into a random order. `mode`
// ("mcq" | "typing") is threaded through so synonym/antonym questions are
// built the right way for how they'll be graded (see buildQuestionsForEntry).
function buildQuiz(studiedEntries, allEntries, mode) {
  let all = [];
  for (const entry of studiedEntries) all = all.concat(buildQuestionsForEntry(entry, allEntries, mode));
  return shuffleArray(all);
}

function quizQuestionLabel(type, isAr) {
  switch (type) {
    case "word_meaning": return tr(isAr, "What does this word mean?", "ما معنى هذه الكلمة؟");
    case "meaning_word": return tr(isAr, "Which word matches this meaning?", "ما الكلمة التي تطابق هذا المعنى؟");
    case "definition_word": return tr(isAr, "Which word matches this definition?", "ما الكلمة التي يصفها هذا التعريف؟");
    case "fill_blank": return tr(isAr, "Fill in the blank", "أكمل الفراغ بالكلمة المناسبة");
    case "synonym": return tr(isAr, "Name a synonym of this word.", "اذكر مرادفًا لهذه الكلمة.");
    case "antonym": return tr(isAr, "Name an antonym of this word.", "اذكر ضدًا لهذه الكلمة.");
    default: return "";
  }
}

/* =========================================================================
   SPACED REPETITION (cumulative accuracy, not a streak)
   -------------------------------------------------------------------------
   Stored per-account per-word: srsStats = { correct, total } — every quiz
   answer adds to `total`, and to `correct` if it was right. Nothing ever
   resets on a wrong answer; a word's level is just correct/total so far.
   Levels:
     - New:       total === 0 (never quizzed yet)
     - Learning:  accuracy < 50%
     - Familiar:  50% <= accuracy < 100%
     - Mastered:  accuracy === 100% AND at least SRS_MASTERY_MIN_ATTEMPTS
                  answers given (so one lucky guess isn't "mastered")
   `srsDueAt` (next-review timestamp) is still tracked separately so the
   quiz's "due for review" filter keeps working: it's pushed further out
   the higher the current level is, and pulled back to "due now" on a
   wrong answer (even though the level itself doesn't reset).
   ========================================================================= */
const SRS_MASTERY_MIN_ATTEMPTS = 3;
const SRS_LEVEL_INTERVALS_MS = [
  10 * 60 * 1000,          // New/just answered wrong -> re-test soon
  12 * 60 * 60 * 1000,     // Learning -> re-test within half a day
  3 * 24 * 60 * 60 * 1000, // Familiar -> re-test in a few days
  7 * 24 * 60 * 60 * 1000, // Mastered -> re-test weekly, just to keep it fresh
];
const SRS_BOX_LABELS = [
  { en: "New", ar: "جديدة" },
  { en: "Learning", ar: "قيد التعلم" },
  { en: "Familiar", ar: "مألوفة" },
  { en: "Mastered", ar: "متقنة" },
];

// Turns a word's { correct, total } into one of the 4 levels above
// (indices matching SRS_BOX_LABELS / SRS_LEVEL_INTERVALS_MS).

function srsLevelFromStats(stats) {
  const total = (stats && stats.total) || 0;
  if (total === 0) return 0;
  const correct = (stats && stats.correct) || 0;
  const accuracy = correct / total;
  if (accuracy >= 1 && total >= SRS_MASTERY_MIN_ATTEMPTS) return 3;
  if (accuracy >= 0.5) return 2;
  return 1;
}

// True if a word is due for review right now: never quizzed, or its last
// due timestamp has passed. `srsDueAt` may be undefined/null-safe.
function isSrsDue(entryId, srsDueAt) {
  const due = srsDueAt && srsDueAt[entryId];
  return typeof due !== "number" || due <= Date.now();
}

// Groups a question type into the three results-review sections the user
// studies from afterwards: plain meaning, synonyms, antonyms.
function quizResultCategory(type) {
  if (type === "synonym") return "synonym";
  if (type === "antonym") return "antonym";
  return "meaning";
}

const QUIZ_RESULT_CATEGORIES = [
  { key: "meaning", label: "Meaning", labelAr: "المعنى" },
  { key: "synonym", label: "Synonyms", labelAr: "المرادفات" },
  { key: "antonym", label: "Antonyms", labelAr: "المضادات" },
];

// mm:ss (or h:mm:ss for long sessions) from a millisecond duration.
function formatQuizDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/* =========================================================================
   ADMIN ACTIVITY LOG
   -------------------------------------------------------------------------
   Every add/edit/delete of a word or account, and every sign in/out, gets
   appended here and saved alongside entries/accounts in the same shared
   record. Only rendered in the Admin panel (admins only). Capped so the
   shared bin doesn't grow forever.
   ========================================================================= */
const MAX_LOG_ENTRIES = 500;

function dateKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Consecutive days up to and including today that have at least one
// "studied" timestamp. A gap of a full day breaks the streak.
function computeStreak(studiedAt) {
  const days = new Set(Object.values(studiedAt || {}).map((t) => dateKey(t)));
  let streak = 0;
  let cursor = Date.now();
  // Today doesn't have to have activity yet for the streak to still count
  // up to yesterday — but if today's missing we start checking from
  // yesterday instead of breaking immediately on day 0.
  if (!days.has(dateKey(cursor))) cursor -= 24 * 60 * 60 * 1000;
  while (days.has(dateKey(cursor))) {
    streak += 1;
    cursor -= 24 * 60 * 60 * 1000;
  }
  return streak;
}

// Formats a future timestamp as a short relative label ("in 2 days",
// "in 3 hours"), or "Due now" if it's already passed. Used for the Stats
// panel's "upcoming reviews" list.
function formatDueIn(ms, isAr) {
  const diff = ms - Date.now();
  if (diff <= 0) return tr(isAr, "Due now", "مستحقة الآن");
  const mins = Math.round(diff / 60000);
  if (mins < 60) return tr(isAr, `in ${mins} min`, `بعد ${mins} دقيقة`);
  const hours = Math.round(diff / 3600000);
  if (hours < 24) return tr(isAr, `in ${hours} hr`, `بعد ${hours} ساعة`);
  const days = Math.round(diff / 86400000);
  return tr(isAr, `in ${days} day${days === 1 ? "" : "s"}`, `بعد ${days} يوم`);
}

export {
  uid,
  quizRangeStart, selectQuizEntries, shuffleArray, pickDistractors,
  normalizeForTyping, isTypingCorrect, buildQuestionsForEntry, buildQuiz,
  quizQuestionLabel, SRS_LEVEL_INTERVALS_MS, SRS_BOX_LABELS,
  srsLevelFromStats, isSrsDue, quizResultCategory, formatQuizDuration,
  dateKey, computeStreak, formatDueIn,
};
