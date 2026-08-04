import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { tr } from "./lib/i18n";
import { INK, PAPER, CARD, BRASS, errorStyle } from "./lib/theme";
import { speakWord, getSpeechRecognitionCtor, recognizeSpeech } from "./lib/speech";
import {
  uid, srsLevelFromStats, SRS_LEVEL_INTERVALS_MS,
} from "./lib/quizHelpers";
import {
  SearchIcon, PlusIcon, BookIcon, XIcon, LoaderIcon,
  CheckIcon, ChevronIcon, UsersIcon, SunIcon,
  MoonIcon, MenuIcon, WifiOffIcon, DownloadIcon, UserIcon, LogoutIcon,
  QuizIcon, StatsIcon, TrophyIcon, FlameIcon, MoreIcon,
  UploadIcon, UndoIcon, ClockIcon, MicIcon, PaletteIcon, LayersIcon,
  ShareIcon, SpeakButton,
} from "./components/Icons";
import QuizModal from "./components/QuizModal";
import StatsModal from "./components/StatsModal";
import LeaderboardModal from "./components/LeaderboardModal";
import FlashcardsModal from "./components/FlashcardsModal";
import { cambridgeUrl, shareWordCard } from "./lib/wordCard";
import {
  EN_LETTERS, AR_LETTERS, firstLetterKey, fuzzyIncludes, matchScore, detectDir, detectFont,
} from "./lib/searchUtils";
import { normalizePairs } from "./lib/pairUtils";
import { parseCsv, exportEntriesAsCsv } from "./lib/csvUtils";
import { capLogs, makeLogEntry } from "./lib/logs";
import { PairListDisplay } from "./components/PairList";
import { Shell, LanguageToggle } from "./components/Shell";
import EntryCard from "./components/EntryCard";
import AddModal from "./components/AddModal";
import AccountModal from "./components/AccountModal";
import AdminModal from "./components/AdminModal";
import AuthScreens from "./components/AuthScreens";

/* =========================================================================
   SHARED CLOUD STORAGE — via /api/jsonbin (Vercel serverless proxy)
   -------------------------------------------------------------------------
   The actual JSONBin bin ID and master key live only in Vercel's server-side
   environment variables (JSONBIN_BIN_ID, JSONBIN_MASTER_KEY) — see
   api/jsonbin.js. This file never sees them, so nothing secret ships to
   the browser. Set the env vars in your Vercel project settings, then
   deploy; both of you read/write the same bin through this proxy.
   ========================================================================= */
// The shared access code is verified server-side by /api/login (env var
// ACCESS_CODE) — it never ships to the browser. The one-time admin-bootstrap
// code has been retired: an admin account already exists, so manage roles
// from the Admin panel from here on.

// `fresh: true` bypasses the browser/edge cache (see api/jsonbin.js) for the
// rare calls where we must have the absolute latest data — e.g. checking for
// a duplicate name right before creating an account. Everywhere else (most
// notably the initial page load) we're happy to accept a response that's up
// to ~10s old in exchange for it arriving instantly instead of waiting on a
// round trip to JSONBin.io on every single visit.
async function fetchRecord({ fresh = false } = {}) {
  const res = await fetch("/api/jsonbin", fresh ? { cache: "no-store" } : undefined);
  if (!res.ok) throw new Error("fetch failed");
  const data = await res.json();
  return {
    entries: data.entries || [],
    accounts: data.accounts || [],
    logs: data.logs || [],
    version: data.version || 0,
  };
}

// Thrown when the server rejects a save because someone else saved first
// (see the `version` / optimistic-locking comment in api/jsonbin.js). Carries
// the fresh server record so callers can resync instead of guessing.
class SaveConflictError extends Error {
  constructor(freshRecord) {
    super("conflict");
    this.name = "SaveConflictError";
    this.fresh = freshRecord;
  }
}

async function saveRecord(record, expectedVersion) {
  const res = await fetch("/api/jsonbin", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...record, expectedVersion }),
  });
  if (res.status === 409) {
    const data = await res.json().catch(() => null);
    throw new SaveConflictError(data || { entries: [], accounts: [], logs: [], version: expectedVersion });
  }
  if (!res.ok) throw new Error("save failed");
  const data = await res.json().catch(() => ({}));
  return typeof data.version === "number" ? data.version : expectedVersion + 1;
}

