/**
 * Day achievement entries with optional spaced-repetition scheduling.
 * Stored per account in localStorage (device-local, like todos).
 *
 * Each entry:
 *   { id, title, note, date (YYYY-MM-DD), useSrs, srsLevel, srsDueAt,
 *     correctStreak, totalReviews, correctReviews, createdAt, updatedAt }
 */

import { SRS_LEVEL_INTERVALS_MS } from "../utils/quizHelpers";

const KEY = "twoTongues.dayAchievements";
const KEY_FOR = (code) => (code ? `twoTongues.dayAchievements.${code}` : KEY);
const NOTIF_KEY = "twoTongues.dayAchievementNotifs";
const NOTIF_KEY_FOR = (code) => (code ? `twoTongues.dayAchievementNotifs.${code}` : NOTIF_KEY);

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeEntry(raw) {
  if (!raw || typeof raw.title !== "string" || !raw.title.trim()) return null;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : uid(),
    title: String(raw.title).trim().slice(0, 200),
    note: typeof raw.note === "string" ? String(raw.note).slice(0, 800) : "",
    date: typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : todayISO(),
    useSrs: !!raw.useSrs,
    srsLevel: Math.max(0, Math.min(5, Number(raw.srsLevel) || 0)),
    srsDueAt: typeof raw.srsDueAt === "number" ? raw.srsDueAt : null,
    correctStreak: Math.max(0, Number(raw.correctStreak) || 0),
    totalReviews: Math.max(0, Number(raw.totalReviews) || 0),
    correctReviews: Math.max(0, Number(raw.correctReviews) || 0),
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

export function loadDayAchievements(accountCode) {
  try {
    const key = KEY_FOR(accountCode);
    const raw = localStorage.getItem(key) || (!accountCode ? null : localStorage.getItem(KEY));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeEntry).filter(Boolean).slice(0, 300);
  } catch (_) {
    return [];
  }
}

export function saveDayAchievements(list, accountCode) {
  try {
    localStorage.setItem(KEY_FOR(accountCode), JSON.stringify((list || []).slice(0, 300)));
  } catch (_) {}
}

export function loadDayAchievementNotifsEnabled(accountCode) {
  try {
    const key = NOTIF_KEY_FOR(accountCode);
    const raw = localStorage.getItem(key) ?? (!accountCode ? null : localStorage.getItem(NOTIF_KEY));
    if (raw == null) return true; // default on
    return raw === "1" || raw === "true";
  } catch (_) {
    return true;
  }
}

export function saveDayAchievementNotifsEnabled(enabled, accountCode) {
  try {
    localStorage.setItem(NOTIF_KEY_FOR(accountCode), enabled ? "1" : "0");
  } catch (_) {}
}

export function createDayAchievement({ title, note = "", date, useSrs = false } = {}) {
  const now = Date.now();
  const level = 0;
  return {
    id: uid(),
    title: String(title || "").trim().slice(0, 200),
    note: String(note || "").slice(0, 800),
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO(),
    useSrs: !!useSrs,
    srsLevel: level,
    // Schedule first review shortly if SRS is on
    srsDueAt: useSrs ? now + SRS_LEVEL_INTERVALS_MS[0] : null,
    correctStreak: 0,
    totalReviews: 0,
    correctReviews: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Record a review result for a day-achievement SRS item (mastery-focused).
 * Correct answers raise level only after consecutive success; wrong resets streak.
 */
export function recordDayAchievementReview(entry, correct) {
  if (!entry) return entry;
  const totalReviews = (entry.totalReviews || 0) + 1;
  const correctReviews = (entry.correctReviews || 0) + (correct ? 1 : 0);
  let streak = correct ? (entry.correctStreak || 0) + 1 : 0;
  let level = entry.srsLevel || 0;

  if (correct) {
    // Require repeated success before advancing (mastery focus)
    if (streak >= 2 && level < 5) {
      level = Math.min(5, level + 1);
      streak = 0; // reset streak after promotion
    }
  } else {
    level = Math.max(0, level - 1);
  }

  const interval = SRS_LEVEL_INTERVALS_MS[level] || SRS_LEVEL_INTERVALS_MS[0];
  return {
    ...entry,
    totalReviews,
    correctReviews,
    correctStreak: streak,
    srsLevel: level,
    srsDueAt: Date.now() + interval,
    updatedAt: Date.now(),
  };
}

export function getDueDayAchievements(list, now = Date.now()) {
  return (list || []).filter(
    (e) => e && e.useSrs && e.srsDueAt != null && Number(e.srsDueAt) <= now
  );
}

export function formatDayAchievementDue(dueMs) {
  if (dueMs == null) return "Due";
  const diff = dueMs - Date.now();
  if (diff <= 0) return "Now";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}
