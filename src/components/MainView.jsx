import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import { tr } from "../lib/config/i18n";
import { INK, PAPER, CARD, BRASS, errorStyle } from "../lib/config/theme";
import { getSpeechRecognitionCtor, recognizeSpeech, loadArDialect, startMicLevelMeter } from "../lib/utils/speech";
import { uid } from "../lib/utils/quizHelpers";
import {
  SearchIcon, PlusIcon, XIcon, LoaderIcon, CheckIcon, WifiOffIcon,
  UndoIcon, ClockIcon, MicIcon, BookIcon,
} from "./common/Icons";
import { firstLetterKey, fuzzyIncludes, matchScore } from "../lib/utils/searchUtils";
import { normalizePairs } from "../lib/utils/pairUtils";
import { parseCsv, exportEntriesAsCsv } from "../lib/utils/csvUtils";
import { makeLogEntry } from "../lib/state/logs";
import { SECTIONS } from "../lib/config/sections";
import { loadSearchHistory, addToSearchHistory, removeFromSearchHistory, clearSearchHistory } from "../lib/state/storage";
import EntryCard from "./common/EntryCard";
import HeaderMenu from "./layout/HeaderMenu";
import ToolsMenu from "./layout/ToolsMenu";
import ReminderBanner from "./layout/ReminderBanner";
import BackupReminderBanner from "./layout/BackupReminderBanner";
import WordOfTheDay from "./layout/WordOfTheDay";
import EmptyState from "./layout/EmptyState";

// These are only ever rendered behind a boolean flag (showQuiz, showAdd,
// etc.) — never on first paint. Loading them lazily keeps their code
// (QuizModal alone pulls in the ~380-line quiz engine) out of the main
// bundle, so the initial page load only ships the code actually needed
// to show the word list.
const QuizModal = lazy(() => import("./modals/QuizModal"));
const StatsModal = lazy(() => import("./modals/StatsModal"));
const LeaderboardModal = lazy(() => import("./modals/LeaderboardModal"));
const FlashcardsModal = lazy(() => import("./modals/FlashcardsModal"));
const AddModal = lazy(() => import("./modals/AddModal"));
const AccountModal = lazy(() => import("./modals/AccountModal"));
const AdminModal = lazy(() => import("./modals/AdminModal"));
const WordZoomModal = lazy(() => import("./modals/WordZoomModal"));
const TimerPage = lazy(() => import("./timer/TimerPage"));

export default function MainView({
  name, isAdmin, entries, entriesLoaded, loadError, isOffline, offlineCachedAt, section, onChangeSection, query, setQuery,
  showAdd, onOpenAdd, onCloseAdd, persistEntries, saveError, onLogout,
  accounts, accountCode, logs, onClearLogs, studiedIds, studiedAt, onToggleStudied, favoriteIds, onToggleFavorite, showAccount, onOpenAccount, onCloseAccount, onUpdateOwnName,
  srsBox, srsDueAt, quizHistory, onRecordSrsAnswer, onSaveQuizResult,
  showAdmin, onOpenAdmin, onCloseAdmin, onAdminAddAccount, onAdminEditAccount, onAdminDeleteAccount,
  toast, showToast, theme, onToggleTheme, accentTheme, onChangeAccent,
  appIsAr, onToggleAppLang,
  sessionStart,
  remindersOn, remindersBusy, onEnableReminders, onDisableReminders, onTestReminder,
  reminderTitle, onChangeReminderTitle,
  reminderMessage, onChangeReminderMessage,
}) {
  const cfg = SECTIONS[section];
  const isAr = section === "ar-ar";
  const sectionEntries = useMemo(() => entries.filter((e) => e.section === section), [entries, section]);
  const studiedCount = useMemo(() => sectionEntries.filter((e) => studiedIds.has(e.id)).length, [sectionEntries, studiedIds]);
  const notStudiedCount = sectionEntries.length - studiedCount;
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
    const stopMeter = startMicLevelMeter(setVoiceMicLevel);
    try {
      const lang = isAr ? loadArDialect() : "en-US";
      const text = await recognizeSpeech(lang, { onStart: () => setVoiceMicState("listening") });
      setQuery(text);
      setShowSuggestions(true);
    } catch (e) {
      showToast(tr(isAr, "Didn't catch that — try again.", "معرفتش أسمع صح — جرّب تاني."));
    } finally {
      stopMeter();
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
  const [quizDueOnly, setQuizDueOnly] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
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
    if (target) setZoomEntry(target);
  }, [entries]);

  const handleToggleStudiedById = useCallback((id) => { onToggleStudied(id); }, [onToggleStudied]);
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
                accentTheme={accentTheme} onChangeAccent={onChangeAccent}
                remindersOn={remindersOn} remindersBusy={remindersBusy} onEnableReminders={onEnableReminders} onDisableReminders={onDisableReminders} onTestReminder={onTestReminder}
                reminderTitle={reminderTitle} onChangeReminderTitle={onChangeReminderTitle}
                reminderMessage={reminderMessage} onChangeReminderMessage={onChangeReminderMessage} />
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
              onTimer={() => setShowTimer(true)}
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
        <WordOfTheDay entries={sectionEntries} section={section} cfg={cfg} isAr={isAr} onOpenZoom={(id) => setZoomEntry(sectionEntries.find((e) => e.id === id) || null)} />
        <ReminderBanner studiedAt={studiedAt} isAr={isAr} cfg={cfg} remindersOn={remindersOn} reminderTitle={reminderTitle} reminderMessage={reminderMessage} onOpenQuiz={() => { setQuizDueOnly(true); setShowQuiz(true); }} />
        {isAdmin && <BackupReminderBanner isAr={isAr} cfg={cfg} onOpenBackup={onOpenAdmin} />}
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
                        onDelete={handleDelete} onEdit={handleEditRequest}
                        onOpenZoom={handleZoomRequest}
                        isStudied={studiedIds.has(e.id)} onToggleStudied={handleToggleStudiedById}
                        isFavorite={favoriteIds.has(e.id)} onToggleFavorite={handleToggleFavoriteById}
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

      <Suspense fallback={null}>
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
            initialDueOnly={quizDueOnly}
            onClose={() => { setShowQuiz(false); setQuizDueOnly(false); }}
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
        {showTimer && (
          <TimerPage
            isAr={isAr}
            onClose={() => setShowTimer(false)}
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
            entries={entries}
            myAccountCode={accountCode}
            logs={logs}
            onClearLogs={onClearLogs}
            onClose={onCloseAdmin}
            onAdd={onAdminAddAccount}
            onEdit={onAdminEditAccount}
            onDelete={onAdminDeleteAccount}
            isAr={isAr}
          />
        )}
      </Suspense>
      {toast && (
        <div role="status" aria-live="polite" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--success)", color: "#fff", padding: "10px 18px", borderRadius: 4, fontSize: 13, fontWeight: 600, boxShadow: "0 10px 24px -10px rgba(0,0,0,0.35)", zIndex: 60, display: "flex", alignItems: "center", gap: 7 }}>
          <CheckIcon size={14} /> {tr(isAr, toast, toast === "Account info updated." ? "تم تحديث بيانات الحساب." : toast)}
        </div>
      )}
    </div>
  );
}

