// Local storage helpers: theme, accent, offline cache, session, search history, lang.

export const THEME_KEY = "twoTongues.theme";
const ACCENT_KEY = "twoTongues.accent";
const OFFLINE_KEY = "twoTongues.offlineCache";
const CODE_KEY = "twoTongues.personalCode";
const SESSION_KEY = "twoTongues.sessionId";
const LANG_KEY = "twoTongues.appLang";
const HISTORY_KEY = "twoTongues.searchHistory";

export const ACCENT_THEMES = [
  { id: "brass", label: "Brass", accent1: "#b08d57", accent2: "#c4a574", soft1: "rgba(176,141,87,0.12)", soft2: "rgba(196,165,116,0.12)", focus: "176,141,87" },
  { id: "ocean", label: "Ocean", accent1: "#2a9d8f", accent2: "#457b9d", soft1: "rgba(42,157,143,0.12)", soft2: "rgba(69,123,157,0.12)", focus: "42,157,143" },
  { id: "berry", label: "Berry", accent1: "#9b5de5", accent2: "#f15bb5", soft1: "rgba(155,93,229,0.12)", soft2: "rgba(241,91,181,0.12)", focus: "155,93,229" },
  { id: "forest", label: "Forest", accent1: "#40916c", accent2: "#52b788", soft1: "rgba(64,145,108,0.12)", soft2: "rgba(82,183,136,0.12)", focus: "64,145,108" },
  { id: "sunset", label: "Sunset", accent1: "#e85d04", accent2: "#f48c06", soft1: "rgba(232,93,4,0.12)", soft2: "rgba(244,140,6,0.12)", focus: "232,93,4" },
];

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
    const id = localStorage.getItem(ACCENT_KEY) || "brass";
    return ACCENT_THEMES.some((t) => t.id === id) ? id : "brass";
  } catch (_) {
    return "brass";
  }
}

export function saveAccent(id) {
  try {
    localStorage.setItem(ACCENT_KEY, id);
  } catch (_) {}
}

export function applyAccentTheme(id) {
  const theme = ACCENT_THEMES.find((t) => t.id === id) || ACCENT_THEMES[0];
  try {
    const root = document.documentElement;
    root.style.setProperty("--accent-1", theme.accent1);
    root.style.setProperty("--accent-2", theme.accent2);
    root.style.setProperty("--accent-1-soft", theme.soft1);
    root.style.setProperty("--accent-2-soft", theme.soft2);
    root.style.setProperty("--focus-rgb", theme.focus);
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
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
