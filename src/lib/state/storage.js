/* =========================================================================
   LOCAL DEVICE STORAGE & SESSION HELPERS
   -------------------------------------------------------------------------
   Everything here reads/writes localStorage only (no network) — session
   persistence, theme + accent preferences, search history, and the offline
   cache mirror of the last successful cloud fetch. Split out of App.jsx so
   these small, self-contained helpers aren't mixed in with app state logic.
   ========================================================================= */

// Generates the personal numeric code a new account receives after signup.
export function generatePersonalCode() {
  let code = "";
  for (let i = 0; i < 10; i++) code += Math.floor(Math.random() * 10);
  return code; // 10 digits
}

/* =========================================================================
   SESSION PERSISTENCE — keeps the user signed in across visits
   -------------------------------------------------------------------------
   We only remember the personal code in localStorage. On the next visit we
   look it up against the (freshly fetched) account list and log the person
   in automatically, using the regular shared access code and whatever role
   is stored on their account. "Sign out" clears the stored code so the
   login screen shows up again on demand.
   ========================================================================= */
export const SESSION_KEY = "twoTongues.personalCode";
export const APP_LANG_KEY = "twoTongues.appLang";
// Single-device session: cloud account.sessionId must match this, or we sign out.
export const SESSION_ID_KEY = "twoTongues.sessionId";
export const THEME_KEY = "twoTongues.theme";
export const ACCENT_KEY = "twoTongues.accent";

// Extra accent-color palettes the user can pick from, on top of the base
// light/dark mode. Each defines the two accent colors + their "soft"
// (low-opacity background) variants for both light and dark mode, so
// switching accent never fights with switching light/dark.
export const ACCENT_THEMES = {
  brass:  { label: { en: "Brass (default)", ar: "نحاسي (افتراضي)" }, light: { a1: "#19A7CE", a1s: "#D3E7EF", a2: "#146C94", a2s: "#E4EEF2" }, dark: { a1: "#3FC1E8", a1s: "#163642", a2: "#6BAFD1", a2s: "#142A34" } },
  forest: { label: { en: "Forest", ar: "أخضر" }, light: { a1: "#2E9E5B", a1s: "#DCEFE1", a2: "#1F6E44", a2s: "#E1EFE6" }, dark: { a1: "#4ED08A", a1s: "#173C29", a2: "#7FCBA0", a2s: "#153025" } },
  plum:   { label: { en: "Plum", ar: "بنفسجي" }, light: { a1: "#9A5FC9", a1s: "#EBE0F5", a2: "#6E3D96", a2s: "#EEE5F5" }, dark: { a1: "#C094E8", a1s: "#2E2140", a2: "#9E77C4", a2s: "#271C36" } },
  amber:  { label: { en: "Amber", ar: "كهرماني" }, light: { a1: "#D98B2B", a1s: "#F5E7D3", a2: "#A85E1B", a2s: "#F2E6D8" }, dark: { a1: "#F0AE5C", a1s: "#3A2A16", a2: "#D68F44", a2s: "#332314" } },
  rose:   { label: { en: "Rose", ar: "وردي" }, light: { a1: "#D9557C", a1s: "#F5DCE4", a2: "#A83A5B", a2s: "#F2DEE5" }, dark: { a1: "#F08AA6", a1s: "#3A1E27", a2: "#D66E8C", a2s: "#331B22" } },
};

export function loadSavedAccent() {
  try {
    const a = localStorage.getItem(ACCENT_KEY);
    return a && ACCENT_THEMES[a] ? a : "brass";
  } catch (e) {
    return "brass";
  }
}

export function saveAccent(accent) {
  try { localStorage.setItem(ACCENT_KEY, accent); } catch (e) {}
}

// Applies the chosen accent palette as CSS custom properties on <html>,
// overriding the base --accent-1/--accent-2 (etc.) set in index.css for
// the current light/dark mode. Called on load and whenever either the
// accent or the light/dark mode changes.
export function applyAccentTheme(accent, mode) {
  const theme = ACCENT_THEMES[accent] || ACCENT_THEMES.brass;
  const pal = theme[mode] || theme.light;
  const root = document.documentElement.style;
  root.setProperty("--accent-1", pal.a1);
  root.setProperty("--accent-1-soft", pal.a1s);
  root.setProperty("--accent-2", pal.a2);
  root.setProperty("--accent-2-soft", pal.a2s);
}

/* =========================================================================
   SEARCH HISTORY — remembers the last few searches per section (ar-ar /
   en-en) so the user can quickly re-run a recent search instead of
   retyping it. Stored locally per-device (not synced to the shared cloud
   record), capped at MAX_SEARCH_HISTORY entries, most recent first.
   ========================================================================= */
