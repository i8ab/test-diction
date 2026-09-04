/**
 * Student weekly schedule — recurring + one-off blocks, conflicts, weekly summary.
 * Per-account localStorage.
 */

const LEGACY_KEY = "twoTongues.schedule";
const KEY_FOR = (code) =>
  code ? `twoTongues.schedule.${String(code)}` : LEGACY_KEY;

const COMPLETION_KEY_FOR = (code) =>
  code ? `twoTongues.scheduleDone.${String(code)}` : "twoTongues.scheduleDone";

const SUMMARY_KEY_FOR = (code) =>
  code ? `twoTongues.scheduleWeekLog.${String(code)}` : "twoTongues.scheduleWeekLog";

/** Block categories */
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

export const PRESET_COLORS = [
  "#6366f1", "#0ea5e9", "#f59e0b", "#10b981", "#f97316",
  "#ef4444", "#a78bfa", "#ec4899", "#14b8a6", "#64748b",
];

const DAY_NAMES = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  ar: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
};
const DAY_SHORT = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ar: ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"],
};

const DAILY_TIPS = {
  en: [
    "Start with the hardest subject while your mind is fresh.",
    "A 5-minute review before bed locks memory better than an extra hour of cramming.",
    "Protect your sleep window — focus drops hard after midnight.",
    "One finished block beats three half-done ones. Tick something off.",
    "Put your phone in another room during the next study block.",
    "Drink water and stand up between blocks — your brain needs oxygen.",
    "If a block feels too big, split it. Small wins stack.",
  ],
  ar: [
    "ابدأ بأصعب مادة وإنت لسه ذهنك فريش.",
    "مراجعة ٥ دقايق قبل النوم بتثبّت أكتر من ساعة سهر زيادة.",
    "احمِ مواعيد نومك — التركيز بيقع جامد بعد منتصف الليل.",
    "بلوك واحد مكتمل أحسن من تلاتة نصّهم. علّم حاجة كـ تم.",
    "حط الموبايل في أوضة تانية في جلسة المذاكرة الجاية.",
    "اشرب مية وقف بين البلوكات — المخ محتاج أكسجين.",
    "لو البلوك كبير، قسّمه. الإنجازات الصغيرة بتتراكم.",
  ],
};

export function dayLabel(dayIndex, isAr, short = true) {
  const list = short
    ? isAr
      ? DAY_SHORT.ar
      : DAY_SHORT.en
    : isAr
      ? DAY_NAMES.ar
      : DAY_NAMES.en;
  return list[dayIndex] || list[0];
}

export function todayIndex() {
  return new Date().getDay();
}

