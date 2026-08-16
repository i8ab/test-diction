// Daily / weekly study goals + auto weekly challenges (local per browser).

const GOALS_KEY = "twoTongues.goals";
const CHALLENGE_KEY = "twoTongues.weeklyChallenge";

export function loadGoals() {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    if (!raw) return defaultGoals();
    const p = JSON.parse(raw);
    return {
      dailyWords: clamp(p.dailyWords, 1, 100, 5),
      dailyMinutes: clamp(p.dailyMinutes, 5, 240, 15),
      weeklyWords: clamp(p.weeklyWords, 5, 500, 30),
      enabled: p.enabled !== false,
    };
  } catch (_) {
    return defaultGoals();
  }
}

function defaultGoals() {
  return { dailyWords: 5, dailyMinutes: 15, weeklyWords: 30, enabled: true };
}

function clamp(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

export function saveGoals(g) {
  try {
    localStorage.setItem(GOALS_KEY, JSON.stringify(g));
  } catch (_) {}
}

export function dayKey(ms = Date.now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function weekKey(ms = Date.now()) {
  const d = new Date(ms);
  // ISO-ish week start Monday
  const day = (d.getDay() + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - day);
  mon.setHours(0, 0, 0, 0);
  return dayKey(mon.getTime());
}

// Progress counters stored locally (also mirrored from studiedAt when possible)
const PROGRESS_KEY = "twoTongues.goalProgress";

export function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { days: {}, weeks: {}, timerMinutesByDay: {} };
    const p = JSON.parse(raw);
    return {
      days: p.days || {},
      weeks: p.weeks || {},
      timerMinutesByDay: p.timerMinutesByDay || {},
    };
  } catch (_) {
    return { days: {}, weeks: {}, timerMinutesByDay: {} };
  }
}

export function saveProgress(p) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch (_) {}
}

/** Count words studied today / this week from studiedAt map */
export function countStudiedInRange(studiedAt, startMs) {
  let n = 0;
  for (const t of Object.values(studiedAt || {})) {
    if (typeof t === "number" && t >= startMs) n += 1;
  }
  return n;
}

export function todayStartMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function weekStartMs() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addTimerMinutes(mins) {
  if (!mins || mins < 0) return;
  const p = loadProgress();
  const k = dayKey();
  p.timerMinutesByDay[k] = (p.timerMinutesByDay[k] || 0) + mins;
  saveProgress(p);
}

export function getTodayTimerMinutes() {
  const p = loadProgress();
  return p.timerMinutesByDay[dayKey()] || 0;
}

// ─── Timer session log (detailed history, auto-pruned after 24h) ───────────
const TIMER_LOG_KEY = "twoTongues.timerSessionLog";
const TIMER_DAY_STATS_KEY = "twoTongues.timerDayStats";
const LOG_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * @typedef {{
 *   id: string,
 *   at: number,
 *   minutes: number,
 *   mode: "countdown"|"stopwatch"|"pomodoro",
 *   phase?: "work"|"break"|null,
 *   cycle?: number|null,
 * }} TimerSession
 */

function pruneLog(list) {
  const cutoff = Date.now() - LOG_TTL_MS;
  return (list || []).filter((s) => s && typeof s.at === "number" && s.at >= cutoff);
}

