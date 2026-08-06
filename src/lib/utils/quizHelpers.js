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

export function buildQuiz(matchingEntries, allEntries, mode) {
  if (!matchingEntries || matchingEntries.length < 1) return [];
  const pool = matchingEntries.length >= 4 ? matchingEntries : allEntries || matchingEntries;

  // Expand multi-sense entries into one question per sense so the quiz can
  // say "this is the NOUN meaning" and not mix verb/noun answers.
  const items = [];
  for (const entry of matchingEntries.slice(0, 40)) {
    const senses = getEntrySenses(entry);
    if (!senses.length) continue;
    for (const sense of senses) {
      items.push({ entry, sense });
    }
  }
  const picked = shuffle(items).slice(0, 30);

  // Collect all meanings from the pool for distractors
  const allMeanings = [];
  for (const e of pool) {
    for (const s of getEntrySenses(e)) {
      if (s.meaning) allMeanings.push(s.meaning);
    }
    if (e.meaning && !allMeanings.includes(e.meaning)) allMeanings.push(e.meaning);
  }

  const questions = picked.map(({ entry, sense }) => {
    const correct = sense.meaning;
    const isArWord = entry.section === "ar-ar";
    const wordDir = isArWord ? "rtl" : "ltr";
    const wordFont = isArWord ? "'Amiri', serif" : "'Fraunces', serif";
    const meaningDir = "rtl";
    const meaningFont = "'Amiri', serif";

    let options = [correct];
    if (mode === "mcq") {
      const distractors = shuffle(
        allMeanings.filter((m) => m && m !== correct)
      ).slice(0, 3);
      while (distractors.length < 3 && allMeanings.length > distractors.length + 1) {
        const extra = allMeanings[Math.floor(Math.random() * allMeanings.length)];
        if (extra && extra !== correct && !distractors.includes(extra)) distractors.push(extra);
        else break;
      }
      options = shuffle([correct, ...distractors]).slice(0, 4);
    }

    return {
      id: `${entry.id}:${sense.id}`,
      entryId: entry.id,
      word: entry.word,
      meaning: correct,
      correct,
      correctAnswer: correct,
      acceptedAnswers: [correct],
      options,
      type: mode,
      mode,
      pos: sense.pos || "",
      promptText: entry.word,
      promptDir: wordDir,
      promptFont: wordFont,
      optionDir: meaningDir,
      optionFont: meaningFont,
      wordDir,
      wordFont,
    };
  });
  return shuffle(questions);
}

export function isTypingCorrect(typed, correct) {
  if (!typed || !correct) return false;
  const norm = (s) =>
    String(s)
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .replace(/\s+/g, " ");
  const t = norm(typed);
  if (!t) return false;
  const list = Array.isArray(correct) ? correct : [correct];
  return list.some((c) => c && norm(c) === t);
}

export function quizQuestionLabel(mode, isAr, pos) {
  const base =
    mode === "typing"
      ? (isAr ? "اكتب المعنى" : "Type the meaning")
      : (isAr ? "اختر المعنى الصحيح" : "Pick the correct meaning");
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
