/**
 * Student weekly schedule — sleep, lessons, study blocks, routines.
 * Per-account localStorage. Days are 0=Sun … 6=Sat (JS Date.getDay()).
 */

const LEGACY_KEY = "twoTongues.schedule";
const KEY_FOR = (code) =>
  code ? `twoTongues.schedule.${String(code)}` : LEGACY_KEY;

const COMPLETION_KEY_FOR = (code) =>
  code ? `twoTongues.scheduleDone.${String(code)}` : "twoTongues.scheduleDone";

/** Block categories — colors work on light & dark paper surfaces */
export const BLOCK_TYPES = {
  sleep: { en: "Sleep", ar: "نوم", color: "#6366f1", icon: "moon" },
  school: { en: "School", ar: "مدرسة", color: "#0ea5e9", icon: "book" },
  study: { en: "Study", ar: "مذاكرة", color: "#f59e0b", icon: "pen" },
  prayer: { en: "Prayer", ar: "صلاة", color: "#10b981", icon: "moon" },
  meal: { en: "Meal", ar: "وجبة", color: "#f97316", icon: "meal" },
  break: { en: "Break", ar: "استراحة", color: "#94a3b8", icon: "break" },
  exercise: { en: "Exercise", ar: "رياضة", color: "#ef4444", icon: "flame" },
  free: { en: "Free time", ar: "وقت حر", color: "#a78bfa", icon: "spark" },
  custom: { en: "Custom", ar: "مخصص", color: "#64748b", icon: "star" },
};

const DAY_NAMES = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ar: ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"],
};

export function dayLabel(dayIndex, isAr) {
  const list = isAr ? DAY_NAMES.ar : DAY_NAMES.en;
  return list[dayIndex] || list[0];
}

export function todayIndex() {
  return new Date().getDay();
}

/** "HH:MM" → minutes from midnight */
export function timeToMinutes(t) {
  if (typeof t !== "string" || !/^\d{1,2}:\d{2}$/.test(t)) return 0;
  const [h, m] = t.split(":").map(Number);
  return Math.max(0, Math.min(24 * 60 - 1, h * 60 + m));
}

