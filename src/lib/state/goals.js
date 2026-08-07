// Daily / weekly study goals + auto weekly challenges (local per browser).

const GOALS_KEY = "twoTongues.goals";
const CHALLENGE_KEY = "twoTongues.weeklyChallenge";
const FOCUS_KEY = "twoTongues.focusMode";

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

export function loadFocusMode() {
  try {
    return localStorage.getItem(FOCUS_KEY) === "1";
  } catch (_) {
    return false;
  }
}

export function saveFocusMode(on) {
  try {
    if (on) localStorage.setItem(FOCUS_KEY, "1");
    else localStorage.removeItem(FOCUS_KEY);
  } catch (_) {}
}
