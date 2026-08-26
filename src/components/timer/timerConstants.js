/** Timer constants, prefs persistence, and small pure helpers. */
export const TIMER_PREFS_KEY = "twoTongues.timerPrefs";
export const TIMER_STATE_KEY = "twoTongues.timerState";
export const CHANNEL_NAME = "twoTongues.timerSync";

export const FONTS = [
  { id: "fraunces", label: "Fraunces", css: "'Fraunces', Georgia, serif" },
  { id: "source", label: "Source Sans", css: "'Source Sans 3', system-ui, sans-serif" },
  { id: "amiri", label: "Amiri", css: "'Amiri', 'Times New Roman', serif" },
  { id: "mono", label: "Monospace", css: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
  { id: "system", label: "System", css: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" },
];

export const BG_PRESETS = [
  { id: "ink", label: { en: "Deep ink", ar: "حبر غامق" }, value: "linear-gradient(160deg, #0f1419 0%, #1a2332 50%, #0d1117 100%)" },
  { id: "paper", label: { en: "Warm paper", ar: "ورق دافئ" }, value: "linear-gradient(160deg, #f7f0e4 0%, #ebe3d4 50%, #e2d8c4 100%)" },
  { id: "ocean", label: { en: "Ocean", ar: "محيط" }, value: "linear-gradient(160deg, #0c4a6e 0%, #0369a1 40%, #0e7490 100%)" },
  { id: "forest", label: { en: "Forest", ar: "غابة" }, value: "linear-gradient(160deg, #14532d 0%, #166534 45%, #15803d 100%)" },
  { id: "sunset", label: { en: "Sunset", ar: "غروب" }, value: "linear-gradient(160deg, #7c2d12 0%, #c2410c 40%, #ea580c 100%)" },
  { id: "plum", label: { en: "Plum", ar: "برقوق" }, value: "linear-gradient(160deg, #4c1d95 0%, #6d28d9 45%, #7c3aed 100%)" },
  { id: "slate", label: { en: "Slate", ar: "رمادي" }, value: "linear-gradient(160deg, #1e293b 0%, #334155 50%, #475569 100%)" },
  { id: "rose", label: { en: "Rose", ar: "وردي" }, value: "linear-gradient(160deg, #881337 0%, #be123c 45%, #e11d48 100%)" },
  // Nature-inspired gradients
  { id: "meadow", label: { en: "Meadow", ar: "مروج" }, value: "linear-gradient(165deg, #86efac 0%, #4ade80 35%, #22c55e 70%, #15803d 100%)" },
  { id: "mountain", label: { en: "Mountains", ar: "جبال" }, value: "linear-gradient(180deg, #bfdbfe 0%, #93c5fd 25%, #64748b 55%, #334155 100%)" },
  { id: "desert", label: { en: "Desert", ar: "صحراء" }, value: "linear-gradient(160deg, #fde68a 0%, #fbbf24 40%, #d97706 75%, #92400e 100%)" },
  { id: "aurora", label: { en: "Aurora", ar: "شفق" }, value: "linear-gradient(145deg, #0f172a 0%, #14532d 30%, #0e7490 60%, #4c1d95 100%)" },
  { id: "lake", label: { en: "Lake", ar: "بحيرة" }, value: "linear-gradient(170deg, #e0f2fe 0%, #7dd3fc 40%, #0ea5e9 75%, #0369a1 100%)" },
  { id: "sky", label: { en: "Open sky", ar: "سماء" }, value: "linear-gradient(180deg, #38bdf8 0%, #7dd3fc 40%, #bae6fd 70%, #f0f9ff 100%)" },
  { id: "night", label: { en: "Starry night", ar: "ليلة نجوم" }, value: "linear-gradient(160deg, #020617 0%, #1e1b4b 45%, #312e81 80%, #0f172a 100%)" },
  { id: "mist", label: { en: "Morning mist", ar: "ضباب الصباح" }, value: "linear-gradient(160deg, #f1f5f9 0%, #cbd5e1 40%, #94a3b8 70%, #64748b 100%)" },
];

export const DEFAULT_PREFS = {
  fontId: "fraunces",
  fontSize: 96,
  textColor: "#ffffff",
  bgId: "ink",
  customBg: null, // data URL from user upload
  mode: "countdown", // countdown | stopwatch | pomodoro
  alarmId: "chime",
  ambientId: "off",
  alarmVolume: 0.7,
  ambientVolume: 0.25,
  flipDigits: false, // optional flip-clock style digits
  sessionTitle: "", // optional label for this study session
  showLowerCounter: true, // show/hide the mini session counter below the main timer
  flipCardBg: "#000000", // background color of flip cards
  flipCardOpacity: 1, // 0–1 transparency of flip card background
  // Pomodoro
  pomoWorkMin: 25,
  pomoBreakMin: 5,
  pomoCycles: 4,
};

export const POMO_PRESETS = [
  { id: "classic", en: "Classic 25 / 5", ar: "كلاسيك 25 / 5", work: 25, brk: 5 },
  { id: "short", en: "Short 15 / 5", ar: "قصير 15 / 5", work: 15, brk: 5 },
  { id: "deep", en: "Deep 50 / 10", ar: "عميق 50 / 10", work: 50, brk: 10 },
  { id: "hour", en: "Hour 60 / 10", ar: "ساعة 60 / 10", work: 60, brk: 10 },
  { id: "sprint", en: "Sprint 10 / 3", ar: "سبرنت 10 / 3", work: 10, brk: 3 },
];

export const ALARM_SOUNDS = [
  { id: "chime", en: "Chime", ar: "جرس ناعم" },
  { id: "beep", en: "Beep", ar: "صفارة" },
  { id: "bell", en: "Bell", ar: "جرس" },
  { id: "digital", en: "Digital", ar: "رقمي" },
  { id: "soft", en: "Soft pulse", ar: "نبضة هادئة" },
  { id: "temple", en: "Temple", ar: "معبد" },
  { id: "xylophone", en: "Xylophone", ar: "زيلوفون" },
  { id: "rising", en: "Rising tone", ar: "نغمة صاعدة" },
  { id: "double", en: "Double ding", ar: "رنين مزدوج" },
  { id: "off", en: "Silent", ar: "صامت" },
];

export const AMBIENT_SOUNDS = [
  { id: "off", en: "Off", ar: "إيقاف" },
  { id: "rain", en: "Rain", ar: "مطر" },
  { id: "hum", en: "Soft hum", ar: "همهمة" },
  { id: "waves", en: "Waves", ar: "أمواج" },
  { id: "focus", en: "Focus drone", ar: "تركيز" },
  { id: "tick", en: "Clock tick", ar: "تكتكة ساعة" },
  { id: "birds", en: "Birds", ar: "طيور" },
  { id: "wind", en: "Wind", ar: "رياح" },
  { id: "fire", en: "Campfire", ar: "نار مخيم" },
  { id: "stream", en: "Stream", ar: "جدول ماء" },
  { id: "night", en: "Night insects", ar: "ليل" },
];

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(TIMER_PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const p = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...p };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(TIMER_PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

export function loadLiveState() {
  try {
    const raw = localStorage.getItem(TIMER_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveLiveState(state) {
  try {
    localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state));
  } catch {}
}

export function clearLiveState() {
  try {
    localStorage.removeItem(TIMER_STATE_KEY);
  } catch {}
}

export function pad(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

export function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export function parseHms(h, m, s) {
  const hh = Math.max(0, Math.min(999, Number(h) || 0));
  const mm = Math.max(0, Math.min(59, Number(m) || 0));
  const ss = Math.max(0, Math.min(59, Number(s) || 0));
  return ((hh * 3600) + (mm * 60) + ss) * 1000;
}



export function isMobileLike() {
  if (typeof window === "undefined") return false;
  const narrow = window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
  const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const touch = typeof navigator !== "undefined" && (navigator.maxTouchPoints || 0) > 0;
  return !!(narrow || (coarse && touch));
}


