import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import {
  fetchBootstrap,
  fetchMyAccount,
  fetchAccountsOnly,
  fetchEntriesOnly,
  fetchLogsOnly,
  fetchVersionOnly,
  saveRecord,
  saveAccountsOnly,
  SaveConflictError,
  patchAccountFields,
  patchSettings,
} from "./lib/state/cloudApi";
import {
  loadSearchHistory, saveSearchHistory, addToSearchHistory, removeFromSearchHistory, clearSearchHistory,
  saveOfflineCache, loadOfflineCache, loadOfflineMeta, flushFullCacheSync, savePersonalCode, loadPersonalCode, clearPersonalCode,
  markPendingCloudSync, clearPendingCloudSync, mergeOfflineProgress,
  loadPendingRemoveCodes, savePendingRemoveCodes, addPendingRemoveCode, removePendingRemoveCode,
  loadPendingApproveCodes, addPendingApproveCode, removePendingApproveCode,
  saveSessionId, loadSessionId, generateSessionId,
  detectDeviceIsAr, hasInviteParam,
} from "./lib/state/storage";
import { useAppPreferences } from "./lib/hooks/useAppPreferences";
import { useStudyReminders } from "./lib/hooks/useStudyReminders";
import { migrateAccounts } from "./lib/utils/authUtils";
import SplashScreen from "./components/layout/SplashScreen";
import { createSaveQueue, applyOps as applyOpsPure, MAX_SAVE_RETRIES as MAX_SAVE_RETRIES_CONST } from "./lib/state/cloudQueue";
import { flushPendingAccounts as flushAccountsCloud, flushPendingEntries as flushEntriesCloud } from "./lib/state/cloudFlush";
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

/** Single-flight refresh lock (survives navigation via sessionStorage). */
const REFRESH_LOCK_KEY = "twoTongues.refreshInFlight";
const REFRESH_LOCK_TTL_MS = 20000;

