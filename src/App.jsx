import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { tr } from "./lib/config/i18n";
import { fetchRecord, saveRecord, SaveConflictError } from "./lib/state/cloudApi";
import {
  loadSavedAccent, saveAccent, applyAccentTheme, ACCENT_THEMES, THEME_KEY,
  loadSearchHistory, saveSearchHistory, addToSearchHistory, removeFromSearchHistory, clearSearchHistory,
  saveOfflineCache, loadOfflineCache, loadSavedTheme, savePersonalCode, loadPersonalCode, clearPersonalCode,
  generatePersonalCode, detectDeviceIsAr, hasInviteParam,
} from "./lib/state/storage";
import { SRS_LEVEL_INTERVALS_MS, srsLevelFromStats } from "./lib/utils/quizHelpers";
import { capLogs, makeLogEntry } from "./lib/state/logs";
import { LoaderIcon } from "./components/common/Icons";
import { Shell } from "./components/layout/Shell";
import AuthScreens from "./components/auth/AuthScreens";
import MainView from "./components/MainView";

const deviceIsAr = detectDeviceIsAr();
const savedPersonalCode = loadPersonalCode();

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
        setLogsLoaded(true);
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

  // Admin action: wipe the activity log down to just the "first sign in"
  // entries (keeps the account-creation history, drops everything else —
  // word/account edits, regular sign-in/out noise, etc.).
  function clearLogsExceptFirstSignIn() {
    persistLogs(logs.filter((entry) => entry.action === "first_sign_in"));
  }

  // Auto-clear the activity log at the start of each new day — keeps
  // "first sign in" entries (account-creation history) forever, but drops
  // everything else (word/account edits, regular sign-in/out noise) once
  // it's from a previous calendar day. Runs once per app load, right after
  // the logs arrive from the server, and only writes back if there's
  // actually something stale to drop.
  const dailyLogClearRanRef = useRef(false);
  useEffect(() => {
    if (dailyLogClearRanRef.current || !logsLoaded) return;
    dailyLogClearRanRef.current = true;
    const now = new Date();
    const isToday = (ts) => {
      const d = new Date(ts);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    };
    const hasStaleEntries = logs.some((entry) => entry.action !== "first_sign_in" && !isToday(entry.at));
    if (hasStaleEntries) {
      persistLogs(logs.filter((entry) => entry.action === "first_sign_in" || isToday(entry.at)));
    }
  }, [logsLoaded, logs, persistLogs]);

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
      accounts={accounts} accountCode={accountCode} logs={logs} onClearLogs={clearLogsExceptFirstSignIn}
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