// Generates the personal numeric code a new account receives after signup.
function generatePersonalCode() {
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
const SESSION_KEY = "twoTongues.personalCode";
const THEME_KEY = "twoTongues.theme";
const ACCENT_KEY = "twoTongues.accent";

// Extra accent-color palettes the user can pick from, on top of the base
// light/dark mode. Each defines the two accent colors + their "soft"
// (low-opacity background) variants for both light and dark mode, so
// switching accent never fights with switching light/dark.
const ACCENT_THEMES = {
  brass:  { label: { en: "Brass (default)", ar: "نحاسي (افتراضي)" }, light: { a1: "#19A7CE", a1s: "#D3E7EF", a2: "#146C94", a2s: "#E4EEF2" }, dark: { a1: "#3FC1E8", a1s: "#163642", a2: "#6BAFD1", a2s: "#142A34" } },
  forest: { label: { en: "Forest", ar: "أخضر" }, light: { a1: "#2E9E5B", a1s: "#DCEFE1", a2: "#1F6E44", a2s: "#E1EFE6" }, dark: { a1: "#4ED08A", a1s: "#173C29", a2: "#7FCBA0", a2s: "#153025" } },
  plum:   { label: { en: "Plum", ar: "بنفسجي" }, light: { a1: "#9A5FC9", a1s: "#EBE0F5", a2: "#6E3D96", a2s: "#EEE5F5" }, dark: { a1: "#C094E8", a1s: "#2E2140", a2: "#9E77C4", a2s: "#271C36" } },
  amber:  { label: { en: "Amber", ar: "كهرماني" }, light: { a1: "#D98B2B", a1s: "#F5E7D3", a2: "#A85E1B", a2s: "#F2E6D8" }, dark: { a1: "#F0AE5C", a1s: "#3A2A16", a2: "#D68F44", a2s: "#332314" } },
  rose:   { label: { en: "Rose", ar: "وردي" }, light: { a1: "#D9557C", a1s: "#F5DCE4", a2: "#A83A5B", a2s: "#F2DEE5" }, dark: { a1: "#F08AA6", a1s: "#3A1E27", a2: "#D66E8C", a2s: "#331B22" } },
};

function loadSavedAccent() {
  try {
    const a = localStorage.getItem(ACCENT_KEY);
    return a && ACCENT_THEMES[a] ? a : "brass";
  } catch (e) {
    return "brass";
  }
}

function saveAccent(accent) {
  try { localStorage.setItem(ACCENT_KEY, accent); } catch (e) {}
}

// Applies the chosen accent palette as CSS custom properties on <html>,
// overriding the base --accent-1/--accent-2 (etc.) set in index.css for
// the current light/dark mode. Called on load and whenever either the
// accent or the light/dark mode changes.
function applyAccentTheme(accent, mode) {
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
const SEARCH_HISTORY_KEY = "twoTongues.searchHistory";
const MAX_SEARCH_HISTORY = 8;

function loadSearchHistory(section) {
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

function saveSearchHistory(section, list) {
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
function addToSearchHistory(section, term) {
  const clean = term.trim();
  if (!clean) return loadSearchHistory(section);
  const existing = loadSearchHistory(section);
  const deduped = existing.filter((t) => t.toLowerCase() !== clean.toLowerCase());
  const next = [clean, ...deduped].slice(0, MAX_SEARCH_HISTORY);
  saveSearchHistory(section, next);
  return next;
}

function removeFromSearchHistory(section, term) {
  const next = loadSearchHistory(section).filter((t) => t !== term);
  saveSearchHistory(section, next);
  return next;
}

function clearSearchHistory(section) {
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
const OFFLINE_CACHE_KEY = "twoTongues.offlineCache";

function saveOfflineCache(record) {
  try {
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify({ ...record, cachedAt: Date.now() }));
  } catch (e) {
    // Storage full or unavailable — offline fallback just won't be there.
  }
}

function loadOfflineCache() {
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

function loadSavedTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" ? "light" : "dark";
  } catch (e) {
    return "dark";
  }
}

function savePersonalCode(code) {
  try {
    localStorage.setItem(SESSION_KEY, code);
  } catch (e) {
    // Storage might be unavailable (e.g. private browsing) — sign-in still
    // works for this visit, it just won't be remembered next time.
  }
}

function loadPersonalCode() {
  try {
    const code = localStorage.getItem(SESSION_KEY);
    return code && code.trim() ? code.trim() : null;
  } catch (e) {
    return null;
  }
}

function clearPersonalCode() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {}
}

/* =========================================================================
   ICONS — small inline SVGs (no external icon package needed)
   ========================================================================= */



/* =========================================================================
   PRONUNCIATION
   -------------------------------------------------------------------------
   Two paths, tried in order:
   1. The device's own local voice (speechSynthesis) — works fully offline,
      no dependency on any external service being reachable.
   2. Only if that genuinely doesn't produce sound do we fall back to the
      online Google Translate audio endpoint — and we now know that
      endpoint is blocked on at least some networks (confirmed: it failed
      with a network error for this exact deployment), so it can't be the
      only path for Arabic.

   The earlier bug: we checked getVoices() *once*, synchronously, on the
   very first click. Voices — especially non-English ones — often aren't
   loaded yet at that point and only appear after the async
   "voiceschanged" event fires, sometimes a second or more after the page
   loads. Checking too early made it look like "no Arabic voice exists"
   when really the browser just hadn't reported it yet. Now we actively
   wait/retry for voices to show up before deciding there's truly nothing
   usable.
   ========================================================================= */






/* =========================================================================
   MCQ QUIZ — helpers
   -------------------------------------------------------------------------
   Turns "words studied in the last N minutes" into a shuffled set of
   multiple-choice questions covering everything stored about each word:
   its meaning (both directions), and its synonyms/antonyms when present.
   ========================================================================= */

// Returns the cutoff timestamp (ms) for a given range key, or null for "no
// cutoff" (i.e. include every studied word, even ones without a timestamp).



// Tiny inline translation helper — used throughout the authenticated app so
// that the Arabic → Arabic section's page (chrome, buttons, messages) reads
// entirely in Arabic, just like the English → Arabic section reads entirely
// in English.


// Editable pair list — used in the add/edit word form for synonyms and
// antonyms. Each row is two boxes facing each other, styled with the
// section's own word/meaning direction and font, so the box order and
// alignment naturally flip to right-to-left for an all-Arabic section.
// Pressing Enter in either box (physical keyboard) never submits the
// form — it adds a fresh empty row and moves focus into it, so typing
// several synonyms/antonyms in a row feels continuous. The word is only
// saved when the "Save word" button is used, as usual.

// The hamburger/header menu is the same in both dictionary sections — it
// follows the device's own system language, not whichever section (EN→AR /
// AR→AR) happens to be open.
function detectDeviceIsAr() {
  try {
    const langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ""];
    return langs.some((l) => (l || "").toLowerCase().startsWith("ar"));
  } catch (e) {
    return false;
  }
}
const deviceIsAr = detectDeviceIsAr();

// Some validation errors are produced in DictionaryApp (shared logic, not
// section-aware) as fixed English sentences. Map the known ones to Arabic
// when the Admin panel is being viewed from the Arabic → Arabic section.

const SECTIONS = {
  "en-ar": {
    label: "English → Arabic", shortLabel: "EN → AR", dir: "ltr",
    accent: "var(--accent-1)", accentSoft: "var(--accent-1-soft)",
    wordPlaceholder: "Word in English", wordDir: "ltr", wordFont: "'Fraunces', serif",
    meaningPlaceholder: "المعنى بالعربية", meaningDir: "rtl", meaningFont: "'Amiri', serif",
    letters: EN_LETTERS,
  },
  "ar-ar": {
    label: "Arabic → Arabic", shortLabel: "AR → AR", dir: "rtl",
    accent: "var(--accent-2)", accentSoft: "var(--accent-2-soft)",
    wordPlaceholder: "الكلمة", wordDir: "rtl", wordFont: "'Amiri', serif",
    meaningPlaceholder: "الشرح بالعربية", meaningDir: "rtl", meaningFont: "'Amiri', serif",
    letters: AR_LETTERS,
  },
};



function HeaderMenu({ theme, onToggleTheme, isAdmin, onOpenAccount, onOpenAdmin, onLogout, isAr, accentTheme, onChangeAccent }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    function onKeyDown(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function itemClick(fn) {
    setOpen(false);
    fn();
  }

  const itemStyle = { display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 14px", fontSize: 13.5, fontWeight: 600, color: "var(--ink)", background: "none", border: "none", textAlign: "start", cursor: "pointer" };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} title={tr(isAr, "Menu", "القائمة")} aria-label={tr(isAr, "Menu", "القائمة")} aria-expanded={open} className="lift-hover"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, border: "1px solid rgba(var(--border-rgb),0.25)", background: "none", color: "var(--icon-muted)", borderRadius: 10, cursor: "pointer" }}>
        <MenuIcon size={16} />
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", top: "calc(100% + 8px)", insetInlineEnd: 0, minWidth: 190, background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 10, boxShadow: "0 14px 30px -12px rgba(0,0,0,0.35)", overflowY: "auto", maxHeight: "min(320px, calc(100vh - 90px))", overscrollBehavior: "contain", zIndex: 40, animation: "scaleIn 0.18s cubic-bezier(0.22,1,0.36,1) both", transformOrigin: "top" }}>
          <button role="menuitem" style={itemStyle} onClick={() => itemClick(onToggleTheme)}>
            {theme === "dark" ? <SunIcon size={15} /> : <MoonIcon size={15} />}
            {theme === "dark" ? tr(isAr, "Light Mode", "الوضع الفاتح") : tr(isAr, "Dark Mode", "الوضع الداكن")}
          </button>
          {onChangeAccent && (
            <div style={{ padding: "9px 14px", borderTop: "1px solid rgba(var(--border-rgb),0.12)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: "var(--icon-muted)", marginBottom: 7 }}>
                <PaletteIcon size={13} /> {tr(isAr, "Color theme", "لون الواجهة")}
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {Object.entries(ACCENT_THEMES).map(([key, t]) => {
                  const swatch = (t[theme] || t.light).a1;
                  const active = key === accentTheme;
                  return (
                    <button key={key} type="button" onClick={() => onChangeAccent(key)}
                      title={tr(isAr, t.label.en, t.label.ar)} aria-label={tr(isAr, t.label.en, t.label.ar)}
                      style={{ width: 22, height: 22, borderRadius: "50%", background: swatch, border: active ? "2px solid var(--ink)" : "1px solid rgba(var(--border-rgb),0.3)", cursor: "pointer", padding: 0, boxShadow: active ? "0 0 0 2px var(--card)" : "none" }} />
                  );
                })}
              </div>
            </div>
          )}
          <button role="menuitem" style={{ ...itemStyle, borderTop: "1px solid rgba(var(--border-rgb),0.12)" }} onClick={() => itemClick(onOpenAccount)}>
            <UserIcon size={15} /> {tr(isAr, "My Account", "حسابي")}
          </button>
          {isAdmin && (
            <button role="menuitem" style={{ ...itemStyle, borderTop: "1px solid rgba(var(--border-rgb),0.12)" }} onClick={() => itemClick(onOpenAdmin)}>
              <UsersIcon size={15} /> {tr(isAr, "Admin Panel", "لوحة التحكم")}
            </button>
          )}
          <button role="menuitem" style={{ ...itemStyle, borderTop: "1px solid rgba(var(--border-rgb),0.12)", color: "var(--danger)" }} onClick={() => itemClick(onLogout)}>
            <LogoutIcon size={15} /> {tr(isAr, "Sign Out", "تسجيل الخروج")}
          </button>
        </div>
      )}
    </div>
  );
}

// Dropdown menu that groups the secondary toolbar actions (Leaderboard,
// Stats, Quiz, Export CSV) so the search bar isn't crowded by 4+ buttons.
const TOOLS_MENU_ITEMS_META = { minWidth: 190, gap: 8 };

function ToolsMenu({ accent, onLeaderboard, onStats, onQuiz, onFlashcards, onExport, exportDisabled, onImport, importing, isAr }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null); // { left, top, openUpward } in viewport (fixed) coordinates
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const computeCoords = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuHeight = menuRef.current ? menuRef.current.offsetHeight : 260;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < menuHeight + TOOLS_MENU_ITEMS_META.gap && spaceAbove > spaceBelow;
    const top = openUpward
      ? Math.max(8, rect.top - menuHeight - TOOLS_MENU_ITEMS_META.gap)
      : rect.bottom + TOOLS_MENU_ITEMS_META.gap;
    const left = isAr
      ? rect.left
      : Math.min(rect.right - TOOLS_MENU_ITEMS_META.minWidth, window.innerWidth - TOOLS_MENU_ITEMS_META.minWidth - 8);
    setCoords({ left: Math.max(8, left), top, openUpward });
  }, [isAr]);

  // Recompute position the instant it opens, then keep it pinned to the
  // button while the page scrolls or the window resizes — since the menu
  // is rendered in a portal at document.body, it's positioned purely from
  // real screen coordinates and can't be clipped by any parent's overflow,
  // transform, or z-index stacking, wherever this button ends up on the page.
  useEffect(() => {
    if (!open) return;
    computeCoords();
    const raf = requestAnimationFrame(computeCoords); // one more pass once menu height is known
    function onDocClick(e) {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onKeyDown(e) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("scroll", computeCoords, true);
    window.addEventListener("resize", computeCoords);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", computeCoords, true);
      window.removeEventListener("resize", computeCoords);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, computeCoords]);

  function itemClick(fn) {
    setOpen(false);
    fn();
  }

  const itemStyle = { display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 14px", fontSize: 13.5, fontWeight: 600, color: "var(--ink)", background: "none", border: "none", textAlign: "start", cursor: "pointer" };

  const menu = open && (
    <div
      ref={menuRef}
      role="menu"
      dir={isAr ? "rtl" : "ltr"}
      style={{
        position: "fixed",
        top: coords ? coords.top : -9999,
        left: coords ? coords.left : -9999,
        visibility: coords ? "visible" : "hidden",
        minWidth: TOOLS_MENU_ITEMS_META.minWidth,
        maxHeight: "min(320px, calc(100vh - 16px))",
        overflowY: "auto",
        overscrollBehavior: "contain",
        background: "var(--card)",
        border: "1px solid rgba(var(--border-rgb),0.2)",
        borderRadius: 10,
        boxShadow: "0 14px 30px -12px rgba(0,0,0,0.35)",
        zIndex: 1000,
        animation: `${coords?.openUpward ? "scaleInUp" : "scaleIn"} 0.18s cubic-bezier(0.22,1,0.36,1) both`,
        transformOrigin: coords?.openUpward ? "bottom" : "top",
      }}
    >
      <button role="menuitem" style={itemStyle} onClick={() => itemClick(onLeaderboard)}>
        <TrophyIcon size={16} /> {tr(isAr, "Leaderboard", "الترتيب")}
      </button>
      <button role="menuitem" style={{ ...itemStyle, borderTop: "1px solid rgba(var(--border-rgb),0.12)" }} onClick={() => itemClick(onStats)}>
        <StatsIcon size={16} /> {tr(isAr, "Stats", "إحصائياتي")}
      </button>
      <button role="menuitem" style={{ ...itemStyle, borderTop: "1px solid rgba(var(--border-rgb),0.12)" }} onClick={() => itemClick(onQuiz)}>
        <QuizIcon size={16} /> {tr(isAr, "Quiz", "اختبار")}
      </button>
      <button role="menuitem" style={{ ...itemStyle, borderTop: "1px solid rgba(var(--border-rgb),0.12)" }} onClick={() => itemClick(onFlashcards)}>
        <LayersIcon size={16} /> {tr(isAr, "Flashcards", "بطاقات تعليمية")}
      </button>
      <button role="menuitem" disabled={exportDisabled}
        style={{ ...itemStyle, borderTop: "1px solid rgba(var(--border-rgb),0.12)", opacity: exportDisabled ? 0.5 : 1, cursor: exportDisabled ? "default" : "pointer" }}
        onClick={() => { if (!exportDisabled) itemClick(onExport); }}>
        <DownloadIcon size={16} /> {tr(isAr, "Export CSV", "تصدير CSV")}
      </button>
      <button role="menuitem" disabled={importing}
        style={{ ...itemStyle, borderTop: "1px solid rgba(var(--border-rgb),0.12)", opacity: importing ? 0.5 : 1, cursor: importing ? "default" : "pointer" }}
        onClick={() => { if (!importing) itemClick(onImport); }}>
        {importing ? <LoaderIcon size={16} /> : <UploadIcon size={16} />} {tr(isAr, "Import CSV", "استيراد CSV")}
      </button>
    </div>
  );

  return (
    <div className="toolbar-anim" style={{ position: "relative", animationDelay: "0.06s" }}>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        aria-label={tr(isAr, "More actions", "المزيد")}
        aria-expanded={open}
        aria-haspopup="menu"
        className="lift-hover"
        style={{ display: "flex", alignItems: "center", gap: 7, height: "100%", padding: "10px 16px", fontSize: 14, fontWeight: 600, color: accent, background: "var(--card)", border: `1px solid ${accent}40`, borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap" }}
      >
        <MoreIcon size={16} /> {tr(isAr, "More", "المزيد")}
        <ChevronIcon size={13} style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
      </button>
      {open && typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </div>
  );
}

// Small language switcher — shown on the login screen (floating, top corner
// of the card) and reused as-is (inline) in the main app header, so the
// button looks identical wherever it appears.

const savedPersonalCode = loadPersonalCode();

// If someone opened an invite link (?invite=1), skip the intro and go
// straight to "create account" — the shared access code still has to be
// given to them separately (it's a server-only secret, never exposed to
// any client, admin included), but this saves the extra tap.
function hasInviteParam() {
  try {
    return new URLSearchParams(window.location.search).get("invite") === "1";
  } catch (e) {
    return false;
  }
}

export default function DictionaryApp() {
  // Fixed the moment this tab loaded — powers the quiz's "This session"
  // time-range option ("studied since I opened the site this time").
  const sessionStartRef = useRef(Date.now());
  const [authStage, setAuthStage] = useState(
    savedPersonalCode ? "restoring" : hasInviteParam() ? "signup" : "intro"
  ); // intro | signup | codeShown | login | restoring | in
  const [name, setName] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [personalCodeInput, setPersonalCodeInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupSaving, setSignupSaving] = useState(false);
  const [myCode, setMyCode] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [moreFeaturesOpen, setMoreFeaturesOpen] = useState(false);

  // App-wide language toggle — starts out matching the device's system
  // language, but the switch in the header (and on the login screen) lets
  // the user flip it manually (Arabic <-> English) anywhere in the site.
  const [appLang, setAppLang] = useState(deviceIsAr ? "ar" : "en");
  const appIsAr = appLang === "ar";
  const atr = (en, ar) => tr(appIsAr, en, ar);
  function toggleAppLang() {
    setAppLang((l) => (l === "ar" ? "en" : "ar"));
  }

  const [entries, setEntries] = useState([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  // Tracks the version of the shared record we last read from the server —
  // sent back on every save as `expectedVersion` so the server can detect
  // (and reject) a write that would silently clobber someone else's change
  // made in between. See the concurrency comment in api/jsonbin.js.
  const [recordVersion, setRecordVersion] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [offlineCachedAt, setOfflineCachedAt] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [accountCode, setAccountCode] = useState(""); // this browser's signed-in account's personal code
  const [section, setSection] = useState("en-ar");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState(loadSavedTheme);
  const [accentTheme, setAccentTheme] = useState(loadSavedAccent);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }, [theme]);

  // Re-applies the chosen accent color palette whenever the accent choice
  // or the light/dark mode changes (each accent has its own light+dark
  // variant so contrast stays correct either way).
  useEffect(() => {
    applyAccentTheme(accentTheme, theme);
    saveAccent(accentTheme);
  }, [accentTheme, theme]);

  // Registers the offline service worker (see /sw.js). Wrapped in feature
  // detection + try/catch since some browsers (or non-HTTPS dev servers)
  // don't support it — the app should keep working online-only there.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failure just means no offline app-shell caching;
      // the localStorage data cache above still works independently.
    });
  }, []);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  }

  const studiedIds = useMemo(() => {
    const acct = accounts.find((a) => a.code === accountCode);
    return new Set((acct && acct.studied) || []);
  }, [accounts, accountCode]);

  const favoriteIds = useMemo(() => {
    const acct = accounts.find((a) => a.code === accountCode);
    return new Set((acct && acct.favorites) || []);
  }, [accounts, accountCode]);

  // When each currently-studied entry was marked as studied (ms since epoch),
  // for the signed-in account — powers the MCQ quiz's "studied in the last…"
  // time-range picker. Entries marked studied before this feature existed
  // won't have a timestamp; the quiz treats those as "any time".
  const studiedAt = useMemo(() => {
    const acct = accounts.find((a) => a.code === accountCode);
    return (acct && acct.studiedAt) || {};
  }, [accounts, accountCode]);

  // Spaced-repetition state for the signed-in account — see the
  // "SPACED REPETITION" helpers above. Both default to empty objects so
  // accounts created before this feature existed (or words never quizzed)
  // behave as "New / due now", same as a brand-new word.
  const srsStats = useMemo(() => {
    const acct = accounts.find((a) => a.code === accountCode);
    return (acct && acct.srsStats) || {};
  }, [accounts, accountCode]);

  // Derived level (0-3) per word, computed from cumulative accuracy — see
  // srsLevelFromStats. Kept as its own memo so consumers (Stats panel,
  // quiz "due" filter) don't each recompute it themselves.
  const srsBox = useMemo(() => {
    const out = {};
    for (const id of Object.keys(srsStats)) out[id] = srsLevelFromStats(srsStats[id]);
    return out;
  }, [srsStats]);

  const srsDueAt = useMemo(() => {
    const acct = accounts.find((a) => a.code === accountCode);
    return (acct && acct.srsDueAt) || {};
  }, [accounts, accountCode]);

  // Past quiz results for the signed-in account (most recent last), capped
  // to the last 50 so the shared bin doesn't grow forever. Powers the
  // Stats panel's "recent quizzes" list and streak calculation.
  const quizHistory = useMemo(() => {
    const acct = accounts.find((a) => a.code === accountCode);
    return (acct && acct.quizHistory) || [];
  }, [accounts, accountCode]);

  // Load the shared record (entries + accounts) once on mount — accounts are
  // needed for both signup (checking for name clashes) and login (checking
  // the personal code), and entries are ready by the time the user gets in.
  // If a personal code was remembered from a previous visit, try it against
  // the freshly-loaded accounts and log straight in — otherwise fall back to
  // the login screen.
  // Whenever the auth stage settles to something other than "restoring" (auto
  // login succeeded, the saved code was invalid, or loading failed), stamp
  // the CURRENT (base) history entry with that final stage. Without this,
  // the base entry stays frozen on the transient "restoring" snapshot from
  // mount — so pressing "back" out of any modal later lands back on
  // "restoring" and the app gets stuck there.
  function syncBaseHistory(stage) {
    window.history.replaceState({ authStage: stage, showAdd: false, showAccount: false, showAdmin: false, section: "en-ar" }, "");
  }

  useEffect(() => {
    (async () => {
      try {
        const rec = await fetchRecord();
        setEntries(rec.entries);
        setAccounts(rec.accounts);
        setLogs(rec.logs);
        setRecordVersion(rec.version);
        saveOfflineCache(rec);
        setIsOffline(false);
        if (savedPersonalCode) {
          const account = rec.accounts.find((a) => a.code === savedPersonalCode);
          if (account) {
            setName(account.name);
            setIsAdmin(account.role === "admin");
            setAccountCode(account.code);
            setAuthStage("in");
            syncBaseHistory("in");
          } else {
            clearPersonalCode();
            setAuthStage("login");
            syncBaseHistory("login");
          }
        }
      } catch (e) {
        // No network (or the API is down) — fall back to whatever we last
        // cached locally so the app still opens with the words in it,
        // read-only, instead of a dead error screen.
        const cached = loadOfflineCache();
        if (cached && cached.entries.length) {
          setEntries(cached.entries);
          setAccounts(cached.accounts);
          setLogs(cached.logs);
          setIsOffline(true);
          setOfflineCachedAt(cached.cachedAt);
          if (savedPersonalCode) {
            const account = cached.accounts.find((a) => a.code === savedPersonalCode);
            if (account) {
              setName(account.name);
              setIsAdmin(account.role === "admin");
              setAccountCode(account.code);
              setAuthStage("in");
              syncBaseHistory("in");
            } else {
              setAuthStage("login");
              syncBaseHistory("login");
            }
          }
        } else {
          setLoadError("Couldn't load the shared dictionary. Check your connection and try refreshing.");
          if (savedPersonalCode) {
            setAuthStage("login");
            syncBaseHistory("login");
          }
        }
      } finally {
        setEntriesLoaded(true);
        setAccountsLoaded(true);
        setLogsLoaded(true);
      }
    })();
  }, []);

  // ---------------------------------------------------------------------
  // History integration: without this, the phone's/browser's back button has
  // nothing to "undo" inside the app, so it just leaves the page entirely —
  // which feels like the page closed. We push a history entry for every
  // screen change, the add-word modal, and section switches (EN→AR / AR→AR),
  // and a popstate listener restores the matching in-app state instead of
  // letting the browser navigate away.
  // ---------------------------------------------------------------------
  const isPoppingRef = useRef(false);

  useEffect(() => {
    window.history.replaceState({ authStage, showAdd: false, showAccount: false, showAdmin: false, section: "en-ar" }, "");
    function onPopState(e) {
      const state = e.state || { authStage: savedPersonalCode ? "restoring" : "intro", showAdd: false, showAccount: false, showAdmin: false, section: "en-ar" };
      isPoppingRef.current = true;
      let nextStage = state.authStage || "intro";
      // History entries created before Sign Out still carry authStage: "in"
      // (pushState snapshots aren't retroactively updated on logout). Never
      // trust a snapshot claiming an authenticated view unless there's still
      // an actual signed-in session — otherwise Back after Sign Out silently
      // re-enters the app.
      if (nextStage === "in" && !loadPersonalCode()) {
        nextStage = "login";
      }
      setAuthStage(nextStage);
      setShowAdd(!!state.showAdd);
      setShowAccount(!!state.showAccount);
      setShowAdmin(!!state.showAdmin);
      setSection(state.section || "en-ar");
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Merges overrides on top of the current in-app state so every push carries
  // forward whichever stage/modal/section wasn't the thing that just changed.
  function pushHistory(overrides) {
    window.history.pushState({ authStage, showAdd, showAccount, showAdmin, section, ...overrides }, "");
  }

  function goToStage(stage) {
    setAuthStage(stage);
    pushHistory({ authStage: stage, showAdd: false, showAccount: false, showAdmin: false });
  }

  function openAddModal() {
    setShowAdd(true);
    pushHistory({ showAdd: true });
  }

  const closeAddModal = useCallback(() => {
    if (window.history.state && window.history.state.showAdd) {
      window.history.back(); // popstate listener will flip showAdd off
    } else {
      setShowAdd(false);
    }
  }, []);

  function openAccountModal() {
    setShowAccount(true);
    pushHistory({ showAccount: true });
  }

  const closeAccountModal = useCallback(() => {
    if (window.history.state && window.history.state.showAccount) {
      window.history.back();
    } else {
      setShowAccount(false);
    }
  }, []);

  function openAdminModal() {
    setShowAdmin(true);
    pushHistory({ showAdmin: true });
  }

  const closeAdminModal = useCallback(() => {
    if (window.history.state && window.history.state.showAdmin) {
      window.history.back();
    } else {
      setShowAdmin(false);
    }
  }, []);

  function changeSection(nextSection) {
    setSection(nextSection);
    setQuery("");
    pushHistory({ section: nextSection });
  }

  // Shared conflict handler: on a version mismatch, adopt the server's
  // fresh data so we're not left silently diverged from what's actually
  // saved. Used as a last-resort fallback when we can't safely auto-retry
  // (e.g. retry attempts exhausted).
  function handleSaveConflict(err) {
    setEntries(err.fresh.entries || []);
    setAccounts(err.fresh.accounts || []);
    setLogs(err.fresh.logs || []);
    setRecordVersion(err.fresh.version || 0);
    setSaveError("Someone else updated the dictionary at the same time — your last change wasn't saved. The list has been refreshed; please try again.");
  }

  // Max number of automatic retries on a version conflict before giving up
  // and falling back to handleSaveConflict (which discards the pending
  // change and asks the user to retry manually). In practice a single
  // retry resolves the vast majority of real-world races (two people
  // adding a word within the same second), since each retry re-reads the
  // absolute latest server state.
  const MAX_SAVE_RETRIES = 5;

  // `entriesFn` is either an array (the new entries list) or a function
  // `(currentEntries) => nextEntries`. Passing a function is what makes
  // concurrent adds safe: if the server rejects our save because someone
  // else saved first, we re-fetch the fresh entries and *re-run* the
  // function against them, so our own change (e.g. "add this one word")
  // gets re-applied on top of theirs instead of being thrown away. Same
  // idea for `logEntryFn`, which may depend on data that changed (e.g. a
  // log message referencing something in the freshly-read state).
  const persistEntries = useCallback(async (entriesFn, logEntryFn) => {
    let curEntries = typeof entriesFn === "function" ? entries : entriesFn;
    let curAccounts = accounts;
    let curLogs = logs;
    let curVersion = recordVersion;

    for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt++) {
      const next = typeof entriesFn === "function" ? entriesFn(curEntries) : entriesFn;
      const logEntry = typeof logEntryFn === "function" ? logEntryFn(curEntries) : logEntryFn;
      const nextLogs = logEntry ? capLogs([...curLogs, logEntry]) : curLogs;

      setEntries(next);
      if (logEntry) setLogs(nextLogs);

      try {
        const newVersion = await saveRecord({ entries: next, accounts: curAccounts, logs: nextLogs }, curVersion);
        setRecordVersion(newVersion);
        saveOfflineCache({ entries: next, accounts: curAccounts, logs: nextLogs });
        setSaveError("");
        return;
      } catch (e) {
        if (e instanceof SaveConflictError && typeof entriesFn === "function" && attempt < MAX_SAVE_RETRIES) {
          // Someone else saved first — reapply our change on top of the
          // fresh server data and try again, instead of losing it.
          curEntries = e.fresh.entries || [];
          curAccounts = e.fresh.accounts || [];
          curLogs = e.fresh.logs || [];
          curVersion = e.fresh.version || 0;
          continue;
        }
        if (e instanceof SaveConflictError) handleSaveConflict(e);
        else setSaveError("Couldn't save — check your connection and try again.");
        return;
      }
    }
  }, [entries, accounts, logs, recordVersion]);

  const persistAccounts = useCallback(async (accountsFn, logEntryFn) => {
    let curEntries = entries;
    let curAccounts = typeof accountsFn === "function" ? accounts : accountsFn;
    let curLogs = logs;
    let curVersion = recordVersion;

    for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt++) {
      const next = typeof accountsFn === "function" ? accountsFn(curAccounts) : accountsFn;
      const logEntry = typeof logEntryFn === "function" ? logEntryFn(curAccounts) : logEntryFn;
      const nextLogs = logEntry ? capLogs([...curLogs, logEntry]) : curLogs;

      setAccounts(next);
      if (logEntry) setLogs(nextLogs);

      try {
        const newVersion = await saveRecord({ entries: curEntries, accounts: next, logs: nextLogs }, curVersion);
        setRecordVersion(newVersion);
        saveOfflineCache({ entries: curEntries, accounts: next, logs: nextLogs });
        setSaveError("");
        return;
      } catch (e) {
        if (e instanceof SaveConflictError && typeof accountsFn === "function" && attempt < MAX_SAVE_RETRIES) {
          curEntries = e.fresh.entries || [];
          curAccounts = e.fresh.accounts || [];
          curLogs = e.fresh.logs || [];
          curVersion = e.fresh.version || 0;
          continue;
        }
        if (e instanceof SaveConflictError) handleSaveConflict(e);
        else setSaveError("Couldn't save — check your connection and try again.");
        return;
      }
    }
  }, [entries, accounts, logs, recordVersion]);

  // For events that don't touch entries/accounts (sign in/out) — still saved
  // into the same shared record so it stays in sync with everything else.
  const persistLogs = useCallback(async (next) => {
    setLogs(next);
    try {
      const newVersion = await saveRecord({ entries, accounts, logs: next }, recordVersion);
      setRecordVersion(newVersion);
    } catch (e) {
      // Best-effort: a failed log write shouldn't block sign-in/out. On a
      // conflict, still resync so we don't keep hammering a stale version.
      if (e instanceof SaveConflictError) handleSaveConflict(e);
    }
  }, [entries, accounts, recordVersion]);

  function logEvent(action, message, actorName, actorCode) {
    persistLogs(capLogs([...logs, makeLogEntry(action, message, actorName, actorCode)]));
  }

  // Toggles whether the current signed-in account has marked a given entry
  // as studied/seen. Stored per-account (account.studied: [entryId, ...]) so
  // each user tracks their own progress against the shared word list. Also
  // stamps (or clears) account.studiedAt[entryId] with when that happened,
  // so the quiz can later ask "words I studied in the last N minutes".
  async function handleToggleStudied(entryId) {
    const acct = accounts.find((a) => a.code === accountCode);
    const current = (acct && acct.studied) || [];
    const currentAt = (acct && acct.studiedAt) || {};
    const nowStudying = !current.includes(entryId);
    const nextStudied = nowStudying
      ? [...current, entryId]
      : current.filter((id) => id !== entryId);
    const nextStudiedAt = { ...currentAt };
    if (nowStudying) nextStudiedAt[entryId] = Date.now();
    else delete nextStudiedAt[entryId];
    const nextAccounts = accounts.map((a) => (a.code === accountCode ? { ...a, studied: nextStudied, studiedAt: nextStudiedAt } : a));
    await persistAccounts(nextAccounts);
  }

  // Toggles whether the current signed-in account has bookmarked a word as
  // a "favorite" — separate from "studied", so someone can flag a word to
  // come back to later without that being read as "I've already learned
  // this". Stored per-account (account.favorites: [entryId, ...]).
  async function handleToggleFavorite(entryId) {
    const acct = accounts.find((a) => a.code === accountCode);
    const current = (acct && acct.favorites) || [];
    const nextFavorites = current.includes(entryId)
      ? current.filter((id) => id !== entryId)
      : [...current, entryId];
    const nextAccounts = accounts.map((a) => (a.code === accountCode ? { ...a, favorites: nextFavorites } : a));
    await persistAccounts(nextAccounts);
  }

  // Called once per answered quiz question. Adds to the word's cumulative
  // correct/total tally (never resets on a wrong answer — see
  // srsLevelFromStats) and reschedules its next due date based on the
  // resulting level. Best-effort: a failed save shouldn't interrupt the
  // quiz the user is in the middle of taking.
  async function handleRecordSrsAnswer(entryId, correct) {
    const acct = accounts.find((a) => a.code === accountCode);
    if (!acct) return;
    const prevStats = (acct.srsStats && acct.srsStats[entryId]) || { correct: 0, total: 0 };
    const nextStats = { correct: prevStats.correct + (correct ? 1 : 0), total: prevStats.total + 1 };
    const nextLevel = correct ? srsLevelFromStats(nextStats) : 0; // a miss always means "re-test soon", regardless of the word's overall level
    const nextDue = Date.now() + SRS_LEVEL_INTERVALS_MS[nextLevel];
    const nextAccounts = accounts.map((a) => (a.code === accountCode
      ? { ...a, srsStats: { ...(a.srsStats || {}), [entryId]: nextStats }, srsDueAt: { ...(a.srsDueAt || {}), [entryId]: nextDue } }
      : a));
    try { await persistAccounts(nextAccounts); } catch (e) { /* best-effort, quiz keeps going */ }
  }

  // Appends one finished quiz's summary to the account's history (for the
  // Stats panel), capped to the most recent 50 so the shared bin stays small.
  async function handleSaveQuizResult(result) {
    const acct = accounts.find((a) => a.code === accountCode);
    if (!acct) return;
    const nextHistory = [...((acct.quizHistory) || []), result].slice(-50);
    const nextAccounts = accounts.map((a) => (a.code === accountCode ? { ...a, quizHistory: nextHistory } : a));
    try { await persistAccounts(nextAccounts); } catch (e) { /* best-effort */ }
  }

  async function handleSignup(e) {
    e.preventDefault();
    setSignupError("");
    const trimmed = name.trim();
    if (!trimmed) { setSignupError("Enter your name."); return; }

    setSignupSaving(true);
    try {
      // Re-fetch the freshest account list right before checking/creating, so a
      // name taken moments ago by someone else (on any device) is still caught.
      const rec = await fetchRecord({ fresh: true });
      const clash = rec.accounts.some((a) => a.name.toLowerCase() === trimmed.toLowerCase());
      if (clash) {
        setSignupError("An account with this name already exists. Use another name, or sign in if it's yours.");
        setAccounts(rec.accounts);
        setEntries(rec.entries);
        setLogs(rec.logs);
        setRecordVersion(rec.version);
        return;
      }
      const code = generatePersonalCode();
      const nextAccounts = [...rec.accounts, { name: trimmed, code, role: "user", createdAt: Date.now() }];
      const nextLogs = capLogs([...(rec.logs || []), makeLogEntry("account_add", `${trimmed} created an account (self sign-up)`, trimmed, code)]);
      const newVersion = await saveRecord({ entries: rec.entries, accounts: nextAccounts, logs: nextLogs }, rec.version);
      setEntries(rec.entries);
      setAccounts(nextAccounts);
      setLogs(nextLogs);
      setRecordVersion(newVersion);
      setMyCode(code);
      goToStage("codeShown");
    } catch (err) {
      if (err instanceof SaveConflictError) {
        // Extremely tight race: someone else signed up (or another change
        // landed) in the instant between our fresh read and our write.
        // Simplest safe move is to ask them to just try again — a second
        // attempt will re-read fresh and almost certainly succeed.
        setSignupError("Someone else just made a change — please try again.");
      } else {
        setSignupError("Couldn't create the account — check your connection and try again.");
      }
    } finally {
      setSignupSaving(false);
    }
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(myCode);
    } catch (err) {
      // Fallback for browsers/contexts without clipboard API access.
      const ta = document.createElement("textarea");
      ta.value = myCode;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e2) {}
      document.body.removeChild(ta);
    }
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1800);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setAuthError("");

    const code = codeInput.trim();
    if (!code) { setAuthError("Enter the access code."); return; }

    if (!accountsLoaded) { setAuthError("Still loading — please try again in a moment."); return; }
    const trimmedPersonal = personalCodeInput.trim();
    if (!trimmedPersonal) { setAuthError("Enter your personal code."); return; }
    const account = accounts.find((a) => a.code === trimmedPersonal);
    if (!account) { setAuthError("That personal code doesn't match any account."); return; }

    setLoggingIn(true);
    let verified;
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      verified = await res.json();
    } catch (err) {
      setLoggingIn(false);
      setAuthError("Couldn't verify the access code — check your connection and try again.");
      return;
    }
    setLoggingIn(false);
    if (!verified || !verified.ok) {
      setAuthError((verified && verified.error) || "That access code doesn't match.");
      return;
    }

    setName(account.name);
    setIsAdmin(account.role === "admin");
    setAccountCode(account.code);
    savePersonalCode(account.code);

    // The very first successful sign-in for an account gets its own log
    // action ("first_sign_in") so admins can tell brand-new users apart
    // from returning ones in the activity log. Admin accounts' own sign-ins
    // aren't logged at all — only regular users' sign in/out show up here.
    if (account.role !== "admin") {
      const isFirstSignIn = !account.firstSignInAt;
      const logEntry = makeLogEntry(
        isFirstSignIn ? "first_sign_in" : "sign_in",
        isFirstSignIn ? `${account.name} signed in for the first time` : `${account.name} signed in`,
        account.name, account.code
      );
      if (isFirstSignIn) {
        const nextAccounts = accounts.map((a) => (a.code === account.code ? { ...a, firstSignInAt: Date.now() } : a));
        await persistAccounts(nextAccounts, logEntry);
      } else {
        await persistLogs(capLogs([...logs, logEntry]));
      }
    }
    goToStage("in");
  }

  function handleLogout() {
    if (accountCode && !isAdmin) {
      logEvent("sign_out", `${name} signed out`, name, accountCode);
    }
    clearPersonalCode();
    setName("");
    setIsAdmin(false);
    setAccountCode("");
    setCodeInput("");
    setPersonalCodeInput("");
    setAuthError("");
    setShowAdd(false);
    setShowAccount(false);
    setShowAdmin(false);
    goToStage("login");
  }

  // Self-service: the signed-in person renaming themselves from "My account".
  async function handleUpdateOwnName(newName) {
    const trimmed = newName.trim();
    if (!trimmed) return { error: "Enter your name." };
    const clash = accounts.some((a) => a.code !== accountCode && a.name.toLowerCase() === trimmed.toLowerCase());
    if (clash) return { error: "That name is already taken." };
    const oldName = name;
    const nextAccounts = accounts.map((a) => (a.code === accountCode ? { ...a, name: trimmed } : a));
    const logEntry = makeLogEntry("account_edit", `${oldName} renamed their own account to "${trimmed}"`, trimmed, accountCode);
    await persistAccounts(nextAccounts, logEntry);
    setName(trimmed);
    showToast("Account info updated.");
    return { ok: true };
  }

  // Admin panel: create a new account with a freshly generated personal code.
  async function handleAdminAddAccount(newName, role) {
    const trimmed = newName.trim();
    if (!trimmed) return { error: "Enter a name." };
    const clash = accounts.some((a) => a.name.toLowerCase() === trimmed.toLowerCase());
    if (clash) return { error: "An account with this name already exists." };
    const code = generatePersonalCode();
    const nextRole = role === "admin" ? "admin" : "user";
    const nextAccounts = [...accounts, { name: trimmed, code, role: nextRole, createdAt: Date.now() }];
    const logEntry = makeLogEntry("account_add", `${name} added account "${trimmed}" (${nextRole === "admin" ? "Admin" : "User"})`, name, accountCode);
    await persistAccounts(nextAccounts, logEntry);
    return { ok: true, code };
  }

  // Admin panel: edit another (or your own) account's name/role.
  async function handleAdminEditAccount(targetCode, updates) {
    const trimmedName = (updates.name || "").trim();
    if (!trimmedName) return { error: "Enter a name." };
    const clash = accounts.some((a) => a.code !== targetCode && a.name.toLowerCase() === trimmedName.toLowerCase());
    if (clash) return { error: "That name is already taken." };
    const nextRole = updates.role === "admin" ? "admin" : "user";
    const target = accounts.find((a) => a.code === targetCode);
    const nextAccounts = accounts.map((a) => (a.code === targetCode ? { ...a, name: trimmedName, role: nextRole } : a));
    const logEntry = makeLogEntry(
      "account_edit",
      `${name} edited account "${(target && target.name) || targetCode}" → name: "${trimmedName}", role: ${nextRole === "admin" ? "Admin" : "User"}`,
      name, accountCode
    );
    await persistAccounts(nextAccounts, logEntry);
    if (targetCode === accountCode) {
      // Editing your own account updates what's shown immediately, including
      // losing admin-panel access right away if you demoted yourself.
      setName(trimmedName);
      setIsAdmin(nextRole === "admin");
    }
    return { ok: true };
  }

  // Admin panel: remove an account. If an admin removes their own account,
  // sign them out immediately rather than leaving them in a stale session.
  async function handleAdminDeleteAccount(targetCode) {
    const target = accounts.find((a) => a.code === targetCode);
    const nextAccounts = accounts.filter((a) => a.code !== targetCode);
    const logEntry = makeLogEntry("account_delete", `${name} deleted account "${(target && target.name) || targetCode}"`, name, accountCode);
    await persistAccounts(nextAccounts, logEntry);
    if (targetCode === accountCode) {
      handleLogout();
    }
  }


  if (authStage !== "in") {
    return (
      <AuthScreens
        authStage={authStage} appIsAr={appIsAr} atr={atr} theme={theme} toggleTheme={toggleTheme} toggleAppLang={toggleAppLang}
        moreFeaturesOpen={moreFeaturesOpen} setMoreFeaturesOpen={setMoreFeaturesOpen} goToStage={goToStage}
        name={name} setName={setName} signupError={signupError} setSignupError={setSignupError} signupSaving={signupSaving} handleSignup={handleSignup}
        myCode={myCode} codeCopied={codeCopied} handleCopyCode={handleCopyCode}
        codeInput={codeInput} setCodeInput={setCodeInput} personalCodeInput={personalCodeInput} setPersonalCodeInput={setPersonalCodeInput}
        authError={authError} setAuthError={setAuthError} loggingIn={loggingIn} handleLogin={handleLogin}
      />
    );
  }

  if (!accountCode) {
    // Safety net: never render the authenticated app without a real
    // signed-in account code, even if authStage somehow says "in".
    return (
      <Shell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--muted-strong)" }}>
          <LoaderIcon size={18} /><span>Signing you in…</span>
        </div>
      </Shell>
    );
  }

  return (
    <MainView
      name={name} isAdmin={isAdmin} entries={entries} entriesLoaded={entriesLoaded} loadError={loadError}
      isOffline={isOffline} offlineCachedAt={offlineCachedAt}
      section={section} onChangeSection={changeSection} query={query} setQuery={setQuery}
      showAdd={showAdd} onOpenAdd={openAddModal} onCloseAdd={closeAddModal} persistEntries={persistEntries} saveError={saveError}
      onLogout={handleLogout}
      accounts={accounts} accountCode={accountCode} logs={logs}
      studiedIds={studiedIds} studiedAt={studiedAt} onToggleStudied={handleToggleStudied}
      favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite}
      srsBox={srsBox} srsDueAt={srsDueAt} quizHistory={quizHistory}
      onRecordSrsAnswer={handleRecordSrsAnswer} onSaveQuizResult={handleSaveQuizResult}
      showAccount={showAccount} onOpenAccount={openAccountModal} onCloseAccount={closeAccountModal} onUpdateOwnName={handleUpdateOwnName}
      showAdmin={showAdmin} onOpenAdmin={openAdminModal} onCloseAdmin={closeAdminModal}
      onAdminAddAccount={handleAdminAddAccount} onAdminEditAccount={handleAdminEditAccount} onAdminDeleteAccount={handleAdminDeleteAccount}
      toast={toast} showToast={showToast}
      theme={theme} onToggleTheme={toggleTheme}
      accentTheme={accentTheme} onChangeAccent={setAccentTheme}
      appIsAr={appIsAr} onToggleAppLang={toggleAppLang}
      sessionStart={sessionStartRef.current}
    />
  );
}

