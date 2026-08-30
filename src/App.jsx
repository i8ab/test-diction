import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import {
  loadDayAchievements,
  loadDayAchievementNotifsEnabled,
  startDayAchievementDueWatcher,
} from "./lib/state/dayAchievements";
import {
  fetchBootstrap,
  fetchMyAccount,
  fetchAccountsOnly,
  fetchEntriesOnly,
  fetchLogsOnly,
  fetchVersionOnly,
  saveAccountsOnly,
  patchAccountFields,
} from "./lib/state/cloudApi";
import {
  loadSearchHistory, saveSearchHistory, addToSearchHistory, removeFromSearchHistory, clearSearchHistory,
  saveOfflineCache, loadOfflineCache, loadOfflineMeta, flushFullCacheSync, savePersonalCode, loadPersonalCode, clearPersonalCode,
  markPendingCloudSync, clearPendingCloudSync, mergeOfflineProgress, preserveLocalProgress, getPendingCloudSyncAt,
  loadPendingRemoveCodes, savePendingRemoveCodes, addPendingRemoveCode, removePendingRemoveCode,
  loadPendingApproveCodes, addPendingApproveCode, removePendingApproveCode,
  saveSessionId, loadSessionId, generateSessionId,
  detectDeviceIsAr, hasInviteParam,
  PROGRESS_KEYS,
} from "./lib/state/storage";
import { useAppPreferences } from "./lib/hooks/useAppPreferences";
import { useStudyReminders } from "./lib/hooks/useStudyReminders";
import { useAppShellLifecycle } from "./lib/hooks/useAppShellLifecycle";
import { useCloudPersist } from "./lib/hooks/useCloudPersist";
import { readInitialOfflineSnapshot } from "./lib/app/offlineSnapshot";
import { apiErrorMessage } from "./lib/utils/apiErrorMessage";
import { migrateAccounts } from "./lib/utils/authUtils";
import { ensureMigratedAccounts as ensureMigratedAccountsCore } from "./lib/state/authFlow";
import { runAppBoot } from "./lib/state/cloudBootstrap";
import { watchForReconnect } from "./lib/state/connectivity";
import SplashScreen from "./components/layout/SplashScreen";
import { createSaveQueue } from "./lib/state/cloudQueue";
import {
  switchToVaultAccount as switchVault,
  beginLinkAccount as beginLink,
  cancelLinkAccount as cancelLink,
  markMainAccount as markMain,
  unlinkVaultAccountFn as unlinkVault,
  performLogout,
} from "./lib/state/vaultSession";
import {
  toggleGuestStudied,
  toggleStudied,
  toggleFavorite,
  recordSrsAnswer,
  dictationRoundFinished,
  saveQuizResult,
  setWordPriority,
} from "./lib/state/entryProgress";
import { srsLevelFromStats, computeStreak } from "./lib/utils/quizHelpers";
import { unlockAchievements } from "./lib/state/achievements";
import { grantDailyOpen, loadXp, hydrateXpFromCloud, attachXpToAccounts } from "./lib/state/xp";
import { loadExamConfigCache, saveExamConfigCache, normalizeExamConfig, defaultExamConfig } from "./lib/state/exam";
import {
  loadAcademicUnitsCache,
  saveAcademicUnitsCache,
  normalizeAcademicUnits,
  loadActiveAcademicUnitId,
  saveActiveAcademicUnitId,
  defaultAcademicUnits,
} from "./lib/state/academicUnits";
import { getTodayTimerMinutes } from "./lib/state/goals";
import {
  loadAccountVault, upsertVaultAccount, removeVaultAccount, clearAccountVault,
  getMainAccountCode, setMainAccountCode,
} from "./lib/state/accountVault";
import { capLogs, makeLogEntry } from "./lib/state/logs";


// تحميل كسول للمكونات الكبيرة — يقلل حجم الحزمة الأولية ويسرّع First Paint
const AuthScreens = lazy(() => import("./components/auth/AuthScreens"));
const MainView = lazy(() => import("./components/MainView"));

/** Professional splash (Arabic slogan + progress bar) used as Suspense fallback and first paint. */
function AppLoadingFallback() {
  return <SplashScreen minMs={1600} />;
}

const deviceIsAr = detectDeviceIsAr();
const savedPersonalCode = loadPersonalCode();
/** Module-level: survives React StrictMode remount (refs reset on remount). */
let APP_BOOT_STARTED = false;

const initialOffline = readInitialOfflineSnapshot();

