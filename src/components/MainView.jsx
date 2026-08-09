import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { tr } from "../lib/config/i18n";
import { useHistoryBackClose, haptic } from "../lib/utils/useModalDismiss";
import { INK, PAPER, CARD, BRASS, errorStyle } from "../lib/config/theme";
import { getSpeechRecognitionCtor, recognizeSpeech, loadArDialect, loadEnAccent, enAccentLang } from "../lib/utils/speech";
import { uid, isSrsDue, computeStreak } from "../lib/utils/quizHelpers";
import {
  SearchIcon, PlusIcon, XIcon, LoaderIcon, CheckIcon, WifiOffIcon,
  UndoIcon, ClockIcon, MicIcon, BookIcon, FlameIcon, UsersIcon, TrashIcon,
} from "./common/Icons";
import { firstLetterKey, fuzzyIncludes, matchScore } from "../lib/utils/searchUtils";
import { WORD_TYPES, entryPosList } from "../lib/utils/wordTypes";
import { normalizePairs } from "../lib/utils/pairUtils";
import { parseCsv, exportEntriesAsCsv, exportEntriesAsAnkiTsv, downloadTextFile } from "../lib/utils/csvUtils";
import { makeLogEntry } from "../lib/state/logs";
import { SECTIONS } from "../lib/config/sections";
import { loadSearchHistory, addToSearchHistory, removeFromSearchHistory, clearSearchHistory } from "../lib/state/storage";
import EntryCard from "./common/EntryCard";
import HeaderMenu from "./layout/HeaderMenu";
import BrandMark from "./common/BrandMark";
import ToolsMenu from "./layout/ToolsMenu";
import ReminderBanner from "./layout/ReminderBanner";
import BackupReminderBanner from "./layout/BackupReminderBanner";
import ExamBanner from "./layout/ExamBanner";
import SiteBanner from "./layout/SiteBanner";
import EmptyState from "./layout/EmptyState";
import { loadFocusMode, saveFocusMode, loadProgress } from "../lib/state/goals";
import { loadWordNotes, setWordNote } from "../lib/state/wordNotes";

// These are only ever rendered behind a boolean flag (showQuiz, showAdd,
// etc.) — never on first paint. Loading them lazily keeps their code
// (QuizModal alone pulls in the ~380-line quiz engine) out of the main
// bundle, so the initial page load only ships the code actually needed
// to show the word list.
const QuizModal = lazy(() => import("./modals/QuizModal"));
const ExamModeModal = lazy(() => import("./modals/ExamModeModal"));
const ExamSettingsModal = lazy(() => import("./modals/ExamSettingsModal"));
const StatsModal = lazy(() => import("./modals/StatsModal"));
const LeaderboardModal = lazy(() => import("./modals/LeaderboardModal"));
const FlashcardsModal = lazy(() => import("./modals/FlashcardsModal"));
const AddModal = lazy(() => import("./modals/AddModal"));
const AccountModal = lazy(() => import("./modals/AccountModal"));
const AdminModal = lazy(() => import("./modals/AdminModal"));
const WordZoomModal = lazy(() => import("./modals/WordZoomModal"));
const TimerPage = lazy(() => import("./timer/TimerPage"));
const CalendarPage = lazy(() => import("./calendar/CalendarPage"));
const TodoPage = lazy(() => import("./todo/TodoPage"));
const QuickReviewModal = lazy(() => import("./modals/QuickReviewModal"));
const GoalsPage = lazy(() => import("./goals/GoalsPage"));
const InfoGuideModal = lazy(() => import("./modals/InfoGuideModal"));
const DictationModal = lazy(() => import("./modals/DictationModal"));
const AchievementsModal = lazy(() => import("./modals/AchievementsModal"));
const RandomWordModal = lazy(() => import("./modals/RandomWordModal"));
const DashboardPage = lazy(() => import("./dashboard/DashboardPage"));
const WordListsModal = lazy(() => import("./modals/WordListsModal"));
const ChallengeModal = lazy(() => import("./modals/ChallengeModal"));


const TIMER_VIEW_KEY = "twoTongues.timerView";
const CALENDAR_VIEW_KEY = "twoTongues.calendarView";
const TODO_VIEW_KEY = "twoTongues.todoView";
const GOALS_VIEW_KEY = "twoTongues.goalsView";

function loadTimerView() {
  try {
    const raw = localStorage.getItem(TIMER_VIEW_KEY);
    if (!raw) return { open: false, bubble: false };
    const p = JSON.parse(raw);
    return { open: !!p.open, bubble: !!p.bubble };
  } catch (e) {
    return { open: false, bubble: false };
  }
}

function saveTimerView(open, bubble) {
  try {
    if (!open) localStorage.removeItem(TIMER_VIEW_KEY);
    else localStorage.setItem(TIMER_VIEW_KEY, JSON.stringify({ open: true, bubble: !!bubble }));
  } catch (e) {}
}

function loadCalendarView() {
  try {
    const raw = localStorage.getItem(CALENDAR_VIEW_KEY);
    if (!raw) return { open: false, bubble: false };
    const p = JSON.parse(raw);
    return { open: !!p.open, bubble: !!p.bubble };
  } catch (e) {
    return { open: false, bubble: false };
  }
}

function saveCalendarView(open, bubble) {
  try {
    if (!open) localStorage.removeItem(CALENDAR_VIEW_KEY);
    else localStorage.setItem(CALENDAR_VIEW_KEY, JSON.stringify({ open: true, bubble: !!bubble }));
  } catch (e) {}
}

function loadTodoView() {
  try {
    const raw = localStorage.getItem(TODO_VIEW_KEY);
    if (!raw) return { open: false, bubble: false };
    const p = JSON.parse(raw);
    return { open: !!p.open, bubble: !!p.bubble };
  } catch (e) {
    return { open: false, bubble: false };
  }
}

function saveTodoView(open, bubble) {
  try {
    if (!open) localStorage.removeItem(TODO_VIEW_KEY);
    else localStorage.setItem(TODO_VIEW_KEY, JSON.stringify({ open: true, bubble: !!bubble }));
  } catch (e) {}
}

function loadGoalsView() {
  try {
    const raw = localStorage.getItem(GOALS_VIEW_KEY);
    if (!raw) return { open: false, bubble: false };
    const p = JSON.parse(raw);
    return { open: !!p.open, bubble: !!p.bubble };
  } catch (e) {
    return { open: false, bubble: false };
  }
}

function saveGoalsView(open, bubble) {
  try {
    if (!open) localStorage.removeItem(GOALS_VIEW_KEY);
    else localStorage.setItem(GOALS_VIEW_KEY, JSON.stringify({ open: true, bubble: !!bubble }));
  } catch (e) {}
}

