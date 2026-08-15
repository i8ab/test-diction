// Local storage helpers: theme, accent, offline cache, session, search history, lang.

export const THEME_KEY = "twoTongues.theme";
const ACCENT_KEY = "twoTongues.accent";
const SKIN_KEY = "twoTongues.skin";
const LATIN_FONT_KEY = "twoTongues.latinFont";
const ARABIC_FONT_KEY = "twoTongues.arabicFont";
const REDUCED_MOTION_KEY = "twoTongues.reducedMotion";
const OFFLINE_KEY = "twoTongues.offlineCache";
const CODE_KEY = "twoTongues.personalCode";
const SESSION_KEY = "twoTongues.sessionId";
const LANG_KEY = "twoTongues.appLang";
const DEVICE_MODE_KEY = "twoTongues.deviceMode";
const UI_SCALE_KEY = "twoTongues.uiScale";
const HISTORY_KEY = "twoTongues.searchHistory";

// Accents must work on both light and dark (soft colors differ).
export const ACCENT_THEMES = {
  ocean: {
    label: { en: "Ocean", ar: "محيطي" },
    light: { a1: "#19A7CE", a2: "#146C94", soft1: "rgba(25,167,206,0.14)", soft2: "rgba(20,108,148,0.10)", focus: "25,167,206", meaning: "#1F7A9E" },
    dark:  { a1: "#3FC1E8", a2: "#6BAFD1", soft1: "rgba(63,193,232,0.18)", soft2: "rgba(107,175,209,0.14)", focus: "63,193,232", meaning: "#6FCCEE" },
  },
  brass: {
    label: { en: "Brass", ar: "نحاسي" },
    light: { a1: "#C9A227", a2: "#A67C00", soft1: "rgba(201,162,39,0.16)", soft2: "rgba(166,124,0,0.12)", focus: "201,162,39", meaning: "#8a6a00" },
    dark:  { a1: "#E8C547", a2: "#D4A017", soft1: "rgba(232,197,71,0.18)", soft2: "rgba(212,160,23,0.14)", focus: "232,197,71", meaning: "#f0d56a" },
  },
  berry: {
    label: { en: "Berry", ar: "توتي" },
    light: { a1: "#9b5de5", a2: "#f15bb5", soft1: "rgba(155,93,229,0.14)", soft2: "rgba(241,91,181,0.12)", focus: "155,93,229", meaning: "#7b3db5" },
    dark:  { a1: "#c77dff", a2: "#ff85c8", soft1: "rgba(199,125,255,0.18)", soft2: "rgba(255,133,200,0.14)", focus: "199,125,255", meaning: "#e0aaff" },
  },
  forest: {
    label: { en: "Forest", ar: "غابة" },
    light: { a1: "#2ecc71", a2: "#27ae60", soft1: "rgba(46,204,113,0.14)", soft2: "rgba(39,174,96,0.12)", focus: "46,204,113", meaning: "#1e8449" },
    dark:  { a1: "#58d68d", a2: "#2ecc71", soft1: "rgba(88,214,141,0.18)", soft2: "rgba(46,204,113,0.14)", focus: "88,214,141", meaning: "#82e0aa" },
  },
  sunset: {
    label: { en: "Sunset", ar: "غروب" },
    light: { a1: "#ff6b35", a2: "#f7c59f", soft1: "rgba(255,107,53,0.14)", soft2: "rgba(247,197,159,0.14)", focus: "255,107,53", meaning: "#e85d04" },
    dark:  { a1: "#ff8c5a", a2: "#ffb347", soft1: "rgba(255,140,90,0.18)", soft2: "rgba(255,179,71,0.14)", focus: "255,140,90", meaning: "#ffb347" },
  },
  coral: {
    label: { en: "Coral", ar: "مرجاني" },
    light: { a1: "#ff4d6d", a2: "#c9184a", soft1: "rgba(255,77,109,0.14)", soft2: "rgba(201,24,74,0.12)", focus: "255,77,109", meaning: "#c9184a" },
    dark:  { a1: "#ff6b8a", a2: "#ff8fab", soft1: "rgba(255,107,138,0.18)", soft2: "rgba(255,143,171,0.14)", focus: "255,107,138", meaning: "#ff8fab" },
  },
  violet: {
    label: { en: "Violet", ar: "بنفسجي" },
    light: { a1: "#7c3aed", a2: "#4c1d95", soft1: "rgba(124,58,237,0.14)", soft2: "rgba(76,29,149,0.12)", focus: "124,58,237", meaning: "#5b21b6" },
    dark:  { a1: "#a78bfa", a2: "#8b5cf6", soft1: "rgba(167,139,250,0.18)", soft2: "rgba(139,92,246,0.14)", focus: "167,139,250", meaning: "#c4b5fd" },
  },
  mint: {
    label: { en: "Mint", ar: "نعناعي" },
    light: { a1: "#00c9a7", a2: "#00a896", soft1: "rgba(0,201,167,0.14)", soft2: "rgba(0,168,150,0.12)", focus: "0,201,167", meaning: "#00897b" },
    dark:  { a1: "#2dd4bf", a2: "#5eead4", soft1: "rgba(45,212,191,0.18)", soft2: "rgba(94,234,212,0.14)", focus: "45,212,191", meaning: "#99f6e4" },
  },
  rose: {
    label: { en: "Rose", ar: "وردي" },
    light: { a1: "#e11d48", a2: "#fb7185", soft1: "rgba(225,29,72,0.14)", soft2: "rgba(251,113,133,0.12)", focus: "225,29,72", meaning: "#be123c" },
    dark:  { a1: "#fb7185", a2: "#fda4af", soft1: "rgba(251,113,133,0.18)", soft2: "rgba(253,164,175,0.14)", focus: "251,113,133", meaning: "#fecdd3" },
  },
  sky: {
    label: { en: "Sky", ar: "سماوي" },
    light: { a1: "#0ea5e9", a2: "#38bdf8", soft1: "rgba(14,165,233,0.14)", soft2: "rgba(56,189,248,0.12)", focus: "14,165,233", meaning: "#0284c7" },
    dark:  { a1: "#38bdf8", a2: "#7dd3fc", soft1: "rgba(56,189,248,0.18)", soft2: "rgba(125,211,252,0.14)", focus: "56,189,248", meaning: "#bae6fd" },
  },
};

