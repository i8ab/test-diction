/**
 * Day achievements + medical-style spaced repetition driven by RECALL QUALITY.
 *
 * Non-SRS items expire after their calendar day and are purged on load.
 * SRS items persist until the user deletes them.
 *
 * At each review the user enters how well they remembered (1–100%).
 * The system maps that quality to the next medical interval — the user does
 * NOT pre-set a schedule percentage.
 *
 * Medical ladder (evidence-informed spaced retrieval / clinical education):
 *   Day 1 → Day 3 → Week 1 → Month 1 → 3 months → 6 months → 12 months
 *
 * Quality bands (international SRS practice, SM-2–inspired thresholds):
 *   1–39%  fail      → demote 1–2 steps, short relearn window
 *   40–59% hard      → demote or stay, partial interval
 *   60–74% fair      → stay, ~70% of current step
 *   75–89% good      → advance 1 step after consecutive success, full step
 *   90–100% excellent → advance (faster mastery), full next step
 */

const KEY = "twoTongues.dayAchievements";
const KEY_FOR = (code) => (code ? `twoTongues.dayAchievements.${code}` : KEY);
const NOTIF_KEY = "twoTongues.dayAchievementNotifs";
const NOTIF_KEY_FOR = (code) => (code ? `twoTongues.dayAchievementNotifs.${code}` : NOTIF_KEY);

const DAY_MS = 24 * 60 * 60 * 1000;

/** Full medical intervals (ms) per ladder step. */
export const MEDICAL_SRS_INTERVALS_MS = [
  1 * DAY_MS, // 0 — Day 1
  3 * DAY_MS, // 1 — Day 3
  7 * DAY_MS, // 2 — Week 1
  30 * DAY_MS, // 3 — Month 1
  90 * DAY_MS, // 4 — 3 months
  180 * DAY_MS, // 5 — 6 months
  365 * DAY_MS, // 6 — 12 months (mastered)
];

export const MEDICAL_SRS_LABELS = [
  { en: "Day 1", ar: "اليوم ١" },
  { en: "Day 3", ar: "اليوم ٣" },
  { en: "Week 1", ar: "أسبوع ١" },
  { en: "Month 1", ar: "شهر ١" },
  { en: "3 months", ar: "٣ أشهر" },
  { en: "6 months", ar: "٦ أشهر" },
  { en: "12 months", ar: "١٢ شهر (متقن)" },
];

const MAX_LEVEL = MEDICAL_SRS_INTERVALS_MS.length - 1;

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function clampRecallPercent(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 50;
  return Math.max(1, Math.min(100, v));
}

function clampLevel(n) {
  const v = Math.round(Number(n) || 0);
  return Math.max(0, Math.min(MAX_LEVEL, v));
}

/**
 * Classify recall quality into a band used by medical SRS rules.
 * @returns {"fail"|"hard"|"fair"|"good"|"excellent"}
 */
export function recallBand(percent) {
  const p = clampRecallPercent(percent);
  if (p < 40) return "fail";
  if (p < 60) return "hard";
  if (p < 75) return "fair";
  if (p < 90) return "good";
  return "excellent";
}

/**
 * Compute next level + due timestamp from current level, streak, and recall %.
 * Returns { level, dueAt, intervalMs, band, advanced }.
 */
