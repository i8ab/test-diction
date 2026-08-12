// Exam countdown config — set by admin, shown to everyone.
// Local cache mirrors the cloud `examConfig` field so the banner
// still appears offline with the last-known date.

const EXAM_CACHE_KEY = "twoTongues.examConfig";

/**
 * @typedef {{
 *   enabled: boolean,
 *   date: string|null,       // ISO YYYY-MM-DD (local calendar date of the exam)
 *   time?: string|null,      // optional HH:MM (24h) — defaults to 00:00
 *   color?: string,          // CSS color for the banner
 *   labelEn?: string,
 *   labelAr?: string,
 * }} ExamConfig
 */

export function defaultExamConfig() {
  return {
    enabled: false,
    date: null,
    time: "09:00",
    color: "#e85d04",
    labelEn: "",
    labelAr: "",
  };
}

export function loadExamConfigCache() {
  try {
    const raw = localStorage.getItem(EXAM_CACHE_KEY);
    if (!raw) return defaultExamConfig();
    const p = JSON.parse(raw);
    return normalizeExamConfig(p);
  } catch (_) {
    return defaultExamConfig();
  }
}

export function saveExamConfigCache(cfg) {
  try {
    localStorage.setItem(EXAM_CACHE_KEY, JSON.stringify(normalizeExamConfig(cfg)));
  } catch (_) {}
}

export function normalizeExamConfig(p) {
  const d = defaultExamConfig();
  if (!p || typeof p !== "object") return d;
  const date = typeof p.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : null;
  let time = typeof p.time === "string" && /^\d{1,2}:\d{2}$/.test(p.time) ? p.time : d.time;
  if (time) {
    const [hh, mm] = time.split(":");
    time = `${String(Number(hh)).padStart(2, "0")}:${mm}`;
  }
  const color = typeof p.color === "string" && p.color.trim() ? p.color.trim() : d.color;
  return {
    enabled: p.enabled === true && !!date,
    date,
    time,
    color,
    labelEn: typeof p.labelEn === "string" ? p.labelEn : "",
    labelAr: typeof p.labelAr === "string" ? p.labelAr : "",
  };
}

/** Absolute timestamp (ms) for the exam moment, or null. */
export function examTimestamp(cfg) {
  const c = normalizeExamConfig(cfg);
  if (!c.date) return null;
  const [y, m, d] = c.date.split("-").map(Number);
  let hh = 0, mm = 0;
  if (c.time) {
    const parts = c.time.split(":").map(Number);
    hh = parts[0] || 0;
    mm = parts[1] || 0;
  }
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getTime();
}

/**
 * Breakdown of remaining time until exam.
 * All fields 0 when past or missing.
 */
export function examCountdownParts(cfg, now = Date.now()) {
  const ts = examTimestamp(cfg);
  if (ts == null) {
    return { totalMs: 0, past: false, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0, totalDays: 0 };
  }
  const diff = ts - now;
  if (diff <= 0) {
    return { totalMs: 0, past: true, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0, totalDays: 0 };
  }
  const totalSec = Math.floor(diff / 1000);
  const seconds = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const minutes = totalMin % 60;
  const totalHours = Math.floor(totalMin / 60);
  const hours = totalHours % 24;
  const totalDays = Math.floor(totalHours / 24);
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  return { totalMs: diff, past: false, weeks, days, hours, minutes, seconds, totalDays };
}

/** Human-readable one-liner. */
export function formatExamCountdownFull(parts, isAr) {
  if (!parts || (parts.totalMs === 0 && !parts.past)) return "";
  if (parts.past) {
    return isAr ? "الامتحان عدّى" : "Exam has passed";
  }
  if (parts.totalDays === 0 && parts.hours === 0 && parts.minutes === 0) {
    return isAr ? `فاضل ${parts.seconds} ثانية` : `${parts.seconds}s left`;
  }
  const bits = [];
  if (parts.weeks > 0) bits.push(isAr ? `${parts.weeks} أسبوع` : `${parts.weeks}w`);
  if (parts.days > 0 || parts.weeks > 0) bits.push(isAr ? `${parts.days} يوم` : `${parts.days}d`);
  bits.push(isAr ? `${parts.hours} ساعة` : `${parts.hours}h`);
  bits.push(isAr ? `${parts.minutes} د` : `${parts.minutes}m`);
  bits.push(isAr ? `${parts.seconds} ث` : `${parts.seconds}s`);
  return isAr ? `فاضل ${bits.join(" · ")}` : `${bits.join(" · ")} left`;
}

// ——— legacy helpers kept for older call sites ———
export function loadExamDate() {
  const c = loadExamConfigCache();
  return c.date;
}

export function saveExamDate(iso) {
  const c = loadExamConfigCache();
  const next = normalizeExamConfig({ ...c, date: iso, enabled: !!iso });
  saveExamConfigCache(next);
}

export function daysUntilExam(examIso, now = Date.now()) {
  const date = examIso || loadExamConfigCache().date;
  if (!date) return null;
  const parts = examCountdownParts({ date, enabled: true, time: "00:00" }, now);
  if (parts.past) return -1;
  return parts.totalDays;
}

export function formatExamCountdown(days, isAr) {
  if (days == null) return "";
  if (days < 0) return isAr ? "الامتحان عدّى" : "Exam has passed";
  if (days === 0) return isAr ? "الامتحان النهاردة!" : "Exam is today!";
  if (days === 1) return isAr ? "فاضل يوم واحد على الامتحان" : "1 day until the exam";
  return isAr ? `فاضل ${days} يوم على الامتحان` : `${days} days until the exam`;
}

export function loadExamPrefs() {
  return { bannerEnabled: true, reminderMessage: "" };
}

export function saveExamPrefs() {}