export const SEARCH_HISTORY_KEY = "twoTongues.searchHistory";
export const MAX_SEARCH_HISTORY = 8;

export function loadSearchHistory(section) {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw);
    const list = (all && all[section]) || [];
    return Array.isArray(list) ? list.filter((s) => typeof s === "string") : [];
  } catch (e) {
    return [];
  }
}

export function saveSearchHistory(section, list) {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[section] = list;
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(all));
  } catch (e) {
    // Storage full or unavailable — history just won't persist this time.
  }
}

// Adds `term` to the front of the section's history, de-duping (case/whitespace
// insensitive) and capping the list length.
export function addToSearchHistory(section, term) {
  const clean = term.trim();
  if (!clean) return loadSearchHistory(section);
  const existing = loadSearchHistory(section);
  const deduped = existing.filter((t) => t.toLowerCase() !== clean.toLowerCase());
  const next = [clean, ...deduped].slice(0, MAX_SEARCH_HISTORY);
  saveSearchHistory(section, next);
  return next;
}

export function removeFromSearchHistory(section, term) {
  const next = loadSearchHistory(section).filter((t) => t !== term);
  saveSearchHistory(section, next);
  return next;
}

export function clearSearchHistory(section) {
  saveSearchHistory(section, []);
  return [];
}

/* =========================================================================
   OFFLINE CACHE — mirrors the last successful jsonbin fetch into
   localStorage so the app still shows something useful (read-only) when
   there's no network. Paired with the service worker (sw.js), which caches
   the app shell itself, this lets the app open and be usable with no
   connection at all — not just tolerate a dropped request mid-session.
   ========================================================================= */
export const OFFLINE_CACHE_KEY = "twoTongues.offlineCache";

export function saveOfflineCache(record) {
  try {
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify({ ...record, cachedAt: Date.now() }));
  } catch (e) {
    // Storage full or unavailable — offline fallback just won't be there.
  }
}

export function loadOfflineCache() {
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      entries: parsed.entries || [],
      accounts: parsed.accounts || [],
      logs: parsed.logs || [],
      cachedAt: parsed.cachedAt || null,
    };
  } catch (e) {
    return null;
  }
}

export function loadSavedTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" ? "light" : "dark";
  } catch (e) {
    return "dark";
  }
}

export function savePersonalCode(code) {
  try {
    localStorage.setItem(SESSION_KEY, code);
  } catch (e) {
    // Storage might be unavailable (e.g. private browsing) — sign-in still
    // works for this visit, it just won't be remembered next time.
  }
}

export function loadPersonalCode() {
  try {
    const code = localStorage.getItem(SESSION_KEY);
    return code && code.trim() ? code.trim() : null;
  } catch (e) {
    return null;
  }
}

export function clearPersonalCode() {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_ID_KEY);
  } catch (e) {}
}

export function saveSessionId(id) {
  try {
    if (id) localStorage.setItem(SESSION_ID_KEY, id);
    else localStorage.removeItem(SESSION_ID_KEY);
  } catch (e) {}
}

export function loadSessionId() {
  try {
    const id = localStorage.getItem(SESSION_ID_KEY);
    return id && id.trim() ? id.trim() : null;
  } catch (e) {
    return null;
  }
}

/** Generate a unique session token for single-device login enforcement. */
export function generateSessionId() {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// follows the device's own system language, not whichever section (EN→AR /
// AR→AR) happens to be open.
export function detectDeviceLang() {
  try {
    const list = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || ""];
    for (const l of list) {
      const code = (l || "").toLowerCase().slice(0, 2);
      if (code === "ar" || code === "en" || code === "de" || code === "fr") return code;
    }
  } catch (e) {}
  return "en";
}

export function detectDeviceIsAr() {
  return detectDeviceLang() === "ar";
}

export function loadAppLang() {
  try {
    const v = localStorage.getItem(APP_LANG_KEY);
    if (v === "ar" || v === "en" || v === "de" || v === "fr") return v;
  } catch (e) {}
  return detectDeviceLang();
}

export function saveAppLang(lang) {
  try {
    if (lang === "ar" || lang === "en" || lang === "de" || lang === "fr") {
      localStorage.setItem(APP_LANG_KEY, lang);
    }
  } catch (e) {}
}



// If someone opened an invite link (?invite=1), skip the intro and go
// straight to "create account" — the shared access code still has to be
// given to them separately (it's a server-only secret, never exposed to
// any client, admin included), but this saves the extra tap.
export function hasInviteParam() {
  try {
    return new URLSearchParams(window.location.search).get("invite") === "1";
  } catch (e) {
    return false;
  }
}