export function planNextReview(currentLevel, correctStreak, recallPercent, now = Date.now()) {
  const p = clampRecallPercent(recallPercent);
  const band = recallBand(p);
  let level = clampLevel(currentLevel);
  let streak = Math.max(0, Number(correctStreak) || 0);
  let advanced = false;

  // Interval scale relative to the ladder step we land on
  let scale = 1;

  switch (band) {
    case "fail":
      // Severe miss — drop up to 2 steps; relearn within ~12–24h of Day-1 step
      level = Math.max(0, level - (p < 25 ? 2 : 1));
      streak = 0;
      scale = p < 25 ? 0.35 : 0.5;
      break;
    case "hard":
      // Weak recall — drop one step or stay at 0; shorter than full step
      if (level > 0) level -= 1;
      streak = 0;
      scale = 0.55 + (p - 40) / 100; // ~0.55–0.74
      break;
    case "fair":
      // Acceptable — hold level; partial interval so item returns sooner
      streak = 0;
      scale = 0.65 + (p - 60) / 200; // ~0.65–0.72
      break;
    case "good":
      // Solid — consecutive good scores promote one medical step
      streak += 1;
      if (streak >= 2 && level < MAX_LEVEL) {
        level += 1;
        streak = 0;
        advanced = true;
      }
      scale = 0.85 + (p - 75) / 100; // ~0.85–0.99
      break;
    case "excellent":
      // Strong mastery signal — promote after 1 excellent (or 2 if already high)
      streak += 1;
      if (level < MAX_LEVEL && (streak >= 1 || p >= 95)) {
        level += 1;
        streak = 0;
        advanced = true;
      }
      scale = 1;
      break;
    default:
      scale = 0.7;
  }

  const full = MEDICAL_SRS_INTERVALS_MS[level] || MEDICAL_SRS_INTERVALS_MS[0];
  const intervalMs = Math.max(60 * 60 * 1000, Math.round(full * scale)); // min 1 hour
  return {
    level,
    streak,
    dueAt: now + intervalMs,
    intervalMs,
    band,
    advanced,
    recallPercent: p,
  };
}

/** Human label for a planned interval (Arabic / English via isAr). */
export function formatIntervalDuration(ms, isAr = false) {
  if (ms == null || ms <= 0) return isAr ? "الآن" : "now";
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 36) {
    return isAr ? `حوالي ${hours} ساعة` : `about ${hours}h`;
  }
  const days = Math.round(ms / DAY_MS);
  if (days < 14) return isAr ? `حوالي ${days} يوم` : `about ${days} days`;
  if (days < 45) {
    const w = Math.round(days / 7);
    return isAr ? `حوالي ${w} أسبوع` : `about ${w} week(s)`;
  }
  const months = Math.round(days / 30);
  return isAr ? `حوالي ${months} شهر` : `about ${months} month(s)`;
}

/** Preview helper for UI: what happens if user rates this % now. */
export function previewReviewOutcome(entry, recallPercent, isAr = false) {
  const plan = planNextReview(entry?.srsLevel || 0, entry?.correctStreak || 0, recallPercent);
  const label = MEDICAL_SRS_LABELS[plan.level] || MEDICAL_SRS_LABELS[0];
  return {
    ...plan,
    levelLabel: isAr ? label.ar : label.en,
    intervalLabel: formatIntervalDuration(plan.intervalMs, isAr),
  };
}

export function computeNextDueAt(level, _unusedPercent, now = Date.now()) {
  // Kept for callers that only need "full step from level"
  const full = MEDICAL_SRS_INTERVALS_MS[clampLevel(level)] || MEDICAL_SRS_INTERVALS_MS[0];
  return now + full;
}

