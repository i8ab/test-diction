import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

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
  };
}

async function saveRecord(record) {
  const res = await fetch("/api/jsonbin", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error("save failed");
  return true;
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
function Icon({ path, size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {path}
    </svg>
  );
}
const SearchIcon = (p) => <Icon {...p} path={<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>} />;
const PlusIcon = (p) => <Icon {...p} path={<><path d="M12 5v14"/><path d="M5 12h14"/></>} />;
const BookIcon = (p) => <Icon {...p} path={<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 0 4 5.5v14ZM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-3H6.5a2.5 2.5 0 0 0 0 5"/>} />;
const XIcon = (p) => <Icon {...p} path={<><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>} />;
const TrashIcon = (p) => <Icon {...p} path={<><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>} />;
const LoaderIcon = (p) => <Icon {...p} path={<path d="M21 12a9 9 0 1 1-6.219-8.56"/>} className="spin" />;
const LoginIcon = (p) => <Icon {...p} path={<><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></>} />;
const KeyIcon = (p) => <Icon {...p} path={<><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></>} />;
const CopyIcon = (p) => <Icon {...p} path={<><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>} />;
const CheckIcon = (p) => <Icon {...p} path={<path d="M20 6 9 17l-5-5"/>} />;
const ChevronIcon = (p) => <Icon {...p} path={<path d="m9 18 6-6-6-6"/>} />;
const EditIcon = (p) => <Icon {...p} path={<><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></>} />;
const UsersIcon = (p) => <Icon {...p} path={<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>} />;
const EyeIcon = (p) => <Icon {...p} path={<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>} />;
const EyeOffIcon = (p) => <Icon {...p} path={<><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></>} />;
const SunIcon = (p) => <Icon {...p} path={<><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></>} />;
const MoonIcon = (p) => <Icon {...p} path={<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>} />;
const MenuIcon = (p) => <Icon {...p} path={<><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></>} />;
const WifiOffIcon = (p) => <Icon {...p} path={<><path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.5a10 10 0 0 1 3.5-2.3"/><path d="M19 12.5a10 10 0 0 0-2.5-1.9"/><path d="M12.5 8.5a13 13 0 0 1 6 1.6"/><path d="M2 8.5a13 13 0 0 1 3.5-2.4"/><line x1="12" y1="20" x2="12.01" y2="20"/></>} />;
const DownloadIcon = (p) => <Icon {...p} path={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></>} />;
const UserIcon = (p) => <Icon {...p} path={<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>} />;
const LogoutIcon = (p) => <Icon {...p} path={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></>} />;
const ZoomIcon = (p) => <Icon {...p} path={<><circle cx="11" cy="11" r="7"/><circle cx="11" cy="11" r="2.75"/><path d="m21 21-3.8-3.8"/></>} />;
const GlobeIcon = (p) => <Icon {...p} path={<><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></>} />;
const QuizIcon = (p) => <Icon {...p} path={<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h8"/><path d="M8 13h5"/><path d="m8 17 2 2 4-4"/></>} />;
const StatsIcon = (p) => <Icon {...p} path={<><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></>} />;
const TrophyIcon = (p) => <Icon {...p} path={<><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4a2 2 0 0 0 0 4h3"/><path d="M17 5h3a2 2 0 0 1 0 4h-3"/></>} />;
const FlameIcon = (p) => <Icon {...p} path={<path d="M8.5 14.5A2.5 2.5 0 0 0 11 17a2.5 2.5 0 0 0 2.5-2.5c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7.5 7.5 0 1 1-15 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5"/>} />;
const ExternalLinkIcon = (p) => <Icon {...p} path={<><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></>} />;
const SpeakerIcon = (p) => <Icon {...p} path={<><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></>} />;
const MoreIcon = (p) => <Icon {...p} path={<><circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/></>} />;
const StarIcon = (p) => <Icon {...p} path={<path d="m12 2 2.9 6.26 6.9.6-5.2 4.6 1.56 6.76L12 16.9l-6.16 3.32L7.4 13.46 2.2 8.86l6.9-.6Z"/>} />;
const UploadIcon = (p) => <Icon {...p} path={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></>} />;
const UndoIcon = (p) => <Icon {...p} path={<><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-6.7L3 9"/></>} />;
const LinkIcon = (p) => <Icon {...p} path={<><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><path d="M8 12h8"/></>} />;
const ClockIcon = (p) => <Icon {...p} path={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></>} />;
const MicIcon = (p) => <Icon {...p} path={<><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></>} />;
const PaletteIcon = (p) => <Icon {...p} path={<><path d="M12 2a10 10 0 1 0 0 20 2.5 2.5 0 0 0 2-4 2 2 0 0 1 2-2h1a3 3 0 0 0 3-3c0-6-3.5-11-8-11Z"/><circle cx="7" cy="10" r="1.2" fill="currentColor" stroke="none"/><circle cx="10" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="14" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="17" cy="10" r="1.2" fill="currentColor" stroke="none"/></>} />;
const LayersIcon = (p) => <Icon {...p} path={<><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></>} />;
const ShareIcon = (p) => <Icon {...p} path={<><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/></>} />;

// Builds the Cambridge Dictionary lookup URL for a given English word.
// Renders a shareable PNG image of a single word (word + meaning + optional
// definition/example) onto an offscreen canvas, styled to loosely match the
// app's paper/ink palette so it reads well when shared outside the app.
// Returns a Blob (image/png) via a Promise.
function generateWordCardImage(entry, cfg) {
  const width = 1080, height = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#FBF7EF";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = cfg.accent || "#146C94";
  ctx.lineWidth = 10;
  ctx.strokeRect(30, 30, width - 60, height - 60);

  ctx.textAlign = "center";
  ctx.direction = cfg.wordDir === "rtl" ? "rtl" : "ltr";

  // Word
  ctx.fillStyle = "#1B1B1B";
  ctx.font = "700 96px 'Fraunces', 'Amiri', serif";
  wrapCanvasText(ctx, entry.word || "", width / 2, 420, width - 200, 104);

  // Divider
  ctx.fillStyle = cfg.accent || "#146C94";
  ctx.fillRect(width / 2 - 60, 470, 120, 6);

  // Meaning
  ctx.fillStyle = cfg.accent || "#146C94";
  ctx.font = "600 56px 'Amiri', 'Fraunces', serif";
  wrapCanvasText(ctx, entry.meaning || "", width / 2, 580, width - 220, 66);

  // Footer brand
  ctx.fillStyle = "#8A8374";
  ctx.font = "600 30px 'Source Sans 3', sans-serif";
  ctx.direction = "ltr";
  ctx.fillText("Two Tongues", width / 2, height - 60);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

// Minimal manual word-wrap for canvas text (canvas has no built-in wrapping).
function wrapCanvasText(ctx, text, cx, startY, maxWidth, lineHeight) {
  const words = text.split(/\s+/);
  let line = "";
  let y = startY;
  const lines = [];
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  // Vertically center the block of lines around startY.
  const totalHeight = lines.length * lineHeight;
  y = startY - totalHeight / 2 + lineHeight / 2;
  for (const l of lines) {
    ctx.fillText(l, cx, y);
    y += lineHeight;
  }
}

// Shares (via Web Share API, when supported for files) or downloads the
// generated word-card image. Falls back to a plain download whenever
// navigator.share/canShare for files isn't available (most desktop browsers).
async function shareWordCard(entry, cfg) {
  const blob = await generateWordCardImage(entry, cfg);
  if (!blob) return false;
  const fileName = `${(entry.word || "word").replace(/[^\p{L}\p{N}]+/gu, "-")}.png`;
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: entry.word });
      return true;
    } catch (e) {
      if (e && e.name === "AbortError") return false; // user cancelled the share sheet
      // fall through to download on any other failure
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

function cambridgeUrl(word) {
  const slug = (word || "").trim().toLowerCase().replace(/\s+/g, "-");
  return `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(slug)}`;
}

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
function waitForVoices(timeoutMs) {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve([]);
    const existing = window.speechSynthesis.getVoices();
    if (existing && existing.length) return resolve(existing);
    let done = false;
    const finish = (list) => {
      if (done) return;
      done = true;
      window.speechSynthesis.onvoiceschanged = null;
      resolve(list || []);
    };
    window.speechSynthesis.onvoiceschanged = () => finish(window.speechSynthesis.getVoices());
    // Some browsers never fire voiceschanged if there's truly nothing to
    // report — poll as a backup so we don't wait forever.
    const start = Date.now();
    const poll = setInterval(() => {
      const list = window.speechSynthesis.getVoices();
      if ((list && list.length) || Date.now() - start > timeoutMs) {
        clearInterval(poll);
        finish(list);
      }
    }, 150);
  });
}

function findArabicVoice(voices) {
  const ar = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("ar"));
  if (ar.length) return ar.find((v) => /sa|eg|xa/i.test(v.lang)) || ar[0];
  return voices.find((v) => /arabic|عربي/i.test(v.name || "")) || null;
}

let ttsAudioEl = null;
function playOnlineArabic(text, onFail) {
  try {
    if (ttsAudioEl) { try { ttsAudioEl.pause(); } catch (e) {} }
    // StreamElements' free speech endpoint used to work here, but it now
    // requires an authenticated key and rejects unauthenticated requests —
    // so it's dead as a fallback. Instead we go through our own /api/tts
    // serverless proxy (api/tts.js), which fetches Google Translate's TTS
    // audio server-side (no CORS issue there) and streams it back to us.
    const url = "/api/tts?lang=ar&text=" + encodeURIComponent(text);
    const audio = new Audio(url);
    ttsAudioEl = audio;
    audio.addEventListener("error", () => onFail && onFail());
    const p = audio.play();
    if (p && p.catch) p.catch(() => onFail && onFail());
  } catch (e) {
    onFail && onFail();
  }
}

async function speakArabic(text) {
  const hasSynth = typeof window !== "undefined" && "speechSynthesis" in window;
  if (hasSynth) {
    const voices = await waitForVoices(1500);
    const arVoice = findArabicVoice(voices);
    if (arVoice) {
      let started = false;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.voice = arVoice;
      utter.lang = arVoice.lang;
      utter.rate = 0.95;
      utter.onstart = () => { started = true; };
      setTimeout(() => window.speechSynthesis.speak(utter), 30);
      // Give it a beat to actually start; if it silently never does,
      // fall through to the online voice instead of staying silent.
      setTimeout(() => {
        if (!started) {
          playOnlineArabic(text, () => {
            window.alert(
              "تعذّر نطق الكلمة العربية: مفيش صوت عربي شغال على جهازك، وخدمة النطق الأونلاين محجوبة على الشبكة دي."
            );
          });
        }
      }, 700);
      return;
    }
  }
  // No local Arabic voice at all — go straight online.
  playOnlineArabic(text, () => {
    window.alert(
      "تعذّر نطق الكلمة العربية: مفيش صوت عربي مثبت على جهازك، وخدمة النطق الأونلاين مش متاحة (محجوبة على الشبكة أو مفيش إنترنت). جرّب تثبّت حزمة اللغة العربية لقارئ الشاشة/النطق من إعدادات الجهاز (Windows: Settings → Time & Language → Speech، أو أندرويد: Settings → Text-to-speech)."
    );
  });
}

function speakEnglish(text) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.95;
    setTimeout(() => window.speechSynthesis.speak(utter), 30);
  } catch (e) {
    console.error("English pronunciation error:", e);
  }
}

// Web Speech API's SpeechRecognition, prefixed in some browsers. Returns
// null when the browser has no support (e.g. Firefox, most non-Chromium
// mobile browsers) so callers can hide the mic button entirely.
function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// Runs one voice-search capture. `lang` is a BCP-47 tag ("ar-EG"/"en-US").
// Resolves with the recognized text, or rejects on error/no-match — callers
// should catch and show a toast rather than let this throw uncaught.
function recognizeSpeech(lang) {
  return new Promise((resolve, reject) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) { reject(new Error("unsupported")); return; }
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let settled = false;
    rec.onresult = (e) => {
      settled = true;
      const text = e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript;
      if (text) resolve(text.trim()); else reject(new Error("empty"));
    };
    rec.onerror = (e) => { if (!settled) { settled = true; reject(new Error(e.error || "recognition failed")); } };
    rec.onend = () => { if (!settled) reject(new Error("no match")); };
    try { rec.start(); } catch (e) { reject(e); }
  });
}

function speakWord(text, dir) {
  if (!text) return;
  if (dir === "rtl") speakArabic(text);
  else speakEnglish(text);
}

function SpeakButton({ text, dir, isAr, size = 16, style }) {
  if (!text) return null;
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); speakWord(text, dir); }}
      title={tr(isAr, "Pronounce", "نطق الكلمة")}
      aria-label={tr(isAr, `Pronounce ${text}`, `نطق ${text}`)}
      style={{ border: "none", background: "none", color: "var(--icon-muted)", padding: 4, cursor: "pointer", display: "inline-flex", alignItems: "center", ...style }}>
      <SpeakerIcon size={size} />
    </button>
  );
}

const EN_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const AR_LETTERS = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي".split("");

