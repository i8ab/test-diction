// Local storage helpers: theme, accent, offline cache, session, search history, lang.

export const THEME_KEY = "twoTongues.theme";
const ACCENT_KEY = "twoTongues.accent";
const SKIN_KEY = "twoTongues.skin";
const LATIN_FONT_KEY = "twoTongues.latinFont";
const ARABIC_FONT_KEY = "twoTongues.arabicFont";
const REDUCED_MOTION_KEY = "twoTongues.reducedMotion";
const UI_SOUNDS_KEY = "twoTongues.uiSounds";
const DIR_OVERRIDE_KEY = "twoTongues.dirOverride";
const CARD_SURFACE_KEY = "twoTongues.cardSurface";
const ICON_STYLE_KEY = "twoTongues.iconStyle";
const MOTION_SPEED_KEY = "twoTongues.motionSpeed";
const EXAM_VISUAL_KEY = "twoTongues.examVisual";
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
  amber: {
    label: { en: "Amber", ar: "كهرماني" },
    light: { a1: "#d97706", a2: "#b45309", soft1: "rgba(217,119,6,0.14)", soft2: "rgba(180,83,9,0.12)", focus: "217,119,6", meaning: "#92400e" },
    dark:  { a1: "#fbbf24", a2: "#f59e0b", soft1: "rgba(251,191,36,0.18)", soft2: "rgba(245,158,11,0.14)", focus: "251,191,36", meaning: "#fcd34d" },
  },
  indigo: {
    label: { en: "Indigo", ar: "نيلي" },
    light: { a1: "#4f46e5", a2: "#3730a3", soft1: "rgba(79,70,229,0.14)", soft2: "rgba(55,48,163,0.12)", focus: "79,70,229", meaning: "#3730a3" },
    dark:  { a1: "#818cf8", a2: "#a5b4fc", soft1: "rgba(129,140,248,0.18)", soft2: "rgba(165,180,252,0.14)", focus: "129,140,248", meaning: "#c7d2fe" },
  },
  jade: {
    label: { en: "Jade", ar: "يشم" },
    light: { a1: "#0d9488", a2: "#0f766e", soft1: "rgba(13,148,136,0.14)", soft2: "rgba(15,118,110,0.12)", focus: "13,148,136", meaning: "#0f766e" },
    dark:  { a1: "#2dd4bf", a2: "#5eead4", soft1: "rgba(45,212,191,0.18)", soft2: "rgba(94,234,212,0.14)", focus: "45,212,191", meaning: "#99f6e4" },
  },
};

/**
 * Full mood / skin templates. Each skin overrides base surface colors
 * (paper, card, ink, muted…) while accent colors stay independent.
 * Designed to reduce visual fatigue during long study sessions.
 *
 * Optional fields:
 * - bg: { light, dark } → overlay gradients/patterns (drawn above the image)
 * - bgImage: path under /public (e.g. "/backgrounds/forest.jpg") — real photo behind overlay
 * - cardShadow: soft elevation for cards/buttons under this mood
 * - btnStyle: "soft" | "lift" | "flat" | "glow" → hint for primary button feel
 */
