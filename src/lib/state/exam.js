// Exam date + exam-mode preferences (local per browser / account).

const EXAM_KEY = "twoTongues.examDate";
const EXAM_PREFS_KEY = "twoTongues.examPrefs";

/** @returns {string|null} ISO date string YYYY-MM-DD or null */
export function loadExamDate() {
  try {
    const v = localStorage.getItem(EXAM_KEY);
    if (!v) return null;
    // Basic validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    return v;
  } catch (_) {
    return null;
  }
}

/** @param {string|null} iso YYYY-MM-DD or null to clear */
export function saveExamDate(iso) {
  try {
    if (!iso) localStorage.removeItem(EXAM_KEY);
    else localStorage.setItem(EXAM_KEY, iso);
  } catch (_) {}
}

/**
 * Days remaining until exam (calendar days).
 * null if no date set.
 * 0 = today, negative = past.
 */
export function daysUntilExam(examIso = loadExamDate(), now = Date.now()) {
  if (!examIso) return null;
  const [y, m, d] = examIso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const exam = new Date(y, m - 1, d);
  exam.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((exam.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export function loadExamPrefs() {
  try {
    const raw = localStorage.getItem(EXAM_PREFS_KEY);
    if (!raw) return defaultExamPrefs();
    const p = JSON.parse(raw);
    return {
      bannerEnabled: p.bannerEnabled !== false,
      reminderMessage: typeof p.reminderMessage === "string" ? p.reminderMessage : "",
    };
  } catch (_) {
    return defaultExamPrefs();
  }
}

function defaultExamPrefs() {
  return { bannerEnabled: true, reminderMessage: "" };
}

export function saveExamPrefs(prefs) {
  try {
    localStorage.setItem(EXAM_PREFS_KEY, JSON.stringify(prefs));
  } catch (_) {}
}

/**
 * Build a human-friendly exam countdown string.
 */
export function formatExamCountdown(days, isAr) {
  if (days == null) return "";
  if (days < 0) {
    return isAr
      ? `الامتحان عدّى من ${Math.abs(days)} يوم`
      : `Exam was ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  }
  if (days === 0) {
    return isAr ? "الامتحان النهاردة!" : "Exam is today!";
  }
  if (days === 1) {
    return isAr ? "فاضل يوم واحد على الامتحان" : "1 day until the exam";
  }
  return isAr
    ? `فاضل ${days} يوم على الامتحان`
    : `${days} days until the exam`;
}