function firstLetterKey(word, section) {
  if (!word) return "#";
  const w = word.trim();
  if (section === "en-ar") {
    const c = w[0].toUpperCase();
    return /[A-Z]/.test(c) ? c : "#";
  } else {
    const c = w[0];
    return AR_LETTERS.includes(c) ? c : "#";
  }
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* =========================================================================
   MCQ QUIZ — helpers
   -------------------------------------------------------------------------
   Turns "words studied in the last N minutes" into a shuffled set of
   multiple-choice questions covering everything stored about each word:
   its meaning (both directions), and its synonyms/antonyms when present.
   ========================================================================= */

// Returns the cutoff timestamp (ms) for a given range key, or null for "no
// cutoff" (i.e. include every studied word, even ones without a timestamp).
function quizRangeStart(key, customMinutes, sessionStart) {
  const now = Date.now();
  if (key === "all") return null;
  if (key === "session") return sessionStart || now;
  if (key === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (key === "custom") {
    const mins = Math.max(1, Math.min(10080, Number(customMinutes) || 0));
    return now - mins * 60000;
  }
  const presetMinutes = { "10": 10, "30": 30, "60": 60, "180": 180, "1440": 1440 };
  const mins = presetMinutes[key];
  return mins ? now - mins * 60000 : null;
}

// Studied entries whose "marked as studied" timestamp falls within the
// chosen range. Entries studied before this feature existed have no
// timestamp — they only show up under "Any time".
function selectQuizEntries(entries, studiedIds, studiedAt, rangeStart) {
  return entries.filter((e) => {
    if (!studiedIds.has(e.id)) return false;
    if (rangeStart == null) return true;
    const at = studiedAt[e.id];
    return typeof at === "number" && at >= rangeStart;
  });
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

// Picks up to `count` unique, non-empty values from `pool` that aren't in
// `excludeValues` (case-insensitive) — used to build plausible wrong
// answers for a multiple-choice question.
function pickDistractors(pool, excludeValues, count) {
  const excludeSet = new Set(excludeValues.filter(Boolean).map((v) => v.toLowerCase()));
  const seen = new Set();
  const unique = [];
  for (const v of pool) {
    if (!v) continue;
    const key = v.toLowerCase();
    if (excludeSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    unique.push(v);
  }
  return shuffleArray(unique).slice(0, count);
}

// Turns typed/target text into a comparable form: trimmed, lowercased,
// Arabic diacritics stripped. Shared by the typing-mode grader and by
// anything else that needs to compare two answers loosely.
function normalizeForTyping(s) {
  return (s || "").trim().toLowerCase().replace(/[\u064B-\u065F\u0670]/g, "");
}

// Typing-mode grading: correct if the normalized answer matches ANY of the
// accepted answers exactly, OR is a close-enough typo of one of them (using
// the same fuzzy-typo budget the search box uses). This is what makes
// typing mode forgiving of small spelling slips instead of demanding a
// keystroke-perfect match.
function isTypingCorrect(typed, acceptedAnswers) {
  const t = normalizeForTyping(typed);
  if (!t) return false;
  const list = (Array.isArray(acceptedAnswers) ? acceptedAnswers : [acceptedAnswers]).filter(Boolean);
  return list.some((raw) => {
    const a = normalizeForTyping(raw);
    if (!a) return false;
    if (t === a) return true;
    const budget = typoBudget(a.length);
    return budget > 0 && Math.abs(t.length - a.length) <= budget && levenshtein(t, a) <= budget;
  });
}

// Builds every applicable question for one studied entry — meaning,
// definition, a fill-in-the-blank from its example sentence (when one is
// available and actually contains the word), and synonyms/antonyms.
//
// `mode` changes how synonyms/antonyms are asked:
//  - "mcq": one question per synonym/antonym (as before) — no ambiguity,
//    since the user just picks from a fixed list of options.
//  - "typing": ONE combined question per word for "a synonym" / "an
//    antonym", accepting ANY word from that list as correct — because a
//    word can have several valid synonyms/antonyms and the user shouldn't
//    have to guess which single one the quiz had in mind.
function buildQuestionsForEntry(entry, allEntries, mode) {
  const sectionCfg = SECTIONS[entry.section] || SECTIONS["en-ar"];
  const sameSection = allEntries.filter((e) => e.section === entry.section && e.id !== entry.id);
  const otherPool = sameSection.length >= 3 ? sameSection : allEntries.filter((e) => e.id !== entry.id);
  const questions = [];

  // Word's own script/direction — stapled onto every question (regardless
  // of type) so the results review can always show the word correctly,
  // even for a "meaning_word" question whose prompt was the meaning.
  const wordDir = sectionCfg.wordDir, wordFont = sectionCfg.wordFont;

  const meaningDistractors = pickDistractors(otherPool.map((e) => e.meaning), [entry.meaning], 3);
  if (meaningDistractors.length >= 1) {
    questions.push({
      id: uid(), entryId: entry.id, word: entry.word, wordDir, wordFont, type: "word_meaning",
      promptText: entry.word, promptDir: sectionCfg.wordDir, promptFont: sectionCfg.wordFont,
      options: shuffleArray([entry.meaning, ...meaningDistractors]), correct: entry.meaning,
      acceptedAnswers: [entry.meaning],
      optionDir: sectionCfg.meaningDir, optionFont: sectionCfg.meaningFont,
    });
  }

  const wordDistractors = pickDistractors(otherPool.map((e) => e.word), [entry.word], 3);
  if (wordDistractors.length >= 1) {
    questions.push({
      id: uid(), entryId: entry.id, word: entry.word, wordDir, wordFont, type: "meaning_word",
      promptText: entry.meaning, promptDir: sectionCfg.meaningDir, promptFont: sectionCfg.meaningFont,
      options: shuffleArray([entry.word, ...wordDistractors]), correct: entry.word,
      acceptedAnswers: [entry.word],
      optionDir: sectionCfg.wordDir, optionFont: sectionCfg.wordFont,
    });
  }

  // Definition -> word. Only generated when the entry actually has a
  // written definition, so this doesn't fire for most words.
  if (entry.definition && entry.definition.trim()) {
    const defDistractors = pickDistractors(otherPool.map((e) => e.word), [entry.word], 3);
    if (defDistractors.length >= 1) {
      questions.push({
        id: uid(), entryId: entry.id, word: entry.word, wordDir, wordFont, type: "definition_word",
        promptText: entry.definition.trim(), promptDir: "rtl", promptFont: "'Amiri', serif",
        options: shuffleArray([entry.word, ...defDistractors]), correct: entry.word,
        acceptedAnswers: [entry.word],
        optionDir: sectionCfg.wordDir, optionFont: sectionCfg.wordFont,
      });
    }
  }

  // Fill-in-the-blank from the example sentence — only generated when an
  // example exists AND the word literally appears in it (no example, or a
  // conjugated/inflected form that doesn't match, means this is skipped).
  if (entry.example && entry.example.trim() && entry.word) {
    const idx = entry.example.toLowerCase().indexOf(entry.word.toLowerCase());
    if (idx !== -1) {
      const blanked = entry.example.slice(0, idx) + "ـــــ" + entry.example.slice(idx + entry.word.length);
      const blankDistractors = pickDistractors(otherPool.map((e) => e.word), [entry.word], 3);
      if (blankDistractors.length >= 1) {
        questions.push({
          id: uid(), entryId: entry.id, word: entry.word, wordDir, wordFont, type: "fill_blank",
          promptText: blanked, promptDir: wordDir, promptFont: wordFont,
          options: shuffleArray([entry.word, ...blankDistractors]), correct: entry.word,
          acceptedAnswers: [entry.word],
          optionDir: sectionCfg.wordDir, optionFont: sectionCfg.wordFont,
        });
      }
    }
  }

  // Synonyms/antonyms are stored as { word, meaning } pairs. The quiz asks
  // "which of these is a synonym/antonym of this word" — that's a
  // same-language question (e.g. an English word's English synonym), so
  // the word-language side is used here, never the Arabic meaning side.
  const synonymPairs = normalizePairs(entry.synonyms, sectionCfg).map((p) => p.word || p.meaning).filter(Boolean);
  const antonymPairs = normalizePairs(entry.antonyms, sectionCfg).map((p) => p.word || p.meaning).filter(Boolean);

  if (mode === "typing") {
    if (synonymPairs.length) {
      questions.push({
        id: uid(), entryId: entry.id, word: entry.word, wordDir, wordFont, type: "synonym",
        promptText: entry.word, promptDir: sectionCfg.wordDir, promptFont: sectionCfg.wordFont,
        options: [], correct: synonymPairs.join(" / "), acceptedAnswers: synonymPairs,
        optionDir: sectionCfg.wordDir, optionFont: sectionCfg.wordFont,
      });
    }
    if (antonymPairs.length) {
      questions.push({
        id: uid(), entryId: entry.id, word: entry.word, wordDir, wordFont, type: "antonym",
        promptText: entry.word, promptDir: sectionCfg.wordDir, promptFont: sectionCfg.wordFont,
        options: [], correct: antonymPairs.join(" / "), acceptedAnswers: antonymPairs,
        optionDir: sectionCfg.wordDir, optionFont: sectionCfg.wordFont,
      });
    }
  } else {
    for (const correct of synonymPairs) {
      const pool = [...antonymPairs, ...otherPool.map((e) => e.word)];
      const distractors = pickDistractors(pool, [...synonymPairs, entry.word], 3);
      if (distractors.length >= 1) {
        questions.push({
          id: uid(), entryId: entry.id, word: entry.word, wordDir, wordFont, type: "synonym",
          promptText: entry.word, promptDir: sectionCfg.wordDir, promptFont: sectionCfg.wordFont,
          options: shuffleArray([correct, ...distractors]), correct, acceptedAnswers: synonymPairs,
          optionDir: sectionCfg.wordDir, optionFont: sectionCfg.wordFont,
        });
      }
    }

    for (const correct of antonymPairs) {
      const pool = [...synonymPairs, ...otherPool.map((e) => e.word)];
      const distractors = pickDistractors(pool, [...antonymPairs, entry.word], 3);
      if (distractors.length >= 1) {
        questions.push({
          id: uid(), entryId: entry.id, word: entry.word, wordDir, wordFont, type: "antonym",
          promptText: entry.word, promptDir: sectionCfg.wordDir, promptFont: sectionCfg.wordFont,
          options: shuffleArray([correct, ...distractors]), correct, acceptedAnswers: antonymPairs,
          optionDir: sectionCfg.wordDir, optionFont: sectionCfg.wordFont,
        });
      }
    }
  }

  return questions;
}

// Builds the full shuffled question set for a quiz session. No cap on
// count — every question generated for the studied words is included, so
// nothing gets left untested, just shuffled into a random order. `mode`
// ("mcq" | "typing") is threaded through so synonym/antonym questions are
// built the right way for how they'll be graded (see buildQuestionsForEntry).
function buildQuiz(studiedEntries, allEntries, mode) {
  let all = [];
  for (const entry of studiedEntries) all = all.concat(buildQuestionsForEntry(entry, allEntries, mode));
  return shuffleArray(all);
}

function quizQuestionLabel(type, isAr) {
  switch (type) {
    case "word_meaning": return tr(isAr, "What does this word mean?", "ما معنى هذه الكلمة؟");
    case "meaning_word": return tr(isAr, "Which word matches this meaning?", "ما الكلمة التي تطابق هذا المعنى؟");
    case "definition_word": return tr(isAr, "Which word matches this definition?", "ما الكلمة التي يصفها هذا التعريف؟");
    case "fill_blank": return tr(isAr, "Fill in the blank", "أكمل الفراغ بالكلمة المناسبة");
    case "synonym": return tr(isAr, "Name a synonym of this word.", "اذكر مرادفًا لهذه الكلمة.");
    case "antonym": return tr(isAr, "Name an antonym of this word.", "اذكر ضدًا لهذه الكلمة.");
    default: return "";
  }
}

/* =========================================================================
   SPACED REPETITION (cumulative accuracy, not a streak)
   -------------------------------------------------------------------------
   Stored per-account per-word: srsStats = { correct, total } — every quiz
   answer adds to `total`, and to `correct` if it was right. Nothing ever
   resets on a wrong answer; a word's level is just correct/total so far.
   Levels:
     - New:       total === 0 (never quizzed yet)
     - Learning:  accuracy < 50%
     - Familiar:  50% <= accuracy < 100%
     - Mastered:  accuracy === 100% AND at least SRS_MASTERY_MIN_ATTEMPTS
                  answers given (so one lucky guess isn't "mastered")
   `srsDueAt` (next-review timestamp) is still tracked separately so the
   quiz's "due for review" filter keeps working: it's pushed further out
   the higher the current level is, and pulled back to "due now" on a
   wrong answer (even though the level itself doesn't reset).
   ========================================================================= */
const SRS_MASTERY_MIN_ATTEMPTS = 3;
const SRS_LEVEL_INTERVALS_MS = [
  10 * 60 * 1000,          // New/just answered wrong -> re-test soon
  12 * 60 * 60 * 1000,     // Learning -> re-test within half a day
  3 * 24 * 60 * 60 * 1000, // Familiar -> re-test in a few days
  7 * 24 * 60 * 60 * 1000, // Mastered -> re-test weekly, just to keep it fresh
];
const SRS_BOX_LABELS = [
  { en: "New", ar: "جديدة" },
  { en: "Learning", ar: "قيد التعلم" },
  { en: "Familiar", ar: "مألوفة" },
  { en: "Mastered", ar: "متقنة" },
];

// Turns a word's { correct, total } into one of the 4 levels above
// (indices matching SRS_BOX_LABELS / SRS_LEVEL_INTERVALS_MS).
function srsLevelFromStats(stats) {
  const total = (stats && stats.total) || 0;
  if (total === 0) return 0;
  const correct = (stats && stats.correct) || 0;
  const accuracy = correct / total;
  if (accuracy >= 1 && total >= SRS_MASTERY_MIN_ATTEMPTS) return 3;
  if (accuracy >= 0.5) return 2;
  return 1;
}

// True if a word is due for review right now: never quizzed, or its last
// due timestamp has passed. `srsDueAt` may be undefined/null-safe.
function isSrsDue(entryId, srsDueAt) {
  const due = srsDueAt && srsDueAt[entryId];
  return typeof due !== "number" || due <= Date.now();
}

// Groups a question type into the three results-review sections the user
// studies from afterwards: plain meaning, synonyms, antonyms.
function quizResultCategory(type) {
  if (type === "synonym") return "synonym";
  if (type === "antonym") return "antonym";
  return "meaning";
}

const QUIZ_RESULT_CATEGORIES = [
  { key: "meaning", label: "Meaning", labelAr: "المعنى" },
  { key: "synonym", label: "Synonyms", labelAr: "المرادفات" },
  { key: "antonym", label: "Antonyms", labelAr: "المضادات" },
];

// mm:ss (or h:mm:ss for long sessions) from a millisecond duration.
function formatQuizDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/* =========================================================================
   ADMIN ACTIVITY LOG
   -------------------------------------------------------------------------
   Every add/edit/delete of a word or account, and every sign in/out, gets
   appended here and saved alongside entries/accounts in the same shared
   record. Only rendered in the Admin panel (admins only). Capped so the
   shared bin doesn't grow forever.
   ========================================================================= */
const MAX_LOG_ENTRIES = 500;
function capLogs(list) {
  return list.length > MAX_LOG_ENTRIES ? list.slice(list.length - MAX_LOG_ENTRIES) : list;
}
function makeLogEntry(action, message, actorName, actorCode) {
  return { id: uid(), action, message, actorName: actorName || "", actorCode: actorCode || "", at: Date.now() };
}

// Classic edit-distance calculation — used to tolerate small typos in search.
function levenshtein(a, b) {
  a = a || ""; b = b || "";
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

// How many typos we tolerate scales with the query length — short queries
// need to stay strict or everything would match.
function typoBudget(len) {
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  return 3;
}

// True if `needle` appears in `haystack` as a substring, OR is a close-enough
// typo of any whitespace-separated word inside it.
function fuzzyIncludes(haystack, needle) {
  const h = (haystack || "").toLowerCase();
  const n = (needle || "").trim().toLowerCase();
  if (!n) return false;
  if (h.includes(n)) return true;
  const budget = typoBudget(n.length);
  if (budget === 0) return false;
  return h.split(/\s+/).some((tok) => Math.abs(tok.length - n.length) <= budget && levenshtein(tok, n) <= budget);
}

// Scores how well a single word matches the query, for ranking autocomplete
// suggestions (lower is better; null means "not a match").
function matchScore(word, needle) {
  const w = (word || "").toLowerCase();
  const n = (needle || "").trim().toLowerCase();
  if (!n) return null;
  if (w.startsWith(n)) return 0;
  if (w.includes(n)) return 1;
  const budget = typoBudget(n.length);
  if (budget === 0) return null;
  const dist = levenshtein(w, n);
  return dist <= budget ? 2 + dist : null;
}

function detectDir(text) {
  return /[\u0600-\u06FF]/.test(text) ? "rtl" : "ltr";
}
function detectFont(text) {
  return /[\u0600-\u06FF]/.test(text) ? "'Amiri', serif" : "'Source Sans 3', sans-serif";
}

// Tiny inline translation helper — used throughout the authenticated app so
// that the Arabic → Arabic section's page (chrome, buttons, messages) reads
// entirely in Arabic, just like the English → Arabic section reads entirely
// in English.
function tr(isAr, en, ar) {
  return isAr ? ar : en;
}

/* =========================================================================
   CSV EXPORT — lets a user download their word list (or a filtered subset
   of it) as a .csv file they can open in Excel/Sheets or print for offline
   study. Values are escaped per RFC 4180 (quotes doubled, field wrapped in
   quotes whenever it contains a comma, quote, or newline). A UTF-8 BOM is
   prepended so Excel opens Arabic text correctly instead of mangling it.
   ========================================================================= */
function csvEscape(value) {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// Minimal CSV parser (handles quoted fields, escaped "" quotes, and both
// \n and \r\n line endings) — the counterpart to entriesToCsv() above, used
// by the "Import CSV" bulk-add feature. Good enough for the flat,
// non-nested rows this app itself exports; not a general-purpose parser.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, ""); // strip BOM if present
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function entriesToCsv(entries, cfg) {
  const header = ["word", "meaning", "definition", "synonyms", "antonyms"];
  const rows = entries.map((e) => {
    const syn = normalizePairs(e.synonyms, cfg).map((p) => p.word).filter(Boolean).join("; ");
    const ant = normalizePairs(e.antonyms, cfg).map((p) => p.word).filter(Boolean).join("; ");
    return [e.word, e.meaning, e.definition || "", syn, ant];
  });
  const lines = [header, ...rows].map((row) => row.map(csvEscape).join(","));
  return "\uFEFF" + lines.join("\r\n");
}

function downloadTextFile(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportEntriesAsCsv(entries, cfg, sectionLabel) {
  const csv = entriesToCsv(entries, cfg);
  const date = new Date().toISOString().slice(0, 10);
  downloadTextFile(`two-tongues-${sectionLabel}-${date}.csv`, csv, "text/csv;charset=utf-8;");
}

/* =========================================================================
   SYNONYM / ANTONYM PAIRS — each synonym/antonym is stored as a pair:
   { id, word, meaning } — the synonym/antonym itself (same language as the
   dictionary's word column) and the meaning of that word (same language as
   the dictionary's meaning column) — shown as two boxes side by side,
   using each section's own direction/font so the Arabic→Arabic section
   reads fully right-to-left. normalizePairs() also upgrades entries saved
   in older shapes (plain strings, or the old {en, ar} pairs).
   ========================================================================= */
function normalizePairs(list, cfg) {
  if (!Array.isArray(list)) return [];
  const wordIsLtr = !cfg || cfg.wordDir === "ltr";
  return list
    .map((item) => {
      if (item && typeof item === "object") {
        if ("word" in item || "meaning" in item) {
          return { id: item.id || uid(), word: item.word || "", meaning: item.meaning || "" };
        }
        // legacy {en, ar} shape
        if (wordIsLtr) return { id: item.id || uid(), word: item.en || "", meaning: item.ar || "" };
        return { id: item.id || uid(), word: item.ar || item.en || "", meaning: item.ar ? "" : item.en || "" };
      }
      const str = String(item || "").trim();
      if (!str) return null;
      return { id: uid(), word: str, meaning: "" };
    })
    .filter(Boolean)
    .filter((p) => p.word || p.meaning);
}

// Editable pair list — used in the add/edit word form for synonyms and
// antonyms. Each row is two boxes facing each other, styled with the
// section's own word/meaning direction and font, so the box order and
// alignment naturally flip to right-to-left for an all-Arabic section.
// Pressing Enter in either box (physical keyboard) never submits the
// form — it adds a fresh empty row and moves focus into it, so typing
// several synonyms/antonyms in a row feels continuous. The word is only
// saved when the "Save word" button is used, as usual.
function PairListEditor({ cfg, label, pairs, onChange, isAr }) {
  const [focusId, setFocusId] = useState(null);
  const wordRefs = useRef({});

  useEffect(() => {
    if (focusId && wordRefs.current[focusId]) {
      wordRefs.current[focusId].focus();
      setFocusId(null);
    }
  }, [focusId, pairs]);

  function updateRow(id, field, value) {
    onChange(pairs.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }
  function addRow(focusNew) {
    const row = { id: uid(), word: "", meaning: "" };
    onChange([...pairs, row]);
    if (focusNew) setFocusId(row.id);
  }
  function removeRow(id) {
    onChange(pairs.filter((p) => p.id !== id));
  }
  function handleEnter(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      addRow(true);
    }
  }
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {pairs.map((p) => (
        <div key={p.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
          <input
            ref={(el) => (wordRefs.current[p.id] = el)}
            value={p.word} onChange={(e) => updateRow(p.id, "word", e.target.value)}
            onKeyDown={handleEnter}
            placeholder={tr(isAr, "Word", "الكلمة")} dir={cfg.wordDir}
            style={{ ...inputStyle, flex: 1, minWidth: 0, fontFamily: cfg.wordFont, fontSize: 14 }}
          />
          <input
            value={p.meaning} onChange={(e) => updateRow(p.id, "meaning", e.target.value)}
            onKeyDown={handleEnter}
            placeholder={tr(isAr, "Meaning in Arabic", "المعنى بالعربي")} dir={cfg.meaningDir}
            style={{ ...inputStyle, flex: 1, minWidth: 0, fontFamily: cfg.meaningFont, fontSize: 14 }}
          />
          <button
            type="button" onClick={() => removeRow(p.id)}
            aria-label={tr(isAr, "Remove", "حذف")}
            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", padding: 4, flexShrink: 0, display: "flex" }}
          >
            <XIcon size={15} />
          </button>
        </div>
      ))}
      <button
        type="button" onClick={() => addRow(true)}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "none", cursor: "pointer", color: "var(--accent-1)", fontSize: 13, fontWeight: 600, padding: "2px 0 12px" }}
      >
        <PlusIcon size={13} /> {tr(isAr, "Add", "إضافة")}
      </button>
    </div>
  );
}

// Read-only pair display — used on the entry card and the zoom view.
// Renders each synonym/antonym as two boxes side by side, in the
// section's own word/meaning direction and font.
function PairListDisplay({ cfg, pairs }) {
  const clean = normalizePairs(pairs, cfg);
  if (!clean.length) return null;
  const isAr = cfg.dir === "rtl";
  return (
    <div dir={cfg.dir} style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 3 }}>
      {clean.map((p) => (
        <div key={p.id} style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
          <span dir={cfg.wordDir} style={{ flex: 1, minWidth: 0, fontFamily: cfg.wordFont, padding: "3px 8px", background: "var(--input-bg)", borderRadius: 3, color: INK, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
            <span style={{ minWidth: 0, overflowWrap: "break-word" }}>{p.word || "—"}</span>
            {!!p.word && <SpeakButton text={p.word} dir={cfg.wordDir} isAr={isAr} size={13} style={{ padding: 2, flexShrink: 0 }} />}
          </span>
          <span dir={cfg.meaningDir} style={{ flex: 1, minWidth: 0, fontFamily: cfg.meaningFont, padding: "3px 8px", background: "var(--input-bg)", borderRadius: 3, color: "var(--meaning)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
            <span style={{ minWidth: 0, overflowWrap: "break-word" }}>{p.meaning || "—"}</span>
            {!!p.meaning && <SpeakButton text={p.meaning} dir={cfg.meaningDir} isAr={isAr} size={13} style={{ padding: 2, flexShrink: 0 }} />}
          </span>
        </div>
      ))}
    </div>
  );
}

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
function translateAdminError(msg, isAr) {
  if (!isAr) return msg;
  const retryMatch = /^Too many attempts — try again in (\d+)s\.$/.exec(msg || "");
  if (retryMatch) return `محاولات كثيرة جدًا — حاول مرة أخرى بعد ${retryMatch[1]} ثانية.`;
  if (msg === "Server not configured: missing ACCESS_CODE env var.") return "الخادم غير مُهيأ: متغير ACCESS_CODE مفقود.";
  const map = {
    "Enter a name.": "أدخل اسمًا.",
    "An account with this name already exists.": "يوجد حساب بهذا الاسم بالفعل.",
    "That name is already taken.": "هذا الاسم مستخدم بالفعل.",
    "Enter the access code.": "أدخل رمز الوصول.",
    "Still loading — please try again in a moment.": "جارٍ التحميل — يرجى المحاولة مرة أخرى بعد لحظة.",
    "Enter your personal code.": "أدخل رمزك الشخصي.",
    "That personal code doesn't match any account.": "هذا الرمز الشخصي لا يطابق أي حساب.",
    "Couldn't verify the access code — check your connection and try again.": "تعذّر التحقق من رمز الوصول — تحقق من اتصالك وحاول مرة أخرى.",
    "That access code doesn't match.": "رمز الوصول غير مطابق.",
  };
  return map[msg] || msg;
}

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

const INK = "var(--ink)", PAPER = "var(--paper)", CARD = "var(--card)", BRASS = "var(--accent-1)";

const labelStyle = { display: "block", fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted-strong)", margin: "14px 0 6px" };
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px 12px", fontFamily: "'Source Sans 3', sans-serif", fontSize: 15, color: INK, background: "var(--input-bg)", border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 3 };
const errorStyle = { marginTop: 12, fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: "var(--danger)", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 3, padding: "8px 10px", animation: "staggerIn 0.3s ease both" };
const primaryBtnStyle = { marginTop: 20, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 14px", fontFamily: "'Source Sans 3', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: "0.01em", color: "#fff", background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))", backgroundSize: "160% 160%", border: "none", borderRadius: 8, cursor: "pointer", boxShadow: "0 10px 24px -12px rgba(var(--focus-rgb),0.6)" };
const authCardStyle = { position: "relative", width: "100%", maxWidth: 400, background: CARD, border: "1px solid rgba(var(--border-rgb),0.15)", borderRadius: 18, padding: "34px 30px 30px", boxShadow: "0 2px 0 rgba(0,0,0,0.06), 0 24px 60px -20px rgba(var(--border-rgb),0.4)" };
const authInputStyle = { ...inputStyle, borderRadius: 8, padding: "11px 13px" };
const authBadgeWrapStyle = { position: "relative", width: 56, height: 56, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))", boxShadow: "0 10px 24px -10px rgba(var(--focus-rgb),0.65)", flexShrink: 0 };

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
function LanguageToggle({ isAr, onToggle, floating = true }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={tr(isAr, "Switch to Arabic", "التبديل إلى الإنجليزية")}
      className="lift-hover"
      style={{
        ...(floating ? { position: "absolute", top: 14, insetInlineEnd: 14 } : {}),
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 10px", fontSize: 12, fontWeight: 600,
        color: "var(--icon-muted)", background: "var(--input-bg)",
        border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 20,
        cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif",
      }}>
      <GlobeIcon size={13} />
      {isAr ? "English" : "العربية"}
    </button>
  );
}

function Shell({ children }) {
  return (
    <div style={{ position: "relative", minHeight: "100vh", background: PAPER, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(var(--border-rgb),0.06) 1px, transparent 0)", backgroundSize: "18px 18px", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden" }}>
      <div className="auth-orb" style={{ width: 320, height: 320, top: "-8%", insetInlineStart: "-6%", background: "radial-gradient(circle, var(--accent-1) 0%, transparent 70%)", animationDuration: "12s" }} />
      <div className="auth-orb" style={{ width: 260, height: 260, bottom: "-8%", insetInlineEnd: "-4%", background: "radial-gradient(circle, var(--accent-2) 0%, transparent 70%)", animationDuration: "14s", animationDelay: "-4s" }} />
      <div className="auth-orb" style={{ width: 180, height: 180, top: "38%", insetInlineEnd: "8%", background: "radial-gradient(circle, var(--focus-rgb, 25,167,206), transparent 70%)", opacity: 0.28, animationDuration: "9s", animationDelay: "-2s" }} />
      <div style={{ position: "relative", zIndex: 1, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

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

  const persistEntries = useCallback(async (next, logEntry) => {
    setEntries(next);
    const nextLogs = logEntry ? capLogs([...logs, logEntry]) : logs;
    if (logEntry) setLogs(nextLogs);
    try {
      await saveRecord({ entries: next, accounts, logs: nextLogs });
      saveOfflineCache({ entries: next, accounts, logs: nextLogs });
      setSaveError("");
    } catch (e) {
      setSaveError("Couldn't save — check your connection and try again.");
    }
  }, [accounts, logs]);

  const persistAccounts = useCallback(async (next, logEntry) => {
    setAccounts(next);
    const nextLogs = logEntry ? capLogs([...logs, logEntry]) : logs;
    if (logEntry) setLogs(nextLogs);
    try {
      await saveRecord({ entries, accounts: next, logs: nextLogs });
      saveOfflineCache({ entries, accounts: next, logs: nextLogs });
      setSaveError("");
    } catch (e) {
      setSaveError("Couldn't save — check your connection and try again.");
    }
  }, [entries, logs]);

  // For events that don't touch entries/accounts (sign in/out) — still saved
  // into the same shared record so it stays in sync with everything else.
  const persistLogs = useCallback(async (next) => {
    setLogs(next);
    try {
      await saveRecord({ entries, accounts, logs: next });
    } catch (e) {
      // Best-effort: a failed log write shouldn't block sign-in/out.
    }
  }, [entries, accounts]);

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
        return;
      }
      const code = generatePersonalCode();
      const nextAccounts = [...rec.accounts, { name: trimmed, code, role: "user", createdAt: Date.now() }];
      const nextLogs = capLogs([...(rec.logs || []), makeLogEntry("account_add", `${trimmed} created an account (self sign-up)`, trimmed, code)]);
      await saveRecord({ entries: rec.entries, accounts: nextAccounts, logs: nextLogs });
      setEntries(rec.entries);
      setAccounts(nextAccounts);
      setLogs(nextLogs);
      setMyCode(code);
      goToStage("codeShown");
    } catch (err) {
      setSignupError("Couldn't create the account — check your connection and try again.");
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

  if (authStage === "intro") {
    const introFeatures = [
      { icon: SearchIcon, title: atr("Instant search", "بحث فوري"), desc: atr("Look up any word between English and Arabic in a heartbeat.", "ابحث عن أي كلمة بين الإنجليزية والعربية في لحظة.") },
      { icon: SpeakerIcon, title: atr("Hear it spoken", "استمع للنطق"), desc: atr("Native-style pronunciation for every entry, one tap away.", "نطق واضح لكل كلمة بضغطة زر واحدة.") },
      { icon: QuizIcon, title: atr("Practice quizzes", "اختبارات تدريبية"), desc: atr("Turn what you've studied into quick multiple-choice quizzes.", "حوّل ما درسته إلى اختبارات اختيار من متعدد سريعة.") },
      { icon: EditIcon, title: atr("Grow the dictionary", "أضِف كلمات جديدة"), desc: atr("Add new words and definitions that everyone in the group can use.", "أضف كلمات وتعريفات جديدة يستفيد منها الجميع.") },
      { icon: UsersIcon, title: atr("Shared with your group", "مشترك مع مجموعتك"), desc: atr("One dictionary for everyone, with each person's progress tracked separately.", "قاموس واحد للجميع، وتقدّم كل شخص محفوظ بشكل منفصل.") },
      { icon: GlobeIcon, title: atr("Fully bilingual", "ثنائي اللغة بالكامل"), desc: atr("Switch the whole app between English and Arabic anytime.", "بدّل الموقع بالكامل بين الإنجليزية والعربية في أي وقت.") },
      { icon: ZoomIcon, title: atr("Automatic grammar breakdown", "تحليل نحوي تلقائي"), desc: atr("Full English tense tables, Arabic verb conjugation, and adjective breakdowns — detected automatically as you type.", "جداول أزمنة إنجليزية كاملة، تصريف الفعل العربي، وتحليل الصفات — يتم اكتشافها تلقائيًا أثناء الكتابة.") },
      { icon: TrophyIcon, title: atr("Leaderboard", "لوحة الصدارة"), desc: atr("See how you stack up against the rest of your group.", "شوف ترتيبك مقارنة بباقي أفراد مجموعتك.") },
      { icon: StatsIcon, title: atr("Smart review reminders", "تذكيرات مراجعة ذكية"), desc: atr("Spaced-repetition scheduling brings words back right before you'd forget them.", "جدولة تكرار متباعد تعيد لك الكلمات في التوقيت المثالي قبل ما تنساها.") },
      { icon: WifiOffIcon, title: atr("Works offline", "يعمل بدون إنترنت"), desc: atr("Your saved words stay with you even without a connection.", "كلماتك المحفوظة تفضل معاك حتى من غير اتصال بالإنترنت.") },
    ];
    return (
      <div
        dir={appIsAr ? "rtl" : "ltr"}
        style={{ position: "relative", minHeight: "100vh", background: PAPER, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(var(--border-rgb),0.06) 1px, transparent 0)", backgroundSize: "18px 18px", overflowX: "hidden" }}>
        <div className="auth-orb" style={{ width: 420, height: 420, top: "-14%", insetInlineStart: "-10%", background: "radial-gradient(circle, var(--accent-1) 0%, transparent 70%)", animationDuration: "15s" }} />
        <div className="auth-orb" style={{ width: 360, height: 360, top: "14%", insetInlineEnd: "-12%", background: "radial-gradient(circle, var(--accent-2) 0%, transparent 70%)", animationDuration: "17s", animationDelay: "-5s" }} />
        <div className="auth-orb" style={{ width: 240, height: 240, bottom: "-6%", insetInlineStart: "22%", background: "radial-gradient(circle, var(--focus-rgb,25,167,206), transparent 70%)", opacity: 0.25, animationDuration: "11s", animationDelay: "-3s" }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 1080, margin: "0 auto", padding: "22px 24px 64px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "clamp(36px, 8vw, 84px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="auth-badge" style={{ ...authBadgeWrapStyle, width: 38, height: 38, borderRadius: 11 }}>
                <BookIcon size={18} color="#fff" />
              </div>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600, color: INK }}>Two Tongues</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" onClick={toggleTheme} className="lift-hover" aria-label={atr("Toggle theme", "تبديل المظهر")}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "50%", color: "var(--icon-muted)", background: "var(--input-bg)", border: "1px solid rgba(var(--border-rgb),0.2)" }}>
                {theme === "dark" ? <SunIcon size={15} /> : <MoonIcon size={15} />}
              </button>
              <LanguageToggle isAr={appIsAr} onToggle={toggleAppLang} floating={false} />
            </div>
          </div>

          <div className="auth-field-1" style={{ textAlign: "center", maxWidth: 680, margin: "0 auto" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: BRASS, background: "var(--accent-1-soft)", padding: "6px 14px", borderRadius: 20, marginBottom: 18 }}>
              <GlobeIcon size={12} /> {atr("English ⇄ Arabic dictionary", "قاموس إنجليزي ⇄ عربي")}
            </div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(30px, 6vw, 50px)", fontWeight: 600, color: INK, margin: "0 0 16px", lineHeight: 1.15 }}>
              {atr("Learn words that stick, together.", "تعلّم كلمات تثبت في ذاكرتك… مع فريقك.")}
            </h1>
            <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: "clamp(14px, 2vw, 17px)", color: "var(--muted-strong)", margin: "0 auto 30px", maxWidth: 560, lineHeight: 1.65 }}>
              {atr("A shared bilingual dictionary with pronunciation, quick quizzes and progress tracking — built for you and your study group.", "قاموس مشترك ثنائي اللغة فيه نطق واختبارات سريعة ومتابعة للتقدّم — مصمَّم لك ولمجموعتك.")}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <button type="button" onClick={() => { setAuthError(""); goToStage("login"); }} className="btn-shine" style={{ ...primaryBtnStyle, width: "auto", marginTop: 0, padding: "13px 28px" }}>
                <LoginIcon size={16} /> {atr("Sign in", "تسجيل الدخول")}
              </button>
              <button type="button" onClick={() => { setSignupError(""); goToStage("signup"); }} className="lift-hover"
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 26px", fontFamily: "'Source Sans 3', sans-serif", fontSize: 15, fontWeight: 700, color: INK, background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 8, cursor: "pointer" }}>
                <PlusIcon size={16} /> {atr("Create account", "إنشاء حساب")}
              </button>
            </div>
          </div>

          {/* Bento-style showcase: an asymmetric mosaic instead of a plain
              uniform grid — two "hero" tiles get extra room to breathe while
              the rest tile in around them, each carrying a large faint
              ordinal numeral for a more editorial, less templated feel. */}
          <style>{`
            .bento-grid { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 122px; gap: 14px; grid-auto-flow: dense; margin-top: clamp(40px, 6vw, 68px); }
            .bento-item { position: relative; overflow: hidden; background: var(--card); border: 1px solid rgba(var(--border-rgb),0.14); border-radius: 16px; padding: 20px; box-shadow: 0 2px 0 rgba(0,0,0,0.04), 0 16px 40px -24px rgba(var(--border-rgb),0.4); transition: transform 0.35s cubic-bezier(0.22,1,0.36,1), box-shadow 0.35s ease, border-color 0.3s ease; display: flex; flex-direction: column; justify-content: flex-end; }
            .bento-item:hover { transform: translateY(-5px) scale(1.015); box-shadow: 0 24px 50px -20px rgba(var(--border-rgb),0.5); border-color: rgba(var(--focus-rgb),0.4); }
            .bento-num { position: absolute; top: 6px; inset-inline-end: 12px; font-family: 'Fraunces', serif; font-size: 58px; font-weight: 600; color: var(--ink); opacity: 0.06; line-height: 1; pointer-events: none; transition: opacity 0.35s ease, transform 0.35s ease; }
            .bento-item:hover .bento-num { opacity: 0.11; transform: scale(1.08); }
            .bento-icon { width: 38px; height: 38px; border-radius: 11px; display: flex; align-items: center; justify-content: center; background: var(--accent-1-soft); color: var(--accent-1); margin-bottom: 12px; transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1); }
            .bento-item:hover .bento-icon { transform: rotate(-8deg) scale(1.1); }
            .bento-big { grid-column: span 2; grid-row: span 2; }
            .bento-big .bento-icon { width: 44px; height: 44px; border-radius: 13px; }
            .bento-big .bento-num { font-size: 78px; }
            .bento-wide { grid-column: span 2; grid-row: span 1; }
            .bento-solo { grid-column: span 1; grid-row: span 1; }
            .bento-more { grid-column: span 2; grid-row: span 1; border-style: dashed; border-width: 1.5px; align-items: center; justify-content: center; text-align: center; color: var(--muted); cursor: pointer; height: auto; }
            .bento-more:hover { border-color: rgba(var(--focus-rgb),0.5); color: var(--ink); }
            .bento-more .bento-more-chevron { transition: transform 0.3s cubic-bezier(0.22,1,0.36,1); margin-inline-start: 4px; transform: rotate(90deg); }
            .bento-more.is-open .bento-more-chevron { transform: rotate(270deg); }
            .bento-more-peek { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.35s cubic-bezier(0.22,1,0.36,1); width: 100%; }
            .bento-more.is-open .bento-more-peek { grid-template-rows: 1fr; }
            .bento-more-peek-inner { overflow: hidden; min-height: 0; }
            @media (max-width: 720px) {
              .bento-grid { grid-template-columns: repeat(2, 1fr); grid-auto-rows: 150px; }
              .bento-big, .bento-wide, .bento-more { grid-column: span 2; grid-row: span 1; }
            }
            @media (max-width: 420px) {
              .bento-grid { grid-template-columns: 1fr; }
              .bento-big, .bento-wide, .bento-solo, .bento-more { grid-column: span 1; }
            }
          `}</style>
          <div className="bento-grid">
            {introFeatures.map((f, i) => {
              const shape = [ "bento-big", "bento-wide", "bento-solo", "bento-solo", "bento-wide", "bento-solo", "bento-wide", "bento-solo", "bento-solo", "bento-wide" ][i] || "bento-solo";
              return (
                <div key={f.title} className={`bento-item auth-field-1 ${shape}`} style={{ animationDelay: `${0.08 + i * 0.05}s` }}>
                  <span className="bento-num">{String(i + 1).padStart(2, "0")}</span>
                  <div className="bento-icon"><f.icon size={shape === "bento-big" ? 20 : 18} /></div>
                  <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: shape === "bento-big" ? 19 : 16, fontWeight: 600, color: INK, margin: "0 0 6px" }}>{f.title}</h3>
                  <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13.5, color: "var(--muted-strong)", margin: 0, lineHeight: 1.55 }}>{f.desc}</p>
                </div>
              );
            })}
            {/* Reserved slot: room to slot in more feature tiles later — just
                add entries to introFeatures and, optionally, a shape above.
                Doubles as a teaser accordion: tapping it peeks at what's
                coming next without committing a full tile to it. */}
            <div
              className={`bento-item bento-more auth-field-1${moreFeaturesOpen ? " is-open" : ""}`}
              style={{ animationDelay: `${0.08 + introFeatures.length * 0.05}s` }}
              role="button"
              tabIndex={0}
              aria-expanded={moreFeaturesOpen}
              onClick={() => setMoreFeaturesOpen((o) => !o)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMoreFeaturesOpen((o) => !o); } }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <PlusIcon size={18} style={{ opacity: 0.6 }} />
                <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, margin: 0 }}>{atr("More features on the way", "المزيد من المميزات قريبًا")}</p>
                <ChevronIcon size={13} className="bento-more-chevron" />
              </div>
              <div className="bento-more-peek">
                <div className="bento-more-peek-inner">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12, marginTop: 12, borderTop: "1px dashed rgba(var(--border-rgb),0.3)", opacity: 0.75 }}>
                    <FlameIcon size={16} />
                    <span style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 12.5 }}>
                      {atr("Daily streaks and study challenges", "سلاسل يومية وتحديات مذاكرة")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (authStage === "signup") {
    return (
      <Shell>
        <div className="auth-card" style={authCardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
            <div className="auth-badge" style={authBadgeWrapStyle}>
              <BookIcon size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600, color: INK, margin: 0 }}>Two Tongues</h1>
              <div style={{ width: 34, height: 3, borderRadius: 2, background: "linear-gradient(90deg, var(--accent-1), var(--accent-2))", marginTop: 6, animation: "underlineGrow 0.6s ease 0.2s both" }} />
            </div>
          </div>
          <p style={{ fontFamily: "'Source Sans 3', sans-serif", color: "var(--muted-strong)", fontSize: 14, margin: "16px 0 22px" }}>
            Create your account with just your name — you'll get a personal code to sign in with.
          </p>
          <form onSubmit={handleSignup}>
            <div className="auth-field-1">
              <label style={labelStyle} htmlFor="signup-name">Your name</label>
              <input id="signup-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Omar" style={authInputStyle} autoFocus autoCapitalize="off" autoCorrect="off" />
            </div>
            {signupError && <div style={errorStyle} role="alert" aria-live="assertive">{signupError}</div>}
            <button type="submit" disabled={signupSaving} className="btn-shine" style={primaryBtnStyle}>
              {signupSaving ? <LoaderIcon size={16} /> : <PlusIcon size={16} />} Create account
            </button>
          </form>
          <p className="auth-field-2" style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: "var(--muted-strong)", textAlign: "center", marginTop: 18 }}>
            Already have an account?{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); setAuthError(""); goToStage("login"); }} className="link-underline" style={{ color: BRASS, fontWeight: 600, textDecoration: "none" }}>
              Sign in
            </a>
          </p>
        </div>
      </Shell>
    );
  }

  if (authStage === "codeShown") {
    return (
      <Shell>
        <div className="auth-card" style={authCardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
            <div className="auth-badge" style={{ ...authBadgeWrapStyle, animation: "floatY 4.5s ease-in-out infinite, pulseGlow 2.2s ease-in-out infinite" }}>
              <KeyIcon size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, color: INK, margin: 0 }}>Your personal code</h1>
              <div style={{ width: 34, height: 3, borderRadius: 2, background: "linear-gradient(90deg, var(--accent-1), var(--accent-2))", marginTop: 6, animation: "underlineGrow 0.6s ease 0.2s both" }} />
            </div>
          </div>
          <p style={{ fontFamily: "'Source Sans 3', sans-serif", color: "var(--muted-strong)", fontSize: 14, margin: "16px 0 18px" }}>
            Save this code — you'll need it, along with the shared access code, every time you sign in.
          </p>
          <div
            onClick={handleCopyCode}
            title="Click to copy"
            role="button"
            tabIndex={0}
            className="auth-field-1"
            aria-label={`Your personal code is ${myCode.split("").join(" ")}. Activate to copy.`}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCopyCode(); } }}
            style={{ textAlign: "center", padding: "20px 10px", background: codeCopied ? "var(--success-bg)" : "var(--input-bg)", border: `1.5px dashed ${codeCopied ? "rgba(var(--success-border-rgb),0.5)" : "rgba(var(--border-rgb),0.3)"}`, borderRadius: 10, marginBottom: 8, cursor: "pointer", userSelect: "none", transition: "background 0.2s, border-color 0.2s, transform 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 600, letterSpacing: "0.08em", color: INK, animation: codeCopied ? "popIn 0.35s ease" : "none" }}>{myCode}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: codeCopied ? "var(--success)" : "var(--muted)", fontFamily: "'Source Sans 3', sans-serif", marginBottom: 18, minHeight: 16 }}>
            {codeCopied ? (<><CheckIcon size={13} /> Copied</>) : (<><CopyIcon size={13} /> Click the code to copy</>)}
          </div>
          <button
            onClick={() => { setCodeInput(""); setPersonalCodeInput(""); setAuthError(""); goToStage("login"); }}
            className="btn-shine"
            style={primaryBtnStyle}>
            <LoginIcon size={16} />Continue to sign in
          </button>
        </div>
      </Shell>
    );
  }

  if (authStage === "restoring") {
    return (
      <Shell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--muted-strong)", animation: "fadeIn 0.4s ease" }}>
          <LoaderIcon size={18} /><span>Signing you in…</span>
        </div>
      </Shell>
    );
  }

  if (authStage === "login") {
    return (
      <Shell>
        <div className="auth-card" style={authCardStyle} dir={appIsAr ? "rtl" : "ltr"}>
          <LanguageToggle isAr={appIsAr} onToggle={toggleAppLang} />
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
            <div className="auth-badge" style={authBadgeWrapStyle}>
              <BookIcon size={24} color="#fff" />
              <span style={{ position: "absolute", inset: -5, borderRadius: 19, border: "1.5px solid rgba(var(--focus-rgb),0.35)", animation: "pulseGlow 2.6s ease-in-out infinite" }} />
            </div>
            <div>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600, color: INK, margin: 0 }}>Two Tongues</h1>
              <div style={{ width: 34, height: 3, borderRadius: 2, background: "linear-gradient(90deg, var(--accent-1), var(--accent-2))", marginTop: 6, animation: "underlineGrow 0.6s ease 0.2s both" }} />
            </div>
          </div>
          <p style={{ fontFamily: "'Source Sans 3', sans-serif", color: "var(--muted-strong)", fontSize: 14, margin: "16px 0 22px" }}>
            {atr("Enter the shared access code and your personal code to open the dictionary.", "أدخل رمز الوصول المشترك ورمزك الشخصي لفتح القاموس.")}
          </p>
          <form onSubmit={handleLogin}>
            <div className="auth-field-1">
              <label style={labelStyle} htmlFor="login-personal-code"><KeyIcon size={13} style={{ marginInlineEnd: 5, verticalAlign: -2 }} />{atr("Personal code", "الرمز الشخصي")}</label>
              <input id="login-personal-code" value={personalCodeInput} onChange={(e) => setPersonalCodeInput(e.target.value)} placeholder={atr("The code you received", "الرمز الذي حصلت عليه")} style={authInputStyle} autoFocus autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} inputMode="numeric" />
            </div>
            <div className="auth-field-2">
              <label style={labelStyle} htmlFor="login-access-code"><KeyIcon size={13} style={{ marginInlineEnd: 5, verticalAlign: -2 }} />{atr("Access code", "رمز الوصول")}</label>
              <input id="login-access-code" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder={atr("Enter the shared code", "أدخل الرمز المشترك")} style={authInputStyle} autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} />
            </div>
            {authError && <div style={errorStyle} role="alert" aria-live="assertive">{translateAdminError(authError, appIsAr)}</div>}
            <button type="submit" disabled={loggingIn} className="btn-shine auth-field-3" style={primaryBtnStyle}>
              {loggingIn ? <LoaderIcon size={16} /> : <LoginIcon size={16} />} {atr("Enter", "دخول")}
            </button>
          </form>
          <p className="auth-field-3" style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: "var(--muted-strong)", textAlign: "center", marginTop: 18 }}>
            {atr("Don't have an account?", "ليس لديك حساب؟")}{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); setSignupError(""); goToStage("signup"); }} className="link-underline" style={{ color: BRASS, fontWeight: 600, textDecoration: "none" }}>
              {atr("Create one", "أنشئ حسابًا")}
            </a>
          </p>
        </div>
      </Shell>
    );
  }

  if (authStage !== "in" || !accountCode) {
    // Safety net: never render the authenticated app for a stage we didn't
    // explicitly handle above, and never render it without a real signed-in
    // account code — closes the same hole from any other direction.
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

  const availableLetters = useMemo(() => new Set(Object.keys(grouped)), [grouped]);
  const letterRefs = useRef({});
  function jumpTo(letter) { const el = letterRefs.current[letter]; if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }

  async function handleAdd(newEntry) {
    const next = [...entries, { ...newEntry, id: uid(), section, addedBy: accountCode, addedAt: Date.now() }];
    const logEntry = makeLogEntry("word_add", `${name} added "${newEntry.word}" (${cfg.shortLabel})`, name, accountCode);
    await persistEntries(next, logEntry);
    onCloseAdd();
  }
  async function handleDelete(id) {
    const target = entries.find((e) => e.id === id);
    const prevEntries = entries;
    const next = entries.filter((e) => e.id !== id);
    const logEntry = makeLogEntry("word_delete", `${name} deleted "${(target && target.word) || id}"`, name, accountCode);
    await persistEntries(next, logEntry);
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
      const newEntries = dataRows
        .filter((r) => r[0] && r[0].trim() && r[1] && r[1].trim())
        .map((r) => ({
          id: uid(), section,
          word: r[0].trim(), meaning: r[1].trim(), definition: (r[2] || "").trim(), example: "",
          synonyms: normalizePairs((r[3] || "").split(";").map((s) => s.trim()).filter(Boolean), cfg),
          antonyms: normalizePairs((r[4] || "").split(";").map((s) => s.trim()).filter(Boolean), cfg),
          addedBy: accountCode, addedAt: Date.now(),
        }));
      if (!newEntries.length) {
        showToast(tr(isAr, "No valid rows found in that file.", "الملف ده مفيهوش صفوف صالحة."));
        return;
      }
      const next = [...entries, ...newEntries];
      const logEntry = makeLogEntry("word_add", `${name} imported ${newEntries.length} word(s) via CSV (${cfg.shortLabel})`, name, accountCode);
      await persistEntries(next, logEntry);
      showToast(tr(isAr, `Imported ${newEntries.length} word(s).`, `تم استيراد ${newEntries.length} كلمة.`));
    } catch (err) {
      showToast(tr(isAr, "Couldn't read that CSV file.", "تعذر قراءة ملف الـ CSV ده."));
    } finally {
      setImporting(false);
    }
  }
  async function handleEdit(id, updates) {
    const target = entries.find((e) => e.id === id);
    const next = entries.map((e) =>
      e.id === id ? { ...e, ...updates, editedBy: accountCode, editedAt: Date.now() } : e
    );
    const wordChanged = target && updates.word && updates.word !== target.word;
    const logEntry = makeLogEntry(
      "word_edit",
      `${name} edited "${(target && target.word) || id}"${wordChanged ? ` → "${updates.word}"` : ""}`,
      name, accountCode
    );
    await persistEntries(next, logEntry);
    setEditingEntry(null);
  }

  return (
    <div dir={cfg.dir} style={{ minHeight: "100vh", background: PAPER, fontFamily: "'Source Sans 3', sans-serif" }}>
      <header style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.15)", background: PAPER, position: "sticky", top: 0, zIndex: 20 }}>
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
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="toolbar-anim" style={{ position: "relative", flex: "1 1 240px", animationDelay: "0.02s" }}>
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
                style={{ listStyle: "none", margin: "4px 0 0", padding: 4, position: "absolute", top: "100%", insetInlineStart: 0, insetInlineEnd: 0, background: CARD, border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 10, boxShadow: "0 10px 24px -10px rgba(0,0,0,0.3)", zIndex: 30, maxHeight: 260, overflowY: "auto" }}>
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
                style={{ margin: "4px 0 0", padding: 4, position: "absolute", top: "100%", insetInlineStart: 0, insetInlineEnd: 0, background: CARD, border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 10, boxShadow: "0 10px 24px -10px rgba(0,0,0,0.3)", zIndex: 30, maxHeight: 260, overflowY: "auto" }}>
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
            cfg.letters.filter((l) => grouped[l]).map((letter) => (
              <div key={letter} ref={(el) => (letterRefs.current[letter] = el)} style={{ marginBottom: 26 }}>
                <div style={{ fontFamily: section === "ar-ar" ? "'Amiri', serif" : "'Fraunces', serif", fontSize: 15, fontWeight: 700, color: cfg.accent, borderBottom: `1px solid ${cfg.accentSoft}`, paddingBottom: 4, marginBottom: 10 }}>
                  {letter}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {grouped[letter].map((e) => (
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
            ))
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

function EntryCard({ entry, cfg, isAdmin, isAr, canEdit, onDelete, onEdit, onOpenZoom, isStudied, onToggleStudied, isFavorite, onToggleFavorite, addedByLabel, editedByLabel }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [open, setOpen] = useState(false);
  const hasDefinition = !!entry.definition;
  const hasExample = !!entry.example || !!(entry.examples && entry.examples.length);
  const hasSynAnt = !!((entry.synonyms && entry.synonyms.length) || (entry.antonyms && entry.antonyms.length));
  const isEnglishWord = cfg.wordDir === "ltr";
  const isExpandable = isAdmin || hasDefinition || hasExample || hasSynAnt || isEnglishWord;
  return (
    <div className="lift-hover" style={{ background: CARD, border: "1px solid rgba(var(--border-rgb),0.1)", borderInlineStart: `3px solid ${isStudied ? "var(--success)" : cfg.accent}`, borderRadius: 3, padding: "9px 14px", display: "flex", justifyContent: "space-between", gap: 12, animation: "fadeInUp 0.35s ease both" }}>
      <div
        style={{ flex: 1, minWidth: 0, cursor: isExpandable ? "pointer" : "default" }}
        onClick={isExpandable ? () => setOpen((o) => !o) : undefined}
        role={isExpandable ? "button" : undefined}
        tabIndex={isExpandable ? 0 : undefined}
        aria-expanded={isExpandable ? open : undefined}
        onKeyDown={isExpandable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } } : undefined}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 15, fontWeight: 600, color: INK }}>{entry.word}</span>
          {isExpandable && (
            <ChevronIcon size={11} color={cfg.accent}
              style={{ flexShrink: 0, transition: "transform 0.15s", transform: `${cfg.dir === "rtl" ? "scaleX(-1) " : ""}${open ? "rotate(90deg)" : ""}` }} />
          )}
          <span dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: 14, color: "var(--meaning)" }}>{entry.meaning}</span>
          {!!entry.meaning && <SpeakButton text={entry.meaning} dir={cfg.meaningDir} isAr={isAr} size={13} />}
        </div>
        {(isStudied || isFavorite) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
            {isStudied && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "var(--success)", background: "var(--success-bg)", borderRadius: 3, padding: "2px 6px" }}>
                <CheckIcon size={9} /> {tr(isAr, "Studied", "تمت الدراسة")}
              </span>
            )}
            {isFavorite && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: BRASS, background: "var(--accent-1-soft)", borderRadius: 3, padding: "2px 6px" }}>
                <StarIcon size={9} fill={BRASS} /> {tr(isAr, "Favorite", "مفضلة")}
              </span>
            )}
          </div>
        )}
        {open && isExpandable && (
          <>
            {isEnglishWord && (
              <a
                href={cambridgeUrl(entry.word)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={tr(isAr, "Open in Cambridge Dictionary", "افتح في قاموس كامبريدج")}
                style={{ display: "inline-flex", alignItems: "center", marginTop: 6, background: "#1D2A57", borderRadius: 3, padding: "4px 8px" }}
                className="lift-hover">
                <img src="https://dictionary.cambridge.org/external/images/freesearch/sbl.png?version=6.0.78" alt={tr(isAr, "Cambridge Dictionary", "قاموس كامبريدج")} style={{ height: 18, display: "block" }} />
              </a>
            )}
            {hasDefinition && (
              <p dir={detectDir(entry.definition)} style={{ fontFamily: detectFont(entry.definition), fontSize: 13, color: "var(--muted-strong)", margin: "6px 0 0", lineHeight: 1.6 }}>{entry.definition}</p>
            )}
            {hasExample && (
              <p dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 13, fontStyle: "italic", color: "var(--muted)", margin: "6px 0 0", lineHeight: 1.6 }}>
                “{entry.example}”
              </p>
            )}
            {!!(entry.examples && entry.examples.length) && entry.examples.map((ex, i) => (
              <p key={i} dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 13, fontStyle: "italic", color: "var(--muted)", margin: "4px 0 0", lineHeight: 1.6 }}>
                “{ex}”
              </p>
            ))}
            {!!(entry.synonyms && entry.synonyms.length) && (
              <div style={{ fontSize: 12, color: "var(--muted-strong)", marginTop: 6 }}>
                <strong style={{ color: "var(--success)" }}>{tr(isAr, "Synonyms", "مرادفات")}</strong>
                <PairListDisplay cfg={cfg} pairs={entry.synonyms} />
              </div>
            )}
            {!!(entry.antonyms && entry.antonyms.length) && (
              <div style={{ fontSize: 12, color: "var(--muted-strong)", marginTop: 6 }}>
                <strong style={{ color: "var(--danger)" }}>{tr(isAr, "Antonyms", "مضادات")}</strong>
                <PairListDisplay cfg={cfg} pairs={entry.antonyms} />
              </div>
            )}
            {isAdmin && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                {tr(isAr, `added by ${addedByLabel}`, `أضافها ${addedByLabel}`)}
                {entry.editedBy && <span> · {tr(isAr, `edited by ${editedByLabel}`, `عدّلها ${editedByLabel}`)}</span>}
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0, alignSelf: "flex-start" }}>
        <SpeakButton text={entry.word} dir={cfg.wordDir} isAr={isAr} size={18} />
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          title={isFavorite ? tr(isAr, "Remove from favorites", "إزالة من المفضلة") : tr(isAr, "Add to favorites", "إضافة للمفضلة")}
          aria-label={isFavorite ? tr(isAr, `Remove ${entry.word} from favorites`, `إزالة ${entry.word} من المفضلة`) : tr(isAr, `Add ${entry.word} to favorites`, `إضافة ${entry.word} للمفضلة`)}
          aria-pressed={isFavorite}
          style={{ border: "none", background: "none", color: isFavorite ? BRASS : "var(--icon-muted)", padding: 4, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <StarIcon size={18} fill={isFavorite ? BRASS : "none"} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onOpenZoom(); }}
          title={tr(isAr, "Zoom", "تكبير")}
          aria-label={tr(isAr, `Zoom in on ${entry.word}`, `تكبير ${entry.word}`)}
          style={{ border: "none", background: "none", color: "var(--icon-muted)", padding: 4, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <ZoomIcon size={18} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleStudied(); }}
          title={isStudied ? tr(isAr, "Mark as not studied", "إلغاء وضع علامة الدراسة") : tr(isAr, "Mark as studied/seen", "وضع علامة كمدروسة")}
          aria-label={isStudied ? tr(isAr, `Mark ${entry.word} as not studied`, `إلغاء علامة الدراسة عن ${entry.word}`) : tr(isAr, `Mark ${entry.word} as studied`, `وضع علامة الدراسة على ${entry.word}`)}
          aria-pressed={isStudied}
          style={{ border: "none", background: "none", color: isStudied ? "var(--success)" : "var(--icon-muted)", padding: 4, cursor: "pointer", display: "flex", alignItems: "center" }}>
          {isStudied ? <EyeIcon size={22} /> : <EyeOffIcon size={22} />}
        </button>
        {canEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            title={tr(isAr, "Edit", "تعديل")} aria-label={tr(isAr, `Edit ${entry.word}`, `تعديل ${entry.word}`)}
            style={{ border: "none", background: "none", color: "var(--icon-muted)", padding: 4, cursor: "pointer", display: "flex", alignItems: "center" }}>
            <EditIcon size={16} />
          </button>
        )}
        {canEdit && (
          <button onClick={() => (confirmDel ? onDelete() : setConfirmDel(true))} onBlur={() => setConfirmDel(false)}
            title={confirmDel ? tr(isAr, "Click again to confirm", "اضغط مرة أخرى للتأكيد") : tr(isAr, "Delete", "حذف")}
            aria-label={confirmDel ? tr(isAr, `Confirm delete ${entry.word}`, `تأكيد حذف ${entry.word}`) : tr(isAr, `Delete ${entry.word}`, `حذف ${entry.word}`)}
            style={{ border: "none", background: confirmDel ? "var(--danger-border)" : "transparent", color: confirmDel ? "var(--danger)" : "var(--icon-muted)", borderRadius: 3, padding: 6, cursor: "pointer" }}>
            <TrashIcon size={14} />
          </button>
        )}
      </div>
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
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
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
function ReviewRow({ item, isAr }) {
  return (
    <div style={{ padding: "10px 12px", border: "1px solid rgba(var(--border-rgb),0.15)", borderRadius: 4, marginBottom: 8 }}>
      <div dir={item.wordDir} style={{ fontFamily: item.wordFont, fontSize: 16, fontWeight: 700, color: INK, marginBottom: 4 }}>
        {item.word}
      </div>
      <p style={{ fontSize: 13, color: "var(--muted-strong)", margin: 0 }}>
        {tr(isAr,
          `You said "${item.selectedAnswer}" — the correct one is "${item.correctAnswer}".`,
          `انت غلطت، قلت معناها "${item.selectedAnswer}"، وهي فعلاً "${item.correctAnswer}".`)}
      </p>
    </div>
  );
}

