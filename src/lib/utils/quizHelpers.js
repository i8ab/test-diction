import { getEntrySenses, posLabel } from "./wordTypes";
// SRS + quiz helpers shared across Quiz, Stats, MainView, App.

export function uid() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffleArray(arr) {
  const a = [...(arr || [])];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Local calendar day key: "YYYY-M-D" (month is 0-based like Date#getMonth). */
export function dateKey(ms = Date.now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Intervals (ms) for SRS boxes 0..5 */
export const SRS_LEVEL_INTERVALS_MS = [
  10 * 60 * 1000, // 0 — 10 min (relearn)
  1 * 60 * 60 * 1000, // 1 — 1 hour
  24 * 60 * 60 * 1000, // 2 — 1 day
  3 * 24 * 60 * 60 * 1000, // 3 — 3 days
  7 * 24 * 60 * 60 * 1000, // 4 — 1 week
  30 * 24 * 60 * 60 * 1000, // 5 — ~1 month
];

export const SRS_BOX_LABELS = [
  { en: "Relearn", ar: "إعادة" },
  { en: "1 hour", ar: "ساعة" },
  { en: "1 day", ar: "يوم" },
  { en: "3 days", ar: "٣ أيام" },
  { en: "1 week", ar: "أسبوع" },
  { en: "Mastered", ar: "متقن" },
];

/**
 * Map cumulative correct/total stats to an SRS box level 0..5.
 * Never decreases on correct answers; level is based on accuracy + volume.
 */
export function srsLevelFromStats(stats) {
  if (!stats || !stats.total) return 0;
  const { correct = 0, total = 0 } = stats;
  const ratio = correct / total;
  if (total < 2 || ratio < 0.5) return 0;
  if (total < 4 || ratio < 0.65) return 1;
  if (total < 6 || ratio < 0.75) return 2;
  if (total < 10 || ratio < 0.85) return 3;
  if (ratio < 0.92) return 4;
  return 5;
}

export function isSrsDue(entryId, srsDueAt) {
  if (!srsDueAt || srsDueAt[entryId] == null) return true; // never scheduled → treat as due
  return Number(srsDueAt[entryId]) <= Date.now();
}

export function formatDueIn(dueMs, isAr) {
  if (dueMs == null) return isAr ? "مستحق" : "Due";
  const diff = dueMs - Date.now();
  if (diff <= 0) return isAr ? "الآن" : "Now";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return isAr ? `${mins} د` : `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return isAr ? `${hours} س` : `${hours}h`;
  const days = Math.round(hours / 24);
  return isAr ? `${days} ي` : `${days}d`;
}

/** Consecutive days ending today (or yesterday if today empty) from studiedAt map */
export function computeStreak(studiedAt) {
  const days = new Set();
  for (const t of Object.values(studiedAt || {})) {
    if (typeof t !== "number") continue;
    const d = new Date(t);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  if (!days.size) return 0;
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // Allow streak to count if last activity was yesterday (still "active")
  const todayKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
  if (!days.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
    const yKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
    if (!days.has(yKey)) return 0;
  }
  while (true) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
    if (!days.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function quizRangeStart(rangeKey, customMinutes, sessionStart) {
  const now = Date.now();
  if (rangeKey === "all") return 0;
  if (rangeKey === "session") return sessionStart || 0;
  if (rangeKey === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (rangeKey === "custom") {
    const m = Math.max(1, Number(customMinutes) || 60);
    return now - m * 60 * 1000;
  }
  const mins = Number(rangeKey) || 60;
  return now - mins * 60 * 1000;
}

export function selectQuizEntries(entries, studiedIds, studiedAt, rangeStart) {
  const set = studiedIds instanceof Set ? studiedIds : new Set(studiedIds || []);
  return (entries || []).filter((e) => {
    if (!set.has(e.id)) return false;
    const at = studiedAt && studiedAt[e.id];
    if (rangeStart && typeof at === "number" && at < rangeStart) return false;
    return true;
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pairWords(pairs) {
  if (!Array.isArray(pairs)) return [];
  return pairs
    .map((p) => (typeof p === "string" ? p : (p && p.word) || ""))
    .map((w) => String(w || "").trim())
    .filter(Boolean);
}

function uniqueStrings(list) {
  const seen = new Set();
  const out = [];
  for (const s of list) {
    const t = String(s || "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Build 5 options with exactly 2 correct answers (for multi-select). */
function buildMultiOptions(corrects, distractorPool, sameEntrySet) {
  const two = shuffle(corrects).slice(0, 2);
  const distractors = shuffle(
    distractorPool.filter((m) => m && !two.includes(m) && !sameEntrySet.has(m))
  ).slice(0, 3);
  // pad if pool is thin
  while (distractors.length < 3 && distractorPool.length > distractors.length) {
    const extra = distractorPool[Math.floor(Math.random() * distractorPool.length)];
    if (extra && !two.includes(extra) && !distractors.includes(extra) && !sameEntrySet.has(extra)) {
      distractors.push(extra);
    } else break;
  }
  return { corrects: two, options: shuffle([...two, ...distractors]).slice(0, 5) };
}

export function buildQuiz(matchingEntries, allEntries, mode) {
  if (!matchingEntries || matchingEntries.length < 1) return [];
  if (mode === "cloze") return buildClozeQuiz(matchingEntries, allEntries, 25);
  const pool = matchingEntries.length >= 4 ? matchingEntries : allEntries || matchingEntries;

  // Collect global pools for distractors
  const allMeanings = [];
  const allSynonyms = [];
  const allAntonyms = [];
  for (const e of pool) {
    for (const s of getEntrySenses(e)) {
      if (s.meaning) allMeanings.push(s.meaning);
    }
    if (e.meaning && !allMeanings.includes(e.meaning)) allMeanings.push(e.meaning);
    for (const w of pairWords(e.synonyms)) allSynonyms.push(w);
    for (const w of pairWords(e.antonyms)) allAntonyms.push(w);
  }

  const questions = [];
  const seenEntryMeaning = new Set(); // avoid duplicate multi-meaning Qs per entry

  for (const entry of shuffle(matchingEntries.slice(0, 40))) {
    const isArWord = entry.section === "ar-ar";
    const wordDir = isArWord ? "rtl" : "ltr";
    const wordFont = isArWord ? "'Amiri', serif" : "'Fraunces', serif";
    const meaningDir = "rtl";
    const meaningFont = "'Amiri', serif";
    const senses = getEntrySenses(entry);
    const senseMeanings = uniqueStrings(senses.map((s) => s.meaning));
    if (entry.meaning) {
      const m = String(entry.meaning).trim();
      if (m && !senseMeanings.includes(m)) senseMeanings.push(m);
    }
    const sameEntryMeanings = new Set(senseMeanings);
    const syns = uniqueStrings(pairWords(entry.synonyms));
    const ants = uniqueStrings(pairWords(entry.antonyms));

    // ——— Multi-meaning: 5 options, 2 correct (pick both) ———
    if (mode === "mcq" && senseMeanings.length >= 2 && !seenEntryMeaning.has(entry.id)) {
      seenEntryMeaning.add(entry.id);
      const { corrects, options } = buildMultiOptions(senseMeanings, allMeanings, sameEntryMeanings);
      if (corrects.length === 2 && options.length >= 4) {
        questions.push({
          id: `${entry.id}:multi-meaning`,
          entryId: entry.id,
          word: entry.word,
          meaning: corrects.join(" / "),
          correct: corrects[0], // primary for backward compat
          correctAnswers: corrects,
          correctAnswer: corrects.join(" | "),
          acceptedAnswers: senseMeanings,
          options,
          selectCount: 2,
          multi: true,
          type: "meaning",
          mode: "mcq",
          pos: (senses[0] && senses[0].pos) || "",
          promptText: entry.word,
          promptDir: wordDir,
          promptFont: wordFont,
          optionDir: meaningDir,
          optionFont: meaningFont,
          wordDir,
          wordFont,
        });
        continue; // don't also emit single-sense meaning Qs for this entry
      }
    }

    // ——— Single-sense meaning questions (word has only 1 meaning) ———
    if (senseMeanings.length < 2) {
      for (const sense of senses) {
        const correct = (sense.meaning || "").trim();
        if (!correct) continue;
        let options = [correct];
        if (mode === "mcq") {
          const distractors = shuffle(
            allMeanings.filter((m) => m && m !== correct && !sameEntryMeanings.has(m))
          ).slice(0, 3);
          while (distractors.length < 3 && allMeanings.length > distractors.length + 1) {
            const extra = allMeanings[Math.floor(Math.random() * allMeanings.length)];
            if (extra && extra !== correct && !distractors.includes(extra)) distractors.push(extra);
            else break;
          }
          options = shuffle([correct, ...distractors]).slice(0, 4);
        }
        questions.push({
          id: `${entry.id}:${sense.id || correct}`,
          entryId: entry.id,
          word: entry.word,
          meaning: correct,
          correct,
          correctAnswers: [correct],
          correctAnswer: correct,
          acceptedAnswers: senseMeanings.length ? senseMeanings : [correct],
          options,
          selectCount: 1,
          multi: false,
          type: "meaning",
          mode,
          pos: sense.pos || "",
          promptText: entry.word,
          promptDir: wordDir,
          promptFont: wordFont,
          optionDir: meaningDir,
          optionFont: meaningFont,
          wordDir,
          wordFont,
        });
      }
    }

    // ——— Multi-synonym: 5 options, 2 correct ———
    if (mode === "mcq" && syns.length >= 2) {
      const sameSyn = new Set(syns);
      const { corrects, options } = buildMultiOptions(syns, allSynonyms, sameSyn);
      if (corrects.length === 2 && options.length >= 4) {
        questions.push({
          id: `${entry.id}:multi-syn`,
          entryId: entry.id,
          word: entry.word,
          meaning: corrects.join(" / "),
          correct: corrects[0],
          correctAnswers: corrects,
          correctAnswer: corrects.join(" | "),
          acceptedAnswers: syns,
          options,
          selectCount: 2,
          multi: true,
          type: "synonym",
          mode: "mcq",
          pos: "",
          promptText: entry.word,
          promptDir: wordDir,
          promptFont: wordFont,
          optionDir: wordDir,
          optionFont: wordFont,
          wordDir,
          wordFont,
        });
      }
    }

    // ——— Multi-antonym: 5 options, 2 correct ———
    if (mode === "mcq" && ants.length >= 2) {
      const sameAnt = new Set(ants);
      const { corrects, options } = buildMultiOptions(ants, allAntonyms, sameAnt);
      if (corrects.length === 2 && options.length >= 4) {
        questions.push({
          id: `${entry.id}:multi-ant`,
          entryId: entry.id,
          word: entry.word,
          meaning: corrects.join(" / "),
          correct: corrects[0],
          correctAnswers: corrects,
          correctAnswer: corrects.join(" | "),
          acceptedAnswers: ants,
          options,
          selectCount: 2,
          multi: true,
          type: "antonym",
          mode: "mcq",
          pos: "",
          promptText: entry.word,
          promptDir: wordDir,
          promptFont: wordFont,
          optionDir: wordDir,
          optionFont: wordFont,
          wordDir,
          wordFont,
        });
      }
    }
  }

  return shuffle(questions).slice(0, 30);
}

/**
 * Flexible answer normalization for Arabic + English.
 * - strips tashkeel / diacritics
 * - unifies أ/إ/آ → ا , ة → ه , ى → ي
 * - strips leading ال (and common prefixes وال/بال/…) from each token
 * - strips English articles the/a/an
 * - lowercases, drops punctuation, collapses spaces
 */
export function normalizeAnswer(s) {
  let t = String(s || "")
    .trim()
    .toLowerCase()
    // Arabic diacritics + tatweel
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    // Alef variants → ا
    .replace(/[أإآٱ]/g, "ا")
    // ة → ه , ى → ي
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    // Drop punctuation (keep letters/numbers/spaces)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!t) return "";

  // Per-token: strip Arabic ال and English articles
  t = t
    .split(" ")
    .map((tok) => {
      if (!tok) return "";
      // Arabic definite article / common clitics
      if (/^(وال|بال|كال|فال|لل|ال)/.test(tok) && tok.length > 3) {
        tok = tok.replace(/^(وال|بال|كال|فال|لل|ال)/, "");
      } else if (tok.startsWith("ال") && tok.length > 2) {
        tok = tok.slice(2);
      }
      if (tok === "the" || tok === "a" || tok === "an") return "";
      return tok;
    })
    .filter(Boolean)
    .join(" ");

  return t;
}

/**
 * True if the typed answer matches any accepted answer flexibly:
 * exact (after norm), or either side contains the other (min length 2).
 */
export function isTypingCorrect(typed, correct) {
  if (!typed || !correct) return false;
  const t = normalizeAnswer(typed);
  if (!t) return false;
  const list = Array.isArray(correct) ? correct : [correct];
  return list.some((c) => {
    if (!c) return false;
    const n = normalizeAnswer(c);
    if (!n) return false;
    if (t === n) return true;
    if (t.length >= 2 && n.length >= 2) {
      if (t.includes(n) || n.includes(t)) return true;
      const ts = t.replace(/\s+/g, "");
      const ns = n.replace(/\s+/g, "");
      if (ts === ns) return true;
      if (ts.length >= 3 && ns.length >= 3 && (ts.includes(ns) || ns.includes(ts))) return true;
    }
    return false;
  });
}

export function quizQuestionLabel(modeOrType, isAr, pos, multi = false) {
  let base;
  const t = modeOrType || "mcq";
  if (t === "cloze") {
    base = isAr ? "أكمل الفراغ بالكلمة الصحيحة" : "Fill in the blank with the correct word";
  } else if (t === "typing") {
    base = isAr ? "اكتب المعنى" : "Type the meaning";
  } else if (t === "synonym") {
    base = multi
      ? (isAr ? "اختر مرادفين صحيحين" : "Pick two correct synonyms")
      : (isAr ? "اختر المرادف الصحيح" : "Pick the correct synonym");
  } else if (t === "antonym") {
    base = multi
      ? (isAr ? "اختر مضادين صحيحين" : "Pick two correct antonyms")
      : (isAr ? "اختر المضاد الصحيح" : "Pick the correct antonym");
  } else if (t === "meaning" || t === "mcq") {
    base = multi
      ? (isAr ? "اختر معنيين صحيحين" : "Pick two correct meanings")
      : (isAr ? "اختر المعنى الصحيح" : "Pick the correct meaning");
  } else {
    base = isAr ? "اختر الإجابة الصحيحة" : "Pick the correct answer";
  }
  if (!pos) return base;
  const tag = posLabel(pos, isAr);
  if (!tag) return base;
  return isAr ? `${base} — دي (${tag})` : `${base} — as a ${tag}`;
}

export const QUIZ_RESULT_CATEGORIES = [
  { key: "perfect", min: 0.95, en: "Perfect", ar: "ممتاز" },
  { key: "great", min: 0.8, en: "Great", ar: "رائع" },
  { key: "good", min: 0.6, en: "Good", ar: "جيد" },
  { key: "ok", min: 0.4, en: "Keep going", ar: "كمّل" },
  { key: "retry", min: 0, en: "Try again", ar: "حاول تاني" },
];

export function quizResultCategory(correct, total) {
  if (!total) return QUIZ_RESULT_CATEGORIES[QUIZ_RESULT_CATEGORIES.length - 1];
  const r = correct / total;
  return QUIZ_RESULT_CATEGORIES.find((c) => r >= c.min) || QUIZ_RESULT_CATEGORIES[QUIZ_RESULT_CATEGORIES.length - 1];
}

export function formatQuizDuration(ms, isAr) {
  if (!ms || ms < 0) return isAr ? "—" : "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return isAr ? `${s} ث` : `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return isAr ? `${m}:${String(rem).padStart(2, "0")}` : `${m}:${String(rem).padStart(2, "0")}`;
}

/**
 * Words that still need work: studied + SRS box 0 or 1 (or never quizzed).
 * Sorted weakest / oldest-studied first.
 */
export function selectWeakEntries(entries, studiedIds, srsBox, studiedAt, limit = 40) {
  const set = studiedIds instanceof Set ? studiedIds : new Set(studiedIds || []);
  const list = (entries || []).filter((e) => {
    if (!set.has(e.id)) return false;
    const box = (srsBox && srsBox[e.id]) || 0;
    return box <= 1;
  });
  list.sort((a, b) => {
    const ba = (srsBox && srsBox[a.id]) || 0;
    const bb = (srsBox && srsBox[b.id]) || 0;
    if (ba !== bb) return ba - bb;
    return (studiedAt?.[a.id] || 0) - (studiedAt?.[b.id] || 0);
  });
  return limit ? list.slice(0, limit) : list;
}

/**
 * Due + weak combined pool for Exam Mode (unique by id).
 */
export function selectExamPool(entries, studiedIds, srsDueAt, srsBox, studiedAt, limit = 40) {
  const set = studiedIds instanceof Set ? studiedIds : new Set(studiedIds || []);
  const map = new Map();
  for (const e of entries || []) {
    if (!set.has(e.id)) continue;
    const due = isSrsDue(e.id, srsDueAt);
    const box = (srsBox && srsBox[e.id]) || 0;
    if (due || box <= 1) map.set(e.id, e);
  }
  const list = [...map.values()];
  list.sort((a, b) => {
    const ba = (srsBox && srsBox[a.id]) || 0;
    const bb = (srsBox && srsBox[b.id]) || 0;
    if (ba !== bb) return ba - bb;
    const da = isSrsDue(a.id, srsDueAt) ? 0 : 1;
    const db = isSrsDue(b.id, srsDueAt) ? 0 : 1;
    if (da !== db) return da - db;
    return (studiedAt?.[a.id] || 0) - (studiedAt?.[b.id] || 0);
  });
  return limit ? list.slice(0, limit) : list;
}

/** Pick a usable example sentence from an entry (primary or extra). */
export function pickEntryExample(entry) {
  if (!entry) return "";
  const primary = String(entry.example || "").trim();
  if (primary) return primary;
  const extras = Array.isArray(entry.examples) ? entry.examples : [];
  for (const ex of extras) {
    const t = String(ex || "").trim();
    if (t) return t;
  }
  return "";
}

/**
 * Build a cloze (fill-in-the-blank) sentence from an example.
 * Replaces the target word (case-insensitive, whole-ish word) with a blank.
 * Returns { sentence, blanked, ok } — ok=false if no good blank could be made.
 */
export function makeClozeFromExample(example, word) {
  const ex = String(example || "").trim();
  const w = String(word || "").trim();
  if (!ex || !w) return { sentence: ex, blanked: "", ok: false };

  // Escape regex special chars in the word
  const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match whole word-ish (allow Arabic/Latin letters around boundaries loosely)
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})([^\\p{L}\\p{N}]|$)`, "iu");
  if (!re.test(ex)) {
    // Fallback: simple includes (first occurrence)
    const lower = ex.toLowerCase();
    const idx = lower.indexOf(w.toLowerCase());
    if (idx < 0) return { sentence: ex, blanked: "", ok: false };
    const blanked =
      ex.slice(0, idx) + "______" + ex.slice(idx + w.length);
    return { sentence: ex, blanked, ok: true };
  }
  const blanked = ex.replace(re, (_, a, _w, b) => `${a}______${b}`);
  return { sentence: ex, blanked, ok: true };
}

/**
 * Build cloze questions. Falls back to typing-the-word if no example works.
 * Correct answer is the word itself (not the meaning).
 */
export function buildClozeQuiz(matchingEntries, allEntries, limit = 20) {
  if (!matchingEntries || matchingEntries.length < 1) return [];
  const pool = matchingEntries.length >= 4 ? matchingEntries : allEntries || matchingEntries;

  const items = shuffle([...matchingEntries]).slice(0, Math.min(40, matchingEntries.length));
  const questions = [];

  for (const entry of items) {
    if (questions.length >= limit) break;
    const isArWord = entry.section === "ar-ar";
    const wordDir = isArWord ? "rtl" : "ltr";
    const wordFont = isArWord ? "'Amiri', serif" : "'Fraunces', serif";
    const example = pickEntryExample(entry);
    const cloze = makeClozeFromExample(example, entry.word);

    if (cloze.ok) {
      questions.push({
        id: `${entry.id}:cloze`,
        entryId: entry.id,
        word: entry.word,
        meaning: (getEntrySenses(entry)[0] || {}).meaning || entry.meaning || "",
        correct: entry.word,
        correctAnswer: entry.word,
        acceptedAnswers: [entry.word],
        options: [],
        type: "cloze",
        mode: "cloze",
        pos: entry.pos || "",
        promptText: cloze.blanked,
        promptDir: wordDir,
        promptFont: wordFont,
        optionDir: wordDir,
        optionFont: wordFont,
        wordDir,
        wordFont,
        clozeSentence: cloze.blanked,
        fullExample: cloze.sentence,
      });
    } else {
      // No usable example → ask to type the word from its meaning (reverse)
      const sense = getEntrySenses(entry)[0];
      const meaning = (sense && sense.meaning) || entry.meaning || "";
      if (!meaning) continue;
      questions.push({
        id: `${entry.id}:cloze-fallback`,
        entryId: entry.id,
        word: entry.word,
        meaning,
        correct: entry.word,
        correctAnswer: entry.word,
        acceptedAnswers: [entry.word],
        options: [],
        type: "cloze",
        mode: "cloze",
        pos: (sense && sense.pos) || entry.pos || "",
        promptText: meaning,
        promptDir: "rtl",
        promptFont: "'Amiri', serif",
        optionDir: wordDir,
        optionFont: wordFont,
        wordDir,
        wordFont,
        clozeSentence: "",
        fullExample: "",
        clozeFallback: true,
      });
    }
  }
  return shuffle(questions);
}


// ─── SM-2 style SRS (backward-compatible with box levels) ───────────────────
// Per-card state shape stored in account.srsCards[id]:
//   { ease: number, interval: number /*days*/, reps: number, lapses: number, dueAt: number }

export const SRS_DEFAULT_EASE = 2.5;
export const SRS_MIN_EASE = 1.3;

/** Load custom interval multipliers (user preference). Keys: learning, graduating, easyBonus */
const SRS_PREFS_KEY = "twoTongues.srsPrefs";

export function loadSrsPrefs() {
  try {
    const raw = localStorage.getItem(SRS_PREFS_KEY);
    if (!raw) return { learningMinutes: 10, graduatingDays: 1, easyBonus: 1.3, hardFactor: 1.2 };
    const p = JSON.parse(raw);
    return {
      learningMinutes: Math.max(1, Number(p.learningMinutes) || 10),
      graduatingDays: Math.max(1, Number(p.graduatingDays) || 1),
      easyBonus: Math.max(1.1, Number(p.easyBonus) || 1.3),
      hardFactor: Math.max(1.05, Number(p.hardFactor) || 1.2),
    };
  } catch (_) {
    return { learningMinutes: 10, graduatingDays: 1, easyBonus: 1.3, hardFactor: 1.2 };
  }
}

export function saveSrsPrefs(prefs) {
  try {
    localStorage.setItem(SRS_PREFS_KEY, JSON.stringify(prefs));
  } catch (_) {}
}

/**
 * Apply SM-2-like update.
 * quality: 0 = again (fail), 1 = hard, 2 = good, 3 = easy
 * Returns { card, dueAt, boxLevel }
 */
export function applySm2(prevCard, quality, prefs) {
  const p = prefs || loadSrsPrefs();
  const q = Math.max(0, Math.min(3, Number(quality) || 0));
  let ease = (prevCard && prevCard.ease) || SRS_DEFAULT_EASE;
  let interval = (prevCard && prevCard.interval) || 0; // days
  let reps = (prevCard && prevCard.reps) || 0;
  let lapses = (prevCard && prevCard.lapses) || 0;

  if (q === 0) {
    // Again — reset to learning
    reps = 0;
    lapses += 1;
    interval = 0;
    ease = Math.max(SRS_MIN_EASE, ease - 0.2);
    const dueAt = Date.now() + p.learningMinutes * 60 * 1000;
    return {
      card: { ease, interval, reps, lapses, dueAt },
      dueAt,
      boxLevel: 0,
    };
  }

  // Adjust ease (SM-2 formula variant)
  // quality mapped: 1→hard(2), 2→good(3), 3→easy(4) in classic SM-2 0-5 scale
  const sm2q = q + 1; // 2, 3, 4
  ease = ease + (0.1 - (5 - sm2q) * (0.08 + (5 - sm2q) * 0.02));
  ease = Math.max(SRS_MIN_EASE, ease);

  if (reps === 0) {
    // Graduating from learning
    interval = q === 3 ? Math.max(p.graduatingDays, 2) : p.graduatingDays;
  } else if (reps === 1) {
    interval = q === 1 ? Math.max(1, Math.round(interval * p.hardFactor)) : (q === 3 ? 6 : 3);
  } else {
    const factor = q === 1 ? p.hardFactor : ease;
    interval = Math.max(1, Math.round(interval * factor * (q === 3 ? p.easyBonus : 1)));
  }
  reps += 1;

  const dueAt = Date.now() + interval * 24 * 60 * 60 * 1000;
  // Map interval days → display box 0..5 for UI compatibility
  let boxLevel = 0;
  if (interval < 0.1) boxLevel = 0;
  else if (interval < 1) boxLevel = 1;
  else if (interval < 3) boxLevel = 2;
  else if (interval < 7) boxLevel = 3;
  else if (interval < 21) boxLevel = 4;
  else boxLevel = 5;

  return {
    card: { ease, interval, reps, lapses, dueAt },
    dueAt,
    boxLevel,
  };
}

/** Convert boolean correct (legacy callers) → SM-2 quality */
export function correctToQuality(correct) {
  return correct ? 2 : 0; // good vs again
}

/**
 * Prefer srsCards[id] when present; fall back to legacy srsStats + srsDueAt.
 */
export function getCardState(entryId, srsCards, srsStats, srsDueAt) {
  if (srsCards && srsCards[entryId]) return srsCards[entryId];
  const stats = srsStats && srsStats[entryId];
  const due = srsDueAt && srsDueAt[entryId];
  const level = srsLevelFromStats(stats);
  const intervalDays = [0, 0, 1, 3, 7, 30][level] || 0;
  return {
    ease: SRS_DEFAULT_EASE,
    interval: intervalDays,
    reps: stats ? stats.correct || 0 : 0,
    lapses: stats ? Math.max(0, (stats.total || 0) - (stats.correct || 0)) : 0,
    dueAt: due != null ? Number(due) : Date.now(),
  };
}
