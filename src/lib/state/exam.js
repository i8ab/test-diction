// Exam countdown config — supports a queue of exams.
// When the current exam passes, the next one in the queue becomes active.
// Local cache mirrors the cloud `examConfig` field.

const EXAM_CACHE_KEY = "twoTongues.examConfig";

/**
 * @typedef {{
 *   id: string,
 *   date: string,            // ISO YYYY-MM-DD
 *   time?: string|null,      // HH:MM 24h
 *   color?: string,
 *   labelEn?: string,
 *   labelAr?: string,
 * }} ExamItem
 *
 * @typedef {{
 *   enabled: boolean,
 *   exams: ExamItem[],
 *   // legacy single-exam mirrors of the active item (for older call sites)
 *   date: string|null,
 *   time?: string|null,
 *   color?: string,
 *   labelEn?: string,
 *   labelAr?: string,
 * }} ExamConfig
 */

function uid() {
  return `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultExamItem(partial = {}) {
  return {
    id: partial.id || uid(),
    date: typeof partial.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(partial.date) ? partial.date : "",
    time: normalizeTime(partial.time) || "09:00",
    color: typeof partial.color === "string" && partial.color.trim() ? partial.color.trim() : "#e85d04",
    labelEn: typeof partial.labelEn === "string" ? partial.labelEn : "",
    labelAr: typeof partial.labelAr === "string" ? partial.labelAr : "",
  };
}

export function defaultExamConfig() {
  return {
    enabled: false,
    exams: [],
    date: null,
    time: "09:00",
    color: "#e85d04",
    labelEn: "",
    labelAr: "",
  };
}

function normalizeTime(t) {
  if (typeof t !== "string" || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [hh, mm] = t.split(":");
  return `${String(Number(hh)).padStart(2, "0")}:${mm}`;
}

/** Timestamp (ms) for an exam item, or null. */
export function examItemTimestamp(item) {
  if (!item || !item.date || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return null;
  const [y, m, d] = item.date.split("-").map(Number);
  let hh = 0, mm = 0;
  const time = normalizeTime(item.time) || "00:00";
  const parts = time.split(":").map(Number);
  hh = parts[0] || 0;
  mm = parts[1] || 0;
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getTime();
}

/**
 * Normalize config from storage / cloud.
 * Accepts legacy single-exam shape { enabled, date, time, ... }
 * and new shape { enabled, exams: [...] }.
 */
export function normalizeExamConfig(p) {
  const d = defaultExamConfig();
  if (!p || typeof p !== "object") return d;

  let exams = [];
  if (Array.isArray(p.exams) && p.exams.length > 0) {
    exams = p.exams
      .map((it) => defaultExamItem(it))
      .filter((it) => !!it.date);
  } else if (typeof p.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.date)) {
    // migrate legacy single exam → queue of one
    exams = [
      defaultExamItem({
        date: p.date,
        time: p.time,
        color: p.color,
        labelEn: p.labelEn,
        labelAr: p.labelAr,
      }),
    ];
  }

  // sort by date+time ascending
  exams.sort((a, b) => {
    const ta = examItemTimestamp(a) ?? Infinity;
    const tb = examItemTimestamp(b) ?? Infinity;
    return ta - tb;
  });

  const enabled = p.enabled === true && exams.length > 0;
  const active = getActiveExamFromList(exams, Date.now()) || exams[0] || null;

  return {
    enabled,
    exams,
    date: active?.date || null,
    time: active?.time || d.time,
    color: active?.color || d.color,
    labelEn: active?.labelEn || "",
    labelAr: active?.labelAr || "",
  };
}

/** Next upcoming exam (not yet past). If all past, returns last one. */
export function getActiveExamFromList(exams, now = Date.now()) {
  if (!Array.isArray(exams) || exams.length === 0) return null;
  const sorted = [...exams].sort((a, b) => {
    const ta = examItemTimestamp(a) ?? Infinity;
    const tb = examItemTimestamp(b) ?? Infinity;
    return ta - tb;
  });
  const upcoming = sorted.find((it) => {
    const ts = examItemTimestamp(it);
    return ts != null && ts > now;
  });
  return upcoming || sorted[sorted.length - 1] || null;
}

export function getActiveExam(cfg, now = Date.now()) {
  const c = normalizeExamConfig(cfg);
  return getActiveExamFromList(c.exams, now);
}

/** Index of active exam in the sorted queue (0-based), and total count. */
export function getExamQueueInfo(cfg, now = Date.now()) {
  const c = normalizeExamConfig(cfg);
  if (!c.exams.length) return { index: -1, total: 0, remaining: 0, active: null };
  const sorted = [...c.exams].sort((a, b) => {
    const ta = examItemTimestamp(a) ?? Infinity;
    const tb = examItemTimestamp(b) ?? Infinity;
    return ta - tb;
  });
  const active = getActiveExamFromList(sorted, now);
  const index = active ? sorted.findIndex((x) => x.id === active.id) : -1;
  const remaining = sorted.filter((it) => {
    const ts = examItemTimestamp(it);
    return ts != null && ts > now;
  }).length;
  return { index, total: sorted.length, remaining, active, sorted };
}

export function loadExamConfigCache() {
  try {
    const raw = localStorage.getItem(EXAM_CACHE_KEY);
    if (!raw) return defaultExamConfig();
    return normalizeExamConfig(JSON.parse(raw));
  } catch (_) {
    return defaultExamConfig();
  }
}

export function saveExamConfigCache(cfg) {
  try {
    localStorage.setItem(EXAM_CACHE_KEY, JSON.stringify(normalizeExamConfig(cfg)));
  } catch (_) {}
}

/** Absolute timestamp (ms) for the *active* exam moment, or null. */
export function examTimestamp(cfg) {
  const active = getActiveExam(cfg);
  return active ? examItemTimestamp(active) : null;
}

/**
 * Breakdown of remaining time until the active exam.
 * All fields 0 when past or missing.
 */
export function examCountdownParts(cfg, now = Date.now()) {
  const active = getActiveExam(cfg, now);
  const ts = active ? examItemTimestamp(active) : null;
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

// ——— legacy helpers ———
export function loadExamDate() {
  const c = loadExamConfigCache();
  return c.date;
}

export function saveExamDate(iso) {
  const c = loadExamConfigCache();
  const exams = iso
    ? [defaultExamItem({ date: iso, time: c.time, color: c.color, labelEn: c.labelEn, labelAr: c.labelAr })]
    : [];
  saveExamConfigCache(normalizeExamConfig({ ...c, exams, enabled: exams.length > 0 }));
}

export function daysUntilExam(examIso, now = Date.now()) {
  const date = examIso || loadExamConfigCache().date;
  if (!date) return null;
  const parts = examCountdownParts({ date, enabled: true, time: "00:00", exams: [{ date, time: "00:00" }] }, now);
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