function isRefreshInFlight() {
  try {
    const raw = sessionStorage.getItem(REFRESH_LOCK_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) {
      sessionStorage.removeItem(REFRESH_LOCK_KEY);
      return false;
    }
    if (Date.now() - ts > REFRESH_LOCK_TTL_MS) {
      sessionStorage.removeItem(REFRESH_LOCK_KEY);
      return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

function beginRefreshLock() {
  try {
    sessionStorage.setItem(REFRESH_LOCK_KEY, String(Date.now()));
  } catch (_) {}
}

function endRefreshLock() {
  try {
    sessionStorage.removeItem(REFRESH_LOCK_KEY);
  } catch (_) {}
}



const deviceIsAr = detectDeviceIsAr();
const savedPersonalCode = loadPersonalCode();
/** Module-level: survives React StrictMode remount (refs reset on remount). */
let APP_BOOT_STARTED = false;

/**
 * Fast startup snapshot — reads only lightweight metadata (accounts, config).
 * Dictionary entries are loaded lazily in a useEffect after first paint so
 * JSON-parsing megabytes of word data never blocks React's initial render.
 */
function readInitialOfflineSnapshot() {
  // Try fast meta first (split key written by saveOfflineCache)
  let cached = loadOfflineMeta();
  // Backward compat: fall back to full cache if meta key doesn't exist yet
  if (!cached) {
    cached = loadOfflineCache();
    if (!cached) return null;
  }
  const hasData =
    (Array.isArray(cached.accounts) && cached.accounts.length > 0);
  if (!hasData) return null;
  let accounts = cached.accounts || [];
  try {
    const migrated = migrateAccounts(accounts);
    accounts = migrated.accounts || accounts;
  } catch (_) {}
  const account =
    savedPersonalCode && accounts.length
      ? accounts.find((a) => a && a.code === savedPersonalCode)
      : null;
  const usableAccount =
    account &&
    account.status !== "pending" &&
    account.status !== "rejected" &&
    account.status !== "blocked"
      ? account
      : null;
  return {
    entries: [], // ← populated lazily after first paint
    accounts,
    logs: Array.isArray(cached.logs) ? cached.logs : [],
    siteBanner: cached.siteBanner || null,
    examConfig: cached.examConfig || null,
    academicUnits: cached.academicUnits || null,
    version: typeof cached.version === "number" ? cached.version : 0,
    cachedAt: cached.cachedAt || null,
    usableAccount,
  };
}

const initialOffline = readInitialOfflineSnapshot();

export default function DictionaryApp() {
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
  const [googleLinkBusy, setGoogleLinkBusy] = useState(false); // this browser's signed-in account's personal code
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
    return [...others, ...incoming];
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

  // Hard force-refresh: unregister every SW, wipe Cache Storage, then reload.
  // Call from console:  window.__forceAppRefresh()
  // or from any button. Survives "I cleared data and still can't refresh".
    // Mark installed-PWA on <html> so CSS can disable pull-to-refresh only there
  // (covers iOS navigator.standalone as well as display-mode media).
  useEffect(() => {
    const apply = () => {
      try {
        // Only true installed-app modes — never treat a normal browser tab as PWA
        // so pull-to-refresh stays available on every screen in the browser.
        const pwa = !!(window.navigator.standalone ||
          window.matchMedia("(display-mode: standalone)").matches);
        document.documentElement.setAttribute("data-pwa-standalone", pwa ? "1" : "0");
      } catch (_) {}
    };
    apply();
    let mq;
    try {
      mq = window.matchMedia("(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)");
      mq.addEventListener?.("change", apply);
      return () => mq.removeEventListener?.("change", apply);
    } catch (_) {}
  }, []);

useEffect(() => {
    // IMPORTANT: do NOT call endRefreshLock() on mount.
    // The lock must survive the reload that controllerchange triggers;
    // clearing it here was the main cause of the double open/close cycle
    // (reload #1 → mount clears lock → second controllerchange → reload #2).
    // The TTL (REFRESH_LOCK_TTL_MS) expires the lock safely after 20s.

    window.__forceAppRefresh = async () => {
      // Only one programmatic refresh may run at a time.
      if (isRefreshInFlight()) return;
      beginRefreshLock();
      // Block the entire UI until reload completes (SplashScreen / water bar).
      try {
        window.dispatchEvent(new CustomEvent("tt-force-refresh-start"));
      } catch (_) {}
      // Brief pause so the blocking overlay can paint before we tear down SW/caches.
      await new Promise((r) => setTimeout(r, 80));
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
      } catch (_) {}
      try {
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (_) {}
      try {
        // Bust any sticky query so the next navigation is not served from disk cache
        const u = new URL(window.location.href);
        u.searchParams.set("_r", String(Date.now()));
        window.location.replace(u.toString());
      } catch (_) {
        try {
          window.location.reload();
        } catch (__) {
          endRefreshLock();
          try {
            window.dispatchEvent(new CustomEvent("tt-force-refresh-end"));
          } catch (___) {}
        }
      }
    };
    return () => {
      try { delete window.__forceAppRefresh; } catch (_) {}
    };
  }, []);

  // Registers the offline service worker (see /sw.js).
  // updateViaCache: "none" + explicit reg.update() so a normal browser
  // refresh (or pull-to-refresh) actually picks up a newly deployed SW/shell
  // instead of silently keeping a week-old worker. Also force-activates any
  // waiting worker so the user does not need a second reload.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        if (cancelled) return;
        try { reg.update(); } catch (_) {}
        const kick = () => {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        };
        if (reg.waiting) kick();
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              kick();
            }
          });
        });
      })
      .catch(() => {
        // Registration failure just means no offline app-shell caching;
        // the localStorage data cache above still works independently.
      });
    // When a new worker takes control, do one clean reload so the user
    // sees the new assets without having to manually refresh twice.
    // Guarded by the same single-flight lock used by __forceAppRefresh.
    const onControllerChange = () => {
      if (isRefreshInFlight()) return;
      beginRefreshLock();
      try {
        window.location.reload();
      } catch (_) {
        endRefreshLock();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
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

  // One-time migration: assign usernames to legacy accounts that only had a
  // name + personal code, and mark them active so they keep working.
  async function ensureMigratedAccounts(rec) {
    const { accounts: migrated, changed } = migrateAccounts(rec.accounts || []);
    if (!changed || migrationDoneRef.current) {
      return { ...rec, accounts: migrated };
    }
    migrationDoneRef.current = true;
    try {
      // كتابة جزئية: الحسابات فقط (بدون إعادة إرسال القاموس كامل)
      const newVersion = await saveAccountsOnly(
        { accounts: migrated },
        rec.version || 0
      );
      return { ...rec, accounts: migrated, version: newVersion };
    } catch (e) {
      // Conflict or offline — still use migrated in-memory so the UI works;
      // next successful save will persist usernames.
      return { ...rec, accounts: migrated };
    }
  }

  useEffect(() => {
    if (APP_BOOT_STARTED) return;
    APP_BOOT_STARTED = true;
    let cancelled = false;
    (async () => {
      try {
        // ── Load offline entries ONCE before any merge ──────────────
        // The rAF-deferred effect (above) may have already populated
        // entriesRef.current. Use it first; fall back to a single
        // loadOfflineCache() call so we never JSON-parse twice.
        let offlineEntries = entriesRef.current;
        if (!offlineEntries || offlineEntries.length === 0) {
          try {
            const fullCache = loadOfflineCache();
            offlineEntries = (fullCache && fullCache.entries) || [];
            if (offlineEntries.length > 0) {
              entriesRef.current = offlineEntries;
              setEntries(offlineEntries);
              setEntriesLoaded(true);
            }
          } catch (_) {}
        }

        // ============================================================
        // مرحلة 1 من عزل الإجراءات: جلب مجزأ بدل السجل الكامل
        // نجمع البيانات من عدة طلبات خفيفة ثم نبني كائن rec متوافق
        // مع المنطق الحالي (الدمج / الموافقات / الجلسات)
        // ============================================================
        let rec;

        // لو في كود شخصي محفوظ → نجيب الحساب أولاً عشان نعرف هل هو أدمن
        const personalCode = savedPersonalCode || loadPersonalCode();
        // القسم الحالي فقط أولاً (توفير باندويث) — باقي الأقسام عند التبديل أو prefetch
        let primarySection = "en-ar";
        try {
          const s = localStorage.getItem("twoTongues.section");
          if (s === "en-ar" || s === "ar-ar" || s === "academic") primarySection = s;
        } catch (_) {}

        if (personalCode) {
          // طلبات متوازية: الحساب + الإعدادات العامة + كلمات القسم الحالي فقط
          const [myAccount, bootstrap, sectionEntries] = await Promise.all([
            fetchMyAccount(personalCode).catch(() => null),
            fetchBootstrap().catch(() => ({})),
            fetchEntriesOnly({ section: primarySection }).catch(() => []),
          ]);

          const isPrivileged =
            myAccount &&
            (myAccount.role === "admin" || myAccount.role === "teacher");

          // الحسابات الكاملة واللوجات فقط للأدمن/المعلم
          let accounts = myAccount ? [myAccount] : [];
          let logs = [];
          if (isPrivileged) {
            const [allAccounts, allLogs] = await Promise.all([
              fetchAccountsOnly().catch(() => []),
              fetchLogsOnly().catch(() => []),
            ]);
            accounts = allAccounts.length ? allAccounts : accounts;
            logs = allLogs;
          }

          // ادمج مع كاش الأقسام الأخرى عشان ما تختفيش لحد ما تتجلب
          const entries = mergeSectionEntries(offlineEntries, sectionEntries, primarySection);
          loadedSectionsRef.current.add(primarySection);

          rec = {
            entries: entries || [],
            accounts,
            logs,
            siteBanner: bootstrap.siteBanner || null,
            examConfig: bootstrap.examConfig || null,
            academicUnits: bootstrap.academicUnits || null,
            version: typeof bootstrap.version === "number" ? bootstrap.version : 0,
          };
        } else {
          // مستخدم مش مسجل → إعدادات عامة + قسم واحد فقط
          const [bootstrap, sectionEntries] = await Promise.all([
            fetchBootstrap().catch(() => ({})),
            fetchEntriesOnly({ section: primarySection }).catch(() => []),
          ]);
          const entries = mergeSectionEntries(offlineEntries, sectionEntries, primarySection);
          loadedSectionsRef.current.add(primarySection);
          rec = {
            entries: entries || [],
            accounts: [],
            logs: [],
            siteBanner: bootstrap.siteBanner || null,
            examConfig: bootstrap.examConfig || null,
            academicUnits: bootstrap.academicUnits || null,
            version: typeof bootstrap.version === "number" ? bootstrap.version : 0,
          };
        }

        rec = await ensureMigratedAccounts(rec);

        // If user reloaded while a studied/favorite save was still in flight,
        // offline cache holds the newer progress — merge it back and re-save.
        // Use lightweight meta (accounts + cachedAt only, no entries) for speed.
        const offline = loadOfflineMeta() || loadOfflineCache();
        const { accounts: mergedAccounts, merged } = mergeOfflineProgress(rec.accounts || [], offline);
        if (merged) {
          rec = { ...rec, accounts: mergedAccounts };
        }

        // Re-apply intentional deletes that may not have landed on the server yet
        // (delete → reload race). Also prune localStorage once the server
        // no longer returns those codes.
        let accountsForUi = rec.accounts || [];
        if (pendingRemoveCodesRef.current.size) {
          const drop = pendingRemoveCodesRef.current;
          const stillOnServer = [];
          accountsForUi = accountsForUi.filter((a) => {
            if (!a || !a.code) return false;
            if (drop.has(String(a.code))) {
              stillOnServer.push(String(a.code));
              return false;
            }
            return true;
          });
          // Codes the server already dropped can leave localStorage.
          for (const code of [...drop]) {
            if (!stillOnServer.includes(code)) {
              drop.delete(code);
              removePendingRemoveCode(code);
            }
          }
          // If any deleted codes are still on the server, push remove again.
          if (stillOnServer.length) {
            try {
              const cleaned = (rec.accounts || []).filter(
                (a) => a && a.code && !drop.has(String(a.code))
              );
              // كتابة جزئية: accounts + remove فقط
              const newVersion = await saveAccountsOnly(
                { accounts: cleaned, removeAccountCodes: stillOnServer },
                rec.version || 0
              );
              commitRecordVersion(newVersion);
              rec = { ...rec, accounts: cleaned, version: newVersion };
              accountsForUi = cleaned;
            } catch (_) {
              // Keep pendingRemoveCodes so the next load retries.
            }
          }
        }

        // Re-apply approvals that may not have landed (approve → reload race).
        if (pendingApprovedCodesRef.current.size) {
          const approved = pendingApprovedCodesRef.current;
          const stillPendingOnServer = [];
          accountsForUi = accountsForUi.map((a) => {
            if (!a || !a.code) return a;
            const key = String(a.code);
            if (!approved.has(key)) return a;
            if (a.status === "pending") {
              stillPendingOnServer.push(key);
              return { ...a, status: "active" };
            }
            approved.delete(key);
            removePendingApproveCode(key);
            return a;
          });
          if (stillPendingOnServer.length) {
            try {
              // كتابة جزئية: accounts + approve فقط
              const newVersion = await saveAccountsOnly(
                {
                  accounts: accountsForUi,
                  approveAccountCodes: stillPendingOnServer,
                },
                rec.version || 0
              );
              commitRecordVersion(newVersion);
              rec = { ...rec, accounts: accountsForUi, version: newVersion };
              for (const code of stillPendingOnServer) {
                approved.delete(code);
                removePendingApproveCode(code);
              }
            } catch (_) {}
          }
        }

        setEntries(rec.entries);
        entriesRef.current = rec.entries || [];
        lastSyncedEntriesRef.current = rec.entries || [];
        setAccounts(accountsForUi);
        accountsRef.current = accountsForUi;
        setLogs(rec.logs);
        setSiteBanner(rec.siteBanner || null);
        setExamConfig(normalizeExamConfig(rec.examConfig));
        setAcademicUnits(normalizeAcademicUnits(rec.academicUnits));
        academicUnitsRef.current = normalizeAcademicUnits(rec.academicUnits);
        setLogsLoaded(true);
        commitRecordVersion(rec.version);
        saveOfflineCache({ ...rec, accounts: accountsForUi });
        setIsOffline(false);

        // prefetch هادئ لباقي الأقسام بعد ما الواجهة تشتغل (ما يعيقش الفتح)
        const remaining = ["en-ar", "ar-ar", "academic"].filter(
          (s) => !loadedSectionsRef.current.has(s)
        );
        if (remaining.length) {
          const runPrefetch = () => {
            remaining.forEach((sec, i) => {
              setTimeout(async () => {
                if (loadedSectionsRef.current.has(sec)) return;
                try {
                  const list = await fetchEntriesOnly({ section: sec });
                  loadedSectionsRef.current.add(sec);
                  setEntries((prev) => {
                    const mergedList = mergeSectionEntries(prev, list, sec);
                    entriesRef.current = mergedList;
                    return mergedList;
                  });
                } catch (_) {}
              }, 2500 + i * 1500); // متباعد عشان ما نضغطش الشبكة
            });
          };
          if (typeof requestIdleCallback === "function") {
            requestIdleCallback(runPrefetch, { timeout: 8000 });
          } else {
            setTimeout(runPrefetch, 4000);
          }
        }

        if (merged) {
          // Push merged progress to cloud in the background (version may race;
          // flushPendingAccounts-style retries handle conflicts).
          try {
            let accountsToSave = mergedAccounts;
            if (pendingRemoveCodesRef.current.size) {
              const drop = pendingRemoveCodesRef.current;
              accountsToSave = accountsToSave.filter((a) => a && a.code && !drop.has(String(a.code)));
            }
            const removeCodes = [...pendingRemoveCodesRef.current];
            // كتابة جزئية: تقدّم الحسابات فقط (studied/favorites) بدون القاموس
            const newVersion = await saveAccountsOnly(
              {
                accounts: accountsToSave,
                ...(removeCodes.length ? { removeAccountCodes: removeCodes } : {}),
              },
              rec.version || 0
            );
            commitRecordVersion(newVersion);
            saveOfflineCache({ ...rec, accounts: accountsToSave, version: newVersion });
            clearPendingCloudSync();
          } catch (_) {
            // Keep pending flag so next load retries the merge.
            markPendingCloudSync();
          }
        } else {
          clearPendingCloudSync();
        }
        if (savedPersonalCode) {
          let account = rec.accounts.find((a) => a.code === savedPersonalCode);
          if (!account) {
            // مسار نادر: الحساب مش موجود في النتيجة الأولى — إعادة جلب مجزأة
            try {
              let primarySec = "en-ar";
              try {
                const s = localStorage.getItem("twoTongues.section");
                if (s === "en-ar" || s === "ar-ar" || s === "academic") primarySec = s;
              } catch (_) {}
              const [freshAccount, bootstrap, sectionEntries] = await Promise.all([
                fetchMyAccount(savedPersonalCode, { fresh: true }).catch(() => null),
                fetchBootstrap({ fresh: true }).catch(() => ({})),
                fetchEntriesOnly({ fresh: true, section: primarySec }).catch(() => []),
              ]);
              const entries = mergeSectionEntries(
                entriesRef.current || [],
                sectionEntries,
                primarySec
              );
              loadedSectionsRef.current.add(primarySec);
              const isPriv =
                freshAccount &&
                (freshAccount.role === "admin" || freshAccount.role === "teacher");
              let accountsList = freshAccount ? [freshAccount] : [];
              let logsList = [];
              if (isPriv) {
                const [allAcc, allLogs] = await Promise.all([
                  fetchAccountsOnly({ fresh: true }).catch(() => []),
                  fetchLogsOnly({ fresh: true }).catch(() => []),
                ]);
                if (allAcc.length) accountsList = allAcc;
                logsList = allLogs;
              }
              const freshRec = await ensureMigratedAccounts({
                entries: entries || [],
                accounts: accountsList,
                logs: logsList,
                siteBanner: bootstrap.siteBanner || null,
                examConfig: bootstrap.examConfig || null,
                academicUnits: bootstrap.academicUnits || null,
                version: typeof bootstrap.version === "number" ? bootstrap.version : 0,
              });
              rec = freshRec;
              setEntries(freshRec.entries);
              setAccounts(freshRec.accounts);
              setLogs(freshRec.logs);
              setSiteBanner(freshRec.siteBanner || null);
              setExamConfig(normalizeExamConfig(freshRec.examConfig));
              setAcademicUnits(normalizeAcademicUnits(freshRec.academicUnits));
              academicUnitsRef.current = normalizeAcademicUnits(freshRec.academicUnits);
              commitRecordVersion(freshRec.version);
              saveOfflineCache(freshRec);
              account = freshRec.accounts.find((a) => a.code === savedPersonalCode);
            } catch (e2) { /* fall through */ }
          }
          if (account && account.status !== "pending" && account.status !== "rejected" && account.status !== "blocked") {
            // Session rules:
            // - If this browser has a sessionId AND it differs from the cloud →
            //   another device signed in → force login.
            // - If local sessionId is missing (refresh, new tab, cleared storage)
            //   but personalCode is still saved → stay signed in and re-bind
            //   the local session to the cloud one (or claim a new one).
            //   Logging out on missing localSid was kicking users on every
            //   refresh / new tab.
            // Stay signed in whenever personalCode matches a valid account.
            // Never force-logout on sessionId mismatch (refresh, new tab,
            // screenshot → visibility, or another device). Multi-device is OK;
            // explicit Sign out is the only way out.
            setName(account.name);
            setIsAdmin(account.role === "admin" || account.role === "teacher");
            setIsTeacher(account.role === "teacher");
            setAccountCode(account.code);
            // مزامنة سريعة للخزنة بعد استعادة الجلسة
            try {
              const v = upsertVaultAccount(account, { allowMulti: account.role === "admin" || account.role === "teacher" });
              setVaultAccounts(v);
              setMainAccountCodeState(getMainAccountCode() || account.code);
            } catch (_) {}
            setAuthStage("in");
            syncBaseHistory("in");
            const localSid = loadSessionId();
            if (account.sessionId) {
              // Prefer the cloud token so every tab in this browser agrees.
              saveSessionId(account.sessionId);
            } else if (!localSid) {
              const sid = generateSessionId();
              saveSessionId(sid);
              const code = account.code;
              const stamped = Date.now();
              try {
                // Best-effort claim; failure must NOT log the user out.
                let ver = rec.version || 0;
                let accs = rec.accounts || [];
                for (let attempt = 0; attempt < 5; attempt++) {
                  const nextAccounts = accs.map((a) =>
                    a.code === code ? { ...a, sessionId: sid, sessionAt: stamped } : a
                  );
                  try {
                    // كتابة جزئية: حقول الجلسة فقط على حساب واحد
                    const newVersion = await patchAccountFields(
                      code,
                      { sessionId: sid, sessionAt: stamped },
                      ver
                    );
                    setAccounts(nextAccounts);
                    commitRecordVersion(newVersion);
                    break;
                  } catch (e) {
                    if (e instanceof SaveConflictError) {
                      accs = e.fresh.accounts || accs;
                      ver = e.fresh.version || ver;
                      commitRecordVersion(ver);
                      // If someone else already set a session, adopt it.
                      const freshAcc = accs.find((a) => a.code === code);
                      if (freshAcc && freshAcc.sessionId) {
                        saveSessionId(freshAcc.sessionId);
                        setAccounts(accs);
                        break;
                      }
                      continue;
                    }
                    setAccounts(accs.map((a) =>
                      a.code === code ? { ...a, sessionId: sid, sessionAt: stamped } : a
                    ));
                    break;
                  }
                }
              } catch (_) { /* stay signed in locally */ }
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
          setExamConfig(normalizeExamConfig(cached.examConfig));
          setAcademicUnits(normalizeAcademicUnits(cached.academicUnits));
          academicUnitsRef.current = normalizeAcademicUnits(cached.academicUnits);
          setIsOffline(true);
          setOfflineCachedAt(cached.cachedAt);
          if (savedPersonalCode) {
            const account = migrated.find((a) => a.code === savedPersonalCode);
            if (account && account.status !== "pending" && account.status !== "rejected" && account.status !== "blocked") {
              setName(account.name);
              setIsAdmin(account.role === "admin" || account.role === "teacher");
              setIsTeacher(account.role === "teacher");
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
        if (!cancelled) {
          setEntriesLoaded(true);
          setAccountsLoaded(true);
          setLogsLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep display name tied to the active account (fixes wrong name after refresh / vault switch)
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
    // Always clear local state first so the modal cannot stick open if history
    // is out of sync (e.g. extra pushState from another overlay).
    setShowAdd(false);
    try {
      // Use replaceState (not history.back) so closing Add never races with
      // another overlay that is about to pushState (e.g. opening word zoom
      // after "word already exists"). history.back is async and was re-opening
      // Add via popstate when a second history helper had also pushed.
      if (window.history.state && window.history.state.showAdd) {
        window.history.replaceState({ ...window.history.state, showAdd: false }, "");
      }
    } catch (_) {}
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
    try { import("./components/modals/AdminModal"); } catch (_) {}
    setShowAdmin(true);
    pushHistory({ showAdmin: true });
    // للأدمن: تأكد إن كل الأقسام متحمّلة (نسخ احتياطي / إحصائيات)
    const missing = ["en-ar", "ar-ar", "academic"].filter(
      (s) => !loadedSectionsRef.current.has(s)
    );
    if (missing.length) {
      (async () => {
        try {
          // جلب كامل مرة واحدة أخف من 3 طلبات لو ناقص أكتر من قسم
          const all = await fetchEntriesOnly({ fresh: true });
          ["en-ar", "ar-ar", "academic"].forEach((s) =>
            loadedSectionsRef.current.add(s)
          );
          setEntries(all);
          entriesRef.current = all;
        } catch (_) {}
      })();
    }
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
    try { localStorage.setItem("twoTongues.section", nextSection); } catch (_) {}
    setQuery("");
    pushHistory({ section: nextSection });
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
  function handleSaveConflict(err) {
    setEntries(err.fresh.entries || []);
    setAccounts(err.fresh.accounts || []);
    setLogs(err.fresh.logs || []);
    if (err.fresh.siteBanner !== undefined) setSiteBanner(err.fresh.siteBanner || null);
    if (err.fresh.examConfig !== undefined) setExamConfig(normalizeExamConfig(err.fresh.examConfig));
    if (err.fresh.academicUnits !== undefined) {
      const u = normalizeAcademicUnits(err.fresh.academicUnits);
      setAcademicUnits(u);
      academicUnitsRef.current = u;
    }
    commitRecordVersion(err.fresh.version || 0);
    setSaveError(""); // conflict recovered by resync — no scary banner
  }

  // Max number of automatic retries on a version conflict before giving up
  // and falling back to handleSaveConflict (which discards the pending
  // change and asks the user to retry manually). In practice a single
  // retry resolves the vast majority of real-world races (two people
  // adding a word within the same second), since each retry re-reads the
  // absolute latest server state.
  const MAX_SAVE_RETRIES = MAX_SAVE_RETRIES_CONST;

  // Apply a list of ops (each op is { fn, logFn }) onto base state.
  // Functional fns compose; plain-array ops replace.
  const applyOps = applyOpsPure;

  function getFlushCtx() {
    return {
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
      commitRecordVersion,
      setAccounts,
      setLogs,
      setEntries,
      setSiteBanner,
      setSaveError,
      accountCode,
      lastSyncedEntriesRef,
    };
  }

  function flushPendingAccounts() {
    return flushAccountsCloud(getFlushCtx());
  }

  function flushPendingEntries() {
    return flushEntriesCloud(getFlushCtx());
  }

  // Snapshot current in-memory record to localStorage RIGHT NOW so a reload
  // mid-flight cannot lose studied/favorite toggles (cloud PUT is slower).
  function snapshotLocalNow() {
    try {
      saveOfflineCache({
        entries: entriesRef.current,
        accounts: accountsRef.current,
        logs: logsRef.current,
        siteBanner: siteBannerRef.current,
        examConfig: examConfigRef.current, academicUnits: academicUnitsRef.current,
        version: recordVersionRef.current,
      });
      markPendingCloudSync();
    } catch (_) {}
  }

  // Public API: queue the op (optimistic UI update) and schedule a coalesced flush.
  const persistEntries = useCallback(async (entriesFn, logEntryFn) => {
    // Optimistic local apply immediately for snappy UI.
    const base = entriesRef.current;
    const optimistic = typeof entriesFn === "function" ? entriesFn(base) : entriesFn;
    setEntries(optimistic);
    entriesRef.current = optimistic;
    if (logEntryFn) {
      const le = typeof logEntryFn === "function" ? logEntryFn(base) : logEntryFn;
      if (le) {
        const nl = capLogs([...logsRef.current, le]);
        setLogs(nl);
        logsRef.current = nl;
      }
    }
    // Survive reload before cloud write finishes
    snapshotLocalNow();
    pendingEntryOpsRef.current.push({ fn: entriesFn, logFn: logEntryFn || null });
    return flushPendingEntries();
  }, []);

  const persistAccounts = useCallback(async (accountsFn, logEntryFn) => {
    const base = accountsRef.current;
    const optimistic = typeof accountsFn === "function" ? accountsFn(base) : accountsFn;
    setAccounts(optimistic);
    accountsRef.current = optimistic;
    if (logEntryFn) {
      const le = typeof logEntryFn === "function" ? logEntryFn(base) : logEntryFn;
      if (le) {
        const nl = capLogs([...logsRef.current, le]);
        setLogs(nl);
        logsRef.current = nl;
      }
    }
    // Survive reload before cloud write finishes (studied / favorites / SRS)
    snapshotLocalNow();
    pendingAccountOpsRef.current.push({ fn: accountsFn, logFn: logEntryFn || null });
    return flushPendingAccounts();
  }, []);

  // أحداث اللوج (sign in/out) — ما زال saveRecord كامل لأن الـ API
  // لا يدعم scope=logs للكتابة بعد. نادر الحدوث؛ بقية المسارات جزئية.
  const persistLogs = useCallback(async (next) => {
    setLogs(next);
    logsRef.current = next;
    return enqueueSave(async () => {
      let curVersion = recordVersionRef.current;
      let curEntries = entriesRef.current;
      let curAccounts = accountsRef.current;
      let curBanner = siteBannerRef.current;
      for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt++) {
        try {
          const newVersion = await saveRecord({ entries: curEntries, accounts: curAccounts, logs: next, siteBanner: curBanner}, curVersion);
          commitRecordVersion(newVersion);
          return;
        } catch (e) {
          if (e instanceof SaveConflictError && attempt < MAX_SAVE_RETRIES) {
            curEntries = e.fresh.entries || [];
            curAccounts = e.fresh.accounts || [];
            curVersion = e.fresh.version || 0;
            if (e.fresh.siteBanner !== undefined) curBanner = e.fresh.siteBanner || null;
            commitRecordVersion(curVersion);
            await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
            continue;
          }
          if (e instanceof SaveConflictError && e.fresh) {
            setEntries(e.fresh.entries || []);
            setAccounts(e.fresh.accounts || []);
            setLogs(e.fresh.logs || []);
            if (e.fresh.siteBanner !== undefined) setSiteBanner(e.fresh.siteBanner || null);
            commitRecordVersion(e.fresh.version || 0);
          }
          return;
        }
      }
    });
  }, []);

  function logEvent(action, message, actorName, actorCode) {
    persistLogs(capLogs([...logs, makeLogEntry(action, message, actorName, actorCode)]));
  }

  // Admin publishes / clears the site-wide announcement banner.
  const persistSiteBanner = useCallback(async (nextBanner) => {
    setSiteBanner(nextBanner);
    siteBannerRef.current = nextBanner;
    return enqueueSave(async () => {
      let curVersion = recordVersionRef.current;
      for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt++) {
        try {
          const newVersion = await patchSettings("site_banner", nextBanner, curVersion);
          commitRecordVersion(newVersion);
          saveOfflineCache({
            entries: entriesRef.current,
            accounts: accountsRef.current,
            logs: logsRef.current,
            siteBanner: nextBanner,
            examConfig: examConfigRef.current,
            academicUnits: academicUnitsRef.current,
          });
          return { ok: true };
        } catch (e) {
          if (e instanceof SaveConflictError && attempt < MAX_SAVE_RETRIES) {
            curVersion = e.fresh.version || 0;
            commitRecordVersion(curVersion);
            await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
            continue;
          }
          if (e instanceof SaveConflictError) handleSaveConflict(e);
          return { ok: false, error: "Couldn't save the announcement — try again." };
        }
      }
      return { ok: false, error: "Couldn't save the announcement — try again." };
    });
  }, []);



  // Admin publishes exam countdown (date/time/color) for all users.
  const persistExamConfig = useCallback(async (nextCfg) => {
    const normalized = normalizeExamConfig(nextCfg);
    setExamConfig(normalized);
    examConfigRef.current = normalized;
    saveExamConfigCache(normalized);
    return enqueueSave(async () => {
      let curVersion = recordVersionRef.current;
      for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt++) {
        try {
          const newVersion = await patchSettings("exam_config", normalized, curVersion);
          commitRecordVersion(newVersion);
          saveOfflineCache({
            entries: entriesRef.current,
            accounts: accountsRef.current,
            logs: logsRef.current,
            siteBanner: siteBannerRef.current,
            examConfig: normalized,
            academicUnits: academicUnitsRef.current,
          });
          return { ok: true };
        } catch (e) {
          if (e instanceof SaveConflictError && attempt < MAX_SAVE_RETRIES) {
            curVersion = e.fresh.version || 0;
            commitRecordVersion(curVersion);
            await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
            continue;
          }
          if (e instanceof SaveConflictError) handleSaveConflict(e);
          return { ok: false, error: "Couldn't save exam settings — try again." };
        }
      }
      return { ok: false, error: "Couldn't save exam settings — try again." };
    });
  }, []);

  const persistAcademicUnits = useCallback(async (nextUnits) => {
    const normalized = normalizeAcademicUnits(nextUnits);
    setAcademicUnits(normalized);
    academicUnitsRef.current = normalized;
    saveAcademicUnitsCache(normalized);
    setActiveUnitId((cur) => {
      if (normalized.some((u) => u.id === cur)) return cur;
      return normalized[0]?.id || null;
    });
    return enqueueSave(async () => {
      let curVersion = recordVersionRef.current;
      for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt++) {
        try {
          const newVersion = await patchSettings("academic_units", normalized, curVersion);
          commitRecordVersion(newVersion);
          saveOfflineCache({
            entries: entriesRef.current,
            accounts: accountsRef.current,
            logs: logsRef.current,
            siteBanner: siteBannerRef.current,
            examConfig: examConfigRef.current,
            academicUnits: normalized,
          });
          return { ok: true };
        } catch (e) {
          if (e instanceof SaveConflictError && attempt < MAX_SAVE_RETRIES) {
            curVersion = e.fresh.version || 0;
            commitRecordVersion(curVersion);
            await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
            continue;
          }
          if (e instanceof SaveConflictError) handleSaveConflict(e);
          return { ok: false, error: "Couldn't save units — try again." };
        }
      }
      return { ok: false, error: "Couldn't save units — try again." };
    });
  }, []);

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
    if (provider !== "google") {
      setAuthError("Only Google sign-in is available.");
      return;
    }
    const [{ signInWithGoogle }, { performSocialLogin }] = await Promise.all([
      import("./lib/state/socialAuth"),
      import("./lib/state/authFlow"),
    ]);
    setAuthError("");
    try {
      const profile = await signInWithGoogle();
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
      setAuthError((err && err.message) || "Sign-in failed.");
    }
  }

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
      ? "إلغاء ربط Google؟ ستحتاج اسم المستخدم وكلمة المرور لتسجيل الدخول."
      : "Unlink Google? You'll need username and password to sign in.";
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
      // Drop null Google fields from in-memory accounts so UI refreshes immediately
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
        showToast(appIsAr ? "تم إلغاء ربط Google" : "Google unlinked");
      }
    } catch (e) {
      const msg = (e && e.message) || (appIsAr ? "تعذّر إلغاء الربط" : "Could not unlink");
      if (typeof showToast === "function") showToast(msg);
      else window.alert(msg);
    } finally {
      setGoogleLinkBusy(false);
    }
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
      goToStage,
    });
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
        let list = [];
        if (isPrivileged && Array.isArray(accountsList) && accountsList.length) {
          list = accountsList;
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
          setAccounts(list);
          accountsRef.current = list;
        }
        if (rec.siteBanner !== undefined) setSiteBanner(rec.siteBanner || null);
        if (typeof rec.version === "number") commitRecordVersion(rec.version);
        const account = (rec.accounts || []).find((a) => a.code === accountCode);
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
    return updateOwnAccount({
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