export default function DictionaryApp() {
  // Shell: PWA attr, force-refresh, service worker (extracted)
  useAppShellLifecycle();

  // Fixed the moment this tab loaded — powers the quiz's "This session"
  // time-range option ("studied since I opened the site this time").
  const sessionStartRef = useRef(Date.now());
  // Full-screen block ONLY while force-refresh runs on this page (before unload).
  // After reload the session lock may still exist (SW double-reload guard) but
  // the app must open immediately — do not keep the splash stuck at 100%.
  const [forceRefreshing, setForceRefreshing] = useState(false);
  useEffect(() => {
    const onStart = () => setForceRefreshing(true);
    const onEnd = () => setForceRefreshing(false);
    window.addEventListener("tt-force-refresh-start", onStart);
    window.addEventListener("tt-force-refresh-end", onEnd);
    return () => {
      window.removeEventListener("tt-force-refresh-start", onStart);
      window.removeEventListener("tt-force-refresh-end", onEnd);
    };
  }, []);
  // لو عندنا كاش صالح لنفس الحساب → ندخل مباشرة (in) ونحدّث في الخلفية
  // وإلا نفضل restoring لحد ما الشبكة ترد
  const [authStage, setAuthStage] = useState(() => {
    if (initialOffline?.usableAccount) return "in";
    if (savedPersonalCode) return "restoring";
    if (hasInviteParam()) return "signup";
    return "intro";
  }); // intro | signup | pendingShown | login | restoring | in
  const [name, setName] = useState(
    () => (initialOffline?.usableAccount?.name) || ""
  );
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPassword2, setSignupPassword2] = useState("");
  const [signupAvatar, setSignupAvatar] = useState("");
  const [signupGender, setSignupGender] = useState(""); // "male" | "female"
  const [signupBirthDate, setSignupBirthDate] = useState(""); // YYYY-MM-DD optional
  const [signupBacTrack, setSignupBacTrack] = useState("");
  const [signupBacGrade, setSignupBacGrade] = useState(""); // "2" | "3"
  const [signupBacSpecialty, setSignupBacSpecialty] = useState("");
  const [signupRole, setSignupRole] = useState("user"); // "user" | "teacher"
  /** When set, signup is completing a Google profile (password optional). */
  const [socialDraft, setSocialDraft] = useState(null);
  const [authError, setAuthError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupSaving, setSignupSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(
    () =>
      initialOffline?.usableAccount?.role === "admin" ||
      initialOffline?.usableAccount?.role === "teacher" ||
      false
  );
  const [isTeacher, setIsTeacher] = useState(
    () => initialOffline?.usableAccount?.role === "teacher" || false
  );
  const [moreFeaturesOpen, setMoreFeaturesOpen] = useState(false);
  const migrationDoneRef = useRef(false);

  // UI preferences (language, theme, accent, scale, device mode) — extracted
  // so App.jsx stays focused on auth, data, and cloud sync.
  const {
    appLang,
    setAppLang,
    toggleAppLang,
    appIsAr,
    atr,
    deviceMode,
    setDeviceMode,
    theme,
    setTheme,
    toggleTheme,
    accentTheme,
    setAccentTheme,
    uiScale,
    setUiScale,
    skin,
    setSkin,
    latinFont,
    setLatinFont,
    arabicFont,
    setArabicFont,
    reducedMotion,
    setReducedMotion,
    uiSounds,
    setUiSounds,
    dirOverride,
    setDirOverride,
    cardSurface,
    setCardSurface,
    headerStyle,
    setHeaderStyle,
    cardClarity,
    setCardClarity,
    modalStyle,
    setModalStyle,
    iconStyle,
    setIconStyle,
    motionSpeed,
    setMotionSpeed,
    examVisual,
    setExamVisual,
  } = useAppPreferences();

  const [entries, setEntries] = useState(
    () => (initialOffline?.entries?.length ? initialOffline.entries : [])
  );
  // لو في كاش → نعتبر البيانات جاهزة للعرض فوراً
  const [entriesLoaded, setEntriesLoaded] = useState(
    () => !!(initialOffline?.entries?.length)
  );
  // Tracks the version of the shared record we last read from the server —
  // sent back on every save as `expectedVersion` so the server can detect
  // (and reject) a write that would silently clobber someone else's change
  // made in between. See the concurrency comment in api/jsonbin.js.
  const [recordVersion, setRecordVersion] = useState(
    () => initialOffline?.version || 0
  );
  // Always keep a ref in sync so concurrent saves (two toggles in a row, two
  // tabs, quiz answers firing back-to-back) never send a stale expectedVersion
  // just because React hasn't re-rendered the useCallback closure yet.
  const recordVersionRef = useRef(initialOffline?.version || 0);
  function commitRecordVersion(v) {
    const n = typeof v === "number" ? v : 0;
    recordVersionRef.current = n;
    setRecordVersion(n);
  }
  // Serialize all cloud writes from this tab. Parallel persist* calls were the
  // main source of fake "updated elsewhere" errors when marking studied /
  // favorites quickly or when login session write raced a background sync.
  const saveQueueRef = useRef(null);
  if (!saveQueueRef.current) saveQueueRef.current = createSaveQueue();
  const enqueueSave = saveQueueRef.current.enqueueSave;
  // Live mirrors so a queued/coalesced save always sees the latest data,
  // not a stale React closure from when the user clicked earlier.
  const entriesRef = useRef(initialOffline?.entries || []);
  /** Last entry list successfully confirmed on the server — for granular diffs. */
  const lastSyncedEntriesRef = useRef(initialOffline?.entries || []);
  const accountsRef = useRef(initialOffline?.accounts || []);
  const logsRef = useRef(initialOffline?.logs || []);
  const siteBannerRef = useRef(initialOffline?.siteBanner || null);
  // Batch rapid studied/favorite/quiz ops into a single network write.
  const pendingAccountOpsRef = useRef([]);
  const pendingEntryOpsRef = useRef([]);
  // Codes intentionally deleted/rejected. Survives reload via localStorage so
  // a delete→reload race cannot resurrect accounts from a still-stale server.
  // Attached to every subsequent save so concurrent writes cannot undo them.
  const pendingRemoveCodesRef = useRef(new Set(loadPendingRemoveCodes()));
  // Codes approved this browser. Survives reload via localStorage.
  const pendingApprovedCodesRef = useRef(new Set(loadPendingApproveCodes()));
  const [loadError, setLoadError] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [offlineCachedAt, setOfflineCachedAt] = useState(
    () => initialOffline?.cachedAt || null
  );
  const [accounts, setAccounts] = useState(
    () => initialOffline?.accounts || []
  );
  const [accountsLoaded, setAccountsLoaded] = useState(
    () => !!(initialOffline?.accounts?.length)
  );
  const [logs, setLogs] = useState(() => initialOffline?.logs || []);
  const [logsLoaded, setLogsLoaded] = useState(
    () => !!(initialOffline?.logs?.length)
  );
  const [siteBanner, setSiteBanner] = useState(
    () => initialOffline?.siteBanner || null
  ); // admin-published site-wide announcement
  const [examConfig, setExamConfig] = useState(() =>
    normalizeExamConfig(
      initialOffline?.examConfig || loadExamConfigCache() || defaultExamConfig()
    )
  ); // admin-published exam countdown
  const examConfigRef = useRef(
    normalizeExamConfig(
      initialOffline?.examConfig || loadExamConfigCache() || defaultExamConfig()
    )
  );
  const [academicUnits, setAcademicUnits] = useState(() =>
    normalizeAcademicUnits(
      initialOffline?.academicUnits || loadAcademicUnitsCache()
    )
  );
  const academicUnitsRef = useRef(
    normalizeAcademicUnits(
      initialOffline?.academicUnits || loadAcademicUnitsCache()
    )
  );
  const [activeUnitId, setActiveUnitId] = useState(() =>
    loadActiveAcademicUnitId(
      normalizeAcademicUnits(
        initialOffline?.academicUnits || loadAcademicUnitsCache()
      )
    )
  );
  const [accountCode, setAccountCode] = useState(
    () => initialOffline?.usableAccount?.code || ""
  );
  const [googleLinkBusy, setGoogleLinkBusy] = useState(false);
  const [facebookLinkBusy, setFacebookLinkBusy] = useState(false);
  const [vaultAccounts, setVaultAccounts] = useState(() => loadAccountVault());
  const [mainAccountCode, setMainAccountCodeState] = useState(() => getMainAccountCode());
  const [linkMode, setLinkMode] = useState(false);
  const [section, setSection] = useState(() => {
    try {
      const s = localStorage.getItem("twoTongues.section");
      if (s === "en-ar" || s === "ar-ar" || s === "academic") return s;
    } catch (_) {}
    return "en-ar";
  });
  // الأقسام اللي اتجلبت من الشبكة في هذه الجلسة (لتجنب إعادة الجلب)
  const loadedSectionsRef = useRef(new Set());
  const [query, setQuery] = useState("");

  /** دمج كلمات قسم معيّن مع القائمة الحالية دون لمس باقي الأقسام */
  function mergeSectionEntries(current, sectionEntries, sec) {
    const others = (current || []).filter((e) => e && e.section !== sec);
    const incoming = Array.isArray(sectionEntries) ? sectionEntries : [];
    // Preserve heavy fields from local/offline when server list is light.
    const prevById = new Map(
      (current || [])
        .filter((e) => e && e.section === sec && e.id != null)
        .map((e) => [String(e.id), e])
    );
    const mergedIncoming = incoming.map((e) => {
      if (!e || e.id == null) return e;
      const old = prevById.get(String(e.id));
      return old ? { ...old, ...e } : e;
    });
    return [...others, ...mergedIncoming];
  }
  const [showAdd, setShowAdd] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [toast, setToast] = useState("");

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  }, []);

  // Study reminders (Web Push) — extracted; depends on signed-in account.
  const {
    remindersOn,
    remindersBusy,
    reminderTitle,
    reminderMessage,
    reminderMessages,
    reminderIntervalHours,
    handleChangeReminderTitle,
    handleChangeReminderMessage,
    handleChangeReminderMessages,
    handleChangeReminderIntervalHours,
    enableReminders,
    disableReminders,
    clearReminderSlots,
    testReminderPush,
  } = useStudyReminders(accountCode, showToast);

  // Drop legacy shared-access-code key from older builds (no longer used).
  useEffect(() => {
    try {
      localStorage.removeItem("twoTongues.accessCode");
      sessionStorage.removeItem("twoTongues.accessCode");
    } catch (_) {}
  }, []);

  // Hydrate dictionary entries from the full offline cache AFTER first paint
  // so JSON-parsing the (potentially large) entries array never blocks React's
  // initial render and FCP fires as soon as auth metadata is ready.
  useEffect(() => {
    if (entries.length > 0) return; // already populated (e.g. from network)
    requestAnimationFrame(() => {
      try {
        const cached = loadOfflineCache();
        if (cached && Array.isArray(cached.entries) && cached.entries.length > 0) {
          setEntries(cached.entries);
          setEntriesLoaded(true);
        }
      } catch (_) {}
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { entriesRef.current = entries; }, [entries]);
  useEffect(() => { accountsRef.current = accounts; }, [accounts]);
  useEffect(() => { logsRef.current = logs; }, [logs]);
  useEffect(() => { siteBannerRef.current = siteBanner; }, [siteBanner]);
  useEffect(() => {
    examConfigRef.current = examConfig;
    saveExamConfigCache(examConfig);
  }, [examConfig]);
  useEffect(() => {
    academicUnitsRef.current = academicUnits;
    saveAcademicUnitsCache(academicUnits);
  }, [academicUnits]);
  useEffect(() => {
    saveActiveAcademicUnitId(activeUnitId);
  }, [activeUnitId]);

  // Last-chance local snapshot when the tab is closing / backgrounded so a
  // studied toggle right before reload is never lost.
  useEffect(() => {
    function snap() {
      try {
        saveOfflineCache({
          entries: entriesRef.current,
          accounts: accountsRef.current,
          logs: logsRef.current,
          siteBanner: siteBannerRef.current,
          examConfig: examConfigRef.current,
          academicUnits: academicUnitsRef.current,
          version: recordVersionRef.current,
        });
        // Force the deferred full-cache write to happen NOW (page is closing)
        flushFullCacheSync();
        if (
          pendingAccountOpsRef.current.length > 0 ||
          pendingEntryOpsRef.current.length > 0
        ) {
          markPendingCloudSync();
        }
      } catch (_) {}
    }
    function onVis() {
      if (document.visibilityState === "hidden") snap();
    }
    window.addEventListener("pagehide", snap);
    window.addEventListener("beforeunload", snap);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", snap);
      window.removeEventListener("beforeunload", snap);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Once-per-day XP for opening the app while signed in — deferred to idle
  useEffect(() => {
    if (!accountCode || accountCode === "guest") return;
    let cancelled = false;
    const run = () => { if (!cancelled) try { grantDailyOpen(accountCode); } catch (_) {} };
    const id = typeof requestIdleCallback === "function"
      ? requestIdleCallback(run, { timeout: 6000 })
      : setTimeout(run, 2500);
    return () => { cancelled = true; typeof cancelIdleCallback === "function" ? cancelIdleCallback(id) : clearTimeout(id); };
  }, [accountCode]);

  // Day-achievement SRS: exact timers + ~1 min tick + server Web Push (no need for per-minute cron)
  useEffect(() => {
    if (!accountCode) return;
    const enabled = loadDayAchievementNotifsEnabled(accountCode);
    const stop = startDayAchievementDueWatcher({
      accountCode,
      enabled,
      isAr: false,
      intervalMs: 60 * 1000,
      getList: () => loadDayAchievements(accountCode),
    });
    return () => { try { stop(); } catch (_) {} };
  }, [accountCode]);



  // Restore XP from cloud account blob (survives clearing site data after re-login) — deferred
  useEffect(() => {
    if (!accountCode || accountCode === "guest" || !accountsLoaded) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      const acct = accounts.find((a) => a.code === accountCode);
      if (acct && acct.xp) {
        try { hydrateXpFromCloud(accountCode, acct.xp); } catch (_) {}
      }
      try {
        const local = loadXp(accountCode);
        const cloudTotal = acct && acct.xp ? Number(acct.xp.total) || 0 : 0;
        if (local.total > cloudTotal) {
          persistAccounts((cur) => attachXpToAccounts(cur, accountCode));
        }
      } catch (_) {}
    };
    const id = typeof requestIdleCallback === "function"
      ? requestIdleCallback(run, { timeout: 6000 })
      : setTimeout(run, 2500);
    return () => { cancelled = true; typeof cancelIdleCallback === "function" ? cancelIdleCallback(id) : clearTimeout(id); };
  }, [accountCode, accountsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Silent backfill: this is maintenance work, not part of the first render.
  // Run it when the browser is idle so login and the dictionary stay responsive.
  useEffect(() => {
    if (!accountCode || accountCode === "guest" || !accountsLoaded) return;
    let cancelled = false;
    let idleId = null;
    const run = () => {
      if (cancelled) return;
      const acct = accounts.find((a) => a.code === accountCode);
      if (!acct) return;
      try {
        let dictationRounds = 0;
        try { dictationRounds = Number(localStorage.getItem("twoTongues.dictationRounds." + accountCode) || 0); } catch (_) {}
        const box = {};
        for (const id of Object.keys(acct.srsStats || {})) box[id] = srsLevelFromStats(acct.srsStats[id]);
        const before = (acct.achievements || []).length;
        const updated = unlockAchievements(
          acct,
          {
            streak: computeStreak(acct.studiedAt || {}),
            srsBox: box,
            timerMinutesTotal: getTodayTimerMinutes(),
            dictationRounds,
          },
          { notify: false }
        );
        if ((updated.achievements || []).length > before) {
          persistAccounts((cur) => cur.map((a) => (a.code === accountCode ? { ...a, achievements: updated.achievements } : a)));
        }
      } catch (_) {}
    };
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(run, { timeout: 5000 });
    } else {
      idleId = setTimeout(run, 1800);
    }
    return () => {
      cancelled = true;
      if (typeof window !== "undefined" && window.cancelIdleCallback && idleId !== null) {
        window.cancelIdleCallback(idleId);
      } else if (idleId !== null) {
        clearTimeout(idleId);
      }
    };
  }, [accountCode, accountsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guest mode removed intentionally — sign-in required.

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

  const [priorityTick, setPriorityTick] = useState(0);
  const wordPriorities = useMemo(() => {
    if (accountCode === "guest") {
      try {
        const raw = localStorage.getItem("twoTongues.guestPriorities");
        return raw ? JSON.parse(raw) : {};
      } catch (_) { return {}; }
    }
    const acct = accounts.find((a) => a.code === accountCode);
    return (acct && acct.wordPriorities) || {};
  }, [accounts, accountCode, priorityTick]);

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

  // Phase A: migration logic lives in authFlow; App only binds the once-flag ref.
  async function ensureMigratedAccounts(rec) {
    return ensureMigratedAccountsCore(rec, migrationDoneRef);
  }

  useEffect(() => {
    if (APP_BOOT_STARTED) return;
    APP_BOOT_STARTED = true;
    const cancelledRef = { current: false };
    runAppBoot(
      {
        entriesRef,
        accountsRef,
        loadedSectionsRef,
        lastSyncedEntriesRef,
        pendingRemoveCodesRef,
        pendingApprovedCodesRef,
        academicUnitsRef,
        migrationDoneRef,
        savedPersonalCode,
        setEntries,
        setEntriesLoaded,
        setAccounts,
        setAccountsLoaded,
        setLogs,
        setLogsLoaded,
        setSiteBanner,
        setExamConfig,
        setAcademicUnits,
        setIsOffline,
        setOfflineCachedAt,
        setLoadError,
        setName,
        setIsAdmin,
        setIsTeacher,
        setAccountCode,
        setAuthStage,
        setVaultAccounts,
        setMainAccountCodeState,
        commitRecordVersion,
        mergeSectionEntries,
        syncBaseHistory,
      },
      cancelledRef
    );
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // Recover from false "You're offline" when the network path is actually fine.
  // navigator.onLine alone is unreliable; we probe /api/jsonbin and clear the banner.
  useEffect(() => {
    if (!isOffline) return undefined;
    const stop = watchForReconnect({
      intervalMs: 6000,
      onBackOnline: () => {
        setIsOffline(false);
        setLoadError("");
        // Soft reload of cloud data without full page refresh
        try {
          if (!window.__bacaloriaReboot) {
            window.__bacaloriaReboot = true;
            window.location.reload();
          }
        } catch (_) {
          setIsOffline(false);
        }
      },
    });
    return () => {
      try { stop(); } catch (_) {}
    };
  }, [isOffline]);

  // Keep display name tied to the active account  // Keep display name tied to the active account (fixes wrong name after refresh / vault switch)
  useEffect(() => {
    if (!accountCode || accountCode === "guest") return;
    const acct = (accounts || []).find((a) => a && a.code === accountCode);
    if (acct && typeof acct.name === "string" && acct.name.trim() && acct.name !== name) {
      setName(acct.name);
    }
  }, [accountCode, accounts]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const signedIn = !!loadPersonalCode();
      const state = e.state || {
        authStage: signedIn ? "restoring" : "intro",
        showAdd: false,
        showAccount: false,
        showAdmin: false,
        section: "en-ar",
      };
      isPoppingRef.current = true;
      let nextStage = state.authStage || "intro";
      // Ghost history entries from before Sign Out still carry authStage:"in".
      // Never re-enter the app without a real session — and flatten the entry
      // so swipe-back does not keep revealing stacked "pages under pages".
      if ((nextStage === "in" || nextStage === "restoring") && !signedIn) {
        nextStage = "login";
        try {
          window.history.replaceState(
            { authStage: "login", showAdd: false, showAccount: false, showAdmin: false, section: "en-ar" },
            ""
          );
        } catch (_) {}
      }
      setAuthStage(nextStage);
      // Modals only make sense while signed in
      if (nextStage !== "in") {
        setShowAdd(false);
        setShowAccount(false);
        setShowAdmin(false);
      } else {
        setShowAdd(!!state.showAdd);
        setShowAccount(!!state.showAccount);
        setShowAdmin(!!state.showAdmin);
      }
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

  /**
   * Auth-stage navigation. Default = replaceState (no extra history layer).
   * This prevents: logout → swipe back → old app screen under login.
   * Pass { replace: false } only when back-navigation inside auth is desired
   * (e.g. signup → intro).
   */
  function goToStage(stage, opts = {}) {
    const replace = opts.replace !== false;
    setAuthStage(stage);
    setShowAdd(false);
    setShowAccount(false);
    setShowAdmin(false);
    const state = {
      authStage: stage,
      showAdd: false,
      showAccount: false,
      showAdmin: false,
      section: stage === "in" ? section : "en-ar",
    };
    try {
      if (replace) window.history.replaceState(state, "");
      else window.history.pushState(state, "");
    } catch (_) {}
  }

  function openAddModal() {
    // Modals stay out of the History stack — avoids "page under page" on swipe-back.
    setShowAdd(true);
  }

  const closeAddModal = useCallback(() => {
    setShowAdd(false);
  }, []);

  function openAccountModal() {
    setShowAccount(true);
  }

  const closeAccountModal = useCallback(() => {
    setShowAccount(false);
  }, []);

  function openAdminModal() {
    try { import("./components/modals/AdminModal"); } catch (_) {}
    setShowAdmin(true);
    // للأدمن: تأكد إن كل الأقسام متحمّلة (نسخ احتياطي / إحصائيات)
    const missing = ["en-ar", "ar-ar", "academic"].filter(
      (s) => !loadedSectionsRef.current.has(s)
    );
    if (missing.length) {
      (async () => {
        try {
          // قائمة خفيفة لكل الأقسام (باندويث أقل) — التفاصيل عند فتح الكلمة
          const all = await fetchEntriesOnly({ fresh: true, fields: "light" });
          ["en-ar", "ar-ar", "academic"].forEach((s) =>
            loadedSectionsRef.current.add(s)
          );
          setEntries((prev) => {
            const prevById = new Map(
              (prev || []).filter((e) => e && e.id != null).map((e) => [String(e.id), e])
            );
            const merged = (all || []).map((e) => {
              if (!e || e.id == null) return e;
              const old = prevById.get(String(e.id));
              return old ? { ...old, ...e } : e;
            });
            entriesRef.current = merged;
            return merged;
          });
        } catch (_) {}
      })();
    }
  }

  const closeAdminModal = useCallback(() => {
    setShowAdmin(false);
  }, []);

  function changeSection(nextSection) {
    setSection(nextSection);
    try { localStorage.setItem("twoTongues.section", nextSection); } catch (_) {}
    setQuery("");
    // replace (not push) so section switches do not stack swipe-back layers
    try {
      window.history.replaceState(
        { authStage: "in", showAdd: false, showAccount: false, showAdmin: false, section: nextSection },
        ""
      );
    } catch (_) {}
    // جلب القسم عند الحاجة فقط (ما يتجلبش مرتين في نفس الجلسة)
    if (
      (nextSection === "en-ar" || nextSection === "ar-ar" || nextSection === "academic") &&
      !loadedSectionsRef.current.has(nextSection)
    ) {
      (async () => {
        try {
          const sectionEntries = await fetchEntriesOnly({ section: nextSection });
          loadedSectionsRef.current.add(nextSection);
          setEntries((prev) => {
            const merged = mergeSectionEntries(prev, sectionEntries, nextSection);
            entriesRef.current = merged;
            return merged;
          });
        } catch (_) {
          /* نستخدم الكاش المحلي للقسم إن وُجد */
        }
      })();
    }
  }

  // Shared conflict handler: on a version mismatch, adopt the server's
  // fresh data so we're not left silently diverged from what's actually
  // saved. Used as a last-resort fallback when we can't safely auto-retry
  // (e.g. retry attempts exhausted).
  const {
    handleSaveConflict,
    getFlushCtx,
    flushPendingAccounts,
    flushPendingEntries,
    snapshotLocalNow,
    persistEntries,
    persistAccounts,
    persistLogs,
    logEvent,
    persistSiteBanner,
    persistExamConfig,
    persistAcademicUnits,
    clearLogsExceptFirstSignIn,
  } = useCloudPersist({
    enqueueSave,
    pendingAccountOpsRef,
    pendingEntryOpsRef,
    pendingRemoveCodesRef,
    pendingApprovedCodesRef,
    entriesRef,
    accountsRef,
    logsRef,
    siteBannerRef,
    examConfigRef,
    academicUnitsRef,
    recordVersionRef,
    lastSyncedEntriesRef,
    commitRecordVersion,
    setAccounts,
    setLogs,
    setEntries,
    setSiteBanner,
    setExamConfig,
    setAcademicUnits,
    setActiveUnitId,
    setSaveError,
    accountCode,
    logs,
    showToast,
    appIsAr,
  });

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
      toggleGuestStudied(entryId, setAccounts);
      return;
    }
    await toggleStudied({ entryId, accountCode, accounts, persistAccounts });
  }

  async function handleToggleFavorite(entryId) {
    await toggleFavorite({ entryId, accountCode, accounts, persistAccounts });
  }

  async function handleSetWordPriority(entryId, nextValue) {
    await setWordPriority({ entryId, nextValue, accountCode, persistAccounts });
    if (accountCode === "guest") setPriorityTick((t) => t + 1);
  }

  async function handleRecordSrsAnswer(entryId, correct, qualityOverride) {
    await recordSrsAnswer({ entryId, correct, qualityOverride, accountCode, persistAccounts });
  }

  async function handleDictationRoundFinished() {
    await dictationRoundFinished({ accountCode, persistAccounts });
  }

  async function handleSaveQuizResult(result) {
    await saveQuizResult({ result, accountCode, persistAccounts });
  }

  async function handleSignup(e, roleOverride) {
    // preventDefault must run synchronously, BEFORE the await below — once we
    // await, the browser has already moved past this event's synchronous
    // phase and will fall through to a real form submit (full page reload)
    // if we haven't cancelled it yet. That reload was the actual cause of
    // "signup/login sends me back to the start page": the request kept
    // running in the background and reached the server, but the page reset
    // before React could show the result.
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    const { performSignup } = await import("./lib/state/authFlow");
    return performSignup({
      e,
      name,
      signupUsername,
      signupPassword,
      signupPassword2,
      signupAvatar,
      signupGender,
      signupBirthDate,
      signupBacTrack,
      signupBacGrade,
      signupBacSpecialty,
      signupRole: roleOverride === "teacher" || roleOverride === "user" ? roleOverride : signupRole,
      appIsAr,
      ensureMigratedAccounts,
      commitRecordVersion,
      setSignupError,
      setSignupSaving,
      setSignupPassword,
      setSignupPassword2,
      setSignupAvatar,
      setSignupGender,
      setSignupBirthDate,
      setSignupBacTrack,
      setSignupBacGrade,
      setSignupBacSpecialty,
      setSignupRole,
      setAccounts,
      setEntries,
      setLogs,
      setSiteBanner,
      setExamConfig,
      goToStage,
      socialDraft,
      setSocialDraft,
    });
  }

  async function handleSocialLogin(provider) {
    if (provider !== "google" && provider !== "facebook") {
      setAuthError(
        appIsAr
          ? "مزوّد الدخول ده مش متاح حاليًا."
          : "This sign-in provider is not available."
      );
      return;
    }
    const [socialMod, { performSocialLogin }] = await Promise.all([
      import("./lib/state/socialAuth"),
      import("./lib/state/authFlow"),
    ]);
    setAuthError("");
    try {
      const profile =
        provider === "facebook"
          ? await socialMod.signInWithFacebook()
          : await socialMod.signInWithGoogle();
      await performSocialLogin({
        provider,
        profile,
        appIsAr,
        ensureMigratedAccounts,
        commitRecordVersion,
        setAuthError,
        setLoggingIn,
        setAccounts,
        setEntries,
        setLogs,
        setSiteBanner,
        setExamConfig,
        setName,
        setIsAdmin,
        setIsTeacher,
        setAccountCode,
        setVaultAccounts,
        linkMode,
        setLinkMode,
        setMainAccountCodeState,
        goToStage,
        persistAccounts,
        setSignupUsername,
        setSignupAvatar,
        setSocialDraft,
        setSignupError,
      });
    } catch (err) {
      setAuthError((err && err.message) || (appIsAr ? "فشل تسجيل الدخول." : "Sign-in failed."));
    }
  }

  // Mobile Facebook: after OAuth redirect, finish login (or link) once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const urlBits = String(window.location.hash || "") + String(window.location.search || "");
        const hasFbReturn =
          typeof window !== "undefined" &&
          (/access_token=/.test(urlBits) || /[?&#]code=/.test(urlBits) || /error=/.test(urlBits));
        let pendingPeek = null;
        try {
          pendingPeek = sessionStorage.getItem("tt_fb_oauth_pending");
        } catch (_) {}
        if (!pendingPeek && !hasFbReturn) return;

        setLoggingIn(true);
        setAuthError("");
        const socialMod = await import("./lib/state/socialAuth");
        // Read mode before complete() clears session keys
        const pending =
          typeof socialMod.consumeFacebookPendingMode === "function"
            ? socialMod.consumeFacebookPendingMode()
            : pendingPeek || "login";
        const profile = await socialMod.completeFacebookRedirectIfPresent();
        if (cancelled) return;
        if (!profile) {
          setLoggingIn(false);
          return;
        }

        if (pending === "link") {
          const code = accountCode || (typeof loadPersonalCode === "function" ? loadPersonalCode() : null);
          if (code && code !== "guest") {
            const { linkFacebookToCurrentAccount } = await import("./lib/state/authFlow");
            const result = await linkFacebookToCurrentAccount({
              profile,
              accountCode: code,
              accounts: accountsRef.current.length ? accountsRef.current : accounts,
              setAccounts,
              persistAccounts,
              appIsAr,
            });
            if (typeof showToast === "function") {
              showToast(
                result.ok
                  ? appIsAr
                    ? "تم ربط Facebook"
                    : "Facebook linked"
                  : result.error || "Link failed"
              );
            }
          }
          setLoggingIn(false);
          return;
        }

        const { performSocialLogin } = await import("./lib/state/authFlow");
        await performSocialLogin({
          provider: "facebook",
          profile,
          appIsAr,
          ensureMigratedAccounts,
          commitRecordVersion,
          setAuthError,
          setLoggingIn,
          setAccounts,
          setEntries,
          setLogs,
          setSiteBanner,
          setExamConfig,
          setName,
          setIsAdmin,
          setIsTeacher,
          setAccountCode,
          setVaultAccounts,
          linkMode,
          setLinkMode,
          setMainAccountCodeState,
          goToStage,
          persistAccounts,
          setSignupUsername,
          setSignupAvatar,
          setSocialDraft,
          setSignupError,
        });
      } catch (e) {
        if (!cancelled) {
          setLoggingIn(false);
          setAuthError(
            (e && e.message) ||
              (appIsAr ? "فشل تسجيل الدخول بفيسبوك." : "Facebook sign-in failed.")
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e) {
    // Same fix as handleSignup above: cancel the form's default submit
    // synchronously, before the await, or the browser reloads the page.
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    const { performLogin } = await import("./lib/state/authFlow");
    return performLogin({
      e,
      usernameInput,
      passwordInput,
      accounts,
      accountsLoaded,
      accountsRef,
      pendingRemoveCodesRef,
      entries,
      logs,
      siteBanner,
      recordVersionRef,
      linkMode,
      appIsAr,
      ensureMigratedAccounts,
      commitRecordVersion,
      setAuthError,
      setLoggingIn,
      setAccounts,
      setEntries,
      setLogs,
      setSiteBanner,
      setExamConfig,
      setName,
      setIsAdmin,
      setIsTeacher,
      setAccountCode,
      setVaultAccounts,
      setLinkMode,
      setMainAccountCodeState,
      setPasswordInput,
      goToStage,
      persistAccounts,
      socialDraft,
      setSocialDraft,
    });
  }

  /** تبديل فوري لحساب محفوظ — بدون تسجيل خروج كامل */
  function switchToVaultAccount(code) {
    return switchVault({
      code,
      accountCode,
      isAdmin,
      accounts,
      setAccountCode,
      setName,
      setIsAdmin,
      setIsTeacher,
      setShowAccount,
      setShowAdmin,
      setShowAdd,
    });
  }


  async function handleLinkGoogle() {
    if (googleLinkBusy || !accountCode || accountCode === "guest") return;
    setGoogleLinkBusy(true);
    try {
      const [{ signInWithGoogle }, { linkGoogleToCurrentAccount }] = await Promise.all([
        import("./lib/state/socialAuth"),
        import("./lib/state/authFlow"),
      ]);
      const profile = await signInWithGoogle();
      const result = await linkGoogleToCurrentAccount({
        profile,
        accountCode,
        accounts: accountsRef.current.length ? accountsRef.current : accounts,
        setAccounts,
        persistAccounts,
        appIsAr,
      });
      if (!result.ok) {
        if (typeof showToast === "function") {
          showToast(result.error || "Link failed");
        } else {
          window.alert(result.error || "Link failed");
        }
        return;
      }
      if (typeof showToast === "function") {
        showToast(
          result.alreadyLinked
            ? (appIsAr ? "Google مربوط مسبقاً" : "Google already linked")
            : (appIsAr ? "تم ربط حساب Google بنجاح" : "Google account linked successfully")
        );
      }
    } catch (e) {
      const msg = (e && e.message) || (appIsAr ? "تعذّر الربط" : "Could not link Google");
      if (typeof showToast === "function") showToast(msg);
      else window.alert(msg);
    } finally {
      setGoogleLinkBusy(false);
    }
  }

  async function handleUnlinkGoogle() {
    if (googleLinkBusy || !accountCode || accountCode === "guest") return;
    const confirmMsg = appIsAr
      ? "إلغاء ربط Google؟ ستحتاج اسم المستخدم وكلمة المرور لتسجيل الدخول. حساب Google هيبقى حر تاني."
      : "Unlink Google? You'll need username and password to sign in. This Google account will be free again.";
    if (!window.confirm(confirmMsg)) return;
    setGoogleLinkBusy(true);
    try {
      const { unlinkGoogleFromCurrentAccount } = await import("./lib/state/authFlow");
      const result = await unlinkGoogleFromCurrentAccount({
        accountCode,
        accounts: accountsRef.current.length ? accountsRef.current : accounts,
        persistAccounts,
        appIsAr,
      });
      if (!result.ok) {
        if (typeof showToast === "function") showToast(result.error || "Unlink failed");
        else window.alert(result.error || "Unlink failed");
        return;
      }
      // Drop null social fields from memory so UI refreshes; identity is free for re-use
      setAccounts((prev) =>
        (prev || []).map((a) => {
          if (!a || a.code !== accountCode) return a;
          const next = { ...a };
          if (next.authProvider == null) delete next.authProvider;
          if (next.socialId == null) delete next.socialId;
          if (next.email == null) delete next.email;
          return next;
        })
      );
      if (typeof showToast === "function") {
        showToast(appIsAr ? "تم إلغاء ربط Google — الحساب حر" : "Google unlinked — identity free");
      }
    } catch (e) {
      const msg = (e && e.message) || (appIsAr ? "تعذّر إلغاء الربط" : "Could not unlink");
      if (typeof showToast === "function") showToast(msg);
      else window.alert(msg);
    } finally {
      setGoogleLinkBusy(false);
    }
  }

  async function handleLinkFacebook() {
    return; // Facebook removed from product
  }

  async function handleUnlinkFacebook() {
    return; // Facebook removed from product
  }

  function beginLinkAccount() {
    beginLink({
      isAdmin,
      setLinkMode,
      setAccountCode,
      setName,
      setUsernameInput,
      setPasswordInput,
      setAuthError,
      setShowAdd,
      setShowAccount,
      setShowAdmin,
      goToStage,
    });
  }

  function cancelLinkAccount() {
    cancelLink({
      setLinkMode,
      setAuthStage,
      switchToVaultAccountFn: switchToVaultAccount,
      goToStage,
    });
  }

  function markMainAccount(code) {
    return markMain({ code, isAdmin, setMainAccountCodeState });
  }

  function unlinkVaultAccount(code) {
    unlinkVault({
      code,
      isAdmin,
      accountCode,
      setVaultAccounts,
      setMainAccountCodeState,
      handleLogout,
      switchToVaultAccountFn: switchToVaultAccount,
    });
  }

  function handleLogout(opts = {}) {
    performLogout({
      opts,
      accountCode,
      isAdmin,
      name,
      logEvent,
      setVaultAccounts,
      setMainAccountCodeState,
      setName,
      setIsAdmin,
      setIsTeacher,
      setAccountCode,
      setUsernameInput,
      setPasswordInput,
      setAuthError,
      setShowAdd,
      setShowAccount,
      setShowAdmin,
      goToStage: (stage) => goToStage(stage, { replace: true }),
    });
    try {
      syncBaseHistory("login");
    } catch (_) {}
    // Hard-reset the History stack. replaceState alone cannot delete older
    // entries created before logout (modals/sections), so swipe-back could
    // still reveal a previous screen underneath. location.replace clears that.
    try {
      const url = window.location.pathname + window.location.search;
      window.location.replace(url);
    } catch (_) {}
  }

  // Soft background sync while signed in. NEVER log the user out because of
  // focus / visibility / screenshot / another device — those were kicking
  // people on refresh and when the OS briefly hid the tab. We only sync
  // data + adopt the cloud sessionId. Logout happens solely via Sign out,
  // or if the account itself is gone / pending / rejected.
  useEffect(() => {
    if (authStage !== "in" || !accountCode) return;
    let cancelled = false;

    async function softSync() {
      try {
        // 1) فحص الإصدار أولاً — لو مفيش تغيير نوفر الباندويث بالكامل
        const remoteVersion = await fetchVersionOnly({ fresh: true }).catch(() => null);
        if (cancelled) return;
        if (
          typeof remoteVersion === "number" &&
          remoteVersion === recordVersionRef.current &&
          remoteVersion > 0
        ) {
          // لا تغيير على السيرفر — لا نجلب شيء آخر
          return;
        }

        // 2) في حالة التغيير: جلب مجزأ خفيف (بدون entries — تبقى من الكاش/الفتح)
        const isPrivileged = isAdmin || isTeacher;
        const [myAccount, bootstrap, accountsList] = await Promise.all([
          fetchMyAccount(accountCode, { fresh: true }).catch(() => null),
          fetchBootstrap({ fresh: true }).catch(() => ({})),
          isPrivileged
            ? fetchAccountsOnly({ fresh: true }).catch(() => [])
            : Promise.resolve(null),
        ]);
        if (cancelled) return;

        // بناء قائمة حسابات مناسبة للصلاحية
        // Light admin list must not wipe the signed-in user's full progress
        // (studied / favorites / SRS) that fetchMyAccount returned.
        let list = [];
        if (isPrivileged && Array.isArray(accountsList) && accountsList.length) {
          list = accountsList.map((a) =>
            a && myAccount && a.code === myAccount.code ? { ...a, ...myAccount } : a
          );
          if (myAccount && !list.some((a) => a && a.code === myAccount.code)) {
            list = [myAccount, ...list];
          }
        } else if (myAccount) {
          list = [myAccount];
        }

        const rec = {
          entries: entriesRef.current || [],
          accounts: list,
          logs: logsRef.current || [],
          siteBanner: bootstrap.siteBanner !== undefined ? bootstrap.siteBanner : siteBannerRef.current,
          examConfig: bootstrap.examConfig,
          academicUnits: bootstrap.academicUnits,
          version: typeof bootstrap.version === "number" ? bootstrap.version : recordVersionRef.current,
        };

        if (rec.accounts) {
          // list already prepared above
          // Hide accounts we intentionally deleted even if a brief race still
          // returns them; prune localStorage once the server dropped them.
          if (pendingRemoveCodesRef.current.size) {
            const drop = pendingRemoveCodesRef.current;
            const stillOnServer = [];
            list = list.filter((a) => {
              if (!a || !a.code) return false;
              if (drop.has(String(a.code))) {
                stillOnServer.push(String(a.code));
                return false;
              }
              return true;
            });
            for (const code of [...drop]) {
              if (!stillOnServer.includes(code)) {
                drop.delete(code);
                removePendingRemoveCode(code);
              }
            }
          }
          // Sticky until *server* confirms non-pending (not after local patch).
          if (pendingApprovedCodesRef.current.size) {
            const approved = pendingApprovedCodesRef.current;
            const serverConfirmed = [];
            for (const a of list) {
              if (a && a.code && approved.has(String(a.code)) && a.status !== "pending") {
                serverConfirmed.push(String(a.code));
              }
            }
            list = list.map((a) =>
              a && a.code && approved.has(String(a.code)) && a.status === "pending"
                ? { ...a, status: "active" }
                : a
            );
            for (const code of serverConfirmed) {
              approved.delete(code);
              removePendingApproveCode(code);
            }
            const stillPending = [...approved].filter((code) =>
              list.some((a) => a && String(a.code) === code)
            );
            if (stillPending.length) {
              try {
                const forced = list.map((a) =>
                  a && a.code && approved.has(String(a.code))
                    ? { ...a, status: "active" }
                    : a
                );
                // كتابة جزئية: موافقات الحسابات فقط
                const newVersion = await saveAccountsOnly(
                  { accounts: forced, approveAccountCodes: stillPending },
                  typeof rec.version === "number" ? rec.version : recordVersionRef.current
                );
                commitRecordVersion(newVersion);
                list = forced;
              } catch (_) {}
            }
          }
          // Do not wipe in-flight studied/favorites: if a cloud write is still
          // pending (or account ops are queued), keep local progress for self.
          const hasPendingOps = pendingAccountOpsRef.current.length > 0;
          const { accounts: safeList, merged: progressMerged } = preserveLocalProgress(
            list,
            accountsRef.current || [],
            {
              onlyCode: accountCode,
              force: hasPendingOps,
            }
          );
          list = safeList;
          setAccounts(list);
          accountsRef.current = list;
          // If we kept newer local progress, push it via narrow accountPatch
          // (not full saveAccountsOnly) so we do not fight other writers with 409.
          if (progressMerged && accountCode) {
            const mine = list.find((a) => a && String(a.code) === String(accountCode));
            if (mine) {
              const patch = {};
              for (const k of PROGRESS_KEYS) {
                if (mine[k] !== undefined) patch[k] = mine[k];
              }
              if (Object.keys(patch).length) {
                try {
                  markPendingCloudSync();
                  let ver =
                    typeof rec.version === "number"
                      ? rec.version
                      : recordVersionRef.current;
                  try {
                    const latest = await fetchVersionOnly({ fresh: true });
                    if (typeof latest === "number" && latest > ver) ver = latest;
                  } catch (_) {}
                  const result = await patchAccountFields(accountCode, patch, ver);
                  commitRecordVersion(result.version);
                  clearPendingCloudSync();
                } catch (_) {
                  // Leave pending flag set; next flush / softSync will retry.
                }
              }
            }
          }
        }
        if (rec.siteBanner !== undefined) setSiteBanner(rec.siteBanner || null);
        if (typeof rec.version === "number") commitRecordVersion(rec.version);
        const account = (list && list.length ? list : rec.accounts || []).find((a) => a.code === accountCode);
        if (account && account.xp) {
          try { hydrateXpFromCloud(accountCode, account.xp); } catch (_) {}
        }
        if (!account || account.status === "pending" || account.status === "rejected" || account.status === "blocked") {
          handleLogout();
          return;
        }
        if (account.sessionId) saveSessionId(account.sessionId);
      } catch (_) {
        // Offline — stay signed in.
      }
    }

    // No focus/visibility listeners (screenshot & app-switch were logging people out).
    // كل 3 دقائق + فحص version أولاً → توفير باندويث مع بقاء البيانات حديثة
    const interval = setInterval(softSync, 180000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authStage, accountCode]);

  async function handleUpdateOwnAccount({
    name: newName,
    password: newPassword,
    avatar: nextAvatar,
    gender: nextGender,
    birthDate: nextBirthDate,
    bacTrack: nextBacTrack,
    bacGrade: nextBacGrade,
    bacSpecialty: nextBacSpecialty,
  }) {
    const { updateOwnAccount } = await import("./lib/state/adminActions");
    try {
      const result = await updateOwnAccount({
        newName,
        newPassword,
        nextAvatar,
        nextGender,
        nextBirthDate,
        nextBacTrack,
        nextBacGrade,
        nextBacSpecialty,
        accountCode,
        name,
        accounts,
        appIsAr,
        persistAccounts,
        setName,
        showToast,
        setAccounts,
        recordVersionRef,
        commitRecordVersion,
        patchAccountFields,
      });
      if (result && result.error) {
        return { error: apiErrorMessage({ message: result.error }, appIsAr) };
      }
      return result;
    } catch (err) {
      const msg = apiErrorMessage(err, appIsAr);
      if (typeof showToast === "function") showToast(msg);
      return { error: msg };
    }
  }

  function getAdminLifecycleCtx() {
    return {
      accounts,
      accountsRef,
      logsRef,
      entriesRef,
      siteBannerRef,
      examConfigRef,
      recordVersionRef,
      pendingApprovedCodesRef,
      pendingRemoveCodesRef,
      commitRecordVersion,
      setAccounts,
      setLogs,
      enqueueSave,
      name,
      accountCode,
      appIsAr,
      showToast,
      handleLogout,
    };
  }

  async function handleApproveRequest(targetCode) {
    const { approveAccountRequest } = await import("./lib/state/adminLifecycle");
    return approveAccountRequest(targetCode, getAdminLifecycleCtx());
  }

  async function handleRejectRequest(targetCode) {
    const { rejectAccountRequest } = await import("./lib/state/adminLifecycle");
    return rejectAccountRequest(targetCode, getAdminLifecycleCtx());
  }

  async function handleAdminAddAccount(newName, role, username) {
    const { adminAddAccount } = await import("./lib/state/adminActions");
    return adminAddAccount({
      newName,
      role,
      username,
      name,
      accountCode,
      accounts,
      persistAccounts,
    });
  }

  async function handleAdminEditAccount(targetCode, updates) {
    const { adminEditAccount } = await import("./lib/state/adminActions");
    return adminEditAccount({
      targetCode,
      updates,
      name,
      accountCode,
      accounts,
      appIsAr,
      persistAccounts,
      setName,
      setIsAdmin,
    });
  }

  async function handleAdminDeleteAccount(targetCode) {
    const { deleteAccount } = await import("./lib/state/adminLifecycle");
    return deleteAccount(targetCode, getAdminLifecycleCtx());
  }



  // Block only until navigation/reload (same document). After reload the app opens.
  if (forceRefreshing) {
    return (
      <SplashScreen
        blocking
        isAr={typeof appIsAr === "boolean" ? appIsAr : true}
      />
    );
  }

  if (authStage !== "in") {
    return (
      <Suspense fallback={<AppLoadingFallback />}>
        <AuthScreens
          authStage={authStage} appIsAr={appIsAr} appLang={appLang} atr={atr} theme={theme} toggleTheme={toggleTheme} toggleAppLang={toggleAppLang} onChangeAppLang={setAppLang} deviceMode={deviceMode} onChangeDeviceMode={setDeviceMode}
          moreFeaturesOpen={moreFeaturesOpen} setMoreFeaturesOpen={setMoreFeaturesOpen} goToStage={goToStage}
          name={name} setName={setName}
          signupUsername={signupUsername} setSignupUsername={setSignupUsername}
          signupPassword={signupPassword} setSignupPassword={setSignupPassword}
          signupPassword2={signupPassword2} setSignupPassword2={setSignupPassword2}
          signupAvatar={signupAvatar} setSignupAvatar={setSignupAvatar}
          signupGender={signupGender} setSignupGender={setSignupGender}
          signupBirthDate={signupBirthDate} setSignupBirthDate={setSignupBirthDate}
          signupBacTrack={signupBacTrack} setSignupBacTrack={setSignupBacTrack}
          signupBacGrade={signupBacGrade} setSignupBacGrade={setSignupBacGrade}
          signupBacSpecialty={signupBacSpecialty} setSignupBacSpecialty={setSignupBacSpecialty}
          signupRole={signupRole} setSignupRole={setSignupRole}
          signupError={signupError} setSignupError={setSignupError} signupSaving={signupSaving} handleSignup={handleSignup}
          usernameInput={usernameInput} setUsernameInput={setUsernameInput}
          passwordInput={passwordInput} setPasswordInput={setPasswordInput}
          authError={authError} setAuthError={setAuthError} loggingIn={loggingIn} handleLogin={handleLogin}
          handleSocialLogin={handleSocialLogin}
          linkMode={linkMode} onCancelLink={cancelLinkAccount}
          socialDraft={socialDraft}
        />
      </Suspense>
    );
  }

  if (!accountCode) {
    // Safety net: never render the authenticated app without a real
    // signed-in account code, even if authStage somehow says "in".
    return <AppLoadingFallback />;
  }

  return (
    <Suspense fallback={<AppLoadingFallback />}>
    <MainView
      name={name} isAdmin={isAdmin} isTeacher={isTeacher} entries={entries} entriesLoaded={entriesLoaded} loadError={loadError}
      isOffline={isOffline} offlineCachedAt={offlineCachedAt}
      deviceMode={deviceMode} onChangeDeviceMode={setDeviceMode} uiScale={uiScale} onChangeUiScale={setUiScale}
      section={section} onChangeSection={changeSection} query={query} setQuery={setQuery}
      showAdd={showAdd} onOpenAdd={openAddModal} onCloseAdd={closeAddModal} persistEntries={persistEntries} saveError={saveError}
      onLogout={handleLogout}
      accounts={accounts} accountCode={accountCode} logs={logs} onClearLogs={clearLogsExceptFirstSignIn}
      studiedIds={studiedIds} studiedAt={studiedAt} onToggleStudied={handleToggleStudied}
      favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite}
      wordPriorities={wordPriorities} onSetWordPriority={handleSetWordPriority}
      srsBox={srsBox} srsDueAt={srsDueAt} srsStats={srsStats} quizHistory={quizHistory}
      onRecordSrsAnswer={handleRecordSrsAnswer} onSaveQuizResult={handleSaveQuizResult}
      onDictationRoundFinished={handleDictationRoundFinished}
      showAccount={showAccount} onOpenAccount={openAccountModal} onCloseAccount={closeAccountModal} onUpdateOwnAccount={handleUpdateOwnAccount}
      vaultAccounts={vaultAccounts}
      mainAccountCode={mainAccountCode}
      onSwitchAccount={switchToVaultAccount}
      onSetMainAccount={markMainAccount}
      onUnlinkVaultAccount={unlinkVaultAccount}
      onLogoutAll={() => handleLogout({ clearVault: true })}
      onLinkAccount={beginLinkAccount}
      googleLinked={(() => { const a = accounts.find((x) => x.code === accountCode); return !!(a && a.authProvider === "google" && a.socialId); })()}
      googleLinkedEmail={(() => { const a = accounts.find((x) => x.code === accountCode); return (a && a.email) || ""; })()}
      onLinkGoogle={handleLinkGoogle}
      onUnlinkGoogle={handleUnlinkGoogle}
      googleLinkBusy={googleLinkBusy}
      onLinkFacebook={handleLinkFacebook}
      onUnlinkFacebook={handleUnlinkFacebook}
      facebookLinkBusy={facebookLinkBusy}
      siteBanner={siteBanner} examConfig={examConfig} onPersistExamConfig={persistExamConfig} onPersistSiteBanner={persistSiteBanner} academicUnits={academicUnits} activeUnitId={activeUnitId} onChangeActiveUnitId={setActiveUnitId} onPersistAcademicUnits={persistAcademicUnits}
      showAdmin={showAdmin} onOpenAdmin={openAdminModal} onCloseAdmin={closeAdminModal}
      onAdminAddAccount={handleAdminAddAccount} onAdminEditAccount={handleAdminEditAccount} onAdminDeleteAccount={handleAdminDeleteAccount}
      onApproveRequest={handleApproveRequest} onRejectRequest={handleRejectRequest}
      toast={toast} showToast={showToast}
      theme={theme} onToggleTheme={toggleTheme} onChangeTheme={setTheme}
      accentTheme={accentTheme} onChangeAccent={setAccentTheme}
      skin={skin} onChangeSkin={setSkin}
      latinFont={latinFont} onChangeLatinFont={setLatinFont}
      arabicFont={arabicFont} onChangeArabicFont={setArabicFont}
      reducedMotion={reducedMotion} onChangeReducedMotion={setReducedMotion}
      uiSounds={uiSounds} onChangeUiSounds={setUiSounds}
      dirOverride={dirOverride} onChangeDirOverride={setDirOverride}
      cardSurface={cardSurface} onChangeCardSurface={setCardSurface}
      headerStyle={headerStyle} onChangeHeaderStyle={setHeaderStyle}
      cardClarity={cardClarity} onChangeCardClarity={setCardClarity}
      modalStyle={modalStyle} onChangeModalStyle={setModalStyle}
      iconStyle={iconStyle} onChangeIconStyle={setIconStyle}
      motionSpeed={motionSpeed} onChangeMotionSpeed={setMotionSpeed}
      examVisual={examVisual} onChangeExamVisual={setExamVisual}
      appIsAr={appIsAr} appLang={appLang} onToggleAppLang={toggleAppLang} onChangeAppLang={setAppLang}
      sessionStart={sessionStartRef.current}
      remindersOn={remindersOn} remindersBusy={remindersBusy} onEnableReminders={enableReminders} onDisableReminders={disableReminders} onTestReminder={testReminderPush} onClearReminderSlots={clearReminderSlots}
      reminderTitle={reminderTitle} onChangeReminderTitle={handleChangeReminderTitle}
      reminderMessage={reminderMessage} onChangeReminderMessage={handleChangeReminderMessage} reminderMessages={reminderMessages} onChangeReminderMessages={handleChangeReminderMessages}
      reminderIntervalHours={reminderIntervalHours} onChangeReminderIntervalHours={handleChangeReminderIntervalHours}
    />
    </Suspense>
  );
}