/**
 * Full mood / skin templates. Each skin overrides base surface colors
 * (paper, card, ink, muted…) while accent colors stay independent.
 * Designed to reduce visual fatigue during long study sessions.
 */
export const SKIN_PRESETS = {
  classic: {
    id: "classic",
    label: { en: "Classic", ar: "كلاسيك", de: "Klassisch", fr: "Classique" },
    desc:  { en: "Clean default", ar: "الافتراضي النظيف" },
    // empty = use CSS :root / data-theme defaults
    light: null,
    dark: null,
    preview: { paper: "#FAFDFE", card: "#FFFFFF", ink: "#146C94", accent: "#19A7CE" },
  },
  paper: {
    id: "paper",
    label: { en: "Paper", ar: "ورق", de: "Papier", fr: "Papier" },
    desc:  { en: "Warm notebook", ar: "دفتر دافئ" },
    light: {
      paper: "#F5F0E6", card: "#FFFEF7", ink: "#3D3226",
      muted: "#9A8B78", "muted-strong": "#6B5C4A", "icon-muted": "#8A7B68",
      "input-bg": "#EFE8DA", "border-rgb": "120,100,70", meaning: "#5C4A32",
    },
    dark: {
      paper: "#1A1610", card: "#241F18", ink: "#EDE4D4",
      muted: "#A89880", "muted-strong": "#C4B49A", "icon-muted": "#B0A088",
      "input-bg": "#2C261E", "border-rgb": "160,140,100", meaning: "#D4C4A8",
    },
    preview: { paper: "#F5F0E6", card: "#FFFEF7", ink: "#3D3226", accent: "#C9A227" },
  },
  midnight: {
    id: "midnight",
    label: { en: "Midnight", ar: "منتصف الليل", de: "Mitternacht", fr: "Minuit" },
    desc:  { en: "True black focus", ar: "أسود عميق للتركيز" },
    light: {
      paper: "#E8EAEF", card: "#F4F5F8", ink: "#1A1D26",
      muted: "#7A8294", "muted-strong": "#4A5266", "icon-muted": "#6A7284",
      "input-bg": "#DEE1E8", "border-rgb": "60,70,90", meaning: "#2A3448",
    },
    dark: {
      paper: "#050608", card: "#0E1014", ink: "#E8ECF4",
      muted: "#7A8498", "muted-strong": "#A0AABC", "icon-muted": "#8A94A8",
      "input-bg": "#141820", "border-rgb": "50,60,80", meaning: "#B0BACC",
    },
    preview: { paper: "#050608", card: "#0E1014", ink: "#E8ECF4", accent: "#6BAFD1" },
  },
  forest: {
    id: "forest",
    label: { en: "Forest", ar: "غابة", de: "Wald", fr: "Forêt" },
    desc:  { en: "Calm green", ar: "أخضر هادئ" },
    light: {
      paper: "#F0F5F0", card: "#F8FBF8", ink: "#1E3A2A",
      muted: "#7A9A82", "muted-strong": "#4A6A52", "icon-muted": "#6A8A72",
      "input-bg": "#E4EDE4", "border-rgb": "60,110,70", meaning: "#2A5A3A",
    },
    dark: {
      paper: "#0C1610", card: "#14201A", ink: "#E0F0E4",
      muted: "#7AAA88", "muted-strong": "#A0C4A8", "icon-muted": "#8AB898",
      "input-bg": "#1A2A20", "border-rgb": "70,130,90", meaning: "#B0D4B8",
    },
    preview: { paper: "#F0F5F0", card: "#F8FBF8", ink: "#1E3A2A", accent: "#2ecc71" },
  },
  rose: {
    id: "rose",
    label: { en: "Rose", ar: "وردي", de: "Rose", fr: "Rose" },
    desc:  { en: "Soft blush", ar: "وردي ناعم" },
    light: {
      paper: "#FDF6F7", card: "#FFFCFC", ink: "#4A2A32",
      muted: "#B08A92", "muted-strong": "#8A5A66", "icon-muted": "#A07A84",
      "input-bg": "#F5E8EA", "border-rgb": "160,100,110", meaning: "#6A3A48",
    },
    dark: {
      paper: "#181012", card: "#22181A", ink: "#F4E4E8",
      muted: "#B09098", "muted-strong": "#D0B0B8", "icon-muted": "#C0A0A8",
      "input-bg": "#2A1E22", "border-rgb": "150,100,110", meaning: "#E0C0C8",
    },
    preview: { paper: "#FDF6F7", card: "#FFFCFC", ink: "#4A2A32", accent: "#e11d48" },
  },
  slate: {
    id: "slate",
    label: { en: "Slate", ar: "أردواز", de: "Schiefer", fr: "Ardoise" },
    desc:  { en: "Cool professional", ar: "رمادي احترافي" },
    light: {
      paper: "#F2F4F6", card: "#FAFBFC", ink: "#1E2A32",
      muted: "#7A8A96", "muted-strong": "#4A5A66", "icon-muted": "#6A7A86",
      "input-bg": "#E6EAEE", "border-rgb": "80,100,120", meaning: "#2A3A48",
    },
    dark: {
      paper: "#0E1216", card: "#161C22", ink: "#E4EAF0",
      muted: "#7A8A98", "muted-strong": "#A0B0BE", "icon-muted": "#8A9AA8",
      "input-bg": "#1A2228", "border-rgb": "70,90,110", meaning: "#B0C0CE",
    },
    preview: { paper: "#F2F4F6", card: "#FAFBFC", ink: "#1E2A32", accent: "#64748b" },
  },
  warm: {
    id: "warm",
    label: { en: "Warm", ar: "دافئ", de: "Warm", fr: "Chaud" },
    desc:  { en: "Coffee & cream", ar: "قهوة وكريمة" },
    light: {
      paper: "#F7F0E6", card: "#FFF9F0", ink: "#3A2A1A",
      muted: "#A08A70", "muted-strong": "#6A5438", "icon-muted": "#8A7458",
      "input-bg": "#EFE4D4", "border-rgb": "140,110,70", meaning: "#5A4028",
    },
    dark: {
      paper: "#16120E", card: "#221C16", ink: "#F0E6D8",
      muted: "#A89880", "muted-strong": "#C8B8A0", "icon-muted": "#B0A088",
      "input-bg": "#2A221A", "border-rgb": "140,120,90", meaning: "#D8C8B0",
    },
    preview: { paper: "#F7F0E6", card: "#FFF9F0", ink: "#3A2A1A", accent: "#C9A227" },
  },
  contrast: {
    id: "contrast",
    label: { en: "High Contrast", ar: "تباين عالي", de: "Hoher Kontrast", fr: "Contraste élevé" },
    desc:  { en: "Max readability", ar: "أقصى وضوح" },
    light: {
      paper: "#FFFFFF", card: "#FFFFFF", ink: "#000000",
      muted: "#555555", "muted-strong": "#222222", "icon-muted": "#333333",
      "input-bg": "#F0F0F0", "border-rgb": "0,0,0", meaning: "#000000",
    },
    dark: {
      paper: "#000000", card: "#0A0A0A", ink: "#FFFFFF",
      muted: "#AAAAAA", "muted-strong": "#DDDDDD", "icon-muted": "#CCCCCC",
      "input-bg": "#1A1A1A", "border-rgb": "255,255,255", meaning: "#FFFFFF",
    },
    preview: { paper: "#000000", card: "#0A0A0A", ink: "#FFFFFF", accent: "#FFFFFF" },
  },
};