export const SKIN_PRESETS = {
  classic: {
    id: "classic",
    label: { en: "Simple", ar: "بسيط", de: "Einfach", fr: "Simple" },
    desc:  { en: "Calm clean default — soft colors, no clutter", ar: "افتراضي هادئ ونظيف — ألوان هادية بدون تعقيد" },
    light: null,
    dark: null,
    bgImage: "/backgrounds/classic.jpg",
    bg: {
      light: "linear-gradient(180deg, rgba(250,253,254,0.62) 0%, rgba(243,248,250,0.55) 100%), radial-gradient(1200px 600px at 10% -10%, rgba(25,167,206,0.18), transparent 55%)",
      dark: "linear-gradient(180deg, rgba(14,26,32,0.68) 0%, rgba(11,21,26,0.62) 100%), radial-gradient(1000px 500px at 15% -5%, rgba(63,193,232,0.14), transparent 50%)",
    },
    cardShadow: "0 8px 28px -16px rgba(20,108,148,0.28)",
    btnStyle: "lift",
    preview: { paper: "#FAFDFE", card: "#FFFFFF", ink: "#146C94", accent: "#19A7CE" },
  },
  paper: {
    id: "paper",
    label: { en: "Paper", ar: "ورق", de: "Papier", fr: "Papier" },
    desc:  { en: "Warm notebook with ruled feel", ar: "دفتر مذاكرة دافئ بملمس الورق" },
    light: {
      paper: "#F4ECD9", card: "#FFFCF5", ink: "#2A2218",
      muted: "#9A8B72", "muted-strong": "#5C4E3A", "icon-muted": "#7A6B54",
      "input-bg": "#EDE4D0", "border-rgb": "140,118,80", meaning: "#4A3C28",
    },
    dark: {
      paper: "#14100B", card: "#1F1A13", ink: "#F2E8D6",
      muted: "#A89878", "muted-strong": "#C8B898", "icon-muted": "#B0A080",
      "input-bg": "#2A2218", "border-rgb": "150,130,90", meaning: "#D8C8A8",
    },
    bgImage: "/backgrounds/paper.jpg",
    bg: {
      light: "repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(140,118,80,0.08) 27px, rgba(140,118,80,0.08) 28px), linear-gradient(165deg, rgba(247,240,224,0.58) 0%, rgba(235,225,203,0.52) 100%)",
      dark: "repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(180,150,100,0.07) 27px, rgba(180,150,100,0.07) 28px), linear-gradient(165deg, rgba(22,18,12,0.68) 0%, rgba(18,16,12,0.62) 100%)",
    },
    cardShadow: "0 6px 22px -12px rgba(80,60,30,0.35)",
    btnStyle: "soft",
    preview: { paper: "#F4ECD9", card: "#FFFCF5", ink: "#2A2218", accent: "#C9A227" },
  },
  midnight: {
    id: "midnight",
    label: { en: "Midnight", ar: "منتصف الليل", de: "Mitternacht", fr: "Minuit" },
    desc:  { en: "Deep night sky focus", ar: "سماء ليل عميقة للتركيز" },
    light: {
      paper: "#E6E8EF", card: "#F3F4F8", ink: "#161922",
      muted: "#7A8294", "muted-strong": "#4A5266", "icon-muted": "#6A7284",
      "input-bg": "#DCDFE8", "border-rgb": "60,70,90", meaning: "#2A3448",
    },
    dark: {
      paper: "#04050A", card: "#0C0E14", ink: "#E6EAF4",
      muted: "#7A8498", "muted-strong": "#A0AABC", "icon-muted": "#8A94A8",
      "input-bg": "#12151C", "border-rgb": "50,60,80", meaning: "#B0BACC",
    },
    bgImage: "/backgrounds/midnight.jpg",
    bg: {
      light: "linear-gradient(180deg, rgba(232,234,239,0.65) 0%, rgba(221,225,234,0.58) 100%)",
      dark: "linear-gradient(180deg, rgba(5,6,10,0.55) 0%, rgba(8,10,16,0.62) 100%), radial-gradient(900px 500px at 20% -10%, rgba(80,100,180,0.18), transparent 50%)",
    },
    cardShadow: "0 10px 32px -14px rgba(0,0,0,0.55)",
    btnStyle: "glow",
    preview: { paper: "#04050A", card: "#0C0E14", ink: "#E6EAF4", accent: "#6BAFD1" },
  },
  forest: {
    id: "forest",
    label: { en: "Forest", ar: "غابة", de: "Wald", fr: "Forêt" },
    desc:  { en: "Calm canopy greens", ar: "أخضر هادئ مثل الغابة" },
    light: {
      paper: "#EEF5EF", card: "#F7FBF7", ink: "#1A3324",
      muted: "#6F9478", "muted-strong": "#3F6348", "icon-muted": "#5F8468",
      "input-bg": "#E0EBE2", "border-rgb": "55,105,70", meaning: "#245A38",
    },
    dark: {
      paper: "#0A140E", card: "#121C16", ink: "#DCF0E2",
      muted: "#6FA880", "muted-strong": "#98C4A4", "icon-muted": "#80B894",
      "input-bg": "#16241C", "border-rgb": "65,125,85", meaning: "#A8D4B4",
    },
    bgImage: "/backgrounds/forest.jpg",
    bg: {
      light: "linear-gradient(160deg, rgba(242,248,242,0.55) 0%, rgba(232,242,234,0.48) 100%), radial-gradient(1000px 500px at 0% 0%, rgba(46,204,113,0.16), transparent 55%)",
      dark: "linear-gradient(180deg, rgba(10,20,14,0.55) 0%, rgba(12,24,16,0.62) 100%), radial-gradient(900px 480px at 10% 0%, rgba(46,204,113,0.14), transparent 50%)",
    },
    cardShadow: "0 8px 26px -14px rgba(30,100,50,0.35)",
    btnStyle: "soft",
    preview: { paper: "#EEF5EF", card: "#F7FBF7", ink: "#1A3324", accent: "#2ecc71" },
  },
  rose: {
    id: "rose",
    label: { en: "Rose", ar: "وردي", de: "Rose", fr: "Rose" },
    desc:  { en: "Soft blush petals", ar: "وردي ناعم كبتلات الورد" },
    light: {
      paper: "#FDF5F7", card: "#FFFBFC", ink: "#422830",
      muted: "#B08A92", "muted-strong": "#8A5A66", "icon-muted": "#A07A84",
      "input-bg": "#F5E6EA", "border-rgb": "160,100,110", meaning: "#6A3A48",
    },
    dark: {
      paper: "#160E10", card: "#201618", ink: "#F4E2E6",
      muted: "#B09098", "muted-strong": "#D0B0B8", "icon-muted": "#C0A0A8",
      "input-bg": "#2A1C20", "border-rgb": "150,100,110", meaning: "#E0C0C8",
    },
    bgImage: "/backgrounds/rose.jpg",
    bg: {
      light: "linear-gradient(155deg, rgba(253,246,248,0.60) 0%, rgba(248,236,239,0.52) 100%), radial-gradient(900px 500px at 85% 5%, rgba(225,29,72,0.14), transparent 50%)",
      dark: "linear-gradient(180deg, rgba(22,14,16,0.62) 0%, rgba(26,16,20,0.65) 100%), radial-gradient(800px 450px at 90% 0%, rgba(225,29,72,0.16), transparent 48%)",
    },
    cardShadow: "0 8px 26px -14px rgba(160,60,90,0.30)",
    btnStyle: "lift",
    preview: { paper: "#FDF5F7", card: "#FFFBFC", ink: "#422830", accent: "#e11d48" },
  },
  slate: {
    id: "slate",
    label: { en: "Slate", ar: "أردواز", de: "Schiefer", fr: "Ardoise" },
    desc:  { en: "Cool professional steel", ar: "رمادي احترافي بارد" },
    light: {
      paper: "#F0F3F6", card: "#F8FAFC", ink: "#1A2630",
      muted: "#72828E", "muted-strong": "#445460", "icon-muted": "#627280",
      "input-bg": "#E2E8EE", "border-rgb": "75,95,115", meaning: "#283848",
    },
    dark: {
      paper: "#0C1014", card: "#141A20", ink: "#E2E8F0",
      muted: "#7A8A98", "muted-strong": "#A0B0BE", "icon-muted": "#8A9AA8",
      "input-bg": "#1A2228", "border-rgb": "70,90,110", meaning: "#B0C0CE",
    },
    bgImage: "/backgrounds/slate.jpg",
    bg: {
      light: "linear-gradient(145deg, rgba(242,245,248,0.65) 0%, rgba(228,234,240,0.58) 100%)",
      dark: "linear-gradient(180deg, rgba(12,16,20,0.65) 0%, rgba(14,20,26,0.68) 100%), radial-gradient(1000px 500px at 50% -20%, rgba(100,130,160,0.14), transparent 55%)",
    },
    cardShadow: "0 6px 24px -14px rgba(30,50,70,0.40)",
    btnStyle: "flat",
    preview: { paper: "#F0F3F6", card: "#F8FAFC", ink: "#1A2630", accent: "#64748b" },
  },
  warm: {
    id: "warm",
    label: { en: "Warm", ar: "دافئ", de: "Warm", fr: "Chaud" },
    desc:  { en: "Coffee & cream café", ar: "قهوة وكريمة دافئة" },
    light: {
      paper: "#F6EFE4", card: "#FFF8EF", ink: "#352818",
      muted: "#A08A70", "muted-strong": "#6A5438", "icon-muted": "#8A7458",
      "input-bg": "#EDE2D2", "border-rgb": "140,110,70", meaning: "#5A4028",
    },
    dark: {
      paper: "#14100C", card: "#1E1812", ink: "#F0E4D6",
      muted: "#A89880", "muted-strong": "#C8B8A0", "icon-muted": "#B0A088",
      "input-bg": "#282018", "border-rgb": "140,120,90", meaning: "#D8C8B0",
    },
    bgImage: "/backgrounds/warm.jpg",
    bg: {
      light: "linear-gradient(160deg, rgba(248,241,230,0.55) 0%, rgba(240,230,214,0.48) 100%), radial-gradient(900px 480px at 15% 0%, rgba(201,162,39,0.16), transparent 50%)",
      dark: "linear-gradient(180deg, rgba(20,16,12,0.62) 0%, rgba(24,20,14,0.65) 100%), radial-gradient(800px 450px at 10% 0%, rgba(201,162,39,0.12), transparent 48%)",
    },
    cardShadow: "0 8px 26px -12px rgba(100,70,30,0.35)",
    btnStyle: "soft",
    preview: { paper: "#F6EFE4", card: "#FFF8EF", ink: "#352818", accent: "#C9A227" },
  },
  aurora: {
    id: "aurora",
    label: { en: "Aurora", ar: "شفق", de: "Aurora", fr: "Aurore" },
    desc:  { en: "Northern lights wash", ar: "تدرجات الشفق القطبي" },
    light: {
      paper: "#F2F4FC", card: "#FBFCFF", ink: "#1E2040",
      muted: "#7A7EA8", "muted-strong": "#4A4E78", "icon-muted": "#6A6E98",
      "input-bg": "#E6E8F6", "border-rgb": "90,100,160", meaning: "#2A2E60",
    },
    dark: {
      paper: "#0A0C18", card: "#121428", ink: "#E4E6F8",
      muted: "#8A8EB8", "muted-strong": "#B0B4D8", "icon-muted": "#9A9EC8",
      "input-bg": "#1A1C30", "border-rgb": "80,90,150", meaning: "#C0C4E8",
    },
    bgImage: "/backgrounds/aurora.jpg",
    bg: {
      light: "linear-gradient(165deg, rgba(244,246,253,0.55) 0%, rgba(238,240,250,0.48) 100%), radial-gradient(900px 500px at 20% 0%, rgba(124,58,237,0.16), transparent 50%), radial-gradient(800px 450px at 90% 20%, rgba(45,212,191,0.14), transparent 48%)",
      dark: "linear-gradient(180deg, rgba(8,10,22,0.55) 0%, rgba(12,14,28,0.62) 100%), radial-gradient(900px 500px at 15% 0%, rgba(124,58,237,0.24), transparent 48%), radial-gradient(800px 450px at 85% 15%, rgba(45,212,191,0.16), transparent 45%)",
    },
    cardShadow: "0 10px 30px -14px rgba(80,60,160,0.35)",
    btnStyle: "glow",
    preview: { paper: "#F2F4FC", card: "#FBFCFF", ink: "#1E2040", accent: "#7c3aed" },
  },
  dusk: {
    id: "dusk",
    label: { en: "Dusk", ar: "غروب", de: "Dämmerung", fr: "Crépuscule" },
    desc:  { en: "Warm evening sky", ar: "سماء المساء الدافئة" },
    light: {
      paper: "#FBF3EC", card: "#FFF9F4", ink: "#3A2820",
      muted: "#A88878", "muted-strong": "#785848", "icon-muted": "#987868",
      "input-bg": "#F2E6DC", "border-rgb": "160,110,80", meaning: "#5A3C28",
    },
    dark: {
      paper: "#140E0C", card: "#1E1612", ink: "#F4E6DC",
      muted: "#B09888", "muted-strong": "#D0B8A8", "icon-muted": "#C0A898",
      "input-bg": "#2A201A", "border-rgb": "150,110,80", meaning: "#E0C8B8",
    },
    bgImage: "/backgrounds/dusk.jpg",
    bg: {
      light: "linear-gradient(160deg, rgba(252,245,238,0.55) 0%, rgba(246,232,220,0.48) 100%), radial-gradient(1000px 500px at 90% 0%, rgba(255,107,53,0.18), transparent 50%)",
      dark: "linear-gradient(180deg, rgba(18,14,10,0.55) 0%, rgba(24,18,14,0.62) 100%), radial-gradient(900px 480px at 85% 0%, rgba(255,107,53,0.20), transparent 48%)",
    },
    cardShadow: "0 8px 28px -12px rgba(160,80,40,0.32)",
    btnStyle: "lift",
    preview: { paper: "#FBF3EC", card: "#FFF9F4", ink: "#3A2820", accent: "#ff6b35" },
  },
  mist: {
    id: "mist",
    label: { en: "Mist", ar: "ضباب", de: "Nebel", fr: "Brume" },
    desc:  { en: "Soft foggy calm", ar: "هدوء ضبابي ناعم" },
    light: {
      paper: "#F0F4F6", card: "#F8FBFC", ink: "#243038",
      muted: "#7A9098", "muted-strong": "#4A6068", "icon-muted": "#6A8088",
      "input-bg": "#E4EAEE", "border-rgb": "90,120,130", meaning: "#2A4048",
    },
    dark: {
      paper: "#0C1216", card: "#141C22", ink: "#E0EAF0",
      muted: "#7A949C", "muted-strong": "#A0B8C0", "icon-muted": "#8AA4AC",
      "input-bg": "#1A242A", "border-rgb": "80,110,120", meaning: "#B0C8D0",
    },
    bgImage: "/backgrounds/mist.jpg",
    bg: {
      light: "linear-gradient(180deg, rgba(242,246,248,0.58) 0%, rgba(232,238,242,0.50) 100%), radial-gradient(1100px 600px at 50% 0%, rgba(14,165,233,0.12), transparent 55%)",
      dark: "linear-gradient(180deg, rgba(10,16,20,0.58) 0%, rgba(14,22,26,0.65) 100%), radial-gradient(1000px 550px at 40% -10%, rgba(56,189,248,0.12), transparent 50%)",
    },
    cardShadow: "0 6px 24px -14px rgba(40,70,90,0.30)",
    btnStyle: "soft",
    preview: { paper: "#F0F4F6", card: "#F8FBFC", ink: "#243038", accent: "#0ea5e9" },
  },
  lavender: {
    id: "lavender",
    label: { en: "Lavender", ar: "لافندر", de: "Lavendel", fr: "Lavande" },
    desc:  { en: "Soft purple calm", ar: "بنفسجي هادئ ومريح" },
    light: {
      paper: "#F6F2FA", card: "#FCFAFE", ink: "#2E2440",
      muted: "#8A7AA0", "muted-strong": "#5A4A70", "icon-muted": "#7A6A90",
      "input-bg": "#EBE4F2", "border-rgb": "120,100,160", meaning: "#3E3458",
    },
    dark: {
      paper: "#100E18", card: "#1A1624", ink: "#ECE4F6",
      muted: "#9A8AB0", "muted-strong": "#C0B0D0", "icon-muted": "#B0A0C0",
      "input-bg": "#221C30", "border-rgb": "110,90,150", meaning: "#D0C0E0",
    },
    bgImage: "/backgrounds/lavender.jpg",
    bg: {
      light: "linear-gradient(160deg, rgba(247,243,251,0.55) 0%, rgba(240,234,246,0.48) 100%), radial-gradient(900px 500px at 80% 0%, rgba(167,139,250,0.18), transparent 50%)",
      dark: "linear-gradient(180deg, rgba(14,12,22,0.58) 0%, rgba(20,16,30,0.65) 100%), radial-gradient(850px 480px at 75% 0%, rgba(124,58,237,0.20), transparent 48%)",
    },
    cardShadow: "0 8px 28px -14px rgba(100,70,160,0.32)",
    btnStyle: "lift",
    preview: { paper: "#F6F2FA", card: "#FCFAFE", ink: "#2E2440", accent: "#a78bfa" },
  },
  sand: {
    id: "sand",
    label: { en: "Sand", ar: "رمل", de: "Sand", fr: "Sable" },
    desc:  { en: "Desert light & dunes", ar: "ضوء الصحراء والكثبان" },
    light: {
      paper: "#F7F0E2", card: "#FFFBF2", ink: "#3A3020",
      muted: "#A09070", "muted-strong": "#6A5A3A", "icon-muted": "#8A7A58",
      "input-bg": "#EEE4D0", "border-rgb": "150,130,90", meaning: "#5A4A28",
    },
    dark: {
      paper: "#14110C", card: "#1E1A14", ink: "#F0E6D4",
      muted: "#A89878", "muted-strong": "#C8B898", "icon-muted": "#B0A080",
      "input-bg": "#282218", "border-rgb": "140,120,80", meaning: "#D8C8A8",
    },
    bgImage: "/backgrounds/sand.jpg",
    bg: {
      light: "linear-gradient(175deg, rgba(249,242,228,0.55) 0%, rgba(235,224,200,0.48) 100%), radial-gradient(1000px 400px at 50% 100%, rgba(212,160,23,0.14), transparent 55%)",
      dark: "linear-gradient(180deg, rgba(18,16,11,0.62) 0%, rgba(24,20,14,0.65) 100%), radial-gradient(900px 400px at 50% 100%, rgba(180,140,40,0.12), transparent 50%)",
    },
    cardShadow: "0 6px 22px -12px rgba(120,90,40,0.30)",
    btnStyle: "soft",
    preview: { paper: "#F7F0E2", card: "#FFFBF2", ink: "#3A3020", accent: "#D4A017" },
  },
  contrast: {
    id: "contrast",
    label: { en: "High Contrast", ar: "تباين عالي", de: "Hoher Kontrast", fr: "Contraste élevé" },
    desc:  { en: "Max readability, flat surfaces", ar: "أقصى وضوح بدون زخرفة" },
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
    // no photo — pure solid for maximum readability
    bg: {
      light: "#FFFFFF",
      dark: "#000000",
    },
    cardShadow: "none",
    btnStyle: "flat",
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
 * When skin is "classic", clears color overrides so CSS :root defaults take over,
 * but still applies optional full-page background (bg) and button mood hints.
 */
export function applySkinTheme(id, mode) {
  const skin = SKIN_PRESETS[id] || SKIN_PRESETS.classic;
  const isDark = mode === "dark" || (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark");
  const palette = isDark ? skin.dark : skin.light;
  const bg = skin.bg ? (isDark ? skin.bg.dark : skin.bg.light) : null;
  const bgImage = skin.bgImage || null;

  try {
    const root = document.documentElement;
    root.setAttribute("data-skin", skin.id);
    root.setAttribute("data-btn-style", skin.btnStyle || "soft");
    if (bgImage) root.setAttribute("data-has-bg-image", "1");
    else root.removeAttribute("data-has-bg-image");

    // Clear previous skin overrides first
    BASE_SURFACE_VARS.forEach((v) => root.style.removeProperty(`--${v}`));
    root.style.removeProperty("--app-bg");
    root.style.removeProperty("--app-bg-image");
    root.style.removeProperty("--skin-card-shadow");

    if (palette) {
      Object.entries(palette).forEach(([key, val]) => {
        root.style.setProperty(`--${key}`, val);
      });
    }

    // Overlay gradients/patterns (above the photo)
    if (bg) {
      root.style.setProperty("--app-bg", bg);
    }

    // Real background photo (under the overlay)
    if (bgImage) {
      root.style.setProperty("--app-bg-image", `url("${bgImage}")`);
    }

    if (skin.cardShadow && skin.cardShadow !== "none") {
      root.style.setProperty("--skin-card-shadow", skin.cardShadow);
    }
  } catch (_) {}
}

// ── Fonts (Latin UI + Arabic) ──────────────────────────────────────────

/** Latin / UI body fonts — only default + System */
export const LATIN_FONTS = {
  "source-sans": {
    id: "source-sans",
    family: '"Source Sans 3", system-ui, sans-serif',
    label: { en: "Source Sans", ar: "سورس سانس" },
  },
  system: {
    id: "system",
    family: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    label: { en: "System", ar: "نظام الجهاز" },
  },
};

/** Arabic display / content fonts — only default + System */
export const ARABIC_FONTS = {
  amiri: {
    id: "amiri",
    family: '"Amiri", "Times New Roman", serif',
    label: { en: "Amiri", ar: "أميري" },
  },
  system: {
    id: "system",
    family: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    label: { en: "System", ar: "نظام الجهاز" },
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

// ── UI sounds ──────────────────────────────────────────────────────────

export function loadUiSounds() {
  try {
    return localStorage.getItem(UI_SOUNDS_KEY) === "1";
  } catch (_) {
    return false;
  }
}

export function saveUiSounds(on) {
  try {
    localStorage.setItem(UI_SOUNDS_KEY, on ? "1" : "0");
  } catch (_) {}
}

// ── Direction override: auto | ltr | rtl ────────────────────────────────

export function loadDirOverride() {
  // Direction choice removed — always auto from language.
  return "auto";
}

export function saveDirOverride(v) {
  try {
    localStorage.setItem(DIR_OVERRIDE_KEY, "auto");
  } catch (_) {}
}

/** Apply dir from language only (EN → LTR, AR → RTL). Manual override removed. */
export function applyDirOverride(override, appLang) {
  try {
    const root = document.documentElement;
    const dir = appLang === "ar" ? "rtl" : "ltr";
    root.setAttribute("dir", dir);
    root.setAttribute("data-dir-override", "auto");
  } catch (_) {}
}

// ── Card surface: solid | gradient | ruled | grid | parchment ──────────

export const CARD_SURFACES = {
  solid: { id: "solid", label: { en: "Solid", ar: "سادة" } },
  gradient: { id: "gradient", label: { en: "Gradient", ar: "تدرج" } },
  paper: { id: "paper", label: { en: "Ruled", ar: "مسطّر" } },
  grid: { id: "grid", label: { en: "Grid", ar: "شبكي" } },
  parchment: { id: "parchment", label: { en: "Parchment", ar: "رقّ / مرقط" } },
};

export function loadCardSurface() {
  try {
    const v = localStorage.getItem(CARD_SURFACE_KEY) || "solid";
    return CARD_SURFACES[v] ? v : "solid";
  } catch (_) {
    return "solid";
  }
}

export function saveCardSurface(id) {
  try {
    localStorage.setItem(CARD_SURFACE_KEY, id || "solid");
  } catch (_) {}
}

export function applyCardSurface(id) {
  try {
    document.documentElement.setAttribute("data-card-surface", id || "solid");
  } catch (_) {}
}

// ── Header style: solid | glass | clear ────────────────────────────────
const HEADER_STYLE_KEY = "twoTongues.headerStyle";

export const HEADER_STYLES = {
  solid: {
    id: "solid",
    label: { en: "Solid", ar: "صلب" },
    desc: { en: "Opaque bar for max contrast", ar: "شريط معتم لأعلى وضوح" },
  },
  glass: {
    id: "glass",
    label: { en: "Glass", ar: "زجاجي" },
    desc: { en: "Blurred so the background peeks through", ar: "ضبابي والخلفية تظهر من وراه" },
  },
  clear: {
    id: "clear",
    label: { en: "Clear", ar: "شفاف" },
    desc: { en: "Almost invisible — full background", ar: "شبه شفاف — الخلفية كاملة" },
  },
};

export function loadHeaderStyle() {
  try {
    const v = localStorage.getItem(HEADER_STYLE_KEY) || "glass";
    return HEADER_STYLES[v] ? v : "glass";
  } catch (_) {
    return "glass";
  }
}

export function saveHeaderStyle(id) {
  try {
    localStorage.setItem(HEADER_STYLE_KEY, id || "glass");
  } catch (_) {}
}

export function applyHeaderStyle(id) {
  try {
    document.documentElement.setAttribute("data-header-style", id || "glass");
  } catch (_) {}
}

// ── Card clarity: opaque | glass | clear ───────────────────────────────
const CARD_CLARITY_KEY = "twoTongues.cardClarity";

export const CARD_CLARITIES = {
  opaque: {
    id: "opaque",
    label: { en: "Opaque", ar: "معتم" },
    desc: { en: "Solid cards, max readability", ar: "كروت صلبة لأعلى وضوح" },
  },
  glass: {
    id: "glass",
    label: { en: "Glass", ar: "زجاجي" },
    desc: { en: "Frosted — background peeks through", ar: "ضبابي والخلفية تظهر من وراه" },
  },
  clear: {
    id: "clear",
    label: { en: "Clear", ar: "شفاف" },
    desc: { en: "Almost transparent cards", ar: "كروت شبه شفافة تماماً" },
  },
};

export function loadCardClarity() {
  // Fixed to Clear only (high transparency). No other options.
  try {
    const v = localStorage.getItem(CARD_CLARITY_KEY) || "clear";
    return CARD_CLARITIES[v] ? "clear" : "clear";
  } catch (_) {
    return "clear";
  }
}

export function saveCardClarity(id) {
  try {
    // Always persist clear — choice UI removed.
    localStorage.setItem(CARD_CLARITY_KEY, "clear");
  } catch (_) {}
}

export function applyCardClarity(id) {
  try {
    document.documentElement.setAttribute("data-card-clarity", "clear");
  } catch (_) {}
}

// ── Modal style: solid | glass | clear (every modal) ───────────────────
const MODAL_STYLE_KEY = "twoTongues.modalStyle";

export const MODAL_STYLES = {
  solid: {
    id: "solid",
    label: { en: "Solid", ar: "صلب" },
    desc: { en: "Classic opaque panels", ar: "لوحات معتمة كلاسيك" },
  },
  glass: {
    id: "glass",
    label: { en: "Glass", ar: "زجاجي" },
    desc: { en: "Blurred glass over the page", ar: "زجاج ضبابي فوق الصفحة" },
  },
  clear: {
    id: "clear",
    label: { en: "Clear", ar: "شفاف" },
    desc: { en: "Very transparent — scene stays visible", ar: "شفاف جداً — المشهد يفضل باين" },
  },
};

export function loadModalStyle() {
  try {
    const v = localStorage.getItem(MODAL_STYLE_KEY) || "glass";
    return MODAL_STYLES[v] ? v : "glass";
  } catch (_) {
    return "glass";
  }
}

export function saveModalStyle(id) {
  try {
    localStorage.setItem(MODAL_STYLE_KEY, id || "glass");
  } catch (_) {}
}

export function applyModalStyle(id) {
  try {
    document.documentElement.setAttribute("data-modal-style", id || "glass");
  } catch (_) {}
}

// ── Icon style: outline | filled ───────────────────────────────────────

export function loadIconStyle() {
  // Icon style choice removed — always outline.
  return "outline";
}

export function saveIconStyle(id) {
  try {
    localStorage.setItem(ICON_STYLE_KEY, "outline");
  } catch (_) {}
}

export function applyIconStyle(id) {
  try {
    document.documentElement.setAttribute("data-icon-style", "outline");
  } catch (_) {}
}

// ── Motion speed: off | slow | normal | fast ───────────────────────────

export const MOTION_SPEEDS = {
  off: { id: "off", scale: 0, label: { en: "Off", ar: "إيقاف" } },
  slow: { id: "slow", scale: 0.5, label: { en: "Slow", ar: "بطيء" } },
  normal: { id: "normal", scale: 1, label: { en: "Normal", ar: "عادي" } },
  fast: { id: "fast", scale: 0.55, label: { en: "Fast", ar: "سريع" } },
};

export function loadMotionSpeed() {
  // Animation speed setting removed — always normal.
  return "normal";
}

export function saveMotionSpeed(id) {
  try {
    localStorage.setItem(MOTION_SPEED_KEY, "normal");
  } catch (_) {}
}

export function applyMotionSpeed(id) {
  const spec = MOTION_SPEEDS.normal;
  try {
    const root = document.documentElement;
    root.setAttribute("data-motion-speed", "normal");
    root.style.setProperty("--motion-scale", String(spec.scale));
    root.removeAttribute("data-reduced-motion");
  } catch (_) {}
}

// ── Exam visual mode (strict B&W) ──────────────────────────────────────

export function loadExamVisual() {
  try {
    return localStorage.getItem(EXAM_VISUAL_KEY) === "1";
  } catch (_) {
    return false;
  }
}

export function saveExamVisual(on) {
  try {
    localStorage.setItem(EXAM_VISUAL_KEY, on ? "1" : "0");
  } catch (_) {}
}

export function applyExamVisual(on) {
  try {
    document.documentElement.setAttribute("data-exam-visual", on ? "1" : "0");
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