export default function MainView({
  name, isAdmin, entries, entriesLoaded, loadError, isOffline, offlineCachedAt, section, onChangeSection, query, setQuery,
  showAdd, onOpenAdd, onCloseAdd, persistEntries, saveError, onLogout,
  accounts, accountCode, logs, onClearLogs, studiedIds, studiedAt, onToggleStudied, favoriteIds, onToggleFavorite, showAccount, onOpenAccount, onCloseAccount, onUpdateOwnAccount,
  srsBox, srsDueAt, quizHistory, onRecordSrsAnswer, onSaveQuizResult,
  siteBanner, onPersistSiteBanner,
  examConfig, onPersistExamConfig,
  showAdmin, onOpenAdmin, onCloseAdmin, onAdminAddAccount, onAdminEditAccount, onAdminDeleteAccount, onApproveRequest, onRejectRequest,
  toast, showToast, theme, onToggleTheme, onChangeTheme, accentTheme, onChangeAccent,
  appIsAr, appLang = "en", onToggleAppLang, onChangeAppLang,
  deviceMode = null, onChangeDeviceMode, uiScale = 1, onChangeUiScale,
  sessionStart,
  remindersOn, remindersBusy, onEnableReminders, onDisableReminders, onTestReminder,
  reminderTitle, onChangeReminderTitle,
  reminderMessage, onChangeReminderMessage,
  vaultAccounts = [], mainAccountCode = "",
  onSwitchAccount, onSetMainAccount, onUnlinkVaultAccount, onLogoutAll, onLinkAccount,
}) {
  const cfg = SECTIONS[section];
  const isAr = section === "ar-ar";
  const sectionEntries = useMemo(() => entries.filter((e) => e.section === section), [entries, section]);
  const studiedCount = useMemo(() => sectionEntries.filter((e) => studiedIds.has(e.id)).length, [sectionEntries, studiedIds]);
  const notStudiedCount = sectionEntries.length - studiedCount;
  const dueCountMobile = useMemo(
    () => sectionEntries.filter((e) => studiedIds.has(e.id) && isSrsDue(e.id, srsDueAt)).length,
    [sectionEntries, studiedIds, srsDueAt]
  );
  const studiedPct = sectionEntries.length ? (studiedCount / sectionEntries.length) * 100 : 0;
  const notStudiedPct = 100 - studiedPct;
  const accountNameByCode = useMemo(() => Object.fromEntries(accounts.map((a) => [a.code, a.name])), [accounts]);
  // "preparing": button pressed but the mic isn't armed yet (permission /
  // hardware startup can take a noticeable beat) — talking during this
  // window is silently lost. "listening": recognition's own onstart fired,
  // so it's actually capturing audio. Waiting for onstart before treating
  // it as "listening" (instead of flipping the flag at click time) fixes
  // attempts getting dropped because the user spoke a moment too early.
  const [voiceMicState, setVoiceMicState] = useState("idle"); // idle | preparing | listening
  const [voiceMicLevel, setVoiceMicLevel] = useState(0);
  const voiceListening = voiceMicState !== "idle";
  const speechSupported = useMemo(() => !!getSpeechRecognitionCtor(), []);
  const handleVoiceSearch = useCallback(async () => {
    if (!speechSupported || voiceListening) return;
    setVoiceMicState("preparing");
    setVoiceMicLevel(0);
    try {
      const lang = isAr ? loadArDialect() : enAccentLang(loadEnAccent());
      const text = await recognizeSpeech(lang, {
        onStart: () => setVoiceMicState("listening"),
        onLevel: (lvl) => setVoiceMicLevel(lvl),
        durationMs: 3200,
      });
      if (text) {
        setQuery(text);
        setShowSuggestions(true);
      } else {
        showToast(tr(isAr, "Didn't catch that — try again.", "معرفتش أسمع صح — جرّب تاني."));
      }
    } catch (e) {
      showToast(tr(isAr, "Didn't catch that — try again.", "معرفتش أسمع صح — جرّب تاني."));
    } finally {
      setVoiceMicLevel(0);
      setVoiceMicState("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechSupported, voiceListening, isAr]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState(() => loadSearchHistory(section));
  useEffect(() => { setSearchHistory(loadSearchHistory(section)); }, [section]);
  const [studyFilter, setStudyFilter] = useState("all"); // "all" | "studied" | "not-studied" | "favorites" | "due"
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
  const [zoomAlreadyExists, setZoomAlreadyExists] = useState(false);
  // When add hits a duplicate: show message + "Go to it" — do NOT auto-open the card.
  const [dupNotice, setDupNotice] = useState(null); // { entry } | null
  const [showQuiz, setShowQuiz] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileNavTab, setMobileNavTab] = useState("words");


  const [quizDueOnly, setQuizDueOnly] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showWordLists, setShowWordLists] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [requestBusyCode, setRequestBusyCode] = useState(null);
  const [posFilter, setPosFilter] = useState("all"); // all | noun | verb | ...
  const [dateFilter, setDateFilter] = useState("all"); // all | today | week | month
  const [sortKey, setSortKey] = useState("alpha"); // alpha | newest | oldest | weak
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showTimer, setShowTimer] = useState(() => loadTimerView().open);
  const [timerBubble, setTimerBubble] = useState(() => loadTimerView().bubble);
  const [showCalendar, setShowCalendar] = useState(() => loadCalendarView().open);
  const [calendarBubble, setCalendarBubble] = useState(() => loadCalendarView().bubble);
  const [showTodo, setShowTodo] = useState(() => loadTodoView().open);
  const [todoBubble, setTodoBubble] = useState(() => loadTodoView().bubble);
  const [focusMode, setFocusMode] = useState(() => loadFocusMode());
  const [showQuickReview, setShowQuickReview] = useState(false);
  const [showExamMode, setShowExamMode] = useState(false);
  const [showExamSettings, setShowExamSettings] = useState(false);
  const [showGoals, setShowGoals] = useState(() => loadGoalsView().open);
  const [goalsBubble, setGoalsBubble] = useState(() => loadGoalsView().bubble);
  const [showInfoGuide, setShowInfoGuide] = useState(false);

  // System back button closes the top-most overlay on mobile instead of leaving the site.
  // NOTE: showAdd is managed by App.jsx history (openAddModal/closeAddModal) — do NOT
  // also hook it here. A second pushState caused: close → history.back → popstate
  // restored showAdd:true → Add modal reopened in a loop with the word zoom card.
  useHistoryBackClose(showQuiz, () => { setShowQuiz(false); setQuizDueOnly(false); });
  useHistoryBackClose(showExamMode, () => setShowExamMode(false));
  useHistoryBackClose(!!zoomEntry, () => { setZoomEntry(null); setZoomAlreadyExists(false); });
  useHistoryBackClose(showGoals, () => { setShowGoals(false); setGoalsBubble(false); });
  useHistoryBackClose(showTodo, () => { setShowTodo(false); setTodoBubble(false); });
  useHistoryBackClose(showInfoGuide, () => setShowInfoGuide(false));

  const [showDictation, setShowDictation] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showRandomWord, setShowRandomWord] = useState(false);
  const [wordNotes, setWordNotes] = useState(() => loadWordNotes(accountCode));
  const searchInputRef = useRef(null);

  useEffect(() => { setWordNotes(loadWordNotes(accountCode)); }, [accountCode]);
  useEffect(() => { saveFocusMode(focusMode); }, [focusMode]);
  useEffect(() => {
    try { document.documentElement.setAttribute("data-focus-mode", focusMode ? "1" : "0"); } catch (_) {}
  }, [focusMode]);


  // Persist timer page across refresh until the user closes it themselves.
  useEffect(() => {
    saveTimerView(showTimer, timerBubble);
  }, [showTimer, timerBubble]);

  // Persist calendar widget across refresh until the user closes it themselves.
  useEffect(() => {
    saveCalendarView(showCalendar, calendarBubble);
  }, [showCalendar, calendarBubble]);

  useEffect(() => {
    saveTodoView(showTodo, todoBubble);
  }, [showTodo, todoBubble]);

  useEffect(() => {
    saveGoalsView(showGoals, goalsBubble);
  }, [showGoals, goalsBubble]);

  // Keyboard shortcuts (desktop) — ignored while typing in inputs
  useEffect(() => {
    function onKey(e) {
      const tag = (e.target && e.target.tagName) || "";
      const typing = tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable;
      if (e.key === "Escape") {
        if (showQuickReview) { setShowQuickReview(false); return; }
        if (focusMode) { setFocusMode(false); return; }
      }
      if (typing) return;
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus?.();
      } else if (e.key === "n" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onOpenAdd?.();
      } else if (e.key === "q" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowQuiz(true);
      } else if (e.key === "r" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowQuickReview(true);
      } else if (e.key === "t" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setTodoBubble(false);
        setShowTodo(true);
      } else if (e.key === "f" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setFocusMode((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showQuickReview, focusMode, onOpenAdd]);

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
      ? sectionEntries.filter((e) => fuzzyIncludes(e.word, q) || fuzzyIncludes(e.meaning, q) || fuzzyIncludes(e.definition || "") || fuzzyIncludes(e.example || ""))
      : sectionEntries.slice();
    if (studyFilter === "studied") base = base.filter((e) => studiedIds.has(e.id));
    else if (studyFilter === "not-studied") base = base.filter((e) => !studiedIds.has(e.id));
    else if (studyFilter === "favorites") base = base.filter((e) => favoriteIds.has(e.id));
    else if (studyFilter === "due") base = base.filter((e) => studiedIds.has(e.id) && isSrsDue(e.id, srsDueAt));
    else if (studyFilter === "weak") base = base.filter((e) => studiedIds.has(e.id) && ((srsBox && srsBox[e.id]) || 0) <= 1);
    if (posFilter !== "all") {
      base = base.filter((e) => entryPosList(e).includes(posFilter) || e.pos === posFilter);
    }
    if (dateFilter !== "all") {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      let minT = 0;
      if (dateFilter === "today") {
        const d = new Date(); d.setHours(0, 0, 0, 0); minT = d.getTime();
      } else if (dateFilter === "week") minT = now - 7 * day;
      else if (dateFilter === "month") minT = now - 30 * day;
      base = base.filter((e) => typeof e.addedAt === "number" && e.addedAt >= minT);
    }
    if (sortKey === "newest") base = [...base].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    else if (sortKey === "oldest") base = [...base].sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
    else if (sortKey === "weak") base = [...base].sort((a, b) => ((srsBox && srsBox[a.id]) || 0) - ((srsBox && srsBox[b.id]) || 0));
    return base;
  }, [sectionEntries, query, studyFilter, studiedIds, favoriteIds, srsDueAt, srsBox, posFilter, dateFilter, sortKey]);

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
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [query, studyFilter, section, posFilter, dateFilter, sortKey]);

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
    // Case-insensitive duplicate check within the same section (buy / Buy / BUY).
    const key = (newEntry.word || "").trim().toLowerCase();
    const existing = sectionEntries.find((e) => (e.word || "").trim().toLowerCase() === key);
    if (existing) {
      // Keep Add modal open — AddModal shows the message + "Go to it" button.
      return { duplicate: existing };
    }

    // Pass a function rather than a precomputed array: if another device
    // saves a word at the same moment, persistEntries re-runs this against
    // the freshly-fetched entries and retries, so both additions survive
    // instead of one silently overwriting the other.
    // Also re-check duplicates against the latest server list (race-safe).
    const newRow = { ...newEntry, id: uid(), section, addedBy: accountCode, addedAt: Date.now() };
    let skippedDup = false;
    await persistEntries(
      (curEntries) => {
        if (curEntries.some((e) => e.section === section && (e.word || "").trim().toLowerCase() === key)) {
          skippedDup = true;
          return curEntries;
        }
        return [...curEntries, newRow];
      },
      () =>
        skippedDup
          ? null
          : makeLogEntry("word_add", `${name} added "${newEntry.word}" (${cfg.shortLabel})`, name, accountCode)
    );
    if (skippedDup) {
      const again = entries.find(
        (e) => e.section === section && (e.word || "").trim().toLowerCase() === key
      );
      if (again) return { duplicate: again };
      showToast(
        tr(
          appIsAr,
          `"${newEntry.word}" is already in the dictionary.`,
          `«${newEntry.word}» موجودة أصلًا في القاموس.`
        )
      );
      return { duplicate: null };
    }
    onCloseAdd();
    return { ok: true };
  }
  const handleDelete = useCallback(async (id) => {
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
  }, [entries, persistEntries, name, accountCode]);

  // Stable (id-based) handlers for the entry list below — EntryCard is
  // wrapped in React.memo, so these need to keep the same function
  // identity across re-renders (e.g. every keystroke while searching) or
  // the memoization is defeated and every visible card re-renders anyway.
  const handleEditRequest = useCallback((id) => {
    const target = entries.find((e) => e.id === id);
    if (target) setEditingEntry(target);
  }, [entries]);

  const handleZoomRequest = useCallback((id) => {
    const target = entries.find((e) => e.id === id);
    if (target) {
      setZoomAlreadyExists(false);
      setZoomEntry(target);
    }
  }, [entries]);

  const handleToggleStudiedById = useCallback((id) => { haptic(12); onToggleStudied(id); }, [onToggleStudied]);
  const handleToggleFavoriteById = useCallback((id) => { onToggleFavorite(id); }, [onToggleFavorite]);
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
    // If the word text changed, block renaming onto another existing word (case-insensitive).
    if (wordChanged) {
      const key = (updates.word || "").trim().toLowerCase();
      const clash = sectionEntries.find(
        (e) => e.id !== id && (e.word || "").trim().toLowerCase() === key
      );
      if (clash) {
        showToast(
          tr(
            appIsAr,
            `"${clash.word}" is already in the dictionary.`,
            `«${clash.word}» موجودة أصلًا في القاموس.`
          )
        );
        return;
      }
    }
    await persistEntries(
      (curEntries) => {
        if (wordChanged) {
          const key = (updates.word || "").trim().toLowerCase();
          if (curEntries.some((e) => e.id !== id && e.section === section && (e.word || "").trim().toLowerCase() === key)) {
            return curEntries;
          }
        }
        return curEntries.map((e) =>
          e.id === id ? { ...e, ...updates, editedBy: accountCode, editedAt: Date.now() } : e
        );
      },
      () => makeLogEntry(
        "word_edit",
        `${name} edited "${(target && target.word) || id}"${wordChanged ? ` → "${updates.word}"` : ""}`,
        name, accountCode
      )
    );
    setEditingEntry(null);
  }

  return (
    <>
    {/* Hide dictionary while the full timer/calendar page is open; show it again under the floating bubble. */}
    <div
      dir={cfg.dir}
      style={{
        minHeight: "100dvh",
        background: PAPER,
        fontFamily: "'Source Sans 3', sans-serif",
        /* لا نضع overflow هنا — overflow-x:hidden على عنصر وسيط يكسر position:sticky لقائمة الحروف */
        maxWidth: "100%",
        display: (showTimer && !timerBubble) || (showCalendar && !calendarBubble) || (showTodo && !todoBubble) || (showGoals && !goalsBubble) ? "none" : undefined,
      }}
      aria-hidden={(showTimer && !timerBubble) || (showCalendar && !calendarBubble) || (showTodo && !todoBubble) || (showGoals && !goalsBubble) ? true : undefined}
    >
      {!focusMode && <SiteBanner banner={siteBanner} isAr={appIsAr} />}
      <header style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.15)", background: PAPER, position: "sticky", top: 0, zIndex: 1000 }}>
        <div className="app-container" style={{ margin: "0 auto", padding: "clamp(12px, 2.5vw, 20px) clamp(12px, 3vw, 24px) 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <BrandMark size="sm" isAr={appIsAr} editable />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                onClick={onOpenAccount}
                title={tr(appIsAr, "My account", "حسابي")}
                aria-label={tr(appIsAr, "My account", "حسابي")}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: "2px solid color-mix(in srgb, var(--accent-1) 45%, transparent)",
                  padding: 0,
                  overflow: "hidden",
                  cursor: "pointer",
                  background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {(() => {
                  const me = (accounts || []).find((a) => a.code === accountCode);
                  if (me && me.avatar) {
                    return <img src={me.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
                  }
                  const n = String(name || "?").trim();
                  const parts = n.split(/\s+/).filter(Boolean);
                  const ini = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]) : n.slice(0, 2);
                  return ini.toUpperCase();
                })()}
              </button>
              {isAdmin && (() => {
                const pending = (accounts || []).filter((a) => a.status === "pending");
                const pendingCount = pending.length;
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => setRequestsOpen(true)}
                      title={tr(appIsAr, "Account requests", "طلبات الحسابات")}
                      aria-label={tr(appIsAr, "Account requests", "طلبات الحسابات")}
                      className="lift-hover touch-target"
                      style={{
                        position: "relative",
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        border: "1px solid rgba(var(--border-rgb),0.25)",
                        background: "none",
                        color: "var(--icon-muted)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <UsersIcon size={16} />
                      {pendingCount > 0 && (
                        <span style={{
                          position: "absolute", top: -3, insetInlineEnd: -3, minWidth: 16, height: 16, borderRadius: 8,
                          background: "var(--danger)", color: "#fff", fontSize: 10, fontWeight: 700,
                          display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
                          boxShadow: "0 0 0 2px var(--card)",
                        }}>{pendingCount > 9 ? "9+" : pendingCount}</span>
                      )}
                    </button>
                    {requestsOpen && typeof document !== "undefined" && createPortal(
                      <div
                        className="modal-backdrop"
                        style={{
                          position: "fixed", inset: 0, zIndex: 5200,
                          background: "rgba(0,0,0,0.45)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          padding: 16,
                        }}
                        onClick={() => setRequestsOpen(false)}
                      >
                        <div
                          role="dialog"
                          aria-modal="true"
                          aria-label={tr(appIsAr, "Account requests", "طلبات الحسابات")}
                          className="modal-card"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: "100%", maxWidth: 400, maxHeight: "min(90dvh, 820px)",
                            overflowY: "auto", background: "var(--card)", color: "var(--ink)",
                            borderRadius: 16, padding: 16,
                            boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
                            border: "1px solid rgba(var(--border-rgb),0.14)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                              {tr(appIsAr, "Account requests", "طلبات الحسابات")}
                            </h2>
                            <button
                              type="button"
                              onClick={() => setRequestsOpen(false)}
                              aria-label={tr(appIsAr, "Close", "إغلاق")}
                              style={{ border: "none", background: "var(--input-bg)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "var(--icon-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              <XIcon size={18} />
                            </button>
                          </div>
                          {pendingCount === 0 ? (
                            <div style={{ fontSize: 13, color: "var(--muted)", padding: "12px 4px", lineHeight: 1.45 }}>
                              {tr(appIsAr, "No pending account requests.", "لا توجد طلبات حساب معلّقة.")}
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {pending.map((a) => (
                                <div key={a.code} style={{
                                  border: "1px solid rgba(var(--border-rgb),0.16)", borderRadius: 10,
                                  padding: "12px 12px", background: "var(--input-bg)",
                                }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{a.name}</div>
                                  <div style={{ fontSize: 12, color: "var(--muted-strong)", fontFamily: "ui-monospace, monospace", marginTop: 2 }} dir="ltr">@{a.username || "—"}</div>
                                  <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                                    <button
                                      type="button"
                                      disabled={requestBusyCode === a.code}
                                      className="touch-target"
                                      onClick={async () => {
                                        setRequestBusyCode(a.code);
                                        try { await onApproveRequest?.(a.code); } finally { setRequestBusyCode(null); }
                                      }}
                                      style={{
                                        flex: 1, minHeight: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                        padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                                        fontSize: 13, fontWeight: 700, color: "#fff", background: "var(--success)",
                                      }}
                                    >
                                      <CheckIcon size={13} /> {tr(appIsAr, "Approve", "موافقة")}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={requestBusyCode === a.code}
                                      className="touch-target"
                                      onClick={async () => {
                                        setRequestBusyCode(a.code);
                                        try { await onRejectRequest?.(a.code); } finally { setRequestBusyCode(null); }
                                      }}
                                      style={{
                                        flex: 1, minHeight: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                        padding: "8px 10px", borderRadius: 8, border: "1px solid var(--danger)", cursor: "pointer",
                                        fontSize: 13, fontWeight: 700, color: "var(--danger)", background: "transparent",
                                      }}
                                    >
                                      <TrashIcon size={13} /> {tr(appIsAr, "Reject", "رفض")}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>,
                      document.body
                    )}
                  </>
                );
              })()}
              <HeaderMenu theme={theme} onToggleTheme={onToggleTheme} onChangeTheme={onChangeTheme} isAdmin={isAdmin}
                onOpenAccount={onOpenAccount} onOpenAdmin={onOpenAdmin} onLogout={onLogout} isAr={appIsAr}
                vaultAccounts={vaultAccounts} mainAccountCode={mainAccountCode} accountCode={accountCode}
                onSwitchAccount={onSwitchAccount} onSetMainAccount={onSetMainAccount}
                onUnlinkVaultAccount={onUnlinkVaultAccount} onLogoutAll={onLogoutAll} onLinkAccount={onLinkAccount}
                appLang={appLang} onChangeAppLang={onChangeAppLang} deviceMode={deviceMode} onChangeDeviceMode={onChangeDeviceMode} uiScale={uiScale} onChangeUiScale={onChangeUiScale}
                accentTheme={accentTheme} onChangeAccent={onChangeAccent}
                remindersOn={remindersOn} remindersBusy={remindersBusy} onEnableReminders={onEnableReminders} onDisableReminders={onDisableReminders} onTestReminder={onTestReminder}
                reminderTitle={reminderTitle} onChangeReminderTitle={onChangeReminderTitle}
                reminderMessage={reminderMessage} onChangeReminderMessage={onChangeReminderMessage}
                pendingAccounts={(accounts || []).filter((a) => a.status === "pending")}
                onApproveRequest={onApproveRequest}
                onRejectRequest={onRejectRequest}
                siteBanner={siteBanner}
                onPersistSiteBanner={onPersistSiteBanner}
                onOpenExamSettings={isAdmin ? () => setShowExamSettings(true) : undefined}
                myAccountCode={accountCode}
              
                focusMode={focusMode}
                onToggleFocus={() => setFocusMode((v) => !v)}
                onOpenInfo={() => setShowInfoGuide(true)}
                onOpenAchievements={() => setShowAchievements(true)}
              />
              <ToolsMenu
              accent={cfg.accent}
              onLeaderboard={() => setShowLeaderboard(true)}
              onStats={() => setShowStats(true)}
              onQuiz={() => setShowQuiz(true)}
              onExamMode={() => setShowExamMode(true)}
              onFlashcards={() => setShowFlashcards(true)}
              onTimer={() => { setTimerBubble(false); setShowTimer(true); }}
              onCalendar={() => { setCalendarBubble(false); setShowCalendar(true); }}
              onTodo={() => { setTodoBubble(false); setShowTodo(true); }}
              onGoals={() => { setGoalsBubble(false); setShowGoals(true); }}
              onQuickReview={() => setShowQuickReview(true)}
              onDictation={() => setShowDictation(true)}
              onAchievements={() => setShowAchievements(true)}
              onRandomWord={() => setShowRandomWord(true)}
              onExport={() => {
                const list = filtered.length ? filtered : sectionEntries;
                const csv = exportEntriesAsCsv(list);
                downloadTextFile(`dictionary-${section}.csv`, csv, "text/csv;charset=utf-8");
              }}
              onExportAnki={() => {
                const list = filtered.length ? filtered : sectionEntries;
                const tsv = exportEntriesAsAnkiTsv(list);
                downloadTextFile(`anki-${section}.txt`, tsv, "text/tab-separated-values;charset=utf-8");
              }}
              onDashboard={() => setShowDashboard(true)}
              onWordLists={() => setShowWordLists(true)}
              onChallenges={() => setShowChallenges(true)}
              focusMode={focusMode}
              onToggleFocus={() => setFocusMode((v) => !v)}
              exportDisabled={sectionEntries.length === 0}
              onImport={() => importInputRef.current && importInputRef.current.click()}
              importing={importing}
              isAr={appIsAr}
            />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {Object.entries(SECTIONS).map(([key, s]) => {
              const active = key === section;
              return (
                <button key={key} onClick={() => onChangeSection(key)}
                  className="section-tab" style={{ padding: "9px 16px", fontSize: 14, fontWeight: 600, color: active ? s.accent : "var(--icon-muted)", background: active ? CARD : "transparent", border: "1px solid rgba(var(--border-rgb),0.15)", borderBottom: active ? `1px solid ${CARD}` : "1px solid rgba(var(--border-rgb),0.15)", borderRadius: "8px 8px 0 0", marginBottom: -1, cursor: "pointer", transform: active ? "translateY(-1px)" : "none" }}>
                  {s.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="app-container" style={{ margin: "0 auto", padding: "clamp(12px, 2.5vw, 20px) clamp(12px, 3vw, 24px) 0" }}>
        {!focusMode && (
          <div className="exam-banner-slot" style={{ marginBottom: 14 }}>
            <ExamBanner
              examConfig={examConfig}
              entries={sectionEntries}
              studiedIds={studiedIds}
              studiedAt={studiedAt}
              srsDueAt={srsDueAt}
              srsBox={srsBox}
              isAr={appIsAr}
              isAdmin={isAdmin}
              onOpenExamMode={() => setShowExamMode(true)}
              onOpenExamSettings={isAdmin ? () => setShowExamSettings(true) : undefined}
            />
          </div>
        )}
        <div className="toolbar-row mobile-sticky-search" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", position: "relative", zIndex: 50, marginBottom: 4 }}>
          <div className="toolbar-anim toolbar-search-wrap" style={{ position: "relative", flex: "1 1 240px", animationDelay: "0.02s", zIndex: 50 }}>
            <SearchIcon size={16} color="var(--icon-muted)" style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              ref={searchInputRef}
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
              style={{ width: "100%", padding: "11px 12px", paddingInlineStart: 36, paddingInlineEnd: (query.trim() ? 68 : 0) + (speechSupported ? 38 : 12), fontSize: 15, border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 12, background: "var(--input-bg)", color: INK }} />
            {!!query.trim() && (
              <button
                type="button"
                onClick={() => { setQuery(""); setShowSuggestions(false); setShowHistory(searchHistory.length > 0); searchInputRef.current?.focus?.(); }}
                aria-label={tr(isAr, "Clear search", "مسح البحث")}
                className="search-clear-btn"
                style={{ position: "absolute", insetInlineEnd: speechSupported ? 40 : 8, top: "50%", transform: "translateY(-50%)", width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(var(--border-rgb),0.12)", color: "var(--icon-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, lineHeight: 1, padding: 0 }}
              >×</button>
            )}
            {speechSupported && (
              <button type="button" onClick={handleVoiceSearch} disabled={voiceListening}
                title={voiceMicState === "listening" ? tr(isAr, "Listening — speak now", "بسمع دلوقتي — اتكلم") : tr(isAr, "Search by voice", "بحث صوتي")}
                aria-label={tr(isAr, "Search by voice", "بحث صوتي")}
                className={voiceMicState === "preparing" ? "voice-mic-active" : undefined}
                style={{ position: "absolute", insetInlineEnd: 8, top: "50%", transform: `translateY(-50%) scale(${voiceMicState === "listening" ? 1 + voiceMicLevel * 0.35 : 1})`, display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, border: "none", background: "none", color: voiceListening ? cfg.accent : "var(--icon-muted)", cursor: voiceListening ? "default" : "pointer", padding: 0, transition: "transform 80ms linear" }}>
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
          <div style={{ display: "flex", gap: 10 }}>
            <div className="toolbar-actions toolbar-anim" style={{ animationDelay: "0.04s" }}>
            <button onClick={onOpenAdd} className="btn-shine lift-hover toolbar-add-word" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", fontSize: 14, fontWeight: 600, color: "#fff", background: cfg.accent, border: "none", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap" }}>
              <PlusIcon size={16} /> {tr(isAr, "Add word", "إضافة كلمة")}
            </button>
            
            </div>
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
        {!focusMode && (
          <div className="mobile-banners-stack">
            <ReminderBanner studiedAt={studiedAt} isAr={appIsAr} cfg={cfg} remindersOn={remindersOn} reminderTitle={reminderTitle} reminderMessage={reminderMessage} onOpenQuiz={() => { setQuizDueOnly(true); setShowQuiz(true); }} />
            {isAdmin && <BackupReminderBanner isAr={appIsAr} cfg={cfg} onOpenBackup={onOpenAdmin} />}
          </div>
        )}
        <div style={{ marginTop: 12, background: CARD, border: "1px solid rgba(var(--border-rgb),0.12)", borderRadius: 10, padding: "12px 14px" }}>
          <div dir={isAr ? "rtl" : "ltr"} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: INK }}>
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
        <div className="mobile-filters-toggle-wrap" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="mobile-filters-toggle"
            onClick={() => setMobileFiltersOpen((v) => !v)}
            aria-expanded={mobileFiltersOpen}
            style={{ display: "none" }}
          >
            {tr(isAr, "Filters & sort", "فلاتر وترتيب")}
            {(studyFilter !== "all" || posFilter !== "all" || dateFilter !== "all" || sortKey !== "alpha") ? " · ●" : ""}
            <span style={{ marginInlineStart: 6, opacity: 0.7 }}>{mobileFiltersOpen ? "▴" : "▾"}</span>
          </button>
        </div>
        <div className={`study-filter-row mobile-filters-panel${mobileFiltersOpen ? " is-open" : ""}`} style={{ display: "flex", gap: 10, marginTop: 10 }}>
          {[
            { key: "all", label: tr(isAr, "All", "الكل") },
            { key: "studied", label: tr(isAr, "Studied", "تمت دراستها") },
            { key: "not-studied", label: tr(isAr, "Not Studied", "لم تُدرس بعد") },
            { key: "favorites", label: tr(isAr, "Favorites", "المفضلة") },
            { key: "due", label: tr(isAr, "Due today", "مستحقة") },
            { key: "weak", label: tr(isAr, "Weak", "ضعيفة") },
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
        <div className={`filter-chip-row mobile-filters-panel${mobileFiltersOpen ? " is-open" : ""}`} style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "nowrap", alignItems: "center", maxWidth: "100%" }}>
          <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)}
            aria-label={tr(isAr, "Part of speech", "نوع الكلمة")}
            style={{ fontSize: 12, padding: "5px 10px", borderRadius: 16, border: "1px solid rgba(var(--border-rgb),0.25)", background: "var(--card)", color: "var(--ink)", fontWeight: 600 }}>
            <option value="all">{tr(isAr, "All types", "كل الأنواع")}</option>
            {WORD_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{isAr ? t.ar : t.en}</option>
            ))}
          </select>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
            aria-label={tr(isAr, "Added date", "تاريخ الإضافة")}
            style={{ fontSize: 12, padding: "5px 10px", borderRadius: 16, border: "1px solid rgba(var(--border-rgb),0.25)", background: "var(--card)", color: "var(--ink)", fontWeight: 600 }}>
            <option value="all">{tr(isAr, "Any time", "أي وقت")}</option>
            <option value="today">{tr(isAr, "Added today", "أُضيفت اليوم")}</option>
            <option value="week">{tr(isAr, "Last 7 days", "آخر ٧ أيام")}</option>
            <option value="month">{tr(isAr, "Last 30 days", "آخر ٣٠ يوم")}</option>
          </select>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}
            aria-label={tr(isAr, "Sort", "ترتيب")}
            style={{ fontSize: 12, padding: "5px 10px", borderRadius: 16, border: "1px solid rgba(var(--border-rgb),0.25)", background: "var(--card)", color: "var(--ink)", fontWeight: 600 }}>
            <option value="alpha">{tr(isAr, "A–Z", "أ–ي")}</option>
            <option value="newest">{tr(isAr, "Newest", "الأحدث")}</option>
            <option value="oldest">{tr(isAr, "Oldest", "الأقدم")}</option>
            <option value="weak">{tr(isAr, "Weakest first", "الأضعف أولاً")}</option>
          </select>
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

      <div className="app-container app-main-row">
        <aside className="letter-rail" aria-label="Alphabet">
          {(cfg.letters || []).map((l) => {
            const hasWords = availableLetters.has(l);
            return (
              <button
                key={l}
                type="button"
                onClick={() => { if (hasWords) jumpTo(l); }}
                disabled={!hasWords}
                className={"letter-rail-btn" + (hasWords ? " has-words" : " no-words")}
                style={{
                  fontFamily: section === "ar-ar" ? "'Amiri', serif" : "'Fraunces', serif",
                  color: hasWords ? cfg.accent : "var(--muted, #9a948c)",
                  fontWeight: hasWords ? 700 : 500,
                  cursor: hasWords ? "pointer" : "default",
                  opacity: hasWords ? 1 : 0.45,
                }}
                title={hasWords ? undefined : (isAr ? "لا توجد كلمات بهذا الحرف" : "No words for this letter")}
              >
                {l}
              </button>
            );
          })}
        </aside>

        <div className="word-list-main">
          {!entriesLoaded ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted-strong)", padding: "30px 0" }}>
              <LoaderIcon size={18} /><span>{tr(isAr, "Loading entries…", "جارٍ تحميل الكلمات…")}</span>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState hasQuery={!!query.trim() || studyFilter !== "all"} onAdd={onOpenAdd} accent={cfg.accent} isAr={appIsAr} />
          ) : (
            <>
              {/* قائمة بالكلمات مع شريط فاصل عند بداية كل حرف */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--entry-gap, 10px)" }}>
                {flatSorted.slice(0, visibleCount).map((e, idx) => {
                  const letterKey = firstLetterKey(e.word, section);
                  const prevLetter = idx > 0 ? firstLetterKey(flatSorted[idx - 1].word, section) : null;
                  const isFirstOfLetter = letterKey && letterKey !== prevLetter;
                  const letterCount = (grouped[letterKey] && grouped[letterKey].length) || 0;
                  return (
                    <div
                      key={e.id}
                      ref={isFirstOfLetter ? ((el) => { letterRefs.current[letterKey] = el; }) : undefined}
                    >
                      {isFirstOfLetter && (
                        <div
                          className="letter-divider"
                          aria-label={letterKey}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginTop: idx === 0 ? 0 : 8,
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: section === "ar-ar" ? "'Amiri', serif" : "'Fraunces', serif",
                              fontSize: 15,
                              fontWeight: 700,
                              color: cfg.accent,
                              lineHeight: 1,
                              minWidth: 22,
                              textAlign: "center",
                            }}
                          >
                            {letterKey}
                          </span>
                          <div
                            style={{
                              flex: 1,
                              height: 1,
                              background: `linear-gradient(${cfg.dir === "rtl" ? "270deg" : "90deg"}, ${cfg.accent}55, rgba(var(--border-rgb),0.12) 70%)`,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "var(--muted)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {letterCount}
                          </span>
                        </div>
                      )}
                      <EntryCard
                        entry={e}
                        cfg={cfg}
                        isAdmin={isAdmin}
                        isAr={appIsAr}
                        mobileLayout={deviceMode === "mobile"}
                        tabletLayout={deviceMode === "tablet"}
                        canEdit={isAdmin || e.addedBy === accountCode}
                        onDelete={handleDelete}
                        onEdit={handleEditRequest}
                        onOpenZoom={handleZoomRequest}
                        isStudied={studiedIds.has(e.id)}
                        onToggleStudied={handleToggleStudiedById}
                        isFavorite={favoriteIds.has(e.id)}
                        onToggleFavorite={handleToggleFavoriteById}
                        addedByLabel={accountNameByCode[e.addedBy] || e.addedBy}
                        editedByLabel={accountNameByCode[e.editedBy] || e.editedBy}
                      />
                    </div>
                  );
                })}
              </div>
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

      <Suspense fallback={null}>
        {showAdd && (
          <AddModal
            cfg={cfg}
            onClose={onCloseAdd}
            onSubmit={handleAdd}
            findExisting={(w) => {
              const key = (w || "").trim().toLowerCase();
              if (!key) return null;
              return sectionEntries.find((e) => (e.word || "").trim().toLowerCase() === key) || null;
            }}
            onGoToExisting={(entry) => {
              onCloseAdd();
              setDupNotice(null);
              setZoomAlreadyExists(true);
              setZoomEntry(entry);
            }}
          />
        )}
        {editingEntry && (
          <AddModal
            cfg={cfg}
            initialEntry={editingEntry}
            onClose={() => setEditingEntry(null)}
            onSubmit={(updates) => handleEdit(editingEntry.id, updates)}
          />
        )}
        {zoomEntry && (
          <WordZoomModal
            entry={zoomEntry}
            cfg={cfg}
            onClose={() => { setZoomEntry(null); setZoomAlreadyExists(false); }}
            wordNote={wordNotes[zoomEntry.id] || ""}
            onSaveNote={(note) => setWordNotes(setWordNote(accountCode, zoomEntry.id, note))}
            alreadyExists={zoomAlreadyExists}
          />
        )}
        {showQuiz && (
          <QuizModal
            entries={sectionEntries}
            sectionLabel={cfg.shortLabel}
            studiedIds={studiedIds}
            studiedAt={studiedAt}
            srsDueAt={srsDueAt}
            sessionStart={sessionStart}
            isAr={appIsAr}
            initialDueOnly={quizDueOnly}
            onClose={() => { setShowQuiz(false); setQuizDueOnly(false); }}
            onRecordSrsAnswer={onRecordSrsAnswer}
            onSaveQuizResult={onSaveQuizResult}
          />
        )}
        
        {showExamSettings && isAdmin && (
          <Suspense fallback={null}>
            <ExamSettingsModal
              examConfig={examConfig}
              onPersist={onPersistExamConfig}
              isAr={appIsAr}
              onClose={() => setShowExamSettings(false)}
            />
          </Suspense>
        )}

        {showExamMode && (
          <Suspense fallback={null}>
            <ExamModeModal
              entries={sectionEntries}
              studiedIds={studiedIds}
              studiedAt={studiedAt}
              srsDueAt={srsDueAt}
              srsBox={srsBox}
              isAr={appIsAr}
              sectionLabel={cfg.shortLabel}
              onClose={() => setShowExamMode(false)}
              onRecordSrsAnswer={onRecordSrsAnswer}
              onSaveQuizResult={onSaveQuizResult}
            />
          </Suspense>
        )}
        {showFlashcards && (
          <FlashcardsModal
            entries={sectionEntries}
            cfg={cfg}
            sectionLabel={cfg.shortLabel}
            studiedIds={studiedIds}
            favoriteIds={favoriteIds}
            onToggleStudied={onToggleStudied}
            isAr={appIsAr}
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
            isAr={appIsAr}
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
            isAr={appIsAr}
            cfg={cfg}
            onClose={() => setShowLeaderboard(false)}
          />
        )}
        {showDashboard && (
          <DashboardPage
            onClose={() => setShowDashboard(false)}
            isAr={appIsAr}
            entries={entries}
            studiedIds={studiedIds}
            studiedAt={studiedAt}
            favoriteIds={favoriteIds}
            srsBox={srsBox}
            srsDueAt={srsDueAt}
            quizHistory={quizHistory}
            streak={computeStreak(studiedAt)}
            section={section}
            name={name}
            onOpenQuiz={() => { setShowQuiz(true); }}
            onOpenDue={() => { setStudyFilter("due"); setQuizDueOnly(true); setShowQuiz(true); }}
            onOpenStats={() => { setShowStats(true); }}
            onOpenGoals={() => { setGoalsBubble(false); setShowGoals(true); }}
            onOpenCalendar={() => { setCalendarBubble(false); setShowCalendar(true); }}
            onOpenFlashcards={() => { setShowFlashcards(true); }}
          />
        )}
        {showWordLists && (
          <WordListsModal
            accountCode={accountCode}
            entries={entries}
            section={section}
            isAr={appIsAr}
            onClose={() => setShowWordLists(false)}
            showToast={showToast}
            onImportWords={async (words, listSection) => {
              if (!words || !words.length) return;
              const sec = listSection || section;
              const existing = new Set(entries.filter((e) => e.section === sec).map((e) => (e.word || "").trim().toLowerCase()));
              const newEntries = [];
              for (const w of words) {
                const key = (w.word || "").trim().toLowerCase();
                if (!key || !w.meaning || existing.has(key)) continue;
                existing.add(key);
                newEntries.push({
                  id: uid(),
                  section: sec,
                  word: w.word,
                  meaning: w.meaning,
                  definition: w.definition || "",
                  example: w.example || "",
                  pos: w.pos || "",
                  synonyms: [],
                  antonyms: [],
                  addedBy: accountCode,
                  addedAt: Date.now(),
                });
              }
              if (!newEntries.length) {
                showToast(tr(isAr, "No new words to import", "لا توجد كلمات جديدة للاستيراد"));
                return;
              }
              await persistEntries(
                (cur) => [...cur, ...newEntries],
                () => makeLogEntry("word_add", `${name} imported ${newEntries.length} word(s) from shared list`, name, accountCode)
              );
              showToast(tr(isAr, `Imported ${newEntries.length} word(s)`, `تم استيراد ${newEntries.length} كلمة`));
            }}
          />
        )}
        {showChallenges && (
          <ChallengeModal
            accountCode={accountCode}
            accountName={name}
            accounts={accounts}
            isAr={appIsAr}
            onClose={() => setShowChallenges(false)}
            showToast={showToast}
          />
        )}
        {showAccount && (
          <AccountModal
            account={accounts.find((a) => a.code === accountCode) || { name, code: accountCode, role: isAdmin ? "admin" : "user" }}
            onClose={onCloseAccount}
            onSave={onUpdateOwnAccount}
            isAr={appIsAr}
            lang={appLang}
          />
        )}
        {showAdmin && (
          <AdminModal
            accounts={accounts}
            entries={entries}
            myAccountCode={accountCode}
            logs={logs}
            onClearLogs={onClearLogs}
            onClose={onCloseAdmin}
            onAdd={onAdminAddAccount}
            onEdit={onAdminEditAccount}
            onDelete={onAdminDeleteAccount}
            isAr={appIsAr}
          />
        )}
      </Suspense>
      {dupNotice && dupNotice.entry && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: "min(440px, calc(100vw - 24px))",
            background: "var(--card, #1a1f2e)",
            color: "var(--ink, #fff)",
            padding: "12px 14px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 12px 32px -8px rgba(0,0,0,0.45)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            border: "1px solid color-mix(in srgb, var(--warning, #e6a817) 50%, transparent)",
          }}
        >
          <span style={{ flex: "1 1 160px", lineHeight: 1.4 }}>
            {tr(
              appIsAr,
              `"${dupNotice.entry.word}" is already in the dictionary.`,
              `«${dupNotice.entry.word}» موجودة أصلًا في القاموس.`
            )}
          </span>
          <button
            type="button"
            onClick={() => {
              const e = dupNotice.entry;
              setDupNotice(null);
              setZoomAlreadyExists(true);
              setZoomEntry(e);
            }}
            style={{
              border: "none",
              cursor: "pointer",
              background: "var(--accent-1, #19A7CE)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 12,
              padding: "8px 12px",
              borderRadius: 8,
              whiteSpace: "nowrap",
            }}
          >
            {tr(appIsAr, "Go to it", "اذهب إليها")}
          </button>
          <button
            type="button"
            onClick={() => setDupNotice(null)}
            aria-label={tr(appIsAr, "Dismiss", "إغلاق")}
            style={{
              border: "none",
              cursor: "pointer",
              background: "transparent",
              color: "var(--muted-strong, #aaa)",
              width: 32,
              height: 32,
              padding: 0,
              borderRadius: 8,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <XIcon size={16} />
          </button>
        </div>
      )}
      {toast && !dupNotice && (
        <div role="status" aria-live="polite" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--success)", color: "#fff", padding: "10px 18px", borderRadius: 4, fontSize: 13, fontWeight: 600, boxShadow: "0 10px 24px -10px rgba(0,0,0,0.35)", zIndex: 10000, display: "flex", alignItems: "center", gap: 7 }}>
          <CheckIcon size={14} /> {tr(isAr, toast, toast === "Account info updated." ? "تم تحديث بيانات الحساب." : toast)}
        </div>
      )}
    </div>

    {showTimer && (
      <Suspense fallback={<div style={{ position: "fixed", inset: 0, zIndex: 6000, background: "var(--paper)" }} aria-hidden />}>
        <TimerPage
          isAr={appIsAr}
          initialBubble={timerBubble}
          onClose={() => { setShowTimer(false); setTimerBubble(false); }}
          onBubbleChange={setTimerBubble}
        />
      </Suspense>
    )}

    {showCalendar && (
      <Suspense fallback={<div style={{ position: "fixed", inset: 0, zIndex: 6000, background: "var(--paper)" }} aria-hidden />}>
        <CalendarPage
          isAr={appIsAr}
          studiedAt={studiedAt}
          entries={entries}
          initialBubble={calendarBubble}
          onClose={() => { setShowCalendar(false); setCalendarBubble(false); }}
          onBubbleChange={setCalendarBubble}
        />
      </Suspense>
    )}

    {showTodo && (
      <Suspense fallback={<div style={{ position: "fixed", inset: 0, zIndex: 6000, background: "var(--paper)" }} aria-hidden />}>
        <TodoPage
          isAr={appIsAr}
          initialBubble={todoBubble}
          onClose={() => { setShowTodo(false); setTodoBubble(false); }}
          onBubbleChange={setTodoBubble}
        />
      </Suspense>
    )}

    {showGoals && (
      <Suspense fallback={<div style={{ position: "fixed", inset: 0, zIndex: 6000, background: "var(--paper)" }} aria-hidden />}>
        <GoalsPage
          isAr={appIsAr}
          studiedAt={studiedAt}
          quizHistory={quizHistory}
          streak={computeStreak(studiedAt)}
          cfg={cfg}
          initialBubble={goalsBubble}
          onClose={() => { setShowGoals(false); setGoalsBubble(false); }}
          onBubbleChange={setGoalsBubble}
        />
      </Suspense>
    )}

    {showInfoGuide && (
      <Suspense fallback={null}>
        <InfoGuideModal isAr={appIsAr} onClose={() => setShowInfoGuide(false)} />
      </Suspense>
    )}

    {showQuickReview && (
      <Suspense fallback={null}>
        <QuickReviewModal
          entries={sectionEntries}
          studiedIds={studiedIds}
          srsDueAt={srsDueAt}
          isAr={appIsAr}
          onClose={() => setShowQuickReview(false)}
          onToggleStudied={onToggleStudied}
          onRecordSrsAnswer={onRecordSrsAnswer}
        />
      </Suspense>
    )}

    {showDictation && (
      <Suspense fallback={null}>
        <DictationModal
          entries={sectionEntries}
          studiedIds={studiedIds}
          isAr={appIsAr}
          onClose={() => setShowDictation(false)}
          onRecordSrsAnswer={onRecordSrsAnswer}
          onFinishRound={() => {
            try {
              const k = "twoTongues.dictationRounds." + accountCode;
              const n = Number(localStorage.getItem(k) || 0) + 1;
              localStorage.setItem(k, String(n));
            } catch (_) {}
          }}
        />
      </Suspense>
    )}

    {showAchievements && (
      <Suspense fallback={null}>
        <AchievementsModal
          unlockedIds={(accounts.find((a) => a.code === accountCode) || {}).achievements || []}
          isAr={appIsAr}
          onClose={() => setShowAchievements(false)}
          account={accounts.find((a) => a.code === accountCode) || null}
          streak={computeStreak(studiedAt)}
          srsBox={srsBox}
          timerMinutesTotal={(() => {
            try {
              const p = loadProgress();
              return Object.values(p.timerMinutesByDay || {}).reduce((s, n) => s + (Number(n) || 0), 0);
            } catch (_) { return 0; }
          })()}
          dictationRounds={(() => {
            try { return Number(localStorage.getItem("twoTongues.dictationRounds." + accountCode) || 0); } catch (_) { return 0; }
          })()}
        />
      </Suspense>
    )}

    {showRandomWord && (
      <Suspense fallback={null}>
        <RandomWordModal
          entries={sectionEntries}
          studiedIds={studiedIds}
          srsDueAt={srsDueAt}
          isAr={appIsAr}
          section={section}
          onClose={() => setShowRandomWord(false)}
          onRecordSrsAnswer={onRecordSrsAnswer}
          onToggleStudied={onToggleStudied}
        />
      </Suspense>
    )}

    {/* Always-available floating Goals button (above To-do) — hidden on mobile (bottom nav) */}
    {!showGoals && !focusMode && deviceMode !== "mobile" && deviceMode !== "tablet" && (
      <button
        type="button"
        className="fab-glow fab-glow--goals"
        onClick={() => { setGoalsBubble(false); setShowGoals(true); }}
        title={tr(isAr, "Goals", "الأهداف")}
        aria-label={tr(isAr, "Open goals", "فتح الأهداف")}
        style={{
          position: "fixed",
          bottom: "calc(88px + env(safe-area-inset-bottom, 0px))",
          insetInlineEnd: 16,
          zIndex: 45,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: "linear-gradient(145deg, #ffb340 0%, #ff9f0a 40%, #ff6b00 100%)",
          color: "#fff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      >
        <span className="fab-glow-shine" aria-hidden="true" />
        <FlameIcon size={24} style={{ position: "relative", zIndex: 1 }} />
      </button>
    )}

    {/* Always-available floating To-do button — hidden on mobile (bottom nav) */}
    {!showTodo && !focusMode && deviceMode !== "mobile" && deviceMode !== "tablet" && (
      <button
        type="button"
        className="fab-glow fab-glow--todo"
        onClick={() => { setTodoBubble(false); setShowTodo(true); }}
        title={tr(isAr, "To-do list", "قائمة المهام")}
        aria-label={tr(isAr, "Open to-do list", "فتح قائمة المهام")}
        style={{
          position: "fixed",
          bottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
          insetInlineEnd: 16,
          zIndex: 45,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: "linear-gradient(145deg, #5dff8a 0%, #30d158 45%, #28a745 100%)",
          color: "#fff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      >
        <span className="fab-glow-shine" aria-hidden="true" />
        <CheckIcon size={24} style={{ position: "relative", zIndex: 1 }} />
      </button>
    )}



    {deviceMode === "mobile" && !focusMode && (
      <button
        type="button"
        className="mobile-fab-add"
        onClick={() => onOpenAdd && onOpenAdd()}
        aria-label={tr(appIsAr, "Add word", "إضافة كلمة")}
        title={tr(appIsAr, "Add word", "إضافة كلمة")}
      >
        <PlusIcon size={26} />
      </button>
    )}


    {/* Tablet side dock — quick actions without crowding the header */}
    {deviceMode === "tablet" && !focusMode && (
      <aside className="tablet-side-dock" aria-label={tr(appIsAr, "Quick actions", "إجراءات سريعة")}>
        <button type="button" className="tablet-dock-btn" onClick={() => onOpenAdd && onOpenAdd()} title={tr(appIsAr, "Add word", "إضافة كلمة")}>
          <PlusIcon size={22} />
          <span>{tr(appIsAr, "Add", "إضافة")}</span>
        </button>
        <button
          type="button"
          className={"tablet-dock-btn" + (showQuiz ? " is-active" : "")}
          onClick={() => { setQuizDueOnly(false); setShowQuiz(true); }}
          onContextMenu={(e) => { e.preventDefault(); setQuizDueOnly(true); setShowQuiz(true); }}
          title={tr(appIsAr, "Tap: quiz · Long-press: due only", "ضغط: اختبار · ضغطة طويلة: المستحق فقط")}
        >
          <span className="mobile-nav-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            {dueCountMobile > 0 && <span className="mobile-nav-badge">{dueCountMobile > 9 ? "9+" : dueCountMobile}</span>}
          </span>
          <span>{tr(appIsAr, "Quiz", "اختبار")}</span>
        </button>
        <button type="button" className={"tablet-dock-btn" + (showGoals ? " is-active" : "")} onClick={() => { setGoalsBubble(false); setShowGoals(true); }} title={tr(appIsAr, "Goals", "أهداف")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <span>{tr(appIsAr, "Goals", "أهداف")}</span>
        </button>
        <button type="button" className={"tablet-dock-btn" + (showTodo ? " is-active" : "")} onClick={() => { setTodoBubble(false); setShowTodo(true); }} title={tr(appIsAr, "To-do", "مهام")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M3 12h6M3 6h6M3 18h6"/></svg>
          <span>{tr(appIsAr, "To-do", "مهام")}</span>
        </button>
        <button type="button" className="tablet-dock-btn" onClick={() => onOpenAccount && onOpenAccount()} title={tr(appIsAr, "Account", "حسابي")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          <span>{tr(appIsAr, "Account", "حسابي")}</span>
        </button>
      </aside>
    )}

    {/* Mobile bottom navigation — only when user chose Phone layout */}
    {deviceMode === "mobile" && !focusMode && (
      <nav className="mobile-bottom-nav" aria-label={tr(appIsAr, "Main navigation", "التنقل الرئيسي")}>
        <button
          type="button"
          className={"mobile-bottom-nav-item" + (mobileNavTab === "words" ? " is-active" : "")}
          onClick={() => {
            setMobileNavTab("words");
            try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (_) {}
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span>{tr(appIsAr, "Words", "كلمات")}</span>
        </button>
        <button
          type="button"
          className={"mobile-bottom-nav-item" + (mobileNavTab === "quiz" || showQuiz ? " is-active" : "")}
          onClick={() => { setMobileNavTab("quiz"); setQuizDueOnly(false); setShowQuiz(true); }}
          onContextMenu={(e) => { e.preventDefault(); setMobileNavTab("quiz"); setQuizDueOnly(true); setShowQuiz(true); }}
          title={tr(appIsAr, "Tap: quiz · Long-press: due only", "ضغط: اختبار · ضغطة طويلة: المستحق فقط")}
        >
          <span className="mobile-nav-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            {dueCountMobile > 0 && (
              <span className="mobile-nav-badge">{dueCountMobile > 9 ? "9+" : dueCountMobile}</span>
            )}
          </span>
          <span>{tr(appIsAr, "Quiz", "اختبار")}</span>
        </button>
        <button
          type="button"
          className={"mobile-bottom-nav-item" + (mobileNavTab === "goals" || showGoals ? " is-active" : "")}
          onClick={() => { setMobileNavTab("goals"); setGoalsBubble(false); setShowGoals(true); }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span>{tr(appIsAr, "Goals", "أهداف")}</span>
        </button>
        <button
          type="button"
          className={"mobile-bottom-nav-item" + (mobileNavTab === "todo" || showTodo ? " is-active" : "")}
          onClick={() => { setMobileNavTab("todo"); setTodoBubble(false); setShowTodo(true); }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 11l3 3L22 4" />
            <path d="M3 12h6" />
            <path d="M3 6h6" />
            <path d="M3 18h6" />
          </svg>
          <span>{tr(appIsAr, "To-do", "مهام")}</span>
        </button>
        <button
          type="button"
          className={"mobile-bottom-nav-item" + (mobileNavTab === "account" ? " is-active" : "")}
          onClick={() => { setMobileNavTab("account"); onOpenAccount && onOpenAccount(); }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
          <span>{tr(appIsAr, "Account", "حسابي")}</span>
        </button>
      </nav>
    )}

    {/* Focus mode exit chip */}
    {focusMode && (
      <button
        type="button"
        onClick={() => setFocusMode(false)}
        style={{
          position: "fixed",
          top: "calc(12px + env(safe-area-inset-top, 0px))",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 60,
          padding: "8px 14px",
          borderRadius: 20,
          border: "none",
          background: "var(--ink)",
          color: "var(--paper)",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 8px 20px -8px rgba(0,0,0,0.4)",
        }}
      >
        {tr(isAr, "Exit focus mode (F)", "خروج من وضع التركيز (F)")}
      </button>
    )}
    </>
  );
}