function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Build a full accent palette from a single hex color (custom theme). */
export function buildCustomAccent(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const { r, g, b } = rgb;
  const a1 = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  const a2r = Math.max(0, Math.round(r * 0.75));
  const a2g = Math.max(0, Math.round(g * 0.75));
  const a2b = Math.max(0, Math.round(b * 0.75));
  const a2 = `#${((1 << 24) + (a2r << 16) + (a2g << 8) + a2b).toString(16).slice(1)}`;
  return {
    label: { en: "Custom", ar: "مخصص" },
    light: {
      a1, a2,
      soft1: `rgba(${r},${g},${b},0.14)`,
      soft2: `rgba(${a2r},${a2g},${a2b},0.12)`,
      focus: `${r},${g},${b}`,
      meaning: a2,
    },
    dark: {
      a1, a2,
      soft1: `rgba(${r},${g},${b},0.22)`,
      soft2: `rgba(${a2r},${a2g},${a2b},0.16)`,
      focus: `${r},${g},${b}`,
      meaning: a1,
    },
  };
}

export function loadSavedTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "dark" || t === "light" || t === "system") return t;
  } catch (_) {}
  return "system";
}

export function resolveTheme(theme) {
  if (theme === "dark" || theme === "light") return theme;
  try {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  } catch (_) {}
  return "light";
}