function normalizeEntry(raw) {
  if (!raw || typeof raw.title !== "string" || !raw.title.trim()) return null;
  const useSrs = !!raw.useSrs;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : uid(),
    title: String(raw.title).trim().slice(0, 200),
    note: typeof raw.note === "string" ? String(raw.note).slice(0, 800) : "",
    date: typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : todayISO(),
    useSrs,
    srsLevel: clampLevel(raw.srsLevel),
    srsDueAt: typeof raw.srsDueAt === "number" ? raw.srsDueAt : null,
    /** Last recall quality the user entered at review time (1–100), informational */
    lastRecallPercent:
      raw.lastRecallPercent != null ? clampRecallPercent(raw.lastRecallPercent) : null,
    correctStreak: Math.max(0, Number(raw.correctStreak) || 0),
    totalReviews: Math.max(0, Number(raw.totalReviews) || 0),
    correctReviews: Math.max(0, Number(raw.correctReviews) || 0),
    weaknessNotes: normalizeWeaknessNotes(raw.weaknessNotes),
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

function normalizeWeaknessNotes(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((w) => w && typeof w.text === "string" && w.text.trim())
    .map((w) => ({
      text: String(w.text).trim().slice(0, 800),
      percent: w.percent != null ? clampRecallPercent(w.percent) : null,
      at: typeof w.at === "number" ? w.at : Date.now(),
    }))
    .slice(-30);
}

export function purgeExpiredDayAchievements(list, today = todayISO()) {
  return (list || []).filter((e) => {
    if (!e) return false;
    if (e.useSrs) return true;
    return e.date >= today;
  });
}

export function loadDayAchievements(accountCode) {
  try {
    const key = KEY_FOR(accountCode);
    const raw = localStorage.getItem(key) || (!accountCode ? null : localStorage.getItem(KEY));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const normalized = arr.map(normalizeEntry).filter(Boolean);
    const purged = purgeExpiredDayAchievements(normalized);
    if (purged.length !== normalized.length) {
      saveDayAchievements(purged, accountCode);
    }
    return purged.slice(0, 300);
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
    if (raw == null) return true;
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
    lastRecallPercent: null,
    // First review after full Day-1 medical step
    srsDueAt: useSrs ? now + MEDICAL_SRS_INTERVALS_MS[0] : null,
    correctStreak: 0,
    totalReviews: 0,
    correctReviews: 0,
    weaknessNotes: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Record a review with explicit recall quality (1–100).
 * The system decides the next interval from medical ladder + quality bands.
 */
export function recordDayAchievementReview(entry, recallPercent, opts = {}) {
  if (!entry) return entry;
  const plan = planNextReview(entry.srsLevel || 0, entry.correctStreak || 0, recallPercent);
  const countedCorrect = plan.recallPercent >= 60;
  const weaknessNotes = normalizeWeaknessNotes(entry.weaknessNotes);
  const noteText = opts && typeof opts.weaknessNote === "string" ? opts.weaknessNote.trim() : "";
  if (noteText) {
    weaknessNotes.push({
      text: noteText.slice(0, 800),
      percent: plan.recallPercent,
      at: Date.now(),
    });
  }
  return {
    ...entry,
    totalReviews: (entry.totalReviews || 0) + 1,
    correctReviews: (entry.correctReviews || 0) + (countedCorrect ? 1 : 0),
    correctStreak: plan.streak,
    srsLevel: plan.level,
    srsDueAt: plan.dueAt,
    lastRecallPercent: plan.recallPercent,
    weaknessNotes: weaknessNotes.slice(-30),
    updatedAt: Date.now(),
  };
}

export function getDueDayAchievements(list, now = Date.now()) {
  return (list || []).filter(
    (e) => e && e.useSrs && e.srsDueAt != null && Number(e.srsDueAt) <= now
  );
}

export function formatDayAchievementDue(dueMs, isAr = false) {
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

export async function notifyDayAchievementDue(entry, isAr = false) {
  if (!entry) return false;
  const title =
    (entry.title && String(entry.title).trim()) ||
    (isAr ? "وقت المراجعة" : "Review Time");
  const body = isAr
    ? "حان وقت مراجعة إنجازك (تكرار متباعد — قيّم نسبة تذكرك)."
    : "Time to review your achievement — rate how well you remembered.";
  const tag = `day-ach-srs-${entry.id}`;

  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === "function") {
        await reg.showNotification(title, {
          body,
          tag,
          renotify: true,
          data: { type: "day-achievement-srs", id: entry.id },
          icon: "/icons/icon-192.png",
          badge: "/icons/favicon-64.png",
        });
        return true;
      }
    }
  } catch (_) {}

  try {
    if (typeof Notification !== "undefined") {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission === "granted") {
        // eslint-disable-next-line no-new
        new Notification(title, { body, tag, data: { type: "day-achievement-srs", id: entry.id } });
        return true;
      }
    }
  } catch (_) {}
  return false;
}

export async function notifyAllDueDayAchievements(list, isAr = false, enabled = true) {
  if (!enabled) return 0;
  const due = getDueDayAchievements(list);
  let n = 0;
  for (const entry of due) {
    const key = `dayAchNotifSent.${entry.id}.${entry.srsDueAt}`;
    try {
      if (sessionStorage.getItem(key)) continue;
      sessionStorage.setItem(key, "1");
    } catch (_) {}
    if (await notifyDayAchievementDue(entry, isAr)) n += 1;
  }
  return n;
}


/**
 * Sync SRS due items to the server so cron can send real Web Push
 * (same pipeline as study reminders). No per-minute polling — cron runs on schedule.
 */