// Simple flip-card review mode: front shows the word, tap/click flips to
// the meaning + definition + example, then the user marks it "knew it" or
// "still learning" (which just moves it to the back of the deck to see
// again) before moving to the next card. Lighter-weight than the Quiz —
// no scoring, just quick repetition through the section's words.
function FlashcardsModal({ entries, cfg, sectionLabel, studiedIds, favoriteIds, onToggleStudied, isAr, onClose }) {
  const [filterKey, setFilterKey] = useState("all"); // all | studied | favorites
  const [deck, setDeck] = useState(null); // null = setup stage, array = running
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knewCount, setKnewCount] = useState(0);
  const [learningCount, setLearningCount] = useState(0);
  const [enterDir, setEnterDir] = useState(1); // 1 = next card enters from the "forward" side
  const [pulse, setPulse] = useState(null); // "knew" | "learning" | null — brief button feedback

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") { onClose(); return; }
      if (!deck) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped((f) => !f); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, deck]);

  const pool = useMemo(() => {
    if (filterKey === "studied") return entries.filter((e) => studiedIds.has(e.id));
    if (filterKey === "favorites") return entries.filter((e) => favoriteIds && favoriteIds.has(e.id));
    return entries;
  }, [entries, filterKey, studiedIds, favoriteIds]);

  function startDeck() {
    setDeck(shuffleArray(pool));
    setPos(0);
    setFlipped(false);
    setKnewCount(0);
    setLearningCount(0);
  }

  function advance(knew) {
    if (knew) setKnewCount((c) => c + 1); else setLearningCount((c) => c + 1);
    setPulse(knew ? "knew" : "learning");
    setTimeout(() => setPulse(null), 300);
    setEnterDir(1);
    if (pos + 1 >= deck.length) { setPos(deck.length); return; } // reached the summary screen
    setPos((p) => p + 1);
    setFlipped(false);
  }

  const current = deck && pos < deck.length ? deck[pos] : null;
  const isDone = deck && pos >= deck.length;

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card" dir={isAr ? "rtl" : "ltr"} role="dialog" aria-modal="true" aria-labelledby="flashcards-modal-title"
        style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", background: CARD, borderRadius: 4, padding: "24px 24px 22px", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 id="flashcards-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <LayersIcon size={19} color={BRASS} /> {tr(isAr, "Flashcards", "بطاقات تعليمية")}
            {sectionLabel && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>· {sectionLabel}</span>}
          </h2>
          <button onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)" }}><XIcon size={20} /></button>
        </div>

        {!deck && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontFamily: "'Source Sans 3', sans-serif", color: "var(--muted-strong)", fontSize: 14, margin: "0 0 14px" }}>
              {tr(isAr,
                "Flip through your words one at a time. Tap a card to reveal the meaning, then mark whether you knew it.",
                "قلّب على كلماتك واحدة واحدة. اضغط على البطاقة عشان تشوف المعنى، وبعدين حدد هل كنت عارفها ولا لسه.")}
            </p>
            <label style={labelStyle}>{tr(isAr, "Which words?", "أنهي كلمات؟")}</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              {[
                { key: "all", label: tr(isAr, "All words", "كل الكلمات") },
                { key: "studied", label: tr(isAr, "Studied only", "المدروسة بس") },
                { key: "favorites", label: tr(isAr, "Favorites only", "المفضلة بس") },
              ].map((opt) => (
                <button key={opt.key} type="button" onClick={() => setFilterKey(opt.key)}
                  style={{ padding: "7px 14px", fontSize: 13, fontWeight: 600, borderRadius: 20, cursor: "pointer", border: `1px solid ${filterKey === opt.key ? cfg.accent : "rgba(var(--border-rgb),0.25)"}`, background: filterKey === opt.key ? cfg.accentSoft : "none", color: filterKey === opt.key ? cfg.accent : "var(--muted-strong)" }}>
                  {opt.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 13, color: "var(--icon-muted)", margin: "0 0 16px" }}>
              {tr(isAr, `${pool.length} word(s) in this deck.`, `${pool.length} كلمة في المجموعة دي.`)}
            </p>
            <button type="button" onClick={startDeck} disabled={pool.length === 0} className="btn-shine"
              style={{ ...primaryBtnStyle, opacity: pool.length === 0 ? 0.5 : 1, cursor: pool.length === 0 ? "default" : "pointer" }}>
              <LayersIcon size={16} /> {tr(isAr, "Start reviewing", "ابدأ المراجعة")}
            </button>
          </div>
        )}

        {current && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: "var(--icon-muted)", marginBottom: 10, textAlign: "center" }}>
              {tr(isAr, `Card ${pos + 1} of ${deck.length}`, `بطاقة ${pos + 1} من ${deck.length}`)}
            </div>
            <div key={current.id} className="flashcard-scene flashcard-enter" style={{ "--flashcard-enter-x": `${enterDir * 24}px` }}>
              <div onClick={() => setFlipped((f) => !f)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFlipped((f) => !f); } }}
                className={`flashcard-flip${flipped ? " is-flipped" : ""}`}>
                <div className="flashcard-face" style={{ border: `1px solid ${cfg.accentSoft}`, background: "var(--input-bg)" }}>
                  <span dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 30, fontWeight: 700, color: INK }}>{current.word}</span>
                  <span style={{ fontSize: 11, color: "var(--icon-muted)", marginTop: 4 }}>{tr(isAr, "Tap to flip", "اضغط عشان تقلب")}</span>
                </div>
                <div className="flashcard-face flashcard-face-back" style={{ border: `1px solid ${cfg.accent}`, background: cfg.accentSoft }}>
                  <span dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: 22, fontWeight: 700, color: cfg.accent }}>{current.meaning}</span>
                  {current.definition && <span dir="rtl" style={{ fontFamily: "'Amiri', serif", fontSize: 14, color: "var(--muted-strong)" }}>{current.definition}</span>}
                  {current.example && <span dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 13, color: "var(--icon-muted)", fontStyle: "italic" }}>{current.example}</span>}
                  <span style={{ fontSize: 11, color: "var(--icon-muted)", marginTop: 4 }}>{tr(isAr, "Tap to flip back", "اضغط عشان ترجع")}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button type="button" onClick={() => advance(false)}
                className={pulse === "learning" ? "flashcard-choice-pop" : undefined}
                style={{ flex: 1, padding: "11px 0", fontSize: 14, fontWeight: 700, borderRadius: 10, cursor: "pointer", border: "1px solid var(--danger)", background: "none", color: "var(--danger)" }}>
                {tr(isAr, "Still learning", "لسه بتعلّمها")}
              </button>
              <button type="button" onClick={() => { if (onToggleStudied && !studiedIds.has(current.id)) onToggleStudied(current.id); advance(true); }}
                className={pulse === "knew" ? "flashcard-choice-pop" : undefined}
                style={{ flex: 1, padding: "11px 0", fontSize: 14, fontWeight: 700, borderRadius: 10, cursor: "pointer", border: "none", background: cfg.accent, color: "#fff" }}>
                {tr(isAr, "Knew it", "كنت عارفها")}
              </button>
            </div>
          </div>
        )}

        {isDone && (
          <div className="flashcard-enter" style={{ marginTop: 20, textAlign: "center" }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 700, color: INK, marginBottom: 6 }}>
              {knewCount} / {deck.length}
            </div>
            <p style={{ fontSize: 14, color: "var(--muted-strong)", marginBottom: 18 }}>
              {tr(isAr, `You knew ${knewCount} and are still learning ${learningCount}.`, `كنت عارف ${knewCount} ولسه بتتعلّم ${learningCount}.`)}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button type="button" onClick={startDeck} className="btn-shine" style={{ ...primaryBtnStyle, width: "auto", padding: "11px 22px" }}>
                {tr(isAr, "Review again", "راجع تاني")}
              </button>
              <button type="button" onClick={() => setDeck(null)}
                style={{ padding: "11px 22px", fontSize: 14, fontWeight: 700, borderRadius: 10, cursor: "pointer", border: "1px solid rgba(var(--border-rgb),0.25)", background: "none", color: INK }}>
                {tr(isAr, "Change selection", "غيّر الاختيار")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QuizModal({ entries, sectionLabel, studiedIds, studiedAt, srsDueAt, sessionStart, isAr, onClose, onRecordSrsAnswer, onSaveQuizResult }) {
  const [rangeKey, setRangeKey] = useState("60");
  const [customMinutes, setCustomMinutes] = useState("120");
  const [mode, setMode] = useState("mcq"); // mcq | typing
  const [dueOnly, setDueOnly] = useState(false);
  const [stage, setStage] = useState("setup"); // setup | running | done
  const [startError, setStartError] = useState("");
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState([]);
  const [startedAt, setStartedAt] = useState(null);
  const [finishedAt, setFinishedAt] = useState(null);
  const [typedAnswer, setTypedAnswer] = useState("");

  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const RANGE_OPTIONS = [
    { key: "10", label: tr(isAr, "Last 10 min", "آخر 10 دقايق") },
    { key: "30", label: tr(isAr, "Last 30 min", "آخر 30 دقيقة") },
    { key: "60", label: tr(isAr, "Last hour", "آخر ساعة") },
    { key: "180", label: tr(isAr, "Last 3 hours", "آخر 3 ساعات") },
    { key: "1440", label: tr(isAr, "Last 24 hours", "آخر 24 ساعة") },
    { key: "today", label: tr(isAr, "Today", "اليوم") },
    { key: "session", label: tr(isAr, "This session", "هذه الجلسة") },
    { key: "all", label: tr(isAr, "Any time", "أي وقت") },
    { key: "custom", label: tr(isAr, "Custom", "مخصص") },
  ];

  const rangeStart = useMemo(() => quizRangeStart(rangeKey, customMinutes, sessionStart), [rangeKey, customMinutes, sessionStart]);
  const matchingEntries = useMemo(() => {
    const base = selectQuizEntries(entries, studiedIds, studiedAt, rangeStart);
    return dueOnly ? base.filter((e) => isSrsDue(e.id, srsDueAt)) : base;
  }, [entries, studiedIds, studiedAt, rangeStart, dueOnly, srsDueAt]);

  function startQuiz() {
    const built = buildQuiz(matchingEntries, entries, mode);
    if (!built.length) {
      setStartError(tr(isAr,
        "Not enough words yet to build a quiz from this selection — add a few more words to the dictionary or pick a wider time range.",
        "لا توجد كلمات كافية لعمل اختبار من هذا الاختيار — أضف كلمات أكتر للقاموس أو اختر نطاق وقت أوسع."));
      return;
    }
    setStartError("");
    setQuestions(built);
    setIndex(0);
    setSelected(null);
    setAnswered(false);
    setResults([]);
    setStartedAt(Date.now());
    setFinishedAt(null);
    setTypedAnswer("");
    setStage("running");
  }

  function recordAnswer(q, opt, correct) {
    setSelected(opt);
    setAnswered(true);
    setResults((r) => [...r, {
      id: q.id, correct, type: q.type,
      word: q.word, wordDir: q.wordDir, wordFont: q.wordFont,
      selectedAnswer: opt, correctAnswer: q.correct,
    }]);
    // Feed this word's result into its spaced-repetition schedule. Fire
    // and forget — the quiz UI doesn't need to wait on the save.
    if (onRecordSrsAnswer) onRecordSrsAnswer(q.entryId, correct);
  }

  function pickOption(opt) {
    if (answered) return;
    const q = questions[index];
    recordAnswer(q, opt, opt === q.correct);
  }

  // Typing mode: compares the typed text to every accepted answer for
  // this question (see isTypingCorrect) — ignoring case, whitespace, and
  // Arabic tashkeel, and tolerating small typos. For synonym/antonym
  // questions this means ANY valid synonym/antonym from the word's list
  // counts, not just the one specific string the quiz happened to pick.
  function submitTyped() {
    if (answered) return;
    const q = questions[index];
    const accepted = q.acceptedAnswers && q.acceptedAnswers.length ? q.acceptedAnswers : [q.correct];
    const isCorrect = isTypingCorrect(typedAnswer, accepted);
    recordAnswer(q, typedAnswer, isCorrect);
  }

  function nextQuestion() {
    if (index + 1 >= questions.length) {
      const finishedTime = Date.now();
      setFinishedAt(finishedTime);
      setStage("done");
      if (onSaveQuizResult) {
        const finalScore = results.filter((r) => r.correct).length;
        onSaveQuizResult({
          id: uid(), at: finishedTime, section: sectionLabel || "", mode,
          score: finalScore, total: results.length,
          durationMs: startedAt ? finishedTime - startedAt : 0,
        });
      }
    } else {
      setIndex((i) => i + 1);
      setSelected(null);
      setAnswered(false);
      setTypedAnswer("");
    }
  }

  function retake() {
    setStage("setup");
    setStartError("");
  }

  const score = results.filter((r) => r.correct).length;
  const quizDurationMs = startedAt && finishedAt ? finishedAt - startedAt : 0;

  // Every wrong question, grouped into the three review sections. Unlike a
  // simple word list, a word can appear more than once here (e.g. wrong on
  // two different synonyms of the same word) since each mistake has its
  // own correct answer to compare against.
  const mistakesByCategory = useMemo(() => {
    const map = { meaning: [], synonym: [], antonym: [] };
    for (const r of results) {
      if (r.correct) continue;
      map[quizResultCategory(r.type)].push(r);
    }
    return map;
  }, [results]);

  // Flat list of every mistake — meaning first, then synonyms, then
  // antonyms — all shown at once in the review.
  const mistakesFlat = useMemo(
    () => [...mistakesByCategory.meaning, ...mistakesByCategory.synonym, ...mistakesByCategory.antonym],
    [mistakesByCategory]
  );

  const chipStyle = (active) => ({
    padding: "7px 13px", fontSize: 12.5, fontWeight: 600, color: active ? "#fff" : "var(--icon-muted)",
    background: active ? BRASS : "none", border: `1px solid ${active ? BRASS : "rgba(var(--border-rgb),0.25)"}`,
    borderRadius: 20, cursor: "pointer",
  });

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card" dir={isAr ? "rtl" : "ltr"} role="dialog" aria-modal="true" aria-labelledby="quiz-modal-title"
        style={{ width: "100%", maxWidth: 540, maxHeight: "88vh", overflowY: "auto", background: CARD, borderRadius: 4, padding: "24px 24px 22px", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 id="quiz-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <QuizIcon size={19} color={BRASS} /> {tr(isAr, "Quiz", "اختبار")}
            {sectionLabel && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>· {sectionLabel}</span>}
          </h2>
          <button onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)" }}><XIcon size={20} /></button>
        </div>

        {stage === "setup" && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontFamily: "'Source Sans 3', sans-serif", color: "var(--muted-strong)", fontSize: 14, margin: "0 0 14px" }}>
              {tr(isAr,
                "Pick which studied words to be tested on. The quiz mixes meaning, definition, fill-in-the-blank (when a word has an example sentence), and synonyms/antonyms for any word that has them — so it's not just rote memorization.",
                "اختر الكلمات التي تمت دراستها والتي عايز تختبر فيها. الاختبار بيخلط بين المعنى والتعريف وإكمال الفراغ (لو الكلمة ليها جملة مثال) والمرادفات/المضادات لأي كلمة ليها — مش مجرد حفظ.")}
            </p>
            <label style={labelStyle}>{tr(isAr, "Studied within", "تمت دراستها خلال")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 4 }}>
              {RANGE_OPTIONS.map((o) => (
                <button key={o.key} type="button" onClick={() => { setRangeKey(o.key); setStartError(""); }} style={chipStyle(rangeKey === o.key)}>
                  {o.label}
                </button>
              ))}
            </div>
            {rangeKey === "custom" && (
              <>
                <label style={labelStyle} htmlFor="quiz-custom-minutes">{tr(isAr, "Minutes", "عدد الدقائق")}</label>
                <input id="quiz-custom-minutes" type="number" min="1" max="10080" value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)} style={{ ...inputStyle, maxWidth: 140 }} inputMode="numeric" />
              </>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16, fontSize: 13, color: "var(--muted-strong)" }}>
              <EyeIcon size={14} color="var(--success)" />
              {tr(isAr,
                `${matchingEntries.length} studied word${matchingEntries.length === 1 ? "" : "s"} match this range.`,
                `${matchingEntries.length} كلمة متاحة من الكلمات المدروسة في هذا النطاق.`)}
            </div>
            <label style={{ ...labelStyle, marginTop: 16 }}>{tr(isAr, "Question type", "نوع الأسئلة")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 4 }}>
              <button type="button" onClick={() => setMode("mcq")} style={chipStyle(mode === "mcq")}>
                {tr(isAr, "Multiple choice", "اختيار من متعدد")}
              </button>
              <button type="button" onClick={() => setMode("typing")} style={chipStyle(mode === "typing")}>
                {tr(isAr, "Type the answer", "اكتب الإجابة")}
              </button>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13.5, color: "var(--muted-strong)", cursor: "pointer" }}>
              <input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} />
              {tr(isAr, "Only words due for review (spaced repetition)", "الكلمات المستحقة للمراجعة فقط (التكرار المتباعد)")}
            </label>
            {startError && <div style={errorStyle} role="alert" aria-live="assertive">{startError}</div>}
            <button type="button" onClick={startQuiz} disabled={matchingEntries.length === 0} style={{ ...primaryBtnStyle, opacity: matchingEntries.length === 0 ? 0.5 : 1, cursor: matchingEntries.length === 0 ? "default" : "pointer" }}>
              <QuizIcon size={16} /> {tr(isAr, "Start quiz", "ابدأ الاختبار")}
            </button>
          </div>
        )}

        {stage === "running" && questions[index] && (() => {
          const q = questions[index];
          return (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                <span>{tr(isAr, `Question ${index + 1} of ${questions.length}`, `السؤال ${index + 1} من ${questions.length}`)}</span>
                <span>{tr(isAr, `Score: ${score}`, `النتيجة: ${score}`)}</span>
              </div>
              <div style={{ width: "100%", height: 4, background: "var(--input-bg)", borderRadius: 2, marginBottom: 18 }}>
                <div style={{ width: `${((index) / questions.length) * 100}%`, height: "100%", background: BRASS, borderRadius: 2, transition: "width 0.2s" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 8px" }}>
                <p style={{ fontSize: 21, fontWeight: 700, color: "var(--muted-strong)", margin: 0 }}>{quizQuestionLabel(q.type, isAr)}</p>
                <SpeakButton text={quizQuestionLabel(q.type, isAr)} dir={isAr ? "rtl" : "ltr"} isAr={isAr} size={16}
                  style={{ flexShrink: 0 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--input-bg)", borderRadius: 4, padding: "20px 16px", marginBottom: 16 }}>
                <div dir={q.promptDir} style={{ flex: 1, minWidth: 0, fontFamily: q.promptFont, fontSize: "clamp(26px, 4.2vw, 34px)", fontWeight: 700, color: INK, wordBreak: "break-word", lineHeight: 1.3 }}>
                  {q.promptText}
                </div>
                {q.promptText && (
                  <SpeakButton text={q.promptText} dir={q.promptDir} isAr={isAr} size={22}
                    style={{ flexShrink: 0, background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.25)", borderRadius: "50%", width: 38, height: 38, justifyContent: "center", color: BRASS }} />
                )}
              </div>
              {mode === "mcq" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {q.options.map((opt, i) => {
                    const isCorrectOpt = opt === q.correct;
                    const isSelectedOpt = opt === selected;
                    let bg = "var(--card)", border = "rgba(var(--border-rgb),0.2)", color = INK;
                    if (answered && isCorrectOpt) { bg = "var(--success-bg)"; border = "var(--success)"; color = "var(--success)"; }
                    else if (answered && isSelectedOpt && !isCorrectOpt) { bg = "var(--danger-bg)"; border = "var(--danger-border)"; color = "var(--danger)"; }
                    return (
                      <button key={i} type="button" onClick={() => pickOption(opt)} disabled={answered}
                        dir={q.optionDir}
                        style={{ textAlign: "start", fontFamily: q.optionFont, fontSize: 16, padding: "12px 14px", background: bg, border: `1.5px solid ${border}`, color, borderRadius: 4, cursor: answered ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span>{opt}</span>
                        {answered && isCorrectOpt && <CheckIcon size={16} />}
                        {answered && isSelectedOpt && !isCorrectOpt && <XIcon size={16} />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                // Typing mode: one free-text input, checked on submit (or
                // Enter) against the correct answer, case/diacritic-insensitive.
                <div>
                  <input
                    type="text"
                    dir={q.optionDir}
                    autoFocus
                    disabled={answered}
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); answered ? nextQuestion() : submitTyped(); } }}
                    placeholder={tr(isAr, "Type your answer…", "اكتب إجابتك…")}
                    style={{ ...inputStyle, fontFamily: q.optionFont, fontSize: 17,
                      borderColor: answered ? (results[results.length - 1]?.correct ? "var(--success)" : "var(--danger-border)") : undefined }}
                  />
                  {!answered && (
                    <button type="button" onClick={submitTyped} disabled={!typedAnswer.trim()} style={{ ...primaryBtnStyle, opacity: typedAnswer.trim() ? 1 : 0.5, cursor: typedAnswer.trim() ? "pointer" : "default" }}>
                      {tr(isAr, "Check answer", "تحقق من الإجابة")}
                    </button>
                  )}
                  {answered && (
                    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 4, fontSize: 14,
                      background: results[results.length - 1]?.correct ? "var(--success-bg)" : "var(--danger-bg)",
                      color: results[results.length - 1]?.correct ? "var(--success)" : "var(--danger)" }}>
                      {results[results.length - 1]?.correct
                        ? tr(isAr, "Correct!", "إجابة صحيحة!")
                        : tr(isAr, `Not quite — the answer is "${q.correct}".`, `مش صح — الإجابة الصح هي "${q.correct}".`)}
                    </div>
                  )}
                </div>
              )}
              {answered && (
                <button type="button" onClick={nextQuestion} style={primaryBtnStyle}>
                  {index + 1 >= questions.length ? tr(isAr, "See results", "عرض النتيجة") : tr(isAr, "Next question", "السؤال التالي")}
                </button>
              )}
            </div>
          );
        })()}

        {stage === "done" && (() => {
          return (
            <div style={{ marginTop: 14 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, color: INK, margin: "10px 0 4px" }}>
                  {score} / {questions.length}
                </p>
                <p style={{ fontSize: 14, color: "var(--muted-strong)", margin: "0 0 6px" }}>
                  {tr(isAr,
                    `You got ${score} out of ${questions.length} right (${Math.round((score / questions.length) * 100)}%).`,
                    `أجبت صح على ${score} من ${questions.length} (${Math.round((score / questions.length) * 100)}%).`)}
                </p>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 18px" }}>
                  {tr(isAr, `Time taken: ${formatQuizDuration(quizDurationMs)}`, `الوقت المستغرق لإنهاء الاختبار: ${formatQuizDuration(quizDurationMs)}`)}
                </p>
              </div>

              {mistakesFlat.length > 0 ? (
                <div style={{ textAlign: "start", marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: INK, margin: "0 0 10px" }}>
                    {tr(isAr, "Words to review", "كلمات للمراجعة")}
                  </p>
                  {QUIZ_RESULT_CATEGORIES.map((cat) => {
                    const items = mistakesByCategory[cat.key];
                    if (!items.length) return null;
                    return (
                      <div key={cat.key} style={{ marginBottom: 14 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-strong)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 6px" }}>
                          {tr(isAr, cat.label, cat.labelAr)}
                        </p>
                        {items.map((item) => (
                          <ReviewRow key={item.id} item={item} isAr={isAr} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ textAlign: "center", fontSize: 14, color: "var(--success)", margin: "0 0 18px" }}>
                  {tr(isAr, "Perfect score — nothing to review!", "علامة كاملة — مفيش حاجة للمراجعة!")}
                </p>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={retake} style={{ flex: 1, padding: "11px 14px", fontSize: 14, fontWeight: 600, color: "var(--icon-muted)", background: "none", border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 3, cursor: "pointer" }}>
                  {tr(isAr, "New quiz", "اختبار جديد")}
                </button>
                <button type="button" onClick={onClose} style={{ ...primaryBtnStyle, marginTop: 0, flex: 1 }}>
                  <CheckIcon size={16} /> {tr(isAr, "Done", "تم")}
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* =========================================================================
   STATS PANEL
   -------------------------------------------------------------------------
   Read-only summary for the signed-in account, scoped to the dictionary
   section it was opened from: overall progress, a spaced-repetition
   breakdown (new/learning/familiar/mastered + how many are due right
   now), a short "needs work" list, a day streak, and recent quiz scores.
   Pulls only from data that's already loaded client-side — no extra
   network calls.
   ========================================================================= */
function dateKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Consecutive days up to and including today that have at least one
// "studied" timestamp. A gap of a full day breaks the streak.
function computeStreak(studiedAt) {
  const days = new Set(Object.values(studiedAt || {}).map((t) => dateKey(t)));
  let streak = 0;
  let cursor = Date.now();
  // Today doesn't have to have activity yet for the streak to still count
  // up to yesterday — but if today's missing we start checking from
  // yesterday instead of breaking immediately on day 0.
  if (!days.has(dateKey(cursor))) cursor -= 24 * 60 * 60 * 1000;
  while (days.has(dateKey(cursor))) {
    streak += 1;
    cursor -= 24 * 60 * 60 * 1000;
  }
  return streak;
}

// Formats a future timestamp as a short relative label ("in 2 days",
// "in 3 hours"), or "Due now" if it's already passed. Used for the Stats
// panel's "upcoming reviews" list.
function formatDueIn(ms, isAr) {
  const diff = ms - Date.now();
  if (diff <= 0) return tr(isAr, "Due now", "مستحقة الآن");
  const mins = Math.round(diff / 60000);
  if (mins < 60) return tr(isAr, `in ${mins} min`, `بعد ${mins} دقيقة`);
  const hours = Math.round(diff / 3600000);
  if (hours < 24) return tr(isAr, `in ${hours} hr`, `بعد ${hours} ساعة`);
  const days = Math.round(diff / 86400000);
  return tr(isAr, `in ${days} day${days === 1 ? "" : "s"}`, `بعد ${days} يوم`);
}

function StatsModal({ entries, sectionLabel, studiedIds, studiedAt, srsBox, srsDueAt, quizHistory, isAr, cfg, onClose }) {
  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const studiedEntries = useMemo(() => entries.filter((e) => studiedIds.has(e.id)), [entries, studiedIds]);
  const total = entries.length;
  const studiedCount = studiedEntries.length;
  const pct = total ? Math.round((studiedCount / total) * 100) : 0;

  const boxCounts = useMemo(() => {
    const counts = [0, 0, 0, 0];
    for (const e of studiedEntries) {
      const box = (srsBox && srsBox[e.id]) || 0;
      counts[box] += 1;
    }
    return counts;
  }, [studiedEntries, srsBox]);

  const dueCount = useMemo(() => studiedEntries.filter((e) => isSrsDue(e.id, srsDueAt)).length, [studiedEntries, srsDueAt]);

  // "Needs work" — studied words still in box 0/1, oldest-studied first
  // (the ones sitting around the longest without being solidified).
  const weakWords = useMemo(() => {
    return studiedEntries
      .filter((e) => ((srsBox && srsBox[e.id]) || 0) <= 1)
      .sort((a, b) => (studiedAt[a.id] || 0) - (studiedAt[b.id] || 0))
      .slice(0, 8);
  }, [studiedEntries, srsBox, studiedAt]);

  const streak = useMemo(() => computeStreak(studiedAt), [studiedAt]);

  // Only words that have an actual scheduled due date (i.e. have been
  // quizzed at least once) — sorted soonest-first, closest 8 shown.
  const upcomingReviews = useMemo(() => {
    return studiedEntries
      .filter((e) => typeof (srsDueAt && srsDueAt[e.id]) === "number")
      .sort((a, b) => srsDueAt[a.id] - srsDueAt[b.id])
      .slice(0, 8);
  }, [studiedEntries, srsDueAt]);

  const recentQuizzes = useMemo(() => [...(quizHistory || [])].reverse().slice(0, 5), [quizHistory]);

  const statCardStyle = { flex: "1 1 120px", background: "var(--input-bg)", borderRadius: 6, padding: "12px 14px", textAlign: "center" };

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card" dir={isAr ? "rtl" : "ltr"} role="dialog" aria-modal="true" aria-labelledby="stats-modal-title"
        style={{ width: "100%", maxWidth: 540, maxHeight: "88vh", overflowY: "auto", background: CARD, borderRadius: 4, padding: "24px 24px 22px", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 id="stats-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <StatsIcon size={19} color={BRASS} /> {tr(isAr, "Your stats", "إحصائياتي")}
            {sectionLabel && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>· {sectionLabel}</span>}
          </h2>
          <button onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)" }}><XIcon size={20} /></button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <div style={statCardStyle}>
            <div style={{ fontSize: 24, fontWeight: 700, color: cfg.accent }}>{pct}%</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{tr(isAr, `${studiedCount} of ${total} words`, `${studiedCount} من ${total} كلمة`)}</div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--success)" }}>{boxCounts[3]}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{tr(isAr, "Mastered", "متقنة")}</div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--danger)" }}>{dueCount}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{tr(isAr, "Due for review", "مستحقة للمراجعة")}</div>
          </div>
          <div style={{ ...statCardStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 24, fontWeight: 700, color: BRASS }}>
              <FlameIcon size={20} color={BRASS} /> {streak}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{tr(isAr, "day streak", "يوم متتالي")}</div>
          </div>
        </div>

        <label style={{ ...labelStyle, marginTop: 20 }}>{tr(isAr, "Learning progress", "مستوى التعلّم")}</label>
        <div style={{ display: "flex", height: 10, borderRadius: 20, overflow: "hidden", marginTop: 6 }}>
          {["#c9c9c9", "#e0b04a", "#7fa8d9", "var(--success)"].map((color, i) => (
            studiedCount > 0 && boxCounts[i] > 0 ? (
              <div key={i} title={tr(isAr, SRS_BOX_LABELS[i].en, SRS_BOX_LABELS[i].ar)} style={{ width: `${(boxCounts[i] / studiedCount) * 100}%`, background: color }} />
            ) : null
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
          {SRS_BOX_LABELS.map((l, i) => (
            <span key={i}>{tr(isAr, l.en, l.ar)}: {boxCounts[i]}</span>
          ))}
        </div>

        {weakWords.length > 0 && (
          <>
            <label style={{ ...labelStyle, marginTop: 20 }}>{tr(isAr, "Needs work", "محتاجة مراجعة")}</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {weakWords.map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "var(--input-bg)", borderRadius: 4 }}>
                  <span dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 14, fontWeight: 600, color: INK }}>{e.word}</span>
                  <span dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: 13, color: "var(--muted)" }}>{e.meaning}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {upcomingReviews.length > 0 && (
          <>
            <label style={{ ...labelStyle, marginTop: 20 }}>{tr(isAr, "Upcoming reviews", "موعد المراجعة الجاية")}</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {upcomingReviews.map((e) => {
                const due = srsDueAt[e.id];
                const isDueNow = due <= Date.now();
                return (
                  <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "var(--input-bg)", borderRadius: 4 }}>
                    <span dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 14, fontWeight: 600, color: INK }}>{e.word}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: isDueNow ? "var(--danger)" : "var(--muted)" }}>{formatDueIn(due, isAr)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {recentQuizzes.length > 0 && (
          <>
            <label style={{ ...labelStyle, marginTop: 20 }}>{tr(isAr, "Recent quizzes", "آخر الاختبارات")}</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {recentQuizzes.map((q) => (
                <div key={q.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "var(--input-bg)", borderRadius: 4, fontSize: 13 }}>
                  <span style={{ color: "var(--muted)" }}>{new Date(q.at).toLocaleString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  <span style={{ fontWeight: 700, color: q.total && q.score / q.total >= 0.7 ? "var(--success)" : INK }}>{q.score}/{q.total}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {studiedCount === 0 && (
          <p style={{ marginTop: 20, fontSize: 14, color: "var(--muted)", textAlign: "center" }}>
            {tr(isAr, "Mark some words as studied to start seeing stats here.", "علّم بعض الكلمات كمدروسة عشان تبدأ تشوف إحصائياتك هنا.")}
          </p>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   LEADERBOARD
   -------------------------------------------------------------------------
   Ranks every account by how many of the CURRENT section's words they've
   studied, with average quiz score as a tie-breaker/secondary stat. Reads
   only from data already loaded (accounts + sectionEntries) — no new
   network calls or stored fields.
   ========================================================================= */
function LeaderboardModal({ accounts, sectionEntries, accountCode, sectionLabel, isAr, cfg, onClose }) {
  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const sectionIds = useMemo(() => new Set(sectionEntries.map((e) => e.id)), [sectionEntries]);

  const ranked = useMemo(() => {
    const rows = accounts.map((a) => {
      const studiedHere = ((a.studied) || []).filter((id) => sectionIds.has(id)).length;
      const srsStats = a.srsStats || {};
      // "studiedHere" is just a self-toggled flag — someone can mark a word
      // as studied without ever actually being quizzed on it. So ranking
      // uses quiz-verified progress instead: a word only counts once the
      // account has answered questions on it in the Quiz and reached at
      // least the "Familiar" accuracy level (see srsLevelFromStats).
      let verifiedHere = 0;
      let masteredHere = 0;
      for (const id of sectionIds) {
        const level = srsLevelFromStats(srsStats[id]);
        if (level >= 2) verifiedHere++;
        if (level === 3) masteredHere++;
      }
      const history = a.quizHistory || [];
      const totalScore = history.reduce((sum, h) => sum + (h.score || 0), 0);
      const totalQuestions = history.reduce((sum, h) => sum + (h.total || 0), 0);
      const avgPct = totalQuestions ? Math.round((totalScore / totalQuestions) * 100) : null;
      return { code: a.code, name: a.name, studiedHere, verifiedHere, masteredHere, avgPct, quizCount: history.length };
    });
    return rows
      .filter((r) => r.verifiedHere > 0 || r.quizCount > 0)
      .sort((a, b) => b.verifiedHere - a.verifiedHere || b.masteredHere - a.masteredHere || (b.avgPct || 0) - (a.avgPct || 0));
  }, [accounts, sectionIds]);

  const medalColors = ["#d4af37", "#a8a8a8", "#c98a4b"];

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card" dir={isAr ? "rtl" : "ltr"} role="dialog" aria-modal="true" aria-labelledby="leaderboard-modal-title"
        style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", background: CARD, borderRadius: 4, padding: "24px 24px 22px", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 id="leaderboard-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <TrophyIcon size={19} color={BRASS} /> {tr(isAr, "Leaderboard", "الترتيب")}
            {sectionLabel && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>· {sectionLabel}</span>}
          </h2>
          <button onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)" }}><XIcon size={20} /></button>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "10px 0 16px" }}>
          {tr(isAr, "Ranked by words verified through the Quiz (not just marked \"studied\"); average quiz score and mastered words break ties.", "الترتيب حسب الكلمات اللي اتأكدت فعليًا عن طريق الاختبار (مش بس اللي اتعلّمت عليها \"درستها\")؛ متوسط نتيجة الاختبارات وعدد الكلمات المتقنة بيفصلوا التعادل.")}
        </p>
        {ranked.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--muted)", textAlign: "center", marginTop: 20 }}>
            {tr(isAr, "No one has been quizzed on any words here yet — take a quiz to be the first!", "محدش اتاختبر في أي كلمة هنا لسه — خد اختبار عشان تكون أول واحد!")}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ranked.map((r, i) => {
              const isMe = r.code === accountCode;
              return (
                <div key={r.code} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 6,
                  background: isMe ? cfg.accentSoft : "var(--input-bg)",
                  border: isMe ? `1px solid ${cfg.accent}` : "1px solid transparent",
                }}>
                  <div style={{ width: 26, textAlign: "center", fontSize: 14, fontWeight: 700, color: i < 3 ? medalColors[i] : "var(--muted)" }}>
                    {i < 3 ? <TrophyIcon size={16} color={medalColors[i]} /> : `#${i + 1}`}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.name} {isMe && <span style={{ fontSize: 11, fontWeight: 600, color: cfg.accent }}>({tr(isAr, "you", "انت")})</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {tr(isAr, `${r.masteredHere} mastered`, `${r.masteredHere} متقنة`)}
                      {r.avgPct !== null && ` · ${tr(isAr, `Avg quiz score: ${r.avgPct}%`, `متوسط الاختبارات: ${r.avgPct}%`)}`}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: cfg.accent }}>{r.verifiedHere}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   STUDY REMINDER
   -------------------------------------------------------------------------
   A small dismissible banner shown when the signed-in account hasn't
   studied anything (in ANY section) in over a day. Also offers to turn on
   browser notifications for a nudge next time the app is opened after a
   gap — this is a soft, in-app reminder (fired when the page loads), NOT
   a true background/push notification while the site is closed, since
   that needs a service worker + push server this project doesn't have.
   Preferences are stored in localStorage, same pattern as the personal
   login code.
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

function AddModal({ cfg, onClose, onSubmit, initialEntry }) {
  const isAr = cfg.dir === "rtl";
  const isEdit = !!initialEntry;
  const [word, setWord] = useState(isEdit ? initialEntry.word : "");
  const [meaning, setMeaning] = useState(isEdit ? initialEntry.meaning : "");
  const [definition, setDefinition] = useState(isEdit ? (initialEntry.definition || "") : "");
  const [example, setExample] = useState(isEdit ? (initialEntry.example || "") : "");
  const [extraExamples, setExtraExamples] = useState(isEdit && initialEntry.examples ? initialEntry.examples : []);
  const [synonyms, setSynonyms] = useState(isEdit ? normalizePairs(initialEntry.synonyms, cfg) : []);
  const [antonyms, setAntonyms] = useState(isEdit ? normalizePairs(initialEntry.antonyms, cfg) : []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function cleanPairs(list) {
    return list
      .map((p) => ({ id: p.id, word: p.word.trim(), meaning: p.meaning.trim() }))
      .filter((p) => p.word || p.meaning);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!word.trim() || !meaning.trim()) { setError(tr(isAr, "Word and meaning are both required.", "الكلمة والمعنى مطلوبان.")); return; }
    setSaving(true);
    await onSubmit({
      word: word.trim(), meaning: meaning.trim(), definition: definition.trim(), example: example.trim(),
      examples: extraExamples.map((ex) => ex.trim()).filter(Boolean),
      synonyms: cleanPairs(synonyms), antonyms: cleanPairs(antonyms),
    });
    setSaving(false);
  }

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card" dir={cfg.dir} role="dialog" aria-modal="true" aria-labelledby="add-modal-title" style={{ width: "100%", maxWidth: 440, background: CARD, borderRadius: 4, padding: "24px 24px 22px", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 id="add-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0 }}>{isEdit ? tr(isAr, "Edit word", "تعديل الكلمة") : tr(isAr, `Add to ${cfg.label}`, `إضافة إلى ${cfg.label}`)}</h2>
          <button onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)" }}><XIcon size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          <label style={labelStyle} htmlFor="add-word">{tr(isAr, "Word *", "الكلمة *")}</label>
          <input id="add-word" value={word} onChange={(e) => setWord(e.target.value)} placeholder={cfg.wordPlaceholder} dir={cfg.wordDir} style={{ ...inputStyle, fontFamily: cfg.wordFont, fontSize: 16 }} autoFocus />
          <label style={labelStyle} htmlFor="add-meaning">{tr(isAr, "Meaning *", "المعنى *")}</label>
          <input id="add-meaning" value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder={cfg.meaningPlaceholder} dir={cfg.meaningDir} style={{ ...inputStyle, fontFamily: cfg.meaningFont, fontSize: 16 }} />
          <label style={labelStyle} htmlFor="add-definition">{tr(isAr, "Definition (optional)", "تعريف (اختياري)")}</label>
          <textarea id="add-definition" value={definition} onChange={(e) => setDefinition(e.target.value)} placeholder="شرح إضافي أو مثال" dir="rtl" rows={3} style={{ ...inputStyle, fontFamily: "'Amiri', serif", fontSize: 15, resize: "vertical" }} />
          <label style={labelStyle} htmlFor="add-example">{tr(isAr, "Example sentence (optional)", "جملة توضيحية (اختياري)")}</label>
          <textarea id="add-example" value={example} onChange={(e) => setExample(e.target.value)} placeholder={cfg.wordPlaceholder} dir={cfg.wordDir} rows={2} style={{ ...inputStyle, fontFamily: cfg.wordFont, fontSize: 15, resize: "vertical" }} />
          {extraExamples.map((ex, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <textarea value={ex} dir={cfg.wordDir} rows={2}
                onChange={(e) => setExtraExamples((list) => list.map((v, idx) => (idx === i ? e.target.value : v)))}
                placeholder={cfg.wordPlaceholder}
                style={{ ...inputStyle, flex: 1, fontFamily: cfg.wordFont, fontSize: 15, resize: "vertical", marginTop: 0 }} />
              <button type="button" onClick={() => setExtraExamples((list) => list.filter((_, idx) => idx !== i))}
                aria-label={tr(isAr, "Remove example", "إزالة الجملة")}
                style={{ alignSelf: "flex-start", marginTop: 4, border: "none", background: "none", color: "var(--icon-muted)", cursor: "pointer", padding: 2 }}>
                <XIcon size={15} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setExtraExamples((list) => [...list, ""])}
            style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, border: "none", background: "none", color: cfg.accent, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
            <PlusIcon size={12} /> {tr(isAr, "Add another example", "أضف جملة تانية")}
          </button>
          <PairListEditor cfg={cfg} label={tr(isAr, "Synonyms (optional)", "مرادفات (اختياري)")} pairs={synonyms} onChange={setSynonyms} isAr={isAr} />
          <PairListEditor cfg={cfg} label={tr(isAr, "Antonyms (optional)", "مضادات (اختياري)")} pairs={antonyms} onChange={setAntonyms} isAr={isAr} />
          {error && <div style={errorStyle} role="alert" aria-live="assertive">{error}</div>}
          <button type="submit" disabled={saving} style={{ ...primaryBtnStyle, background: cfg.accent }}>
            {saving ? <LoaderIcon size={16} /> : (isEdit ? <CheckIcon size={16} /> : <PlusIcon size={16} />)} {isEdit ? tr(isAr, "Save changes", "حفظ التغييرات") : tr(isAr, "Save word", "حفظ الكلمة")}
          </button>
        </form>
      </div>
    </div>
  );
}

function AccountModal({ account, onClose, onSave, isAr }) {
  const [nameInput, setNameInput] = useState(account.name);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(account.code);
    } catch (err) {
      const ta = document.createElement("textarea");
      ta.value = account.code;
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

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const result = await onSave(nameInput);
    setSaving(false);
    if (result && result.error) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="account-modal-title" style={{ width: "100%", maxWidth: 440, background: CARD, borderRadius: 4, padding: "24px 24px 22px", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 id="account-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0 }}>{tr(isAr, "My account", "حسابي")}</h2>
          <button onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)" }}><XIcon size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          <label style={labelStyle} htmlFor="account-name">{tr(isAr, "Name", "الاسم")}</label>
          {account.role === "admin" ? (
            <input id="account-name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} style={inputStyle} autoFocus autoCapitalize="off" autoCorrect="off" />
          ) : (
            <div id="account-name" style={{ ...inputStyle, background: "var(--input-bg)", color: "var(--muted-strong)", fontWeight: 600 }}>
              {account.name}
            </div>
          )}

          {account.role === "admin" && (
            <>
              <label style={labelStyle}>{tr(isAr, "Role", "الدور")}</label>
              <div style={{ ...inputStyle, background: "var(--input-bg)", color: BRASS, fontWeight: 600 }}>
                {tr(isAr, "Admin", "مسؤول")}
              </div>
            </>
          )}

          <label style={labelStyle}>{tr(isAr, "Personal code", "الرمز الشخصي")}</label>
          <div
            onClick={handleCopyCode}
            title={tr(isAr, "Click to copy", "اضغط للنسخ")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCopyCode(); } }}
            style={{ ...inputStyle, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", background: codeCopied ? "var(--success-bg)" : "var(--input-bg)", userSelect: "none" }}>
            <span style={{ letterSpacing: "0.06em" }}>{account.code}</span>
            {codeCopied ? <CheckIcon size={14} color="var(--success)" /> : <CopyIcon size={14} color="var(--icon-muted)" />}
          </div>

          {error && <div style={errorStyle} role="alert" aria-live="assertive">{tr(isAr, error, error === "Enter your name." ? "أدخل اسمك." : error === "That name is already taken." ? "هذا الاسم مستخدم بالفعل." : error)}</div>}
          {account.role === "admin" && (
            <button type="submit" disabled={saving} style={primaryBtnStyle}>
              {saving ? <LoaderIcon size={16} /> : <CheckIcon size={16} />} {tr(isAr, "Save changes", "حفظ التغييرات")}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// Human-readable labels/colors for each action type in the admin activity log.
const LOG_ACTION_META = {
  word_add: { label: "Word added", labelAr: "تمت إضافة كلمة", color: "var(--success)" },
  word_edit: { label: "Word edited", labelAr: "تم تعديل كلمة", color: BRASS },
  word_delete: { label: "Word deleted", labelAr: "تم حذف كلمة", color: "var(--danger)" },
  account_add: { label: "Account added", labelAr: "تمت إضافة حساب", color: "var(--success)" },
  account_edit: { label: "Account edited", labelAr: "تم تعديل حساب", color: BRASS },
  account_delete: { label: "Account deleted", labelAr: "تم حذف حساب", color: "var(--danger)" },
  first_sign_in: { label: "First sign in", labelAr: "أول تسجيل دخول", color: "var(--success)" },
  sign_in: { label: "Sign in", labelAr: "تسجيل دخول", color: "var(--accent-1)" },
  sign_out: { label: "Sign out", labelAr: "تسجيل خروج", color: "var(--muted-strong)" },
};

// Sections shown as filter tabs at the top of the admin activity log.
const LOG_SECTIONS = [
  { key: "all", label: "All", labelAr: "الكل", match: () => true },
  { key: "words", label: "Words", labelAr: "الكلمات", match: (a) => a === "word_add" || a === "word_edit" || a === "word_delete" },
  { key: "accounts", label: "Accounts", labelAr: "الحسابات", match: (a) => a === "account_add" || a === "account_edit" || a === "account_delete" },
  { key: "first_sign_in", label: "First Sign In", labelAr: "أول تسجيل دخول", match: (a) => a === "first_sign_in" },
  { key: "sign_in", label: "Sign In", labelAr: "تسجيل الدخول", match: (a) => a === "sign_in" },
  { key: "sign_out", label: "Sign Out", labelAr: "تسجيل الخروج", match: (a) => a === "sign_out" },
];

function AdminModal({ accounts, myAccountCode, logs, onClose, onAdd, onEdit, onDelete, isAr }) {
  const [mode, setMode] = useState("list"); // list | add | edit | added | log
  const [editingCode, setEditingCode] = useState(null);
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("user");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountCode, setNewAccountCode] = useState("");
  const [confirmDeleteCode, setConfirmDeleteCode] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [logFilter, setLogFilter] = useState("all");

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      if (mode !== "list") setMode("list");
      else onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, mode]);

  function startAdd() {
    setFormName(""); setFormRole("user"); setError(""); setMode("add");
  }
  function startEdit(account) {
    setEditingCode(account.code); setFormName(account.name); setFormRole(account.role === "admin" ? "admin" : "user"); setError(""); setMode("edit");
  }

  async function submitAdd(e) {
    e.preventDefault();
    setSaving(true); setError("");
    const result = await onAdd(formName, formRole);
    setSaving(false);
    if (result && result.error) { setError(translateAdminError(result.error, isAr)); return; }
    setNewAccountName(formName.trim());
    setNewAccountCode(result.code);
    setMode("added");
  }

  async function submitEdit(e) {
    e.preventDefault();
    setSaving(true); setError("");
    const result = await onEdit(editingCode, { name: formName, role: formRole });
    setSaving(false);
    if (result && result.error) { setError(translateAdminError(result.error, isAr)); return; }
    setMode("list");
  }

  async function handleCopyNewCode() {
    try {
      await navigator.clipboard.writeText(newAccountCode);
    } catch (err) {
      const ta = document.createElement("textarea");
      ta.value = newAccountCode;
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

  const [inviteCopied, setInviteCopied] = useState(false);
  async function handleCopyInviteLink() {
    const link = `${window.location.origin}${window.location.pathname}?invite=1`;
    try {
      await navigator.clipboard.writeText(link);
    } catch (err) {
      const ta = document.createElement("textarea");
      ta.value = link;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e2) {}
      document.body.removeChild(ta);
    }
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 1800);
  }

  const sortedLogs = useMemo(() => [...(logs || [])].sort((a, b) => b.at - a.at), [logs]);
  const activeSection = LOG_SECTIONS.find((s) => s.key === logFilter) || LOG_SECTIONS[0];
  const filteredLogs = useMemo(() => sortedLogs.filter((entry) => activeSection.match(entry.action)), [sortedLogs, activeSection]);

  const title = mode === "list" ? tr(isAr, "Admin panel", "لوحة التحكم")
    : mode === "add" ? tr(isAr, "Add account", "إضافة حساب")
    : mode === "added" ? tr(isAr, "Account created", "تم إنشاء الحساب")
    : mode === "log" ? tr(isAr, "Activity log", "سجل النشاط")
    : tr(isAr, "Edit account", "تعديل الحساب");

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title" style={{ width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", background: CARD, borderRadius: 4, padding: "24px 24px 22px", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 id="admin-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0 }}>{title}</h2>
          <button onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)" }}><XIcon size={20} /></button>
        </div>

        {mode === "list" && (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={handleCopyInviteLink} className="lift-hover" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: inviteCopied ? "var(--success)" : INK, background: "none", border: `1px solid ${inviteCopied ? "var(--success)" : "rgba(var(--border-rgb),0.25)"}`, borderRadius: 3, cursor: "pointer" }}>
                {inviteCopied ? <CheckIcon size={14} /> : <LinkIcon size={14} />} {inviteCopied ? tr(isAr, "Link copied", "تم النسخ") : tr(isAr, "Copy invite link", "نسخ رابط الدعوة")}
              </button>
              <button onClick={() => { setLogFilter("all"); setMode("log"); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: INK, background: "none", border: "1px solid rgba(var(--border-rgb),0.25)", borderRadius: 3, cursor: "pointer" }}>
                <BookIcon size={14} /> {tr(isAr, "Activity log", "سجل النشاط")}
              </button>
              <button onClick={startAdd} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#fff", background: BRASS, border: "none", borderRadius: 3, cursor: "pointer" }}>
                <PlusIcon size={14} /> {tr(isAr, "Add account", "إضافة حساب")}
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "8px 0 0" }}>
              {tr(isAr, "Anyone with this link can create an account, but they'll still need the shared access code from you to actually sign in.", "أي حد معاه الرابط ده يقدر يعمل حساب، بس لسه محتاج منك رمز الوصول المشترك عشان يقدر يسجل دخول فعلاً.")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              {accounts.length === 0 && <p style={{ fontSize: 13, color: "var(--muted-strong)" }}>{tr(isAr, "No accounts yet.", "لا توجد حسابات بعد.")}</p>}
              {accounts.map((a) => (
                <div key={a.code} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 12px", border: "1px solid rgba(var(--border-rgb),0.12)", borderRadius: 3 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: INK, display: "flex", alignItems: "center", gap: 6 }}>
                      {a.name}
                      {a.code === myAccountCode && <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>{tr(isAr, "(you)", "(أنت)")}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: a.role === "admin" ? BRASS : "var(--muted)", fontWeight: a.role === "admin" ? 700 : 400 }}>
                      {a.role === "admin" ? tr(isAr, "Admin", "مسؤول") : tr(isAr, "User", "مستخدم")}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "'Fraunces', serif", letterSpacing: "0.04em", marginTop: 2 }}>
                      {tr(isAr, `Code: ${a.code}`, `الرمز: ${a.code}`)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => startEdit(a)} title={tr(isAr, "Edit", "تعديل")} aria-label={tr(isAr, `Edit ${a.name}`, `تعديل ${a.name}`)}
                      style={{ border: "1px solid rgba(var(--border-rgb),0.2)", background: "none", color: "var(--icon-muted)", borderRadius: 3, padding: 6, cursor: "pointer" }}>
                      <EditIcon size={13} />
                    </button>
                    <button
                      onClick={() => (confirmDeleteCode === a.code ? onDelete(a.code) : setConfirmDeleteCode(a.code))}
                      onBlur={() => setConfirmDeleteCode(null)}
                      title={confirmDeleteCode === a.code ? tr(isAr, "Click again to confirm", "اضغط مرة أخرى للتأكيد") : tr(isAr, "Remove", "إزالة")}
                      aria-label={confirmDeleteCode === a.code ? tr(isAr, `Confirm remove ${a.name}`, `تأكيد إزالة ${a.name}`) : tr(isAr, `Remove ${a.name}`, `إزالة ${a.name}`)}
                      style={{ border: "none", background: confirmDeleteCode === a.code ? "var(--danger-border)" : "transparent", color: confirmDeleteCode === a.code ? "var(--danger)" : "var(--icon-muted)", borderRadius: 3, padding: 6, cursor: "pointer" }}>
                      <TrashIcon size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {(mode === "add" || mode === "edit") && (
          <form onSubmit={mode === "add" ? submitAdd : submitEdit} style={{ marginTop: 14 }}>
            <label style={labelStyle} htmlFor="acct-form-name">{tr(isAr, "Name", "الاسم")}</label>
            <input id="acct-form-name" value={formName} onChange={(e) => setFormName(e.target.value)} style={inputStyle} autoFocus autoCapitalize="off" autoCorrect="off" />
            <label style={labelStyle} htmlFor="acct-form-role">{tr(isAr, "Role", "الدور")}</label>
            <select id="acct-form-role" value={formRole} onChange={(e) => setFormRole(e.target.value)} style={{ ...inputStyle, fontFamily: "'Source Sans 3', sans-serif" }}>
              <option value="user">{tr(isAr, "User", "مستخدم")}</option>
              <option value="admin">{tr(isAr, "Admin", "مسؤول")}</option>
            </select>
            {error && <div style={errorStyle} role="alert" aria-live="assertive">{error}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button type="button" onClick={() => setMode("list")} style={{ flex: 1, padding: "11px 14px", fontSize: 14, fontWeight: 600, color: "var(--icon-muted)", background: "none", border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 3, cursor: "pointer" }}>
                {tr(isAr, "Cancel", "إلغاء")}
              </button>
              <button type="submit" disabled={saving} style={{ ...primaryBtnStyle, marginTop: 0, flex: 1 }}>
                {saving ? <LoaderIcon size={16} /> : <CheckIcon size={16} />} {tr(isAr, "Save", "حفظ")}
              </button>
            </div>
          </form>
        )}

        {mode === "added" && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontFamily: "'Source Sans 3', sans-serif", color: "var(--muted-strong)", fontSize: 14, margin: "0 0 14px" }}>
              {tr(isAr, `Share this personal code with ${newAccountName} — they'll use it, along with the shared access code, to sign in.`, `شارك هذا الرمز الشخصي مع ${newAccountName} — سيستخدمه مع رمز الوصول المشترك لتسجيل الدخول.`)}
            </p>
            <div
              onClick={handleCopyNewCode}
              title={tr(isAr, "Click to copy", "اضغط للنسخ")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCopyNewCode(); } }}
              style={{ textAlign: "center", padding: "18px 10px", background: codeCopied ? "var(--success-bg)" : "var(--input-bg)", border: `1px dashed ${codeCopied ? "rgba(var(--success-border-rgb),0.45)" : "rgba(var(--border-rgb),0.3)"}`, borderRadius: 4, marginBottom: 8, cursor: "pointer", userSelect: "none" }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 600, letterSpacing: "0.08em", color: INK }}>{newAccountCode}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: codeCopied ? "var(--success)" : "var(--muted)", marginBottom: 18 }}>
              {codeCopied ? (<><CheckIcon size={13} /> {tr(isAr, "Copied", "تم النسخ")}</>) : (<><CopyIcon size={13} /> {tr(isAr, "Click the code to copy", "اضغط على الرمز للنسخ")}</>)}
            </div>
            <button onClick={() => setMode("list")} style={primaryBtnStyle}>{tr(isAr, "Done", "تم")}</button>
          </div>
        )}

        {mode === "log" && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
              <button onClick={() => setMode("list")} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", fontSize: 13, fontWeight: 600, color: "var(--icon-muted)", background: "none", border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 3, cursor: "pointer" }}>
                <ChevronIcon size={13} style={{ transform: `rotate(${isAr ? 0 : 180}deg)` }} /> {tr(isAr, "Back", "رجوع")}
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {LOG_SECTIONS.map((s) => {
                const active = s.key === logFilter;
                return (
                  <button key={s.key} onClick={() => setLogFilter(s.key)}
                    style={{ padding: "6px 11px", fontSize: 12, fontWeight: 600, color: active ? "#fff" : "var(--icon-muted)", background: active ? BRASS : "none", border: `1px solid ${active ? BRASS : "rgba(var(--border-rgb),0.2)"}`, borderRadius: 20, cursor: "pointer" }}>
                    {tr(isAr, s.label, s.labelAr)}
                  </button>
                );
              })}
            </div>
            {filteredLogs.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted-strong)" }}>
                {sortedLogs.length === 0 ? tr(isAr, "No activity recorded yet.", "لا يوجد نشاط مسجل بعد.") : tr(isAr, "No activity in this section yet.", "لا يوجد نشاط في هذا القسم بعد.")}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "50vh", overflowY: "auto" }}>
                {filteredLogs.map((entry) => {
                  const meta = LOG_ACTION_META[entry.action] || { label: entry.action, labelAr: entry.action, color: "var(--muted-strong)" };
                  return (
                    <div key={entry.id} style={{ padding: "8px 10px", border: "1px solid rgba(var(--border-rgb),0.12)", borderRadius: 3 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                          {tr(isAr, meta.label, meta.labelAr)}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>
                          {new Date(entry.at).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: INK, marginTop: 3 }}>{entry.message}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