export function loadUiScale() {
  try {
    const n = Number(localStorage.getItem(UI_SCALE_KEY));
    if (n === 0.9 || n === 1 || n === 1.1 || n === 1.2) return n;
  } catch (_) {}
  return 1;
}

export function saveUiScale(scale) {
  try { localStorage.setItem(UI_SCALE_KEY, String(scale)); } catch (_) {}
}


export function loadSavedAccent() {
  try {
    const id = localStorage.getItem(ACCENT_KEY) || "ocean";
    if (id === "custom") return "custom";
    return ACCENT_THEMES[id] ? id : "ocean";
  } catch (_) {
    return "ocean";
  }
}

export function loadCustomAccentHex() {
  try {
    const h = localStorage.getItem("tt_custom_accent");
    return h && /^#[0-9A-Fa-f]{6}$/.test(h) ? h : "#19A7CE";
  } catch (_) {
    return "#19A7CE";
  }
}

export function saveCustomAccentHex(hex) {
  try {
    if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex)) localStorage.setItem("tt_custom_accent", hex);
  } catch (_) {}
}

export function saveAccent(id) {
  try {
    localStorage.setItem(ACCENT_KEY, id);
  } catch (_) {}
}

/** Apply accent CSS vars. Second arg is light/dark mode from the app theme. */
export function applyAccentTheme(id, mode, customHex) {
  let theme = ACCENT_THEMES[id] || ACCENT_THEMES.ocean;
  if (id === "custom") {
    const built = buildCustomAccent(customHex || (typeof localStorage !== "undefined" ? localStorage.getItem("tt_custom_accent") : null) || "#19A7CE");
    if (built) theme = built;
  }
  const isDark = mode === "dark" || (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark");
  const colors = isDark ? theme.dark : theme.light;
  try {
    const root = document.documentElement;
    root.style.setProperty("--accent-1", colors.a1);
    root.style.setProperty("--accent-2", colors.a2);
    root.style.setProperty("--accent-1-soft", colors.soft1);
    root.style.setProperty("--accent-2-soft", colors.soft2);
    root.style.setProperty("--focus-rgb", colors.focus);
    if (colors.meaning) root.style.setProperty("--meaning", colors.meaning);
  } catch (_) {}
}

// ── Skin / Mood templates ──────────────────────────────────────────────

const BASE_SURFACE_VARS = [
  "paper", "card", "ink", "muted", "muted-strong", "icon-muted",
  "input-bg", "border-rgb", "meaning",
];

export function loadSavedSkin() {
  try {
    const id = localStorage.getItem(SKIN_KEY) || "classic";
    return SKIN_PRESETS[id] ? id : "classic";
  } catch (_) {
    return "classic";
  }
}

export function saveSkin(id) {
  try {
    localStorage.setItem(SKIN_KEY, id || "classic");
  } catch (_) {}
}

/**
 * Apply a mood skin. Sets data-skin attribute and overrides surface CSS vars.
 * Pass mode ("light"|"dark") so the correct palette is chosen.
 * When skin is "classic", clears overrides so CSS defaults take over.
 */
export function applySkinTheme(id, mode) {
  const skin = SKIN_PRESETS[id] || SKIN_PRESETS.classic;
  const isDark = mode === "dark" || (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark");
  const palette = isDark ? skin.dark : skin.light;

  try {
    const root = document.documentElement;
    root.setAttribute("data-skin", skin.id);

    // Clear previous skin overrides first
    BASE_SURFACE_VARS.forEach((v) => root.style.removeProperty(`--${v}`));

    if (palette) {
      Object.entries(palette).forEach(([key, val]) => {
        root.style.setProperty(`--${key}`, val);
      });
    }
  } catch (_) {}
}

// ── Fonts (Latin UI + Arabic) ──────────────────────────────────────────

/** Latin / UI body fonts */
export const LATIN_FONTS = {
  "source-sans": {
    id: "source-sans",
    family: '"Source Sans 3", system-ui, sans-serif',
    label: { en: "Source Sans", ar: "سورس سانس" },
  },
  inter: {
    id: "inter",
    family: '"Inter", system-ui, sans-serif',
    label: { en: "Inter", ar: "إنتر" },
  },
  nunito: {
    id: "nunito",
    family: '"Nunito", system-ui, sans-serif',
    label: { en: "Nunito", ar: "نونيتو" },
  },
  "ibm-plex": {
    id: "ibm-plex",
    family: '"IBM Plex Sans", system-ui, sans-serif',
    label: { en: "IBM Plex", ar: "آي بي إم بليكس" },
  },
  georgia: {
    id: "georgia",
    family: 'Georgia, "Times New Roman", serif',
    label: { en: "Georgia", ar: "جورجيا" },
  },
  system: {
    id: "system",
    family: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    label: { en: "System", ar: "نظام الجهاز" },
  },
};

/** Arabic display / content fonts */
export const ARABIC_FONTS = {
  amiri: {
    id: "amiri",
    family: '"Amiri", "Times New Roman", serif',
    label: { en: "Amiri", ar: "أميري" },
  },
  cairo: {
    id: "cairo",
    family: '"Cairo", "Segoe UI", sans-serif',
    label: { en: "Cairo", ar: "القاهرة" },
  },
  tajawal: {
    id: "tajawal",
    family: '"Tajawal", "Segoe UI", sans-serif',
    label: { en: "Tajawal", ar: "تجوّل" },
  },
  "noto-naskh": {
    id: "noto-naskh",
    family: '"Noto Naskh Arabic", "Times New Roman", serif',
    label: { en: "Noto Naskh", ar: "نوتو نسخ" },
  },
  "ibm-plex-ar": {
    id: "ibm-plex-ar",
    family: '"IBM Plex Sans Arabic", "Segoe UI", sans-serif',
    label: { en: "IBM Plex Arabic", ar: "آي بي إم عربي" },
  },
  almarai: {
    id: "almarai",
    family: '"Almarai", "Segoe UI", sans-serif',
    label: { en: "Almarai", ar: "المراعي" },
  },
};

export function loadLatinFont() {
  try {
    const id = localStorage.getItem(LATIN_FONT_KEY) || "source-sans";
    return LATIN_FONTS[id] ? id : "source-sans";
  } catch (_) {
    return "source-sans";
  }
}

export function loadArabicFont() {
  try {
    const id = localStorage.getItem(ARABIC_FONT_KEY) || "amiri";
    return ARABIC_FONTS[id] ? id : "amiri";
  } catch (_) {
    return "amiri";
  }
}

export function saveLatinFont(id) {
  try { localStorage.setItem(LATIN_FONT_KEY, id || "source-sans"); } catch (_) {}
}

export function saveArabicFont(id) {
  try { localStorage.setItem(ARABIC_FONT_KEY, id || "amiri"); } catch (_) {}
}

export function applyFonts(latinId, arabicId) {
  const latin = LATIN_FONTS[latinId] || LATIN_FONTS["source-sans"];
  const arabic = ARABIC_FONTS[arabicId] || ARABIC_FONTS.amiri;
  try {
    const root = document.documentElement;
    root.style.setProperty("--font-latin", latin.family);
    root.style.setProperty("--font-arabic", arabic.family);
    root.setAttribute("data-latin-font", latin.id);
    root.setAttribute("data-arabic-font", arabic.id);
  } catch (_) {}
}

// ── Reduced motion ─────────────────────────────────────────────────────

export function loadReducedMotion() {
  try {
    return localStorage.getItem(REDUCED_MOTION_KEY) === "1";
  } catch (_) {
    return false;
  }
}

export function saveReducedMotion(on) {
  try {
    localStorage.setItem(REDUCED_MOTION_KEY, on ? "1" : "0");
  } catch (_) {}
}

export function applyReducedMotion(on) {
  try {
    document.documentElement.setAttribute("data-reduced-motion", on ? "1" : "0");
  } catch (_) {}
}

export function saveOfflineCache(rec) {
  try {
    localStorage.setItem(
      OFFLINE_KEY,
      JSON.stringify({ ...rec, cachedAt: Date.now() })
    );
  } catch (_) {}
}

export function loadOfflineCache() {
  try {
    const raw = localStorage.getItem(OFFLINE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/** Flag: local progress changed but cloud save may not have finished yet. */
const PENDING_SYNC_KEY = "twoTongues.pendingCloudSync";

export function markPendingCloudSync() {
  try { localStorage.setItem(PENDING_SYNC_KEY, String(Date.now())); } catch (_) {}
}

export function clearPendingCloudSync() {
  try { localStorage.removeItem(PENDING_SYNC_KEY); } catch (_) {}
}

export function getPendingCloudSyncAt() {
  try {
    const v = localStorage.getItem(PENDING_SYNC_KEY);
    if (!v) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  } catch (_) {
    return 0;
  }
}

/**
 * Account codes intentionally deleted/rejected. Survives reload so a race
 * (delete clicked → reload before cloud write finishes) cannot resurrect them.
 * Cleared when server no longer returns those codes.
 */
const PENDING_REMOVE_KEY = "twoTongues.pendingRemoveCodes";

export function loadPendingRemoveCodes() {
  try {
    const raw = localStorage.getItem(PENDING_REMOVE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((c) => String(c)).filter(Boolean);
  } catch (_) {
    return [];
  }
}

export function savePendingRemoveCodes(codes) {
  try {
    const list = [...new Set([...(codes || [])].map((c) => String(c)).filter(Boolean))];
    if (!list.length) {
      localStorage.removeItem(PENDING_REMOVE_KEY);
      return;
    }
    localStorage.setItem(PENDING_REMOVE_KEY, JSON.stringify(list));
  } catch (_) {}
}

export function addPendingRemoveCode(code) {
  const c = String(code || "");
  if (!c) return;
  const next = new Set(loadPendingRemoveCodes());
  next.add(c);
  savePendingRemoveCodes([...next]);
}

export function removePendingRemoveCode(code) {
  const c = String(code || "");
  if (!c) return;
  const next = loadPendingRemoveCodes().filter((x) => x !== c);
  savePendingRemoveCodes(next);
}

export function clearPendingRemoveCodes() {
  try { localStorage.removeItem(PENDING_REMOVE_KEY); } catch (_) {}
}

/** Codes approved in this browser; survives reload until server confirms active. */
const PENDING_APPROVE_KEY = "twoTongues.pendingApproveCodes";

export function loadPendingApproveCodes() {
  try {
    const raw = localStorage.getItem(PENDING_APPROVE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((c) => String(c)).filter(Boolean);
  } catch (_) {
    return [];
  }
}

export function savePendingApproveCodes(codes) {
  try {
    const list = [...new Set([...(codes || [])].map((c) => String(c)).filter(Boolean))];
    if (!list.length) {
      localStorage.removeItem(PENDING_APPROVE_KEY);
      return;
    }
    localStorage.setItem(PENDING_APPROVE_KEY, JSON.stringify(list));
  } catch (_) {}
}

export function addPendingApproveCode(code) {
  const c = String(code || "");
  if (!c) return;
  const next = new Set(loadPendingApproveCodes());
  next.add(c);
  savePendingApproveCodes([...next]);
}

export function removePendingApproveCode(code) {
  const c = String(code || "");
  if (!c) return;
  savePendingApproveCodes(loadPendingApproveCodes().filter((x) => x !== c));
}

export function clearPendingApproveCodes() {
  try { localStorage.removeItem(PENDING_APPROVE_KEY); } catch (_) {}
}

/**
 * Progress fields that live per-account and must survive a reload that
 * races a still-in-flight cloud write.
 */
const PROGRESS_KEYS = [
  "studied", "studiedAt", "favorites",
  "srsStats", "srsDueAt", "srsBox", "srsCards",
  "xp", "xpHistory", "achievements",
];

/**
 * If the user toggled studied/favorite and reloaded before the cloud PUT
 * finished, the offline cache is newer than the server for *their* account.
 * Merge those progress fields from offline → server accounts, then the
 * caller should save the merged record back to the cloud.
 */
export function mergeOfflineProgress(serverAccounts, offlineRec) {
  if (!offlineRec || !Array.isArray(offlineRec.accounts) || !Array.isArray(serverAccounts)) {
    return { accounts: serverAccounts, merged: false };
  }
  const pendingAt = getPendingCloudSyncAt();
  const offlineAt = Number(offlineRec.cachedAt) || 0;
  // Only trust offline progress if we know a sync was pending, or offline
  // is very recent (last 2 minutes) — avoids stomping real multi-device edits
  // with ancient cache.
  const trustOffline = pendingAt > 0 || (Date.now() - offlineAt < 2 * 60 * 1000);
  if (!trustOffline || !offlineAt) {
    return { accounts: serverAccounts, merged: false };
  }

  const byCode = {};
  for (const a of offlineRec.accounts) {
    if (a && a.code) byCode[a.code] = a;
  }
  let merged = false;
  const next = serverAccounts.map((srv) => {
    const off = byCode[srv.code];
    if (!off) return srv;
    // Prefer offline progress when offline cache is at least as fresh as
    // the pending marker (or always when pending flag is set).
    const patch = { ...srv };
    for (const k of PROGRESS_KEYS) {
      if (off[k] !== undefined) {
        const same = JSON.stringify(off[k]) === JSON.stringify(srv[k]);
        if (!same) {
          patch[k] = off[k];
          merged = true;
        }
      }
    }
    return patch;
  });
  // IMPORTANT: never re-add accounts that exist only in offline cache.
  // Admin deletes / rejects remove accounts from the server; bringing them
  // back from localStorage was the root cause of "I deleted it, reloaded,
  // and it came back". Progress merge above only patches accounts that
  // still exist on the server.
  return { accounts: next, merged };
}

export function savePersonalCode(code) {
  try {
    if (code) localStorage.setItem(CODE_KEY, code);
    else localStorage.removeItem(CODE_KEY);
  } catch (_) {}
}

export function loadPersonalCode() {
  try {
    return localStorage.getItem(CODE_KEY) || "";
  } catch (_) {
    return "";
  }
}

export function clearPersonalCode() {
  try {
    localStorage.removeItem(CODE_KEY);
  } catch (_) {}
}


export function generatePersonalCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 8; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}

export function generateSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function saveSessionId(id) {
  try {
    localStorage.setItem(SESSION_KEY, id);
  } catch (_) {}
}

export function loadSessionId() {
  try {
    return localStorage.getItem(SESSION_KEY) || "";
  } catch (_) {
    return "";
  }
}

export function detectDeviceIsAr() {
  try {
    const lang = (navigator.language || "").toLowerCase();
    return lang.startsWith("ar");
  } catch (_) {
    return false;
  }
}

export function hasInviteParam() {
  try {
    return new URLSearchParams(window.location.search).has("invite");
  } catch (_) {
    return false;
  }
}

export function loadAppLang() {
  try {
    const s = localStorage.getItem(LANG_KEY);
    if (s === "en" || s === "ar" || s === "de" || s === "fr") return s;
  } catch (_) {}
  return detectDeviceIsAr() ? "ar" : "en";
}

export function saveAppLang(lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch (_) {}
}

/** UI layout mode chosen by the user: mobile | tablet | desktop */
export function loadDeviceMode() {
  try {
    const s = localStorage.getItem(DEVICE_MODE_KEY);
    if (s === "mobile" || s === "tablet" || s === "desktop") return s;
  } catch (_) {}
  return null;
}

export function saveDeviceMode(mode) {
  if (mode !== "mobile" && mode !== "tablet" && mode !== "desktop") return;
  try {
    localStorage.setItem(DEVICE_MODE_KEY, mode);
  } catch (_) {}
}

export function clearDeviceMode() {
  try { localStorage.removeItem(DEVICE_MODE_KEY); } catch (_) {}
}

export function applyDeviceModeToDom(mode) {
  try {
    const el = document.documentElement;
    if (mode === "mobile" || mode === "tablet" || mode === "desktop") {
      el.setAttribute("data-device", mode);
    } else {
      el.removeAttribute("data-device");
    }
  } catch (_) {}
}

export function guessDeviceMode() {
  try {
    const w = window.innerWidth || 1024;
    if (w < 640) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  } catch (_) {
    return "desktop";
  }
}


export function loadSearchHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, 30) : [];
  } catch (_) {
    return [];
  }
}

export function saveSearchHistory(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify((list || []).slice(0, 30)));
  } catch (_) {}
}

export function addToSearchHistory(q) {
  const query = String(q || "").trim();
  if (!query) return loadSearchHistory();
  const prev = loadSearchHistory().filter((x) => x !== query);
  const next = [query, ...prev].slice(0, 30);
  saveSearchHistory(next);
  return next;
}

export function removeFromSearchHistory(q) {
  const next = loadSearchHistory().filter((x) => x !== q);
  saveSearchHistory(next);
  return next;
}

export function clearSearchHistory() {
  saveSearchHistory([]);
  return [];
}