function MainView({
  name, isAdmin, entries, entriesLoaded, loadError, isOffline, offlineCachedAt, section, onChangeSection, query, setQuery,
  showAdd, onOpenAdd, onCloseAdd, persistEntries, saveError, onLogout,
  accounts, accountCode, logs, studiedIds, studiedAt, onToggleStudied, favoriteIds, onToggleFavorite, showAccount, onOpenAccount, onCloseAccount, onUpdateOwnName,
  srsBox, srsDueAt, quizHistory, onRecordSrsAnswer, onSaveQuizResult,
  showAdmin, onOpenAdmin, onCloseAdmin, onAdminAddAccount, onAdminEditAccount, onAdminDeleteAccount,
  toast, showToast, theme, onToggleTheme, accentTheme, onChangeAccent,
  appIsAr, onToggleAppLang,
  sessionStart,
}) {
  const cfg = SECTIONS[section];
  const isAr = section === "ar-ar";
  const sectionEntries = useMemo(() => entries.filter((e) => e.section === section), [entries, section]);
  const studiedCount = useMemo(() => sectionEntries.filter((e) => studiedIds.has(e.id)).length, [sectionEntries, studiedIds]);
  const notStudiedCount = sectionEntries.length - studiedCount;
  const studiedPct = sectionEntries.length ? (studiedCount / sectionEntries.length) * 100 : 0;
  const notStudiedPct = 100 - studiedPct;
  const accountNameByCode = useMemo(() => Object.fromEntries(accounts.map((a) => [a.code, a.name])), [accounts]);
  const [voiceListening, setVoiceListening] = useState(false);
  const speechSupported = useMemo(() => !!getSpeechRecognitionCtor(), []);
  const handleVoiceSearch = useCallback(async () => {
    if (!speechSupported || voiceListening) return;
    setVoiceListening(true);
    try {
      const lang = isAr ? "ar-EG" : "en-US";
      const text = await recognizeSpeech(lang);
      setQuery(text);
      setShowSuggestions(true);
    } catch (e) {
      showToast(tr(isAr, "Didn't catch that — try again.", "معرفتش أسمع صح — جرّب تاني."));
    } finally {
      setVoiceListening(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechSupported, voiceListening, isAr]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState(() => loadSearchHistory(section));
  useEffect(() => { setSearchHistory(loadSearchHistory(section)); }, [section]);
  const [studyFilter, setStudyFilter] = useState("all"); // "all" | "studied" | "not-studied"
  /* PAGINATION — with word lists that grow past a hundred or so entries,
     rendering every EntryCard (each with its own DOM subtree, hover
     handlers, speak buttons, etc.) at once is what makes the page feel
     sluggish while scrolling. Instead of pulling in a virtualization
     library, we render entries in capped batches ("pages") and grow the
     batch as the user scrolls near the bottom (classic infinite-scroll),
     or jump straight to a bigger batch when they use the A-Z sidebar to
     jump to a letter that isn't rendered yet. This keeps the mounted node
     count bounded regardless of how many words are in the dictionary. */
  const PAGE_SIZE = 60;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [zoomEntry, setZoomEntry] = useState(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [undoDelete, setUndoDelete] = useState(null); // { entry, prevEntries } — cleared after UNDO_DELETE_MS or on undo
  const undoTimerRef = useRef(null);
  const importInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  useEffect(() => () => clearTimeout(undoTimerRef.current), []);

  const suggestions = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const seen = new Set();
    const scored = [];
    for (const e of sectionEntries) {
      if (seen.has(e.word)) continue;
      const score = matchScore(e.word, q);
      if (score === null) continue;
      seen.add(e.word);
      scored.push({ entry: e, score });
    }
    scored.sort((a, b) => a.score - b.score || a.entry.word.localeCompare(b.entry.word, section === "ar-ar" ? "ar" : "en"));
    return scored.slice(0, 6).map((s) => s.entry);
  }, [query, sectionEntries, section]);

  const filtered = useMemo(() => {
    const q = query.trim();
    let base = q
      ? sectionEntries.filter((e) => fuzzyIncludes(e.word, q) || fuzzyIncludes(e.meaning, q) || fuzzyIncludes(e.definition, q))
      : sectionEntries;
    if (studyFilter === "studied") base = base.filter((e) => studiedIds.has(e.id));
    else if (studyFilter === "not-studied") base = base.filter((e) => !studiedIds.has(e.id));
    else if (studyFilter === "favorites") base = base.filter((e) => favoriteIds.has(e.id));
    return base;
  }, [sectionEntries, query, studyFilter, studiedIds, favoriteIds]);

  useEffect(() => { setActiveIndex(-1); }, [query]);

  function commitSearchTerm(term) {
    if (!term.trim()) return;
    setSearchHistory(addToSearchHistory(section, term));
  }

  function selectSuggestion(entry) {
    setQuery(entry.word);
    setShowSuggestions(false);
    setShowHistory(false);
    setActiveIndex(-1);
    commitSearchTerm(entry.word);
  }

  function selectHistoryTerm(term) {
    setQuery(term);
    setShowHistory(false);
    setShowSuggestions(false);
    // Re-committing bumps it back to the front of the list (most-recent-first).
    commitSearchTerm(term);
  }

  function handleRemoveHistoryTerm(e, term) {
    e.preventDefault();
    e.stopPropagation();
    setSearchHistory(removeFromSearchHistory(section, term));
  }

  function handleClearHistory() {
    setSearchHistory(clearSearchHistory(section));
  }

  function handleSearchKeyDown(e) {
    if (showHistory && !showSuggestions) {
      if (e.key === "Escape") setShowHistory(false);
      return;
    }
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        selectSuggestion(suggestions[activeIndex]);
      } else if (query.trim()) {
        commitSearchTerm(query);
        setShowSuggestions(false);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  }

  // Full grouping (all matching entries) — used for the A-Z sidebar so it
  // always shows every letter that has words, even ones not rendered yet.
  const grouped = useMemo(() => {
    const map = {};
    for (const e of filtered) {
      const key = firstLetterKey(e.word, section);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    for (const k in map) map[k].sort((a, b) => a.word.localeCompare(b.word, section === "ar-ar" ? "ar" : "en"));
    return map;
  }, [filtered, section]);

  // Flat, fully-sorted list in the exact order the letters render (A, B, C…
  // each internally alphabetical) — this is what pagination slices.
  const sortedLetters = useMemo(() => cfg.letters.filter((l) => grouped[l]), [cfg.letters, grouped]);
  const flatSorted = useMemo(() => {
    const out = [];
    for (const l of sortedLetters) out.push(...grouped[l]);
    return out;
  }, [sortedLetters, grouped]);

  // Reset how many words are rendered whenever the underlying result set
  // changes (new search, new filter, switched section) — otherwise a
  // previous "load more" position could hide brand-new matches.
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [query, studyFilter, section]);

  // The letter → entries map actually rendered right now, capped to
  // visibleCount words total (in flatSorted order).
  const visibleGrouped = useMemo(() => {
    const map = {};
    let remaining = visibleCount;
    for (const l of sortedLetters) {
      if (remaining <= 0) break;
      const slice = grouped[l].slice(0, remaining);
      if (slice.length) map[l] = slice;
      remaining -= slice.length;
    }
    return map;
  }, [sortedLetters, grouped, visibleCount]);

  const hasMore = visibleCount < flatSorted.length;

  // Infinite-scroll: grow the rendered batch when the sentinel at the
  // bottom of the list comes into view, instead of forcing a manual click.
  useEffect(() => {
    if (!hasMore) return;
    const el = loadMoreRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entriesObs) => {
      if (entriesObs[0].isIntersecting) {
        setVisibleCount((c) => Math.min(c + PAGE_SIZE, flatSorted.length));
      }
    }, { rootMargin: "600px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, flatSorted.length]);

  const availableLetters = useMemo(() => new Set(Object.keys(grouped)), [grouped]);
  const letterRefs = useRef({});
  function jumpTo(letter) {
    // If that letter's group isn't rendered yet (still beyond the current
    // page), grow visibleCount to include it first, then scroll once React
    // has actually mounted it.
    if (!visibleGrouped[letter] && grouped[letter]) {
      let count = 0;
      for (const l of sortedLetters) {
        count += grouped[l].length;
        if (l === letter) break;
      }
      setVisibleCount((c) => Math.max(c, count));
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = letterRefs.current[letter];
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }));
      return;
    }
    const el = letterRefs.current[letter];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleAdd(newEntry) {
    // Pass a function rather than a precomputed array: if another device
    // saves a word at the same moment, persistEntries re-runs this against
    // the freshly-fetched entries and retries, so both additions survive
    // instead of one silently overwriting the other.
    const newRow = { ...newEntry, id: uid(), section, addedBy: accountCode, addedAt: Date.now() };
    await persistEntries(
      (curEntries) => [...curEntries, newRow],
      () => makeLogEntry("word_add", `${name} added "${newEntry.word}" (${cfg.shortLabel})`, name, accountCode)
    );
    onCloseAdd();
  }
  async function handleDelete(id) {
    const target = entries.find((e) => e.id === id);
    const prevEntries = entries;
    await persistEntries(
      (curEntries) => curEntries.filter((e) => e.id !== id),
      () => makeLogEntry("word_delete", `${name} deleted "${(target && target.word) || id}"`, name, accountCode)
    );
    if (target) {
      clearTimeout(undoTimerRef.current);
      setUndoDelete({ entry: target, prevEntries });
      undoTimerRef.current = setTimeout(() => setUndoDelete(null), 6000);
    }
  }
  async function handleUndoDelete() {
    if (!undoDelete) return;
    clearTimeout(undoTimerRef.current);
    const restored = undoDelete;
    setUndoDelete(null);
    const logEntry = makeLogEntry("word_add", `${name} restored "${restored.entry.word}" (${cfg.shortLabel})`, name, accountCode);
    await persistEntries(restored.prevEntries, logEntry);
  }
  // Bulk-imports words from a CSV file matching the Export CSV column
  // layout (word, meaning, definition, synonyms, antonyms — synonyms and
  // antonyms are ";"-separated words). Lets someone paste in a list they
  // already have instead of adding words one by one through the form.
  async function handleImportCsv(file) {
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      let dataRows = rows;
      if (rows.length && rows[0][0] && rows[0][0].trim().toLowerCase() === "word") dataRows = rows.slice(1);

      // Guard against a pathologically huge file — a many-thousand-row CSV
      // would balloon the shared JSONBin record (there's a hard size cap on
      // JSONBin's free tier) and make every future load/save slower for
      // everyone. Import the first IMPORT_ROW_CAP valid rows and tell the
      // user plainly if the file had more than that.
      const IMPORT_ROW_CAP = 2000;
      const truncated = dataRows.length > IMPORT_ROW_CAP;
      if (truncated) dataRows = dataRows.slice(0, IMPORT_ROW_CAP);

      const existingWords = new Set(sectionEntries.map((e) => e.word.trim().toLowerCase()));
      let skippedInvalid = 0;
      let skippedDuplicate = 0;
      const seenInFile = new Set();
      const newEntries = [];
      for (const r of dataRows) {
        const word = (r[0] || "").trim();
        const meaning = (r[1] || "").trim();
        if (!word || !meaning) { skippedInvalid++; continue; }
        const key = word.toLowerCase();
        if (existingWords.has(key) || seenInFile.has(key)) { skippedDuplicate++; continue; }
        seenInFile.add(key);
        newEntries.push({
          id: uid(), section,
          word, meaning, definition: (r[2] || "").trim(), example: "",
          synonyms: normalizePairs((r[3] || "").split(";").map((s) => s.trim()).filter(Boolean), cfg),
          antonyms: normalizePairs((r[4] || "").split(";").map((s) => s.trim()).filter(Boolean), cfg),
          addedBy: accountCode, addedAt: Date.now(),
        });
      }

      if (!newEntries.length) {
        showToast(skippedDuplicate && !skippedInvalid
          ? tr(isAr, "Every word in that file is already in your dictionary.", "كل الكلمات في الملف ده موجودة أصلاً في قاموسك.")
          : tr(isAr, "No valid rows found in that file.", "الملف ده مفيهوش صفوف صالحة."));
        return;
      }

      await persistEntries(
        (curEntries) => [...curEntries, ...newEntries],
        () => makeLogEntry("word_add", `${name} imported ${newEntries.length} word(s) via CSV (${cfg.shortLabel})`, name, accountCode)
      );

      // Be explicit about anything that DIDN'T make it in, instead of just
      // reporting the success count and letting a mismatch with the file's
      // row count confuse people silently.
      const notes = [];
      if (skippedInvalid) notes.push(tr(isAr, `${skippedInvalid} row(s) skipped (missing word/meaning)`, `${skippedInvalid} صف اتجاهل (ناقص كلمة/معنى)`));
      if (skippedDuplicate) notes.push(tr(isAr, `${skippedDuplicate} duplicate(s) skipped`, `${skippedDuplicate} كلمة مكررة اتجاهلت`));
      if (truncated) notes.push(tr(isAr, `only the first ${IMPORT_ROW_CAP} rows were processed`, `اتعالج بس أول ${IMPORT_ROW_CAP} صف`));
      const suffix = notes.length ? ` (${notes.join(", ")})` : "";
      showToast(tr(isAr, `Imported ${newEntries.length} word(s).${suffix}`, `تم استيراد ${newEntries.length} كلمة.${suffix}`));
    } catch (err) {
      showToast(tr(isAr, "Couldn't read that CSV file.", "تعذر قراءة ملف الـ CSV ده."));
    } finally {
      setImporting(false);
    }
  }
  async function handleEdit(id, updates) {
    const target = entries.find((e) => e.id === id);
    const wordChanged = target && updates.word && updates.word !== target.word;
    await persistEntries(
      (curEntries) => curEntries.map((e) =>
        e.id === id ? { ...e, ...updates, editedBy: accountCode, editedAt: Date.now() } : e
      ),
      () => makeLogEntry(
        "word_edit",
        `${name} edited "${(target && target.word) || id}"${wordChanged ? ` → "${updates.word}"` : ""}`,
        name, accountCode
      )
    );
    setEditingEntry(null);
  }

  return (
    <div dir={cfg.dir} style={{ minHeight: "100vh", background: PAPER, fontFamily: "'Source Sans 3', sans-serif" }}>
      <header style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.15)", background: PAPER, position: "sticky", top: 0, zIndex: 1000 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "18px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <BookIcon size={20} color={BRASS} />
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 21, fontWeight: 600, color: INK, margin: 0 }}>Two Tongues</h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 13, color: "var(--muted-strong)" }}><strong style={{ color: INK }}>{name}</strong></div>
              <HeaderMenu theme={theme} onToggleTheme={onToggleTheme} isAdmin={isAdmin}
                onOpenAccount={onOpenAccount} onOpenAdmin={onOpenAdmin} onLogout={onLogout} isAr={appIsAr}
                accentTheme={accentTheme} onChangeAccent={onChangeAccent} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 16 }}>
            {Object.entries(SECTIONS).map(([key, s]) => {
              const active = key === section;
              return (
                <button key={key} onClick={() => onChangeSection(key)}
                  style={{ padding: "9px 18px", fontSize: 14, fontWeight: 600, color: active ? s.accent : "var(--icon-muted)", background: active ? CARD : "transparent", border: "1px solid rgba(var(--border-rgb),0.15)", borderBottom: active ? `1px solid ${CARD}` : "1px solid rgba(var(--border-rgb),0.15)", borderRadius: "8px 8px 0 0", marginBottom: -1, cursor: "pointer", transform: active ? "translateY(-1px)" : "none" }}>
                  {s.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "18px 20px 0" }}>
        <div className="toolbar-row" style={{ display: "flex", gap: 10, flexWrap: "wrap", position: "relative", zIndex: 50 }}>
          <div className="toolbar-anim toolbar-search-wrap" style={{ position: "relative", flex: "1 1 240px", animationDelay: "0.02s", zIndex: 50 }}>
            <SearchIcon size={16} color="var(--icon-muted)" style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                setShowSuggestions(!!v.trim());
                setShowHistory(!v.trim() && searchHistory.length > 0);
              }}
              onFocus={() => {
                if (query.trim()) setShowSuggestions(true);
                else if (searchHistory.length > 0) setShowHistory(true);
              }}
              onBlur={() => setTimeout(() => { setShowSuggestions(false); setShowHistory(false); }, 120)}
              onKeyDown={handleSearchKeyDown}
              placeholder={tr(isAr, `Search ${cfg.shortLabel}…`, `بحث في ${cfg.shortLabel}…`)} dir={section === "ar-ar" ? "rtl" : "auto"}
              role="combobox" aria-autocomplete="list" aria-expanded={showSuggestions && suggestions.length > 0}
              aria-controls="search-suggestions" aria-activedescendant={activeIndex >= 0 ? `search-suggestion-${activeIndex}` : undefined}
              autoComplete="off"
              className="toolbar-search-input"
              style={{ width: "100%", padding: "10px 12px", paddingInlineStart: 36, paddingInlineEnd: speechSupported ? 38 : 12, fontSize: 14, border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 10, background: "var(--input-bg)", color: INK }} />
            {speechSupported && (
              <button type="button" onClick={handleVoiceSearch} disabled={voiceListening}
                title={tr(isAr, "Search by voice", "بحث صوتي")} aria-label={tr(isAr, "Search by voice", "بحث صوتي")}
                className={voiceListening ? "voice-mic-active" : undefined}
                style={{ position: "absolute", insetInlineEnd: 8, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, border: "none", background: "none", color: voiceListening ? cfg.accent : "var(--icon-muted)", cursor: voiceListening ? "default" : "pointer", padding: 0 }}>
                <MicIcon size={15} />
              </button>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <ul id="search-suggestions" role="listbox" dir={section === "ar-ar" ? "rtl" : "auto"}
                className="modal-card"
                style={{ listStyle: "none", margin: "4px 0 0", padding: 4, position: "absolute", top: "100%", insetInlineStart: 0, insetInlineEnd: 0, background: CARD, border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 10, boxShadow: "0 10px 24px -10px rgba(0,0,0,0.3)", zIndex: 60, maxHeight: 260, overflowY: "auto" }}>
                {suggestions.map((s, i) => (
                  <li key={s.id} id={`search-suggestion-${i}`} role="option" aria-selected={i === activeIndex}
                    onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                    onMouseEnter={() => setActiveIndex(i)}
                    style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "7px 9px", borderRadius: 7, cursor: "pointer", background: i === activeIndex ? cfg.accentSoft : "transparent" }}>
                    <span dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 14, fontWeight: 600, color: INK }}>{s.word}</span>
                    <span dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: 13, color: "var(--meaning)" }}>{s.meaning}</span>
                  </li>
                ))}
              </ul>
            )}
            {showHistory && !query.trim() && searchHistory.length > 0 && (
              <div dir={section === "ar-ar" ? "rtl" : "auto"}
                className="modal-card"
                style={{ margin: "4px 0 0", padding: 4, position: "absolute", top: "100%", insetInlineStart: 0, insetInlineEnd: 0, background: CARD, border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 10, boxShadow: "0 10px 24px -10px rgba(0,0,0,0.3)", zIndex: 60, maxHeight: 260, overflowY: "auto" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 9px 3px", fontSize: 11, color: "var(--icon-muted)", fontWeight: 600 }}>
                  <span>{tr(isAr, "Recent searches", "عمليات بحث سابقة")}</span>
                  <button onMouseDown={(e) => { e.preventDefault(); handleClearHistory(); }}
                    style={{ background: "none", border: "none", color: "var(--icon-muted)", fontSize: 11, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                    {tr(isAr, "Clear", "مسح الكل")}
                  </button>
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {searchHistory.map((term) => (
                    <li key={term}
                      onMouseDown={(e) => { e.preventDefault(); selectHistoryTerm(term); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 7, cursor: "pointer" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = cfg.accentSoft; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                      <ClockIcon size={14} color="var(--icon-muted)" style={{ flexShrink: 0 }} />
                      <span dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 14, color: INK, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{term}</span>
                      <button onMouseDown={(e) => handleRemoveHistoryTerm(e, term)}
                        aria-label={tr(isAr, "Remove", "إزالة")}
                        style={{ background: "none", border: "none", color: "var(--icon-muted)", cursor: "pointer", padding: 2, display: "flex", flexShrink: 0 }}>
                        <XIcon size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onOpenAdd} className="btn-shine lift-hover toolbar-anim" style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", fontSize: 14, fontWeight: 600, color: "#fff", background: cfg.accent, border: "none", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap", animationDelay: "0.04s" }}>
              <PlusIcon size={16} /> {tr(isAr, "Add word", "إضافة كلمة")}
            </button>
            <ToolsMenu
              accent={cfg.accent}
              onLeaderboard={() => setShowLeaderboard(true)}
              onStats={() => setShowStats(true)}
              onQuiz={() => setShowQuiz(true)}
              onFlashcards={() => setShowFlashcards(true)}
              onExport={() => exportEntriesAsCsv(filtered.length ? filtered : sectionEntries, cfg, cfg.shortLabel)}
              exportDisabled={sectionEntries.length === 0}
              onImport={() => importInputRef.current && importInputRef.current.click()}
              importing={importing}
              isAr={isAr}
            />
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files && e.target.files[0];
                e.target.value = "";
                if (file) handleImportCsv(file);
              }}
            />
          </div>
        </div>
        {undoDelete && (
          <div role="status" className="modal-card"
            style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", background: "var(--ink)", color: "var(--paper)", borderRadius: 10, fontSize: 13 }}>
            <span>{tr(isAr, `Deleted "${undoDelete.entry.word}".`, `اتمسحت "${undoDelete.entry.word}".`)}</span>
            <button onClick={handleUndoDelete} className="lift-hover"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 13, fontWeight: 700, color: "var(--ink)", background: "var(--paper)", border: "none", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" }}>
              <UndoIcon size={14} /> {tr(isAr, "Undo", "تراجع")}
            </button>
          </div>
        )}
        <ReminderBanner studiedAt={studiedAt} isAr={isAr} cfg={cfg} onOpenQuiz={() => setShowQuiz(true)} />
        <div style={{ marginTop: 12, background: CARD, border: "1px solid rgba(var(--border-rgb),0.12)", borderRadius: 10, padding: "12px 14px" }}>
          <div dir={isAr ? "rtl" : "ltr"} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, color: INK }}>
              <BookIcon size={14} color={cfg.accent} />
              {tr(isAr, `${sectionEntries.length} words`, `${sectionEntries.length} الكلمات`)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: cfg.accent, borderRadius: 20, padding: "5px 12px", whiteSpace: "nowrap" }}>
                {tr(isAr, `${notStudiedCount} to learn`, `${notStudiedCount} تعلم`)}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "var(--success)", borderRadius: 20, padding: "5px 12px", whiteSpace: "nowrap" }}>
                {tr(isAr, `${studiedCount} know`, `${studiedCount} أعرف`)}
              </span>
            </div>
          </div>
          {sectionEntries.length > 0 && (
            <div dir={isAr ? "rtl" : "ltr"} style={{ marginTop: 10, height: 8, borderRadius: 20, overflow: "hidden", display: "flex", background: "rgba(var(--border-rgb),0.15)" }}>
              <div style={{ width: `${notStudiedPct}%`, background: cfg.accent, transition: "width 0.3s" }} />
              <div style={{ width: `${studiedPct}%`, background: "var(--success)", transition: "width 0.3s" }} />
            </div>
          )}
          {(query.trim() || studyFilter !== "all") && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
              {tr(isAr, `${filtered.length} of ${sectionEntries.length} word${sectionEntries.length === 1 ? "" : "s"} shown`, `عرض ${filtered.length} من ${sectionEntries.length} كلمة`)}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          {[
            { key: "all", label: tr(isAr, "All", "الكل") },
            { key: "studied", label: tr(isAr, "Studied", "تمت دراستها") },
            { key: "not-studied", label: tr(isAr, "Not Studied", "لم تُدرس بعد") },
            { key: "favorites", label: tr(isAr, "Favorites", "المفضلة") },
          ].map((f) => {
            const active = studyFilter === f.key;
            return (
              <button key={f.key} onClick={() => setStudyFilter(f.key)} className={active ? "btn-shine" : ""}
                style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, color: active ? "#fff" : "var(--icon-muted)", background: active ? cfg.accent : "none", border: `1px solid ${active ? cfg.accent : "rgba(var(--border-rgb),0.25)"}`, borderRadius: 20, cursor: "pointer" }}>
                {f.label}
              </button>
            );
          })}
        </div>
        {loadError && <div style={{ ...errorStyle, marginTop: 10 }} role="alert" aria-live="assertive">{tr(isAr, loadError, "تعذر تحميل القاموس المشترك. تحقق من اتصالك وحاول تحديث الصفحة.")}</div>}
        {saveError && <div style={{ ...errorStyle, marginTop: 10 }} role="alert" aria-live="assertive">{tr(isAr, saveError, "تعذر الحفظ — تحقق من اتصالك وحاول مرة أخرى.")}</div>}
        {isOffline && (
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", fontSize: 13, color: "var(--muted-strong)", background: "var(--input-bg)", border: "1px dashed rgba(var(--border-rgb),0.3)", borderRadius: 6 }} role="status">
            <WifiOffIcon size={14} color="var(--icon-muted)" />
            {tr(isAr,
              `You're offline — showing your saved words${offlineCachedAt ? ` from ${new Date(offlineCachedAt).toLocaleString()}` : ""}. Adding or editing words needs a connection.`,
              `أنت غير متصل — يتم عرض كلماتك المحفوظة${offlineCachedAt ? ` من ${new Date(offlineCachedAt).toLocaleString()}` : ""}. إضافة أو تعديل الكلمات يحتاج اتصال بالإنترنت.`)}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 20px 60px", display: "flex", gap: 18 }}>
        <nav style={{ flex: "0 0 34px", display: "flex", flexDirection: "column", gap: 2, position: "sticky", top: 130, alignSelf: "flex-start", maxHeight: "calc(100vh - 160px)", overflowY: "auto" }}>
          {cfg.letters.map((l) => {
            const has = availableLetters.has(l);
            return (
              <button key={l} disabled={!has} onClick={() => jumpTo(l)}
                style={{ fontFamily: section === "ar-ar" ? "'Amiri', serif" : "'Fraunces', serif", fontSize: 13, padding: "2px 0", border: "none", background: "none", color: has ? cfg.accent : "rgba(var(--border-rgb),0.2)", fontWeight: has ? 700 : 400, cursor: has ? "pointer" : "default", textAlign: "center" }}>
                {l}
              </button>
            );
          })}
        </nav>

        <div style={{ flex: 1, minWidth: 0 }}>
          {!entriesLoaded ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted-strong)", padding: "30px 0" }}>
              <LoaderIcon size={18} /><span>{tr(isAr, "Loading entries…", "جارٍ تحميل الكلمات…")}</span>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState hasQuery={!!query.trim() || studyFilter !== "all"} onAdd={onOpenAdd} accent={cfg.accent} isAr={isAr} />
          ) : (
            <>
              {cfg.letters.filter((l) => visibleGrouped[l]).map((letter) => (
                <div key={letter} ref={(el) => (letterRefs.current[letter] = el)} style={{ marginBottom: 26 }}>
                  <div style={{ fontFamily: section === "ar-ar" ? "'Amiri', serif" : "'Fraunces', serif", fontSize: 15, fontWeight: 700, color: cfg.accent, borderBottom: `1px solid ${cfg.accentSoft}`, paddingBottom: 4, marginBottom: 10 }}>
                    {letter}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {visibleGrouped[letter].map((e) => (
                      <EntryCard key={e.id} entry={e} cfg={cfg} isAdmin={isAdmin} isAr={isAr}
                        canEdit={isAdmin || e.addedBy === accountCode}
                        onDelete={() => handleDelete(e.id)} onEdit={() => setEditingEntry(e)}
                        onOpenZoom={() => setZoomEntry(e)}
                        isStudied={studiedIds.has(e.id)} onToggleStudied={() => onToggleStudied(e.id)}
                        isFavorite={favoriteIds.has(e.id)} onToggleFavorite={() => onToggleFavorite(e.id)}
                        addedByLabel={accountNameByCode[e.addedBy] || e.addedBy}
                        editedByLabel={accountNameByCode[e.editedBy] || e.editedBy} />
                    ))}
                  </div>
                </div>
              ))}
              {hasMore && (
                <div ref={loadMoreRef} style={{ display: "flex", justifyContent: "center", padding: "10px 0 24px" }}>
                  <button onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, flatSorted.length))}
                    style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, color: cfg.accent, background: "var(--input-bg)", border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 10, cursor: "pointer" }}>
                    {tr(isAr, `Load more (${flatSorted.length - visibleCount} left)`, `تحميل المزيد (${flatSorted.length - visibleCount} متبقي)`)}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAdd && <AddModal cfg={cfg} onClose={onCloseAdd} onSubmit={handleAdd} />}
      {editingEntry && (
        <AddModal
          cfg={cfg}
          initialEntry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSubmit={(updates) => handleEdit(editingEntry.id, updates)}
        />
      )}
      {zoomEntry && (
        <WordZoomModal entry={zoomEntry} cfg={cfg} onClose={() => setZoomEntry(null)} />
      )}
      {showQuiz && (
        <QuizModal
          entries={sectionEntries}
          sectionLabel={cfg.shortLabel}
          studiedIds={studiedIds}
          studiedAt={studiedAt}
          srsDueAt={srsDueAt}
          sessionStart={sessionStart}
          isAr={isAr}
          onClose={() => setShowQuiz(false)}
          onRecordSrsAnswer={onRecordSrsAnswer}
          onSaveQuizResult={onSaveQuizResult}
        />
      )}
      {showFlashcards && (
        <FlashcardsModal
          entries={sectionEntries}
          cfg={cfg}
          sectionLabel={cfg.shortLabel}
          studiedIds={studiedIds}
          favoriteIds={favoriteIds}
          onToggleStudied={onToggleStudied}
          isAr={isAr}
          onClose={() => setShowFlashcards(false)}
        />
      )}
      {showStats && (
        <StatsModal
          entries={sectionEntries}
          sectionLabel={cfg.shortLabel}
          studiedIds={studiedIds}
          studiedAt={studiedAt}
          srsBox={srsBox}
          srsDueAt={srsDueAt}
          quizHistory={quizHistory}
          isAr={isAr}
          cfg={cfg}
          onClose={() => setShowStats(false)}
        />
      )}
      {showLeaderboard && (
        <LeaderboardModal
          accounts={accounts}
          sectionEntries={sectionEntries}
          accountCode={accountCode}
          sectionLabel={cfg.shortLabel}
          isAr={isAr}
          cfg={cfg}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
      {showAccount && (
        <AccountModal
          account={accounts.find((a) => a.code === accountCode) || { name, code: accountCode, role: isAdmin ? "admin" : "user" }}
          onClose={onCloseAccount}
          onSave={onUpdateOwnName}
          isAr={isAr}
        />
      )}
      {showAdmin && (
        <AdminModal
          accounts={accounts}
          myAccountCode={accountCode}
          logs={logs}
          onClose={onCloseAdmin}
          onAdd={onAdminAddAccount}
          onEdit={onAdminEditAccount}
          onDelete={onAdminDeleteAccount}
          isAr={isAr}
        />
      )}
      {toast && (
        <div role="status" aria-live="polite" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--success)", color: "#fff", padding: "10px 18px", borderRadius: 4, fontSize: 13, fontWeight: 600, boxShadow: "0 10px 24px -10px rgba(0,0,0,0.35)", zIndex: 60, display: "flex", alignItems: "center", gap: 7 }}>
          <CheckIcon size={14} /> {tr(isAr, toast, toast === "Account info updated." ? "تم تحديث بيانات الحساب." : toast)}
        </div>
      )}
    </div>
  );
}