export function minutesToTime(mins) {
  const m = ((Math.round(mins) % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function formatTimeDisplay(t, isAr = false) {
  const mins = timeToMinutes(t);
  const h24 = Math.floor(mins / 60);
  const mm = mins % 60;
  const h12 = h24 % 12 || 12;
  const am = h24 < 12;
  if (isAr) {
    return `${h12}:${String(mm).padStart(2, "0")} ${am ? "ص" : "م"}`;
  }
  return `${h12}:${String(mm).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

function uid() {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function block(partial) {
  return {
    id: partial.id || uid(),
    title: String(partial.title || "").slice(0, 80),
    type: BLOCK_TYPES[partial.type] ? partial.type : "custom",
    start: partial.start || "08:00",
    end: partial.end || "09:00",
    note: String(partial.note || "").slice(0, 200),
    days: Array.isArray(partial.days)
      ? partial.days.filter((d) => d >= 0 && d <= 6)
      : [0, 1, 2, 3, 4, 5, 6],
  };
}

/**
 * Sensible default for a secondary / baccalaureate student:
 * fixed sleep window, school-week study focus, lighter Friday, recovery Saturday.
 */
export function defaultSchedule() {
  const weekday = [0, 1, 2, 3, 4]; // Sun–Thu (common school week in many MENA countries)
  const all = [0, 1, 2, 3, 4, 5, 6];

  return {
    version: 1,
    sleep: { bedtime: "23:00", wake: "06:30" },
    weekStartsOn: 6, // Saturday-first option for AR users; UI can flip
    blocks: [
      block({
        title: "نوم",
        type: "sleep",
        start: "23:00",
        end: "06:30",
        days: all,
        note: "7.5 ساعات — حافظ على نفس المواعيد",
      }),
      block({
        title: "استيقاظ وروتين صباحي",
        type: "break",
        start: "06:30",
        end: "07:15",
        days: weekday,
      }),
      block({
        title: "فطور",
        type: "meal",
        start: "07:15",
        end: "07:45",
        days: weekday,
      }),
      block({
        title: "مدرسة / حصص",
        type: "school",
        start: "08:00",
        end: "14:00",
        days: weekday,
        note: "عدّل حسب جدول مدرستك",
      }),
      block({
        title: "غداء + راحة",
        type: "meal",
        start: "14:00",
        end: "15:00",
        days: weekday,
      }),
      block({
        title: "مذاكرة مركّزة — جلسة 1",
        type: "study",
        start: "15:30",
        end: "17:30",
        days: weekday,
        note: "مادة صعبة أولاً",
      }),
      block({
        title: "استراحة / رياضة خفيفة",
        type: "exercise",
        start: "17:30",
        end: "18:15",
        days: weekday,
      }),
      block({
        title: "مذاكرة — جلسة 2",
        type: "study",
        start: "18:30",
        end: "20:30",
        days: weekday,
      }),
      block({
        title: "عشاء",
        type: "meal",
        start: "20:30",
        end: "21:15",
        days: all,
      }),
      block({
        title: "مراجعة خفيفة / كلمات",
        type: "study",
        start: "21:15",
        end: "22:15",
        days: weekday,
        note: "مراجعة فقط — بدون دروس جديدة",
      }),
      block({
        title: "وقت حر / عائلة",
        type: "free",
        start: "22:15",
        end: "23:00",
        days: all,
      }),
      // Friday lighter
      block({
        title: "صلاة الجمعة + راحة",
        type: "prayer",
        start: "11:30",
        end: "13:30",
        days: [5],
      }),
      block({
        title: "مذاكرة خفيفة",
        type: "study",
        start: "16:00",
        end: "18:00",
        days: [5],
      }),
      // Saturday recovery + catch-up
      block({
        title: "مذاكرة عميقة / مشروع",
        type: "study",
        start: "10:00",
        end: "13:00",
        days: [6],
      }),
      block({
        title: "وقت حر",
        type: "free",
        start: "15:00",
        end: "20:00",
        days: [6],
      }),
    ],
    updatedAt: Date.now(),
  };
}

function normalize(raw) {
  if (!raw || typeof raw !== "object") return defaultSchedule();
  const base = defaultSchedule();
  const sleep = {
    bedtime:
      typeof raw.sleep?.bedtime === "string" ? raw.sleep.bedtime : base.sleep.bedtime,
    wake: typeof raw.sleep?.wake === "string" ? raw.sleep.wake : base.sleep.wake,
  };
  const blocks = Array.isArray(raw.blocks)
    ? raw.blocks.map((b) => block(b)).slice(0, 80)
    : base.blocks;
  return {
    version: 1,
    sleep,
    weekStartsOn: raw.weekStartsOn === 0 || raw.weekStartsOn === 6 ? raw.weekStartsOn : 6,
    blocks,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

export function loadSchedule(accountCode) {
  try {
    const key = KEY_FOR(accountCode);
    let raw = localStorage.getItem(key);
    if (!raw && accountCode) raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return defaultSchedule();
    return normalize(JSON.parse(raw));
  } catch (_) {
    return defaultSchedule();
  }
}

export function saveSchedule(accountCode, data) {
  try {
    const normalized = normalize({ ...data, updatedAt: Date.now() });
    localStorage.setItem(KEY_FOR(accountCode), JSON.stringify(normalized));
    return normalized;
  } catch (_) {
    return data;
  }
}

/** Blocks that apply on a given day index, sorted by start (sleep spanning midnight last-first handled). */
export function blocksForDay(schedule, dayIndex) {
  const list = (schedule?.blocks || []).filter((b) =>
    (b.days || []).includes(dayIndex)
  );
  return list.slice().sort((a, b) => {
    const as = timeToMinutes(a.start);
    const bs = timeToMinutes(b.start);
    // Keep overnight sleep visually at top when start is late evening
    const aNight = a.type === "sleep" && as > 12 * 60 ? as - 24 * 60 : as;
    const bNight = b.type === "sleep" && bs > 12 * 60 ? bs - 24 * 60 : bs;
    return aNight - bNight;
  });
}

export function blockDurationMinutes(b) {
  let s = timeToMinutes(b.start);
  let e = timeToMinutes(b.end);
  if (e <= s) e += 24 * 60; // overnight
  return e - s;
}

export function orderedWeekDays(weekStartsOn = 6) {
  const out = [];
  for (let i = 0; i < 7; i++) out.push((weekStartsOn + i) % 7);
  return out;
}

// ——— completion tracking (today only, rolls with date) ———

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function loadCompletions(accountCode) {
  try {
    const raw = localStorage.getItem(COMPLETION_KEY_FOR(accountCode));
    if (!raw) return { date: todayKey(), done: {} };
    const parsed = JSON.parse(raw);
    if (parsed.date !== todayKey()) return { date: todayKey(), done: {} };
    return { date: parsed.date, done: parsed.done || {} };
  } catch (_) {
    return { date: todayKey(), done: {} };
  }
}

export function saveCompletions(accountCode, state) {
  try {
    localStorage.setItem(
      COMPLETION_KEY_FOR(accountCode),
      JSON.stringify({ date: todayKey(), done: state.done || {} })
    );
  } catch (_) {}
}

export function toggleCompletion(accountCode, blockId) {
  const cur = loadCompletions(accountCode);
  const next = { ...cur.done, [blockId]: !cur.done[blockId] };
  saveCompletions(accountCode, { done: next });
  return next;
}

export function dayProgress(schedule, dayIndex, completions) {
  const blocks = blocksForDay(schedule, dayIndex).filter((b) => b.type !== "sleep");
  if (!blocks.length) return { done: 0, total: 0, pct: 0 };
  const done = blocks.filter((b) => completions?.[b.id]).length;
  return { done, total: blocks.length, pct: Math.round((done / blocks.length) * 100) };
}

export function upsertBlock(schedule, nextBlock) {
  const b = block(nextBlock);
  const idx = (schedule.blocks || []).findIndex((x) => x.id === b.id);
  const blocks = [...(schedule.blocks || [])];
  if (idx >= 0) blocks[idx] = b;
  else blocks.push(b);
  return saveSchedule(null, { ...schedule, blocks }) || { ...schedule, blocks };
}

export function removeBlock(schedule, blockId) {
  const blocks = (schedule.blocks || []).filter((b) => b.id !== blockId);
  return { ...schedule, blocks };
}

export function applySleepToSchedule(schedule, bedtime, wake) {
  const sleep = { bedtime, wake };
  const blocks = (schedule.blocks || []).map((b) =>
    b.type === "sleep" ? { ...b, start: bedtime, end: wake } : b
  );
  const hasSleep = blocks.some((b) => b.type === "sleep");
  if (!hasSleep) {
    blocks.unshift(
      block({
        title: "نوم",
        type: "sleep",
        start: bedtime,
        end: wake,
        days: [0, 1, 2, 3, 4, 5, 6],
      })
    );
  }
  return { ...schedule, sleep, blocks };
}