export function loadTimerSessionLog() {
  try {
    const raw = localStorage.getItem(TIMER_LOG_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    const pruned = pruneLog(Array.isArray(list) ? list : []);
    if (pruned.length !== (list || []).length) {
      try { localStorage.setItem(TIMER_LOG_KEY, JSON.stringify(pruned)); } catch (_) {}
    }
    return pruned;
  } catch (_) {
    return [];
  }
}

function saveTimerSessionLog(list) {
  try {
    localStorage.setItem(TIMER_LOG_KEY, JSON.stringify(pruneLog(list)));
  } catch (_) {}
}

/** Sessions still within the last 24 hours (newest first). */
export function getRecentTimerSessions() {
  return loadTimerSessionLog().slice().sort((a, b) => b.at - a.at);
}

/** Sum of minutes in the last 24 hours from the session log. */
export function getLast24hTimerMinutes() {
  return loadTimerSessionLog().reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
}

export function loadTimerDayStats() {
  try {
    const raw = localStorage.getItem(TIMER_DAY_STATS_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : {};
  } catch (_) {
    return {};
  }
}

function saveTimerDayStats(stats) {
  try {
    localStorage.setItem(TIMER_DAY_STATS_KEY, JSON.stringify(stats || {}));
  } catch (_) {}
}

export function getTimerStatsForDay(key) {
  const stats = loadTimerDayStats();
  return stats[key] || null;
}

/**
 * Record a completed timer section.
 * - Adds to 24h session history (auto-pruned)
 * - Updates daily aggregate for calendar (persists across days)
 * - Updates goal progress minutes (work / countdown only)
 */
export function logTimerSession({ minutes, mode = "countdown", phase = null, cycle = null }) {
  const mins = Math.max(0, Math.round(Number(minutes) || 0));
  if (mins <= 0) return null;

  const at = Date.now();
  const session = {
    id: `${at.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at,
    minutes: mins,
    mode: mode === "pomodoro" ? "pomodoro" : mode === "stopwatch" ? "stopwatch" : "countdown",
    phase: phase === "break" || phase === "work" ? phase : null,
    cycle: typeof cycle === "number" ? cycle : null,
  };

  const log = loadTimerSessionLog();
  log.push(session);
  saveTimerSessionLog(log);

  // Daily aggregate for calendar (kept beyond 24h)
  const k = dayKey(at);
  const stats = loadTimerDayStats();
  const row = stats[k] || {
    minutes: 0,
    sessions: 0,
    countdownMinutes: 0,
    pomodoroMinutes: 0,
    pomodoroWorkSessions: 0,
    pomodoroBreakSessions: 0,
  };
  row.minutes += mins;
  row.sessions += 1;
  if (session.mode === "pomodoro") {
    row.pomodoroMinutes += mins;
    if (session.phase === "break") row.pomodoroBreakSessions += 1;
    else row.pomodoroWorkSessions += 1;
  } else {
    row.countdownMinutes += mins;
  }
  stats[k] = row;
  saveTimerDayStats(stats);

  // Goal minutes: count study time only (not breaks)
  if (session.mode !== "pomodoro" || session.phase !== "break") {
    addTimerMinutes(mins);
  }

  return session;
}

/** Short health / focus tips for Pomodoro sections */
export const POMO_HEALTH_TIPS = {
  work: [
    { en: "Sit upright — shoulders relaxed, screen at eye level.", ar: "اقعد مظبوط — كتافك مرتاحة والشاشة قدام عينك." },
    { en: "Blink often and look away every few minutes.", ar: "رمّش كتير وابص بعيد كل كام دقيقة." },
    { en: "Keep water nearby and take small sips.", ar: "خلي مية جنبك واشرب رشفات صغيرة." },
    { en: "One task only this cycle — no tab-hopping.", ar: "مهمة واحدة في الدورة دي — من غير تقليب تابس." },
    { en: "Breathe steady; tension in the jaw means slow down.", ar: "نفس هادي؛ لو فكك متوتر هدّي شوية." },
  ],
  break: [
    { en: "Stand up, stretch your neck and wrists.", ar: "قوم ومدّ رقبتك ومعصميك." },
    { en: "Look at something far away for 20 seconds.", ar: "بص على حاجة بعيدة ٢٠ ثانية." },
    { en: "Drink water — skip the phone if you can.", ar: "اشرب مية — وسيب الموبايل لو تقدر." },
    { en: "Walk a few steps; reset your posture.", ar: "امشي كام خطوة وعدّل جلستك." },
    { en: "Close your eyes and take three slow breaths.", ar: "اقفل عينيك وخد ٣ أنفاس بطيئة." },
  ],
};

export function pickPomoHealthTip(phase) {
  const list = phase === "break" ? POMO_HEALTH_TIPS.break : POMO_HEALTH_TIPS.work;
  return list[Math.floor(Math.random() * list.length)] || list[0];
}

// Weekly challenge: auto-rotating simple target
const CHALLENGE_POOL = [
  { id: "words20", type: "words", target: 20, labelEn: "Study 20 new words this week", labelAr: "اتعلّم ٢٠ كلمة جديدة الأسبوع ده" },
  { id: "words40", type: "words", target: 40, labelEn: "Study 40 words this week", labelAr: "اتعلّم ٤٠ كلمة الأسبوع ده" },
  { id: "quiz3", type: "quizzes", target: 3, labelEn: "Finish 3 quizzes this week", labelAr: "خلّص ٣ اختبارات الأسبوع ده" },
  { id: "streak5", type: "streak", target: 5, labelEn: "Keep a 5-day streak", labelAr: "حافظ على سلسلة ٥ أيام" },
  { id: "minutes60", type: "minutes", target: 60, labelEn: "Study 60 minutes this week", labelAr: "ذاكر ٦٠ دقيقة الأسبوع ده" },
];

export function loadWeeklyChallenge() {
  try {
    const raw = localStorage.getItem(CHALLENGE_KEY);
    const wk = weekKey();
    if (raw) {
      const p = JSON.parse(raw);
      if (p.weekKey === wk && p.challenge) return p;
    }
    // Pick challenge by week index for stability
    const idx = Math.abs(hashStr(wk)) % CHALLENGE_POOL.length;
    const challenge = CHALLENGE_POOL[idx];
    const next = { weekKey: wk, challenge, completed: false };
    localStorage.setItem(CHALLENGE_KEY, JSON.stringify(next));
    return next;
  } catch (_) {
    return { weekKey: weekKey(), challenge: CHALLENGE_POOL[0], completed: false };
  }
}

export function markChallengeCompleted() {
  try {
    const c = loadWeeklyChallenge();
    c.completed = true;
    localStorage.setItem(CHALLENGE_KEY, JSON.stringify(c));
  } catch (_) {}
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