// Big, centered "zoom" view of a single word — just the word and its meaning
// (plus definition, if any) in a large, readable font. Opened via the zoom
// icon on each entry card.
function WordZoomModal({ entry, cfg, onClose }) {
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try { await shareWordCard(entry, cfg); } finally { setSharing(false); }
  }

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 2000 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card" dir={cfg.dir} role="dialog" aria-modal="true" aria-labelledby="zoom-modal-word"
        style={{ width: "100%", maxWidth: 560, background: CARD, borderRadius: 6, padding: "48px 32px 40px", boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45)", textAlign: "center", position: "relative" }}>
        <button onClick={handleShare} disabled={sharing} aria-label={tr(cfg.dir === "rtl", "Share this word", "شارك الكلمة دي")}
          title={tr(cfg.dir === "rtl", "Share this word", "شارك الكلمة دي")}
          style={{ position: "absolute", top: 14, insetInlineStart: 14, border: "none", background: "none", cursor: sharing ? "default" : "pointer", color: "var(--icon-muted)" }}>
          {sharing ? <LoaderIcon size={19} /> : <ShareIcon size={19} />}
        </button>
        <button onClick={onClose} aria-label={tr(cfg.dir === "rtl", "Close", "إغلاق")} style={{ position: "absolute", top: 14, insetInlineEnd: 14, border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)" }}>
          <XIcon size={20} />
        </button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div dir={cfg.wordDir} id="zoom-modal-word" style={{ fontFamily: cfg.wordFont, fontSize: "clamp(30px, 6vw, 46px)", fontWeight: 700, color: INK, lineHeight: 1.2, wordBreak: "break-word" }}>
            {entry.word}
          </div>
          <SpeakButton text={entry.word} dir={cfg.wordDir} isAr={cfg.dir === "rtl"} size={26} style={{ color: cfg.accent, flexShrink: 0 }} />
        </div>
        <div style={{ width: 48, height: 3, background: cfg.accent, borderRadius: 2, margin: "18px auto" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: "clamp(22px, 4.5vw, 30px)", color: "var(--meaning)", lineHeight: 1.35, wordBreak: "break-word" }}>
            {entry.meaning}
          </div>
          <SpeakButton text={entry.meaning} dir={cfg.meaningDir} isAr={cfg.dir === "rtl"} size={20} style={{ color: "var(--meaning)", flexShrink: 0 }} />
        </div>
        {cfg.wordDir === "ltr" && (
          <a
            href={cambridgeUrl(entry.word)}
            target="_blank"
            rel="noopener noreferrer"
            title={tr(cfg.dir === "rtl", "Open in Cambridge Dictionary", "افتح في قاموس كامبريدج")}
            style={{ display: "inline-flex", alignItems: "center", marginTop: 18, background: "#1D2A57", borderRadius: 3, padding: "6px 10px" }}
            className="lift-hover">
            <img src="https://dictionary.cambridge.org/external/images/freesearch/sbl.png?version=6.0.78" alt={tr(cfg.dir === "rtl", "Cambridge Dictionary", "قاموس كامبريدج")} style={{ height: 20, display: "block" }} />
          </a>
        )}
        {entry.definition && (
          <p dir={detectDir(entry.definition)} style={{ fontFamily: detectFont(entry.definition), fontSize: 15, color: "var(--muted-strong)", marginTop: 22, lineHeight: 1.7, textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
            {entry.definition}
          </p>
        )}
        {entry.example && (
          <p dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 15, fontStyle: "italic", color: "var(--muted)", marginTop: 14, lineHeight: 1.7, textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
            “{entry.example}”
          </p>
        )}
        {!!(entry.examples && entry.examples.length) && entry.examples.map((ex, i) => (
          <p key={i} dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 15, fontStyle: "italic", color: "var(--muted)", marginTop: 8, lineHeight: 1.7, textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
            “{ex}”
          </p>
        ))}
        {!!(entry.synonyms && entry.synonyms.length) && (
          <div style={{ fontSize: 14, color: "var(--muted-strong)", marginTop: 16, textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
            <strong style={{ color: "var(--success)" }}>{tr(cfg.dir === "rtl", "Synonyms", "مرادفات")}</strong>
            <PairListDisplay cfg={cfg} pairs={entry.synonyms} />
          </div>
        )}
        {!!(entry.antonyms && entry.antonyms.length) && (
          <div style={{ fontSize: 14, color: "var(--muted-strong)", marginTop: 10, textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
            <strong style={{ color: "var(--danger)" }}>{tr(cfg.dir === "rtl", "Antonyms", "مضادات")}</strong>
            <PairListDisplay cfg={cfg} pairs={entry.antonyms} />
          </div>
        )}
      </div>
    </div>
  );
}

// The MCQ quiz: pick a time range for "which studied words", then work
// through a shuffled set of multiple-choice questions covering meaning
// (both directions) plus one question per synonym and per antonym where
// the word has them. `entries` is already scoped to a single dictionary
// section by the caller, so the English and Arabic sections always get
// their own separate quiz over their own studied words.
// One row in the post-quiz mistake review: just shows the word and an
// immediate "you said X — it's actually Y" comparison. No typing, no
// staggered reveal — every mistake is shown at once.


// Simple flip-card review mode: front shows the word, tap/click flips to
// the meaning + definition + example, then the user marks it "knew it" or
// "still learning" (which just moves it to the back of the deck to see
// again) before moving to the next card. Lighter-weight than the Quiz —
// no scoring, just quick repetition through the section's words.





/* =========================================================================
   LEADERBOARD
   -------------------------------------------------------------------------
   Ranks every account by how many of the CURRENT section's words they've
   studied, with average quiz score as a tie-breaker/secondary stat. Reads
   only from data already loaded (accounts + sectionEntries) — no new
   network calls or stored fields.
   ========================================================================= */

const REMINDER_PREF_KEY = "twoTongues.remindersEnabled";
const REMINDER_DISMISS_KEY = "twoTongues.reminderDismissedOn";
const REMINDER_NOTIFIED_KEY = "twoTongues.reminderNotifiedOn";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function ReminderBanner({ studiedAt, isAr, cfg, onOpenQuiz }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(REMINDER_DISMISS_KEY) === todayKey(); } catch (e) { return false; }
  });
  const [remindersOn, setRemindersOn] = useState(() => {
    try { return localStorage.getItem(REMINDER_PREF_KEY) === "1"; } catch (e) { return false; }
  });

  const lastStudied = useMemo(() => {
    const values = Object.values(studiedAt || {});
    return values.length ? Math.max(...values) : null;
  }, [studiedAt]);

  const daysSince = lastStudied == null ? null : Math.floor((Date.now() - lastStudied) / (24 * 60 * 60 * 1000));
  const shouldShow = daysSince !== null && daysSince >= 1 && !dismissed;

  // Fire a soft, local notification (only while the app is open) once per
  // day if the person has opted in and it's been a day+ since they studied.
  useEffect(() => {
    if (!remindersOn || daysSince === null || daysSince < 1) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      if (localStorage.getItem(REMINDER_NOTIFIED_KEY) === todayKey()) return;
      new Notification(tr(isAr, "Time to review!", "وقت المراجعة!"), {
        body: tr(isAr, `It's been ${daysSince} day${daysSince === 1 ? "" : "s"} since you studied.`, `عدّى ${daysSince} يوم من غير ما تراجع.`),
      });
      localStorage.setItem(REMINDER_NOTIFIED_KEY, todayKey());
    } catch (e) { /* Notification API not available/blocked — ignore */ }
  }, [remindersOn, daysSince, isAr]);

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(REMINDER_DISMISS_KEY, todayKey()); } catch (e) {}
  }

  async function enableReminders() {
    try {
      if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return;
      }
      setRemindersOn(true);
      localStorage.setItem(REMINDER_PREF_KEY, "1");
    } catch (e) { /* Notification API not available — the in-app banner still works */ }
  }

  if (!shouldShow) return null;

  return (
    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: cfg.accentSoft, border: `1px solid ${cfg.accent}`, borderRadius: 8, padding: "10px 14px" }}>
      <FlameIcon size={17} color={cfg.accent} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 200, fontSize: 13.5, color: "var(--muted-strong)" }}>
        {tr(isAr,
          `It's been ${daysSince} day${daysSince === 1 ? "" : "s"} since your last review — a quick quiz keeps it fresh.`,
          `عدّى ${daysSince} يوم من غير ما تراجع — اختبار سريع هيفضّل الكلام طازة.`)}
      </span>
      <button type="button" onClick={onOpenQuiz} style={{ padding: "6px 12px", fontSize: 13, fontWeight: 700, color: "#fff", background: cfg.accent, border: "none", borderRadius: 6, cursor: "pointer" }}>
        {tr(isAr, "Review now", "راجع دلوقتي")}
      </button>
      {!remindersOn && (
        <button type="button" onClick={enableReminders} style={{ padding: "6px 12px", fontSize: 13, fontWeight: 600, color: cfg.accent, background: "none", border: `1px solid ${cfg.accent}`, borderRadius: 6, cursor: "pointer" }}>
          {tr(isAr, "Remind me daily", "ذكّرني يوميًا")}
        </button>
      )}
      <button type="button" onClick={dismiss} aria-label={tr(isAr, "Dismiss", "إخفاء")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", padding: 4 }}>
        <XIcon size={16} />
      </button>
    </div>
  );
}

function EmptyState({ hasQuery, onAdd, accent, isAr }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted-strong)", border: "1px dashed rgba(var(--border-rgb),0.2)", borderRadius: 4 }}>
      <p style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: INK, marginBottom: 6 }}>
        {hasQuery ? tr(isAr, "No entries match your search", "لا توجد نتائج مطابقة لبحثك") : tr(isAr, "This dictionary is empty", "هذا القاموس فارغ")}
      </p>
      <p style={{ fontSize: 14, marginBottom: 18 }}>{hasQuery ? tr(isAr, "Try a different word.", "جرّب كلمة أخرى.") : tr(isAr, "Be the first to add a word.", "كن أول من يضيف كلمة.")}</p>
      {!hasQuery && (
        <button onClick={onAdd} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", fontSize: 14, fontWeight: 600, color: "#fff", background: accent, border: "none", borderRadius: 3, cursor: "pointer" }}>
          <PlusIcon size={16} /> {tr(isAr, "Add word", "إضافة كلمة")}
        </button>
      )}
    </div>
  );
}