export async function syncDayAchievementPushSchedule(accountCode, list, enabled = true) {
  if (!accountCode || accountCode === "guest") return { ok: false, reason: "no_account" };
  const items = (list || [])
    .filter((e) => e && e.useSrs && typeof e.srsDueAt === "number")
    .map((e) => ({
      id: e.id,
      title: e.title || "",
      dueAt: e.srsDueAt,
      notifiedDueAt: e.pushNotifiedDueAt != null ? e.pushNotifiedDueAt : null,
    }))
    .slice(0, 50);

  try {
    const r = await fetch("/api/push?action=dayAchSchedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: accountCode,
        enabled: !!enabled,
        items: enabled ? items : [],
      }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return { ok: false, status: r.status, error: err.error };
    }
    return await r.json();
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}


/** Prevent duplicate local fires for the same (id, dueAt) in this tab. */
const _localFired = new Set();

export async function requestDayAchievementPushNow(accountCode) {
  if (!accountCode || accountCode === "guest") return { ok: false };
  try {
    const r = await fetch("/api/push?action=dayAchNotifyDue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: accountCode }),
    });
    return await r.json().catch(() => ({ ok: false }));
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/**
 * Near–real-time due watcher (≈1 min tick + exact timeouts).
 * Does NOT require cron every minute. While the PWA/tab can run timers:
 *   - fires SW notification at due time
 *   - asks the server to send the same Web Push to subscribed devices
 * Cron remains a backup when the app is fully closed.
 *
 * @returns {function} stop()
 */
export function startDayAchievementDueWatcher({
  getList,
  accountCode,
  enabled = true,
  isAr = false,
  intervalMs = 60 * 1000,
} = {}) {
  if (typeof window === "undefined") return () => {};

  const timers = new Map(); // id -> timeoutId
  let tickId = null;
  let stopped = false;

  async function fireOne(entry) {
    if (!entry || !entry.useSrs || entry.srsDueAt == null) return;
    const key = `${entry.id}:${entry.srsDueAt}`;
    if (_localFired.has(key)) return;
    _localFired.add(key);
    try {
      await notifyDayAchievementDue(entry, isAr);
    } catch (_) {}
    if (accountCode && accountCode !== "guest") {
      requestDayAchievementPushNow(accountCode).catch(() => {});
    }
  }

  function clearTimers() {
    for (const id of timers.values()) clearTimeout(id);
    timers.clear();
  }

  function armTimeouts(list) {
    clearTimers();
    if (!enabled) return;
    const now = Date.now();
    for (const entry of list || []) {
      if (!entry || !entry.useSrs || entry.srsDueAt == null) continue;
      const due = Number(entry.srsDueAt);
      if (!Number.isFinite(due)) continue;
      const key = `${entry.id}:${due}`;
      if (_localFired.has(key)) continue;

      if (due <= now) {
        fireOne(entry);
        continue;
      }
      // Arm exact timeout (cap far-future to avoid huge timer issues: 7 days)
      const delay = Math.min(due - now, 7 * 24 * 60 * 60 * 1000);
      if (delay > 7 * 24 * 60 * 60 * 1000) continue;
      const tid = setTimeout(() => {
        timers.delete(entry.id);
        fireOne(entry);
      }, delay);
      timers.set(entry.id, tid);
    }
  }

  function tick() {
    if (stopped || !enabled) return;
    let list = [];
    try {
      list = typeof getList === "function" ? getList() : [];
    } catch (_) {
      list = [];
    }
    armTimeouts(list);
    // Also ask server to flush any due pushes (covers other devices / missed local timer)
    if (accountCode && accountCode !== "guest") {
      const due = getDueDayAchievements(list);
      if (due.length) {
        requestDayAchievementPushNow(accountCode).catch(() => {});
      }
    }
  }

  function onVis() {
    if (document.visibilityState === "visible") tick();
  }

  tick();
  tickId = setInterval(tick, Math.max(30 * 1000, intervalMs)); // default every 1 min
  document.addEventListener("visibilitychange", onVis);

  return function stop() {
    stopped = true;
    if (tickId) clearInterval(tickId);
    clearTimers();
    document.removeEventListener("visibilitychange", onVis);
  };
}
