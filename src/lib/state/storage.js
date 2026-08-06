// Local storage helpers: theme, accent, offline cache, session, search history, lang.

export const THEME_KEY = "twoTongues.theme";
const ACCENT_KEY = "twoTongues.accent";
const OFFLINE_KEY = "twoTongues.offlineCache";
const CODE_KEY = "twoTongues.personalCode";
const SESSION_KEY = "twoTongues.sessionId";
const LANG_KEY = "twoTongues.appLang";
const HISTORY_KEY = "twoTongues.searchHistory";

// Accents must work on both light and dark (soft colors differ).
export const ACCENT_THEMES = {
  ocean: {
    label: "Ocean",
    light: { a1: "#19A7CE", a2: "#146C94", soft1: "#D3E7EF", soft2: "#E4EEF2", focus: "25,167,206", meaning: "#1F7A9E" },
    dark:  { a1: "#3FC1E8", a2: "#6BAFD1", soft1: "#163642", soft2: "#142A34", focus: "63,193,232", meaning: "#6FCCEE" },
  },
  brass: {
    label: "Brass",
    light: { a1: "#b08d57", a2: "#8a6a3a", soft1: "rgba(176,141,87,0.15)", soft2: "rgba(138,106,58,0.12)", focus: "176,141,87", meaning: "#7a5c2e" },
    dark:  { a1: "#d4b483", a2: "#c4a574", soft1: "rgba(212,180,131,0.18)", soft2: "rgba(196,165,116,0.14)", focus: "212,180,131", meaning: "#e0c9a0" },
  },
  berry: {
    label: "Berry",
    light: { a1: "#9b5de5", a2: "#f15bb5", soft1: "rgba(155,93,229,0.12)", soft2: "rgba(241,91,181,0.12)", focus: "155,93,229", meaning: "#7b3db5" },
    dark:  { a1: "#c77dff", a2: "#ff85c8", soft1: "rgba(199,125,255,0.18)", soft2: "rgba(255,133,200,0.14)", focus: "199,125,255", meaning: "#e0aaff" },
  },
  forest: {
    label: "Forest",
    light: { a1: "#40916c", a2: "#2d6a4f", soft1: "rgba(64,145,108,0.12)", soft2: "rgba(45,106,79,0.12)", focus: "64,145,108", meaning: "#2d6a4f" },
    dark:  { a1: "#52b788", a2: "#74c69d", soft1: "rgba(82,183,136,0.18)", soft2: "rgba(116,198,157,0.14)", focus: "82,183,136", meaning: "#95d5b2" },
  },
  sunset: {
    label: "Sunset",
    light: { a1: "#e85d04", a2: "#f48c06", soft1: "rgba(232,93,4,0.12)", soft2: "rgba(244,140,6,0.12)", focus: "232,93,4", meaning: "#c2410c" },
    dark:  { a1: "#fb923c", a2: "#fdba74", soft1: "rgba(251,146,60,0.18)", soft2: "rgba(253,186,116,0.14)", focus: "251,146,60", meaning: "#fdba74" },
  },
};

export function loadSavedTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "dark" || t === "light" ? t : "light";
  } catch (_) {
    return "light";
  }
}

export function loadSavedAccent() {
  try {
    const id = localStorage.getItem(ACCENT_KEY) || "ocean";
    return ACCENT_THEMES[id] ? id : "ocean";
  } catch (_) {
    return "ocean";
  }
}

export function saveAccent(id) {
  try {
    localStorage.setItem(ACCENT_KEY, id);
  } catch (_) {}
}

/** Apply accent CSS vars. Second arg is light/dark mode from the app theme. */
export function applyAccentTheme(id, mode) {
  const theme = ACCENT_THEMES[id] || ACCENT_THEMES.ocean;
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
