import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { tr } from "./lib/config/i18n";
import { fetchRecord, saveRecord, SaveConflictError } from "./lib/state/cloudApi";
import {
  loadSavedAccent, saveAccent, applyAccentTheme, ACCENT_THEMES, THEME_KEY,
  loadSearchHistory, saveSearchHistory, addToSearchHistory, removeFromSearchHistory, clearSearchHistory,
  saveOfflineCache, loadOfflineCache, loadSavedTheme, savePersonalCode, loadPersonalCode, clearPersonalCode,
  saveSessionId, loadSessionId, generateSessionId,
  generatePersonalCode, detectDeviceIsAr, hasInviteParam,
  loadAppLang, saveAppLang,
} from "./lib/state/storage";
import {
  validateUsername, validatePassword, hashPassword, verifyPassword, verifyPasswordDetailed, migrateAccounts, normalizeUsername,
} from "./lib/utils/authUtils";
import { SRS_LEVEL_INTERVALS_MS, srsLevelFromStats, computeStreak } from "./lib/utils/quizHelpers";
import { evaluateAchievements } from "./lib/state/achievements";
import { getTodayTimerMinutes } from "./lib/state/goals";
import {
  pushSupported, getPushStatus, subscribeToPush, unsubscribeFromPush, savePushPrefs,
  loadRemindersEnabled, saveRemindersEnabled,
  loadReminderMessage, saveReminderMessage, loadReminderTitle, saveReminderTitle,
  buildReminderPayload,
} from "./lib/state/push";
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
  ); // intro | signup | pendingShown | login | restoring | in
  const [name, setName] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPassword2, setSignupPassword2] = useState("");
  const [authError, setAuthError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupSaving, setSignupSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [moreFeaturesOpen, setMoreFeaturesOpen] = useState(false);
  const migrationDoneRef = useRef(false);

  // App-wide UI language (en / ar / de / fr). Independent of dictionary content.
  // Starts from saved preference, else device language.
  const [appLang, setAppLangState] = useState(() => loadAppLang());
  const appIsAr = appLang === "ar";
  const atr = (en, ar, de, fr) => tr(appLang, en, ar, de, fr);
  function setAppLang(lang) {
    if (lang !== "en" && lang !== "ar" && lang !== "de" && lang !== "fr") return;
    setAppLangState(lang);
    saveAppLang(lang);
    try {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    } catch (_) {}
  }
  function toggleAppLang() {
    // Legacy two-way flip used on older auth toggle — cycles en <-> ar
    setAppLang(appLang === "ar" ? "en" : "ar");
  }
  // Keep <html lang/dir> in sync on mount + change
  useEffect(() => {
    try {
      document.documentElement.lang = appLang;
      document.documentElement.dir = appLang === "ar" ? "rtl" : "ltr";
    } catch (_) {}
  }, [appLang]);

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
  const [siteBanner, setSiteBanner] = useState(null); // admin-published site-wide announcement
  const [accountCode, setAccountCode] = useState(""); // this browser's signed-in account's personal code
  const [accessCode, setAccessCode] = useState(""); // shared ACCESS_CODE kept in memory only (never localStorage)
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

  /* =======================================================================
     STUDY REMINDERS — lifted up here (instead of living only inside
     ReminderBanner) so the on/off control can live in the top header menu
     too, and both stay in sync no matter which one the person used.
     ======================================================================= */
  const [remindersOn, setRemindersOn] = useState(false);
  const [remindersBusy, setRemindersBusy] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const prefsSaveTimerRef = useRef(null);

  // Reload this account's own notification prefs whenever the signed-in
  // account changes — never reuse another account's title/body/on-state.
  useEffect(() => {
    if (!accountCode) {
      setRemindersOn(false);
      setReminderTitle("");
      setReminderMessage("");
      return;
    }
    setRemindersOn(loadRemindersEnabled(accountCode));
    setReminderTitle(loadReminderTitle(accountCode));
    setReminderMessage(loadReminderMessage(accountCode));
  }, [accountCode]);

  function schedulePrefsSave(next) {
    if (prefsSaveTimerRef.current) clearTimeout(prefsSaveTimerRef.current);
    prefsSaveTimerRef.current = setTimeout(() => {
      if (!accountCode || !remindersOn) return;
      savePushPrefs(accountCode, next).catch(() => {});
    }, 700);
  }

  function getReminderPrefs() {
    return {
      title: reminderTitle,
      message: reminderMessage,
    };
  }

  function handleChangeReminderTitle(title) {
    setReminderTitle(title);
    if (accountCode) saveReminderTitle(title, accountCode);
    schedulePrefsSave({ title, message: reminderMessage });
  }

  function handleChangeReminderMessage(message) {
    setReminderMessage(message);
    if (accountCode) saveReminderMessage(message, accountCode);
    schedulePrefsSave({ title: reminderTitle, message });
  }


  // On load, if the person previously opted in AND permission is still
  // granted but the subscription was somehow lost (e.g. cleared site
  // data), re-subscribe quietly so reminders keep working.
  useEffect(() => {
    (async () => {
      if (!remindersOn || !accountCode || !pushSupported()) return;
      const status = await getPushStatus();
      if (status === "granted") await subscribeToPush(accountCode, getReminderPrefs());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountCode]);

  // Optimistic UI: flip the toggle immediately so the menu feels instant.
  // Network / permission work runs in the background; if enable fails
  // (permission denied, unsupported, server error) we roll the flag back.
  async function enableReminders() {
    if (remindersBusy) return;
    setRemindersOn(true);
    if (accountCode) saveRemindersEnabled(accountCode, true);
    setRemindersBusy(true);
    try {
      if (pushSupported() && accountCode) {
        const result = await subscribeToPush(accountCode, getReminderPrefs());
        if (!result.ok) {
          setRemindersOn(false);
          if (accountCode) saveRemindersEnabled(accountCode, false);
        }
      } else if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setRemindersOn(false);
          if (accountCode) saveRemindersEnabled(accountCode, false);
        }
      }
    } catch (e) {
      setRemindersOn(false);
      if (accountCode) saveRemindersEnabled(accountCode, false);
    }
    setRemindersBusy(false);
  }

  async function disableReminders() {
    setRemindersOn(false);
    if (accountCode) saveRemindersEnabled(accountCode, false);
    setRemindersBusy(false);
    // Unsubscribe in the background — UI is already off, no lag.
    if (accountCode) {
      try { await unsubscribeFromPush(accountCode); } catch (e) { /* ignore */ }
    }
  }

  // Test push — sends the FINAL notification shape (custom title/body the
  // user typed, or the default if empty) so they can preview exactly what
  // the real reminder will look like.
  async function testReminderPush() {
    if (!accountCode) {
      showToast("سجّل الدخول أولاً / Sign in first");
      return;
    }
    try {
      if (pushSupported()) {
        const sub = await subscribeToPush(accountCode, getReminderPrefs());
        if (!sub.ok) {
          const err = sub.error || sub.reason || "";
          if (err === "denied") {
            showToast("الإذن مرفوض — فعّل الإشعارات من إعدادات المتصفح");
          } else if (err === "no_vapid") {
            showToast("مفتاح VAPID ناقص — حط VITE_VAPID_PUBLIC_KEY في Vercel ثم redeploy");
          } else {
            showToast(sub.message || "مفيش اشتراك Push — فعّل التذكيرات ووافق على الإذن");
          }
          return;
        }
        setRemindersOn(true);
        if (accountCode) saveRemindersEnabled(accountCode, true);
      }
      const payload = buildReminderPayload({
        title: reminderTitle,
        message: reminderMessage,
      });
      const r = await fetch("/api/push-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accountCode, title: payload.title, body: payload.body }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        // Success: the OS notification itself is the feedback — no in-app toast.
      } else if (data.error === "no_subscription") {
        showToast("مفيش اشتراك محفوظ — فعّل التذكيرات ووافق على الإذن");
      } else if (data.error === "subscription_expired") {
        showToast("الاشتراك انتهى — أوقف التذكيرات وشغّلها تاني");
      } else if (data.error === "vapid_invalid" || /unexpected response code/i.test(String(data.error || data.message || ""))) {
        showToast("مفاتيح VAPID غلط — ولّد مفاتيح جديدة وحطها في Vercel ثم redeploy");
      } else {
        showToast(data.message || data.error || `فشل الإرسال (${r.status})`);
      }
    } catch (e) {
      showToast("خطأ شبكة أثناء تجربة الإشعار");
    }
  }

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  }

  function handleGuest() {
    let studied = [], studiedAt = {}, favorites = [];
    try {
      const raw = localStorage.getItem("twoTongues.guestStudied");
      if (raw) {
        const data = JSON.parse(raw);
        studied = data.studied || [];
        studiedAt = data.studiedAt || {};
        favorites = data.favorites || [];
      }
    } catch (_) {}
    setAccounts((prev) => {
      const others = prev.filter((a) => a.code !== "guest");
      return [...others, { code: "guest", name: "Guest", role: "user", studied, studiedAt, favorites, status: "active" }];
    });
    setName("Guest");
    setIsAdmin(false);
    setAccountCode("guest");
    setAuthStage("in");
    try { window.history.replaceState({ authStage: "in", showAdd: false, showAccount: false, showAdmin: false, section: "en-ar" }, ""); } catch (_) {}
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

  // One-time migration: assign usernames to legacy accounts that only had a
  // name + personal code, and mark them active so they keep working.
  async function ensureMigratedAccounts(rec) {
    const { accounts: migrated, changed } = migrateAccounts(rec.accounts || []);
    if (!changed || migrationDoneRef.current) {
      return { ...rec, accounts: migrated };
    }
    migrationDoneRef.current = true;
    // Only persist migration when we already hold a verified access code
    // (otherwise the PUT would be rejected). In-memory migration still
    // applies so the UI works; a later authenticated save will write it.
    if (!accessCode) {
      return { ...rec, accounts: migrated };
    }
    try {
      const newVersion = await saveRecord(
        { entries: rec.entries || [], accounts: migrated, logs: rec.logs || [], siteBanner: rec.siteBanner || null },
        rec.version || 0,
        accessCode
      );
      return { ...rec, accounts: migrated, version: newVersion };
    } catch (e) {
      // Conflict or offline — still use migrated in-memory so the UI works;
      // next successful save will persist usernames.
      return { ...rec, accounts: migrated };
    }
  }

  useEffect(() => {
    (async () => {
      try {
        let rec = await fetchRecord();
        rec = await ensureMigratedAccounts(rec);
        setEntries(rec.entries);
        setAccounts(rec.accounts);
        setLogs(rec.logs);
        setSiteBanner(rec.siteBanner || null);
        setLogsLoaded(true);
        setRecordVersion(rec.version);
        saveOfflineCache(rec);
        setIsOffline(false);
        if (savedPersonalCode) {
          let account = rec.accounts.find((a) => a.code === savedPersonalCode);
          if (!account) {
            try {
              const freshRec = await ensureMigratedAccounts(await fetchRecord({ fresh: true }));
              rec = freshRec;
              setEntries(freshRec.entries);
              setAccounts(freshRec.accounts);
              setLogs(freshRec.logs);
              setSiteBanner(freshRec.siteBanner || null);
              setRecordVersion(freshRec.version);
              saveOfflineCache(freshRec);
              account = freshRec.accounts.find((a) => a.code === savedPersonalCode);
            } catch (e2) { /* fall through */ }
          }
          if (account && account.status !== "pending" && account.status !== "rejected") {
            // Session rules:
            // - If this browser has a sessionId AND it differs from the cloud →
            //   another device signed in → force login.
            // - If local sessionId is missing (refresh, new tab, cleared storage)
            //   but personalCode is still saved → stay signed in and re-bind
            //   the local session to the cloud one (or claim a new one).
            //   Logging out on missing localSid was kicking users on every
            //   refresh / new tab.
            const localSid = loadSessionId();
            if (account.sessionId && localSid && account.sessionId !== localSid) {
              clearPersonalCode();
              try { localStorage.removeItem("twoTongues.sessionId"); } catch (_) {}
              setAuthStage("login");
              syncBaseHistory("login");
            } else {
              setName(account.name);
              setIsAdmin(account.role === "admin");
              setAccountCode(account.code);
              setAuthStage("in");
              syncBaseHistory("in");
              if (!account.sessionId) {
                // First bind: claim a session token for this account.
                const sid = generateSessionId();
                saveSessionId(sid);
                const nextAccounts = rec.accounts.map((a) =>
                  a.code === account.code ? { ...a, sessionId: sid, sessionAt: Date.now() } : a
                );
                try {
                  if (accessCode) {
                    const newVersion = await saveRecord(
                      { entries: rec.entries, accounts: nextAccounts, logs: rec.logs, siteBanner: rec.siteBanner || null },
                      rec.version || 0,
                      accessCode
                    );
                    setAccounts(nextAccounts);
                    setRecordVersion(newVersion);
                  } else {
                    setAccounts(nextAccounts);
                  }
                } catch (_) {
                  setAccounts(nextAccounts);
                }
              } else if (!localSid) {
                // Same browser, lost local token (or new tab before write) —
                // adopt the cloud session so refresh stays signed in.
                saveSessionId(account.sessionId);
              } else {
                saveSessionId(localSid);
              }
            }
          } else {
            clearPersonalCode();
            setAuthStage("login");
            syncBaseHistory("login");
          }
        }
      } catch (e) {
        const cached = loadOfflineCache();
        if (cached && ((cached.entries && cached.entries.length) || (cached.accounts && cached.accounts.length))) {
          const { accounts: migrated } = migrateAccounts(cached.accounts || []);
          setEntries(cached.entries);
          setAccounts(migrated);
          setLogs(cached.logs);
          setSiteBanner(cached.siteBanner || null);
          setIsOffline(true);
          setOfflineCachedAt(cached.cachedAt);
          if (savedPersonalCode) {
            const account = migrated.find((a) => a.code === savedPersonalCode);
            if (account && account.status !== "pending" && account.status !== "rejected") {
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
    if (err.fresh.siteBanner !== undefined) setSiteBanner(err.fresh.siteBanner || null);
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
        const newVersion = await saveRecord({ entries: next, accounts: curAccounts, logs: nextLogs, siteBanner }, curVersion, accessCode);
        setRecordVersion(newVersion);
        saveOfflineCache({ entries: next, accounts: curAccounts, logs: nextLogs, siteBanner });
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
  }, [entries, accounts, logs, siteBanner, recordVersion, accessCode]);

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
        const newVersion = await saveRecord({ entries: curEntries, accounts: next, logs: nextLogs, siteBanner }, curVersion, accessCode);
        setRecordVersion(newVersion);
        saveOfflineCache({ entries: curEntries, accounts: next, logs: nextLogs, siteBanner });
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
  }, [entries, accounts, logs, siteBanner, recordVersion, accessCode]);

  // For events that don't touch entries/accounts (sign in/out) — still saved
  // into the same shared record so it stays in sync with everything else.
  const persistLogs = useCallback(async (next) => {
    setLogs(next);
    try {
      const newVersion = await saveRecord({ entries, accounts, logs: next, siteBanner }, recordVersion, accessCode);
      setRecordVersion(newVersion);
    } catch (e) {
      // Best-effort: a failed log write shouldn't block sign-in/out. On a
      // conflict, still resync so we don't keep hammering a stale version.
      if (e instanceof SaveConflictError) handleSaveConflict(e);
    }
  }, [entries, accounts, siteBanner, recordVersion, accessCode]);

  function logEvent(action, message, actorName, actorCode) {
    persistLogs(capLogs([...logs, makeLogEntry(action, message, actorName, actorCode)]));
  }

  // Admin publishes / clears the site-wide announcement banner.
  const persistSiteBanner = useCallback(async (nextBanner) => {
    setSiteBanner(nextBanner);
    let curVersion = recordVersion;
    for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt++) {
      try {
        const newVersion = await saveRecord(
          { entries, accounts, logs, siteBanner: nextBanner },
          curVersion,
          accessCode
        );
        setRecordVersion(newVersion);
        saveOfflineCache({ entries, accounts, logs, siteBanner: nextBanner });
        return { ok: true };
      } catch (e) {
        if (e instanceof SaveConflictError && attempt < MAX_SAVE_RETRIES) {
          setEntries(e.fresh.entries || []);
          setAccounts(e.fresh.accounts || []);
          setLogs(e.fresh.logs || []);
          curVersion = e.fresh.version || 0;
          // Keep trying to write OUR banner on top of the fresh record.
          continue;
        }
        if (e instanceof SaveConflictError) handleSaveConflict(e);
        return { ok: false, error: "Couldn't save the announcement — try again." };
      }
    }
    return { ok: false, error: "Couldn't save the announcement — try again." };
  }, [entries, accounts, logs, recordVersion, accessCode]);


  // Admin action: wipe the activity log down to just the "first sign in"
  // entries (keeps the account-creation history, drops everything else —
  // word/account edits, regular sign-in/out noise, etc.).
  function clearLogsExceptFirstSignIn() {
    persistLogs(logs.filter((entry) => entry.action === "first_sign_in"));
  }

  // Auto-clearing stale log entries used to run once per app load, right
  // after the logs arrived from the server — but that meant EVERY device/
  // tab that opened the app on a new day tried to write at once, which is
  // exactly the kind of near-simultaneous save that trips the version
  // conflict warning (see handleSaveConflict) even though nobody actually
  // touched anything. That cleanup now runs server-side, once a day, from
  // the existing daily cron (see the tail of api/push-send-reminders.js) —
  // so it only ever writes once, not once per open tab.

  // Toggles whether the current signed-in account has marked a given entry
  // as studied/seen. Stored per-account (account.studied: [entryId, ...]) so
  // each user tracks their own progress against the shared word list. Also
  // stamps (or clears) account.studiedAt[entryId] with when that happened,
  // so the quiz can later ask "words I studied in the last N minutes".
  async function handleToggleStudied(entryId) {
    if (accountCode === "guest") {
      try {
        const raw = localStorage.getItem("twoTongues.guestStudied");
        const data = raw ? JSON.parse(raw) : { studied: [], studiedAt: {} };
        const current = data.studied || [];
        const currentAt = data.studiedAt || {};
        const nowStudying = !current.includes(entryId);
        const nextStudied = nowStudying ? [...current, entryId] : current.filter((id) => id !== entryId);
        const nextStudiedAt = { ...currentAt };
        if (nowStudying) nextStudiedAt[entryId] = Date.now();
        else delete nextStudiedAt[entryId];
        localStorage.setItem("twoTongues.guestStudied", JSON.stringify({ studied: nextStudied, studiedAt: nextStudiedAt }));
        // force re-render via dummy account merge
        setAccounts((prev) => {
          const others = prev.filter((a) => a.code !== "guest");
          return [...others, { code: "guest", name: "Guest", studied: nextStudied, studiedAt: nextStudiedAt, favorites: [] }];
        });
      } catch (_) {}
      return;
    }
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
    // Passed as a function (not a precomputed array) so persistAccounts can
    // safely auto-retry on a version conflict, re-deriving the update from
    // the freshest accounts each time. This matters a lot here: quiz
    // questions fire these calls back-to-back without waiting for the
    // previous save to finish, so consecutive calls routinely race against
    // each other's own in-flight save — not actually a different user.
    try {
      await persistAccounts((curAccounts) => curAccounts.map((a) => {
        if (a.code !== accountCode) return a;
        const prevStats = (a.srsStats && a.srsStats[entryId]) || { correct: 0, total: 0 };
        const nextStats = { correct: prevStats.correct + (correct ? 1 : 0), total: prevStats.total + 1 };
        const nextLevel = correct ? srsLevelFromStats(nextStats) : 0; // a miss always means "re-test soon", regardless of the word's overall level
        const levelIdx = Math.max(0, Math.min(nextLevel, SRS_LEVEL_INTERVALS_MS.length - 1));
        const nextDue = Date.now() + SRS_LEVEL_INTERVALS_MS[levelIdx];
        return { ...a, srsStats: { ...(a.srsStats || {}), [entryId]: nextStats }, srsDueAt: { ...(a.srsDueAt || {}), [entryId]: nextDue } };
      }));
    } catch (e) { /* best-effort, quiz keeps going */ }
  }

  // Appends one finished quiz's summary to the account's history (for the
  // Stats panel), capped to the most recent 50 so the shared bin stays small.
  async function handleSaveQuizResult(result) {
    try {
      await persistAccounts((curAccounts) => curAccounts.map((a) => {
        if (a.code !== accountCode) return a;
        const nextHistory = [...((a.quizHistory) || []), result].slice(-50);
        let next = { ...a, quizHistory: nextHistory };
        try {
          let dictationRounds = 0;
          try { dictationRounds = Number(localStorage.getItem("twoTongues.dictationRounds." + accountCode) || 0); } catch (_) {}
          const box = {};
          for (const id of Object.keys(next.srsStats || {})) box[id] = srsLevelFromStats(next.srsStats[id]);
          const newly = evaluateAchievements(next, {
            streak: computeStreak(next.studiedAt || {}),
            srsBox: box,
            timerMinutesTotal: getTodayTimerMinutes(),
            dictationRounds,
          });
          if (newly.length) {
            next = { ...next, achievements: [...new Set([...(next.achievements || []), ...newly])] };
          }
        } catch (_) {}
        return next;
      }));
    } catch (e) { /* best-effort */ }
  }

  async function handleSignup(e) {
    e.preventDefault();
    setSignupError("");
    const trimmedName = name.trim();
    if (!trimmedName) { setSignupError("Enter a name."); return; }

    const sharedCode = codeInput.trim();
    if (!sharedCode) { setSignupError("Enter the access code."); return; }

    const uCheck = validateUsername(signupUsername);
    if (!uCheck.ok) { setSignupError(uCheck.error); return; }
    const pCheck = validatePassword(signupPassword);
    if (!pCheck.ok) { setSignupError(pCheck.error); return; }
    if (signupPassword !== signupPassword2) {
      setSignupError("Passwords do not match.");
      return;
    }

    setSignupSaving(true);
    // Verify shared access code before creating the pending account.
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: sharedCode }),
      });
      const verified = await res.json();
      if (!verified || !verified.ok) {
        setSignupError((verified && verified.error) || "That access code doesn't match.");
        setSignupSaving(false);
        return;
      }
      setAccessCode(sharedCode);
    } catch (err) {
      setSignupError("Couldn't verify the access code — check your connection and try again.");
      setSignupSaving(false);
      return;
    }
    try {
      const rec = await ensureMigratedAccounts(await fetchRecord({ fresh: true }));
      const clash = (rec.accounts || []).some(
        (a) => normalizeUsername(a.username) === uCheck.username
      );
      if (clash) {
        setSignupError("That username is already taken. Pick another.");
        setAccounts(rec.accounts);
        setEntries(rec.entries);
        setLogs(rec.logs);
        setSiteBanner(rec.siteBanner || null);
        setRecordVersion(rec.version);
        return;
      }
      const code = generatePersonalCode();
      const passwordHash = await hashPassword(pCheck.password, code);
      const nextAccounts = [
        ...(rec.accounts || []),
        {
          name: trimmedName,
          username: uCheck.username,
          passwordHash,
          code,
          role: "user",
          status: "pending",
          createdAt: Date.now(),
        },
      ];
      const nextLogs = capLogs([
        ...(rec.logs || []),
        makeLogEntry(
          "account_add",
          `${trimmedName} (@${uCheck.username}) requested an account`,
          trimmedName,
          code
        ),
      ]);
      const newVersion = await saveRecord(
        { entries: rec.entries, accounts: nextAccounts, logs: nextLogs, siteBanner: rec.siteBanner || null },
        rec.version,
        sharedCode
      );
      setEntries(rec.entries);
      setAccounts(nextAccounts);
      setLogs(nextLogs);
      setRecordVersion(newVersion);
      setSignupPassword("");
      setSignupPassword2("");
      goToStage("pendingShown");
    } catch (err) {
      if (err instanceof SaveConflictError) {
        setSignupError("Someone else just made a change — please try again.");
      } else {
        setSignupError("Couldn't create the account — check your connection and try again.");
      }
    } finally {
      setSignupSaving(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setAuthError("");

    const accessCode = codeInput.trim();
    if (!accessCode) { setAuthError("Enter the access code."); return; }
    if (!accountsLoaded) { setAuthError("Still loading — please try again in a moment."); return; }

    const uCheck = validateUsername(usernameInput);
    if (!uCheck.ok) { setAuthError(uCheck.error); return; }
    if (!passwordInput) { setAuthError("Enter your password."); return; }

    let curAccounts = accounts;
    let account = curAccounts.find((a) => normalizeUsername(a.username) === uCheck.username);
    if (!account) {
      try {
        const rec = await ensureMigratedAccounts(await fetchRecord({ fresh: true }));
        curAccounts = rec.accounts;
        setAccounts(rec.accounts);
        setEntries(rec.entries);
        setLogs(rec.logs);
        setSiteBanner(rec.siteBanner || null);
        setRecordVersion(rec.version);
        account = curAccounts.find((a) => normalizeUsername(a.username) === uCheck.username);
      } catch (e) { /* fall through */ }
    }
    if (!account) { setAuthError("That username doesn't match any account."); return; }
    if (account.status === "pending") {
      setAuthError("Your account is still waiting for admin approval.");
      return;
    }
    if (account.status === "rejected") {
      setAuthError("Your account request was declined. Contact an admin.");
      return;
    }

    setLoggingIn(true);
    let passwordOk = false;
    let shouldUpgradeHash = false;
    try {
      if (account.passwordHash) {
        const result = await verifyPasswordDetailed(passwordInput, account.code, account.passwordHash);
        passwordOk = result.ok;
        shouldUpgradeHash = !!(result.ok && result.needsUpgrade);
      }
      // Legacy / recovery: personal code accepted as password once.
      // Also covers accounts whose hash was produced by an older build
      // whose algorithm we no longer match — users can sign in with the
      // personal code and we rewrite the hash to the canonical form.
      if (!passwordOk) {
        const typed = passwordInput.trim();
        if (typed && typed === String(account.code)) {
          passwordOk = true;
          shouldUpgradeHash = true;
        }
      }
      if (passwordOk && shouldUpgradeHash) {
        const newHash = await hashPassword(passwordInput, account.code);
        curAccounts = curAccounts.map((a) =>
          a.code === account.code ? { ...a, passwordHash: newHash } : a
        );
        account = curAccounts.find((a) => a.code === account.code) || account;
        // Persist hash upgrade after access-code verification below (uses accessCode).
      }
    } catch (err) {
      setLoggingIn(false);
      setAuthError("Couldn't verify the password — try again.");
      return;
    }
    if (!passwordOk) {
      setLoggingIn(false);
      setAuthError("Wrong password.");
      return;
    }

    let verified;
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accessCode }),
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
    setAccessCode(accessCode);
    savePersonalCode(account.code);
    // Keep password field until login fully succeeds — cleared after session is saved.

    // Persist any password-hash upgrade now that we hold a verified access code.
    if (shouldUpgradeHash) {
      try {
        const newVersion = await saveRecord(
          { entries, accounts: curAccounts, logs, siteBanner },
          recordVersion,
          accessCode
        );
        setAccounts(curAccounts);
        setRecordVersion(newVersion);
      } catch (e) {
        setAccounts(curAccounts);
      }
    }

    // New session token — invalidates any other device still holding the old one.
    const sid = generateSessionId();
    saveSessionId(sid);
    const withSession = curAccounts.map((a) =>
      a.code === account.code
        ? {
            ...a,
            sessionId: sid,
            sessionAt: Date.now(),
            ...(a.role !== "admin" && !a.firstSignInAt ? { firstSignInAt: Date.now() } : {}),
          }
        : a
    );
    curAccounts = withSession;

    if (account.role !== "admin") {
      const isFirstSignIn = !account.firstSignInAt;
      const logEntry = makeLogEntry(
        isFirstSignIn ? "first_sign_in" : "sign_in",
        isFirstSignIn
          ? `${account.name} (@${account.username}) signed in for the first time`
          : `${account.name} (@${account.username}) signed in`,
        account.name,
        account.code
      );
      await persistAccounts(withSession, logEntry);
    } else {
      // Admins still need the sessionId written so other devices get kicked.
      try {
        await persistAccounts(withSession, null);
      } catch (_) {
        setAccounts(withSession);
      }
    }
    setPasswordInput("");
    goToStage("in");
  }

  function handleLogout() {
    if (accountCode && !isAdmin) {
      logEvent("sign_out", `${name} signed out`, name, accountCode);
    }
    clearPersonalCode();
    try { localStorage.removeItem("twoTongues.sessionId"); } catch (_) {}
    setName("");
    setIsAdmin(false);
    setAccountCode("");
    setAccessCode("");
    setCodeInput("");
    setUsernameInput("");
    setPasswordInput("");
    setAuthError("");
    setShowAdd(false);
    setShowAccount(false);
    setShowAdmin(false);
    goToStage("login");
  }

  // While signed in: periodically re-check that this device still owns the
  // account session. If the same account signed in elsewhere, kick this tab.
  useEffect(() => {
    if (authStage !== "in" || !accountCode) return;
    let cancelled = false;

    async function checkSession() {
      try {
        const rec = await fetchRecord({ fresh: true });
        if (cancelled) return;
        if (rec.accounts) setAccounts(rec.accounts);
        if (rec.siteBanner !== undefined) setSiteBanner(rec.siteBanner || null);
        if (typeof rec.version === "number") setRecordVersion(rec.version);
        const account = (rec.accounts || []).find((a) => a.code === accountCode);
        if (!account || account.status === "pending" || account.status === "rejected") {
          handleLogout();
          return;
        }
        const localSid = loadSessionId();
        // Only kick when this browser has a token that no longer matches
        // the cloud (signed in elsewhere). Missing local token = re-bind,
        // never logout — otherwise refresh / new tab boots the user out.
        if (account.sessionId && localSid && account.sessionId !== localSid) {
          handleLogout();
        } else if (account.sessionId && !localSid) {
          saveSessionId(account.sessionId);
        }
      } catch (_) {
        // Offline — don't kick the user just because the network dropped.
      }
    }

    const onFocus = () => checkSession();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkSession();
    });
    const interval = setInterval(checkSession, 45000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [authStage, accountCode]);

  async function handleUpdateOwnAccount({ name: newName, password: newPassword }) {
    const trimmed = (newName || "").trim();
    if (!trimmed) return { error: "Enter your name." };
    const updates = { name: trimmed };
    if (newPassword) {
      const pCheck = validatePassword(newPassword);
      if (!pCheck.ok) return { error: pCheck.error };
      updates.passwordHash = await hashPassword(pCheck.password, accountCode);
    }
    const oldName = name;
    const nextAccounts = accounts.map((a) =>
      a.code === accountCode ? { ...a, ...updates } : a
    );
    const logEntry = makeLogEntry(
      "account_edit",
      newPassword
        ? `${oldName} updated their account (name/password)`
        : `${oldName} renamed their own account to "${trimmed}"`,
      trimmed,
      accountCode
    );
    try {
      await persistAccounts(nextAccounts, logEntry);
    } catch (e) {
      return { error: appIsAr ? "تعذّر حفظ التغييرات — حاول مرة أخرى." : "Couldn't save changes — try again." };
    }
    setName(trimmed);
    showToast(appIsAr ? "تم تحديث الحساب." : "Account info updated.");
    return { ok: true };
  }

  async function handleApproveRequest(targetCode) {
    const target = accounts.find((a) => a.code === targetCode);
    if (!target || target.status !== "pending") return { error: "Request not found." };
    const nextAccounts = accounts.map((a) =>
      a.code === targetCode ? { ...a, status: "active" } : a
    );
    const logEntry = makeLogEntry(
      "account_edit",
      `${name} approved @${target.username || target.name}`,
      name,
      accountCode
    );
    await persistAccounts(nextAccounts, logEntry);
    showToast(appIsAr ? "تمت الموافقة على الطلب." : "Request approved.");
    return { ok: true };
  }

  async function handleRejectRequest(targetCode) {
    const target = accounts.find((a) => a.code === targetCode);
    if (!target || target.status !== "pending") return { error: "Request not found." };
    const nextAccounts = accounts.filter((a) => a.code !== targetCode);
    const logEntry = makeLogEntry(
      "account_delete",
      `${name} rejected request from @${target.username || target.name}`,
      name,
      accountCode
    );
    await persistAccounts(nextAccounts, logEntry);
    showToast(appIsAr ? "تم رفض الطلب." : "Request rejected.");
    return { ok: true };
  }

  async function handleAdminAddAccount(newName, role, username) {
    const trimmed = (newName || "").trim();
    if (!trimmed) return { error: "Enter a name." };
    const uCheck = validateUsername(username || "");
    if (!uCheck.ok) return { error: uCheck.error };
    if (accounts.some((a) => normalizeUsername(a.username) === uCheck.username)) {
      return { error: "That username is already taken." };
    }
    const code = generatePersonalCode();
    const nextRole = role === "admin" ? "admin" : "user";
    const passwordHash = await hashPassword(code, code);
    const nextAccounts = [
      ...accounts,
      {
        name: trimmed,
        username: uCheck.username,
        passwordHash,
        code,
        role: nextRole,
        status: "active",
        createdAt: Date.now(),
      },
    ];
    const logEntry = makeLogEntry(
      "account_add",
      `${name} added account "${trimmed}" (@${uCheck.username}, ${nextRole === "admin" ? "Admin" : "User"})`,
      name,
      accountCode
    );
    await persistAccounts(nextAccounts, logEntry);
    return { ok: true, code, username: uCheck.username };
  }

  async function handleAdminEditAccount(targetCode, updates) {
    const trimmedName = (updates.name || "").trim();
    if (!trimmedName) return { error: "Enter a name." };
    const nextRole = updates.role === "admin" ? "admin" : "user";
    let nextUsername;
    if (updates.username != null) {
      const uCheck = validateUsername(updates.username);
      if (!uCheck.ok) return { error: uCheck.error };
      if (
        accounts.some(
          (a) => a.code !== targetCode && normalizeUsername(a.username) === uCheck.username
        )
      ) {
        return { error: "That username is already taken." };
      }
      nextUsername = uCheck.username;
    }
    const target = accounts.find((a) => a.code === targetCode);
    const nextAccounts = accounts.map((a) => {
      if (a.code !== targetCode) return a;
      const patch = {
        name: trimmedName,
        role: nextRole,
        status: a.status === "pending" ? "active" : a.status || "active",
      };
      if (nextUsername) patch.username = nextUsername;
      return { ...a, ...patch };
    });
    const logEntry = makeLogEntry(
      "account_edit",
      `${name} edited account "${(target && target.name) || targetCode}" → name: "${trimmedName}", role: ${nextRole === "admin" ? "Admin" : "User"}`,
      name,
      accountCode
    );
    await persistAccounts(nextAccounts, logEntry);
    if (targetCode === accountCode) {
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
        authStage={authStage} appIsAr={appIsAr} appLang={appLang} atr={atr} theme={theme} toggleTheme={toggleTheme} toggleAppLang={toggleAppLang} onChangeAppLang={setAppLang}
        moreFeaturesOpen={moreFeaturesOpen} setMoreFeaturesOpen={setMoreFeaturesOpen} goToStage={goToStage}
        name={name} setName={setName}
        signupUsername={signupUsername} setSignupUsername={setSignupUsername}
        signupPassword={signupPassword} setSignupPassword={setSignupPassword}
        signupPassword2={signupPassword2} setSignupPassword2={setSignupPassword2}
        signupError={signupError} setSignupError={setSignupError} signupSaving={signupSaving} handleSignup={handleSignup}
        usernameInput={usernameInput} setUsernameInput={setUsernameInput}
        passwordInput={passwordInput} setPasswordInput={setPasswordInput}
        codeInput={codeInput} setCodeInput={setCodeInput}
        authError={authError} setAuthError={setAuthError} loggingIn={loggingIn} handleLogin={handleLogin} onGuest={handleGuest}
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
      showAccount={showAccount} onOpenAccount={openAccountModal} onCloseAccount={closeAccountModal} onUpdateOwnAccount={handleUpdateOwnAccount}
      siteBanner={siteBanner} onPersistSiteBanner={persistSiteBanner}
      showAdmin={showAdmin} onOpenAdmin={openAdminModal} onCloseAdmin={closeAdminModal}
      onAdminAddAccount={handleAdminAddAccount} onAdminEditAccount={handleAdminEditAccount} onAdminDeleteAccount={handleAdminDeleteAccount}
      onApproveRequest={handleApproveRequest} onRejectRequest={handleRejectRequest}
      toast={toast} showToast={showToast}
      theme={theme} onToggleTheme={toggleTheme}
      accentTheme={accentTheme} onChangeAccent={setAccentTheme}
      appIsAr={appIsAr} appLang={appLang} onToggleAppLang={toggleAppLang} onChangeAppLang={setAppLang}
      sessionStart={sessionStartRef.current}
      remindersOn={remindersOn} remindersBusy={remindersBusy} onEnableReminders={enableReminders} onDisableReminders={disableReminders} onTestReminder={testReminderPush}
      reminderTitle={reminderTitle} onChangeReminderTitle={handleChangeReminderTitle}
      reminderMessage={reminderMessage} onChangeReminderMessage={handleChangeReminderMessage}
    />
  );
}