/** Local calendar date YYYY-MM-DD */
export function dateKey(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

/** ISO-like week key: year-Wxx based on Thursday of that week */
export function weekKey(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7));
  const week1 = new Date(x.getFullYear(), 0, 4);
  const wk =
    1 +
    Math.round(
      ((x - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
  return `${x.getFullYear()}-W${String(wk).padStart(2, "0")}`;
}

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
  if (isAr) return `${h12}:${String(mm).padStart(2, "0")} ${am ? "ص" : "م"}`;
  return `${h12}:${String(mm).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

function uid() {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * recurrence:
 *  - "weekly" (default): repeats every week on `days`
 *  - "once": only on `date` (YYYY-MM-DD)
 *  - "week": only during `weekKey` (this calendar week)
 */
/** True when a block has both a start and end time set. Time is optional. */
export function hasTime(b) {
  return (
    typeof b?.start === "string" &&
    /^\d{1,2}:\d{2}$/.test(b.start) &&
    typeof b?.end === "string" &&
    /^\d{1,2}:\d{2}$/.test(b.end)
  );
}

function block(partial) {
  const type = BLOCK_TYPES[partial.type] ? partial.type : "custom";
  const color =
    typeof partial.color === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(partial.color)
      ? partial.color
      : BLOCK_TYPES[type].color;
  const recurrence = ["weekly", "once", "week"].includes(partial.recurrence)
    ? partial.recurrence
    : "weekly";
  // Time is optional: a block only carries a start/end when both are valid
  // "HH:MM" strings. Anything else (missing, empty, malformed) becomes a
  // timeless block instead of silently defaulting to 08:00–09:00.
  const validStart = typeof partial.start === "string" && /^\d{1,2}:\d{2}$/.test(partial.start);
  const validEnd = typeof partial.end === "string" && /^\d{1,2}:\d{2}$/.test(partial.end);
  return {
    id: partial.id || uid(),
    title: String(partial.title || "").slice(0, 80),
    type,
    color,
    start: validStart && validEnd ? partial.start : null,
    end: validStart && validEnd ? partial.end : null,
    note: String(partial.note || "").slice(0, 200),
    days: Array.isArray(partial.days)
      ? partial.days.filter((d) => d >= 0 && d <= 6)
      : [0, 1, 2, 3, 4, 5, 6],
    recurrence,
    date: typeof partial.date === "string" ? partial.date : null,
    weekKey: typeof partial.weekKey === "string" ? partial.weekKey : null,
  };
}

export function defaultSchedule() {
  const weekday = [0, 1, 2, 3, 4];
  const all = [0, 1, 2, 3, 4, 5, 6];

  return {
    version: 2,
    sleep: { bedtime: "23:00", wake: "06:30" },
    weekStartsOn: 6,
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
    ? raw.blocks.map((b) => block(b)).slice(0, 120)
    : base.blocks;
  return {
    version: 2,
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

/** Parse an imported schedule (JSON string or object) into a valid schedule, or null if invalid. */
export function importScheduleData(raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.blocks)) return null;
    return normalize(parsed);
  } catch (_) {
    return null;
  }
}

/** Serialize a schedule to a portable JSON string, for sharing/backup. */
export function exportScheduleData(schedule) {
  return JSON.stringify(
    {
      version: 2,
      weekStartsOn: schedule?.weekStartsOn ?? 6,
      sleep: schedule?.sleep,
      blocks: schedule?.blocks || [],
    },
    null,
    2
  );
}

/**
 * Read-only "virtual" schedule entries for spaced-repetition (medical ladder)
 * day-achievement items due on calendar date `d`. These are not persisted in
 * the schedule itself — they're derived live from dayAchievements so they
 * always reflect the current due dates automatically.
 */
export function srsBlocksForDate(dayAchievements, d = new Date()) {
  const dk = dateKey(d);
  return (dayAchievements || [])
    .filter(
      (e) => e && e.useSrs && e.srsDueAt != null && dateKey(new Date(e.srsDueAt)) === dk
    )
    .map((e) => ({
      id: `srs_${e.id}`,
      title: e.title || "",
      type: "study",
      color: BLOCK_TYPES.study.color,
      start: null,
      end: null,
      note: e.note || "",
      days: [d.getDay()],
      recurrence: "once",
      date: dk,
      weekKey: null,
      isSrs: true,
      srsSourceId: e.id,
    }));
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

/** Does this block apply on calendar date `d`? */
export function blockAppliesOnDate(b, d = new Date()) {
  const day = d.getDay();
  const dk = dateKey(d);
  const wk = weekKey(d);
  const rec = b.recurrence || "weekly";
  if (rec === "once") return b.date === dk;
  if (rec === "week") return b.weekKey === wk && (b.days || []).includes(day);
  return (b.days || []).includes(day);
}

function timeSort(a, b) {
  const as = timeToMinutes(a.start);
  const bs = timeToMinutes(b.start);
  const aNight = a.type === "sleep" && as > 12 * 60 ? as - 24 * 60 : as;
  const bNight = b.type === "sleep" && bs > 12 * 60 ? bs - 24 * 60 : bs;
  return aNight - bNight;
}

/** Timed blocks first (by start time), then timeless blocks (by title). */
function sortBlocksForDisplay(list) {
  const timed = list.filter(hasTime).sort(timeSort);
  const untimed = list
    .filter((b) => !hasTime(b))
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ar"));
  return [...timed, ...untimed];
}

export function blocksForDate(schedule, d = new Date()) {
  const list = (schedule?.blocks || []).filter((b) => blockAppliesOnDate(b, d));
  return sortBlocksForDisplay(list);
}

/** @deprecated prefer blocksForDate — kept for day-index previews of recurring only */
export function blocksForDay(schedule, dayIndex) {
  const list = (schedule?.blocks || []).filter((b) => {
    if ((b.recurrence || "weekly") !== "weekly") return false;
    return (b.days || []).includes(dayIndex);
  });
  return sortBlocksForDisplay(list);
}

export function blockDurationMinutes(b) {
  if (!hasTime(b)) return 0;
  let s = timeToMinutes(b.start);
  let e = timeToMinutes(b.end);
  if (e <= s) e += 24 * 60;
  return e - s;
}

/** Interval in minutes from midnight; overnight → end + 24h */
function interval(b) {
  let s = timeToMinutes(b.start);
  let e = timeToMinutes(b.end);
  if (e <= s) e += 24 * 60;
  return { s, e };
}

/**
 * True if two blocks overlap in time (same calendar day context).
 * Sleep overnight is handled via interval expansion.
 * Blocks without a set time never conflict with anything.
 */
export function blocksOverlap(a, b) {
  if (a.id && b.id && a.id === b.id) return false;
  if (!hasTime(a) || !hasTime(b)) return false;
  const A = interval(a);
  const B = interval(b);
  return A.s < B.e && B.s < A.e;
}

/**
 * Find conflicts for a candidate block against existing ones on a given date.
 * Returns array of conflicting blocks.
 */
export function findConflicts(schedule, candidate, d = new Date()) {
  const others = blocksForDate(schedule, d).filter(
    (b) => !candidate.id || b.id !== candidate.id
  );
  // For weekly candidate without a fixed date, check against each selected day
  // by simulating the next occurrence — caller should pass the day being edited.
  return others.filter((b) => blocksOverlap(candidate, b));
}

/**
 * Conflict check when saving: for weekly, test each day in candidate.days
 * against recurring + temporary blocks that fall on the "next" such weekday
 * in the current week when possible.
 */
export function findConflictsForSave(schedule, candidate) {
  // No time set → nothing to conflict with.
  if (!hasTime(candidate)) return [];
  const conflicts = [];
  const rec = candidate.recurrence || "weekly";
  const seen = new Set();

  if (rec === "once" && candidate.date) {
    const [y, m, d] = candidate.date.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    for (const c of findConflicts(schedule, candidate, dt)) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        conflicts.push(c);
      }
    }
    return conflicts;
  }

  if (rec === "week" && candidate.weekKey) {
    // Approximate: check today-week days that match
    const days = candidate.days?.length ? candidate.days : [todayIndex()];
    for (const day of days) {
      const dt = dateOnWeekdayThisWeek(day);
      if (weekKey(dt) !== candidate.weekKey && candidate.weekKey !== weekKey()) continue;
      for (const c of findConflicts(schedule, candidate, dt)) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          conflicts.push(c);
        }
      }
    }
    return conflicts;
  }

  // weekly
  const days = candidate.days?.length ? candidate.days : [todayIndex()];
  for (const day of days) {
    const dt = dateOnWeekdayThisWeek(day);
    for (const c of findConflicts(schedule, candidate, dt)) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        conflicts.push(c);
      }
    }
  }
  return conflicts;
}

function dateOnWeekdayThisWeek(targetDay) {
  const now = new Date();
  const cur = now.getDay();
  const delta = targetDay - cur;
  const d = new Date(now);
  d.setDate(now.getDate() + delta);
  d.setHours(12, 0, 0, 0);
  return d;
}

export function orderedWeekDays(weekStartsOn = 6) {
  const out = [];
  for (let i = 0; i < 7; i++) out.push((weekStartsOn + i) % 7);
  return out;
}

export function dateForWeekday(dayIndex, weekStartsOn = 6) {
  return dateOnWeekdayThisWeek(dayIndex);
}

// ——— completions (keyed by date) ———

export function loadCompletions(accountCode) {
  try {
    const raw = localStorage.getItem(COMPLETION_KEY_FOR(accountCode));
    if (!raw) return { date: dateKey(), done: {} };
    const parsed = JSON.parse(raw);
    // keep map of date -> { blockId: true }
    if (parsed.byDate && typeof parsed.byDate === "object") {
      return { byDate: parsed.byDate };
    }
    // migrate old single-day format
    if (parsed.date && parsed.done) {
      return { byDate: { [parsed.date]: parsed.done } };
    }
    return { byDate: {} };
  } catch (_) {
    return { byDate: {} };
  }
}

export function saveCompletions(accountCode, state) {
  try {
    localStorage.setItem(
      COMPLETION_KEY_FOR(accountCode),
      JSON.stringify({ byDate: state.byDate || {} })
    );
  } catch (_) {}
}

export function toggleCompletion(accountCode, blockId, d = new Date()) {
  const cur = loadCompletions(accountCode);
  const dk = dateKey(d);
  const dayMap = { ...(cur.byDate?.[dk] || {}) };
  dayMap[blockId] = !dayMap[blockId];
  const byDate = { ...(cur.byDate || {}), [dk]: dayMap };
  // prune old dates (>21 days)
  const cutoff = Date.now() - 21 * 86400000;
  for (const k of Object.keys(byDate)) {
    const [y, m, dd] = k.split("-").map(Number);
    if (new Date(y, m - 1, dd).getTime() < cutoff) delete byDate[k];
  }
  saveCompletions(accountCode, { byDate });
  return dayMap;
}

export function completionsForDate(accountCode, d = new Date()) {
  const cur = loadCompletions(accountCode);
  return cur.byDate?.[dateKey(d)] || {};
}

export function dayProgress(schedule, d, completions) {
  const blocks = blocksForDate(schedule, d).filter((b) => b.type !== "sleep");
  if (!blocks.length) return { done: 0, total: 0, pct: 0 };
  const done = blocks.filter((b) => completions?.[b.id]).length;
  return { done, total: blocks.length, pct: Math.round((done / blocks.length) * 100) };
}

export function removeBlock(schedule, blockId) {
  const blocks = (schedule.blocks || []).filter((b) => b.id !== blockId);
  return { ...schedule, blocks };
}

export function removeBlocks(schedule, ids) {
  const set = new Set(ids || []);
  if (!set.size) return schedule;
  const blocks = (schedule.blocks || []).filter((b) => !set.has(b.id));
  return { ...schedule, blocks };
}

/**
 * Remove or strip days from blocks for the given weekday indexes (0–6).
 * mode: "all" | "weekly" | "temporary"
 * - weekly: only recurring; removes those days from days[]; drops block if no days left
 * - temporary: only once/week blocks that fall on those weekdays (this week context)
 * - all: both
 */
export function removeBlocksForDays(schedule, dayIndexes, mode = "all") {
  const days = new Set((dayIndexes || []).filter((d) => d >= 0 && d <= 6));
  if (!days.size) return schedule;
  const wk = weekKey();
  const out = [];
  for (const b of schedule.blocks || []) {
    const rec = b.recurrence || "weekly";
    if (rec === "weekly") {
      if (mode === "temporary") {
        out.push(b);
        continue;
      }
      const nextDays = (b.days || []).filter((d) => !days.has(d));
      if (!nextDays.length) continue; // fully removed
      if (nextDays.length === (b.days || []).length) {
        out.push(b);
      } else {
        out.push({ ...b, days: nextDays });
      }
      continue;
    }
    // temporary
    if (mode === "weekly") {
      out.push(b);
      continue;
    }
    if (rec === "once" && b.date) {
      try {
        const d = new Date(b.date + "T12:00:00").getDay();
        if (days.has(d) && weekKey(new Date(b.date + "T12:00:00")) === wk) continue;
      } catch (_) {}
      out.push(b);
      continue;
    }
    if (rec === "week") {
      if (b.weekKey === wk && (b.days || []).some((d) => days.has(d))) {
        const nextDays = (b.days || []).filter((d) => !days.has(d));
        if (!nextDays.length) continue;
        out.push({ ...b, days: nextDays });
      } else {
        out.push(b);
      }
      continue;
    }
    out.push(b);
  }
  return { ...schedule, blocks: out };
}


export function applySleepToSchedule(schedule, bedtime, wake) {
  const sleep = { bedtime, wake };
  const blocks = (schedule.blocks || []).map((b) =>
    b.type === "sleep" && (b.recurrence || "weekly") === "weekly"
      ? { ...b, start: bedtime, end: wake }
      : b
  );
  const hasSleep = blocks.some(
    (b) => b.type === "sleep" && (b.recurrence || "weekly") === "weekly"
  );
  if (!hasSleep) {
    blocks.unshift(
      block({
        title: "نوم",
        type: "sleep",
        start: bedtime,
        end: wake,
        days: [0, 1, 2, 3, 4, 5, 6],
        recurrence: "weekly",
      })
    );
  }
  return { ...schedule, sleep, blocks };
}

export function tipForDate(d = new Date(), isAr = false) {
  const list = isAr ? DAILY_TIPS.ar : DAILY_TIPS.en;
  // stable per date
  const dk = dateKey(d);
  let hash = 0;
  for (let i = 0; i < dk.length; i++) hash = (hash * 31 + dk.charCodeAt(i)) >>> 0;
  return list[hash % list.length];
}

/**
 * Build end-of-week summary for the current week.
 */
export function buildWeekSummary(schedule, accountCode, weekStartsOn = 6) {
  const days = orderedWeekDays(weekStartsOn);
  const byDate = loadCompletions(accountCode).byDate || {};
  const daysOut = [];
  let totalBlocks = 0;
  let totalDone = 0;
  let studyMinsPlanned = 0;
  let studyMinsDone = 0;

  for (const day of days) {
    const d = dateOnWeekdayThisWeek(day);
    // only count up to today for "done" narrative; still list full week plan
    const blocks = blocksForDate(schedule, d).filter((b) => b.type !== "sleep");
    const doneMap = byDate[dateKey(d)] || {};
    const done = blocks.filter((b) => doneMap[b.id]).length;
    totalBlocks += blocks.length;
    totalDone += done;
    for (const b of blocks) {
      const mins = blockDurationMinutes(b);
      if (b.type === "study" || b.type === "school") {
        studyMinsPlanned += mins;
        if (doneMap[b.id]) studyMinsDone += mins;
      }
    }
    daysOut.push({
      day,
      date: dateKey(d),
      label: dayLabel(day, false, true),
      total: blocks.length,
      done,
      pct: blocks.length ? Math.round((done / blocks.length) * 100) : 0,
    });
  }

  return {
    weekKey: weekKey(),
    days: daysOut,
    totalBlocks,
    totalDone,
    pct: totalBlocks ? Math.round((totalDone / totalBlocks) * 100) : 0,
    studyMinsPlanned,
    studyMinsDone,
  };
}

export function formatMins(mins, isAr) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (isAr) {
    if (h && m) return `${h} س ${m} د`;
    if (h) return `${h} ساعة`;
    return `${m} دقيقة`;
  }
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Free gaps between non-sleep blocks on a date (minutes from midnight). */
export function findFreeGaps(schedule, d = new Date(), minGap = 20) {
  const blocks = blocksForDate(schedule, d)
    .filter((b) => b.type !== "sleep" && hasTime(b))
    .map((b) => {
      let s = timeToMinutes(b.start);
      let e = timeToMinutes(b.end);
      if (e <= s) e += 24 * 60;
      return { s, e, title: b.title };
    })
    .sort((a, b) => a.s - b.s);

  const gaps = [];
  const dayStart = 6 * 60; // 06:00
  const dayEnd = 23 * 60; // 23:00
  let cursor = dayStart;
  for (const b of blocks) {
    if (b.s - cursor >= minGap) {
      gaps.push({ start: minutesToTime(cursor), end: minutesToTime(Math.min(b.s, dayEnd)), minutes: b.s - cursor });
    }
    cursor = Math.max(cursor, b.e);
  }
  if (dayEnd - cursor >= minGap) {
    gaps.push({ start: minutesToTime(cursor), end: minutesToTime(dayEnd), minutes: dayEnd - cursor });
  }
  return gaps;
}

/** Current or next block for "now" on a given date (defaults today). */
export function getNowAndNext(schedule, d = new Date()) {
  const now = new Date();
  const isToday = dateKey(d) === dateKey(now);
  const mins = isToday ? now.getHours() * 60 + now.getMinutes() : -1;
  const blocks = blocksForDate(schedule, d).filter((b) => b.type !== "sleep" && hasTime(b));

  let current = null;
  let next = null;
  for (const b of blocks) {
    let s = timeToMinutes(b.start);
    let e = timeToMinutes(b.end);
    if (e <= s) e += 24 * 60;
    if (isToday && mins >= s && mins < e) {
      current = b;
    } else if (isToday && s > mins) {
      if (!next) next = b;
    } else if (!isToday && !next) {
      next = blocks[0] || null;
    }
  }
  if (!isToday) {
    next = blocks[0] || null;
    current = null;
  }
  return { current, next };
}

/** Copy recurring structure of source weekday onto target weekdays (weekly blocks only). */
export function copyDayToDays(schedule, sourceDay, targetDays) {
  const targets = (targetDays || []).filter((d) => d !== sourceDay && d >= 0 && d <= 6);
  if (!targets.length) return schedule;
  const blocks = (schedule.blocks || []).map((b) => {
    if ((b.recurrence || "weekly") !== "weekly") return b;
    if (!(b.days || []).includes(sourceDay)) return b;
    const days = new Set(b.days || []);
    targets.forEach((t) => days.add(t));
    return { ...b, days: [...days].sort() };
  });
  return { ...schedule, blocks };
}

/** Remove once/week temporary blocks for current week (or all temps). */
export function clearTemporaryBlocks(schedule, mode = "week") {
  const wk = weekKey();
  const blocks = (schedule.blocks || []).filter((b) => {
    const r = b.recurrence || "weekly";
    if (r === "weekly") return true;
    if (mode === "all") return false;
    if (r === "once") {
      if (!b.date) return false;
      try {
        return weekKey(new Date(b.date + "T12:00:00")) !== wk;
      } catch (_) {
        return false;
      }
    }
    if (r === "week") return b.weekKey !== wk;
    return true;
  });
  return { ...schedule, blocks };
}

/** Consecutive days (ending today) with 100% non-sleep completion. */
export function scheduleStreak(schedule, accountCode, maxLookback = 21) {
  const byDate = loadCompletions(accountCode).byDate || {};
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  for (let i = 0; i < maxLookback; i++) {
    const d = new Date(cursor);
    d.setDate(cursor.getDate() - i);
    const blocks = blocksForDate(schedule, d).filter((b) => b.type !== "sleep");
    if (!blocks.length) {
      if (i === 0) continue; // empty today doesn't break yet
      break;
    }
    const doneMap = byDate[dateKey(d)] || {};
    const allDone = blocks.every((b) => doneMap[b.id]);
    if (!allDone) break;
    streak += 1;
  }
  return streak;
}

export function exportWeekText(schedule, accountCode, isAr = false, weekStartsOn = 6) {
  const days = orderedWeekDays(weekStartsOn);
  const lines = [];
  lines.push(isAr ? "جدول الأسبوع" : "Weekly schedule");
  lines.push("────────────");
  for (const day of days) {
    const d = dateForWeekday(day, weekStartsOn);
    const blocks = blocksForDate(schedule, d);
    const doneMap = completionsForDate(accountCode, d);
    lines.push(`${dayLabel(day, isAr, false)} (${dateKey(d)})`);
    if (!blocks.length) {
      lines.push(isAr ? "  (فارغ)" : "  (empty)");
    }
    for (const b of blocks) {
      const mark = doneMap[b.id] ? "✓" : "•";
      const meta = BLOCK_TYPES[b.type] || BLOCK_TYPES.custom;
      const time = hasTime(b) ? `${b.start}-${b.end} ` : "";
      lines.push(
        `  ${mark} ${time}${b.title} (${isAr ? meta.ar : meta.en})`
      );
    }
    lines.push("");
  }
  const summary = buildWeekSummary(schedule, accountCode, weekStartsOn);
  lines.push(
    isAr
      ? `إنجاز الأسبوع: ${summary.pct}% (${summary.totalDone}/${summary.totalBlocks})`
      : `Week progress: ${summary.pct}% (${summary.totalDone}/${summary.totalBlocks})`
  );
  return lines.join("\n");
}

export function setWeekStartsOn(schedule, value) {
  const v = value === 0 ? 0 : 6;
  return { ...schedule, weekStartsOn: v };
}

export const QUICK_DURATIONS = [
  { mins: 25, en: "25m", ar: "٢٥ د" },
  { mins: 45, en: "45m", ar: "٤٥ د" },
  { mins: 60, en: "1h", ar: "١ س" },
  { mins: 90, en: "1.5h", ar: "١.٥ س" },
  { mins: 120, en: "2h", ar: "٢ س" },
];
