import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { tr } from "./lib/config/i18n";
import { fetchRecord, saveRecord, SaveConflictError } from "./lib/state/cloudApi";
import {
  loadSavedAccent, saveAccent, applyAccentTheme, ACCENT_THEMES, THEME_KEY,
  loadCustomAccentHex, saveCustomAccentHex,
  loadSearchHistory, saveSearchHistory, addToSearchHistory, removeFromSearchHistory, clearSearchHistory,
  saveOfflineCache, loadOfflineCache, loadSavedTheme, resolveTheme, loadUiScale, saveUiScale, savePersonalCode, loadPersonalCode, clearPersonalCode,
  saveSessionId, loadSessionId, generateSessionId,
  generatePersonalCode, detectDeviceIsAr, hasInviteParam,
  loadAppLang, saveAppLang,
  loadDeviceMode, saveDeviceMode, applyDeviceModeToDom, guessDeviceMode,
} from "./lib/state/storage";
import {
  validateUsername, validatePassword, hashPassword, verifyPassword, verifyPasswordDetailed, migrateAccounts, normalizeUsername,
} from "./lib/utils/authUtils";
import { SRS_LEVEL_INTERVALS_MS, srsLevelFromStats, computeStreak, applySm2, correctToQuality, getCardState, loadSrsPrefs } from "./lib/utils/quizHelpers";
import { evaluateAchievements } from "./lib/state/achievements";
import { loadExamConfigCache, saveExamConfigCache, normalizeExamConfig, defaultExamConfig } from "./lib/state/exam";
import { getTodayTimerMinutes } from "./lib/state/goals";
import {
  pushSupported, getPushStatus, subscribeToPush, unsubscribeFromPush, savePushPrefs,
  loadRemindersEnabled, saveRemindersEnabled,
  loadReminderMessage, saveReminderMessage, loadReminderTitle, saveReminderTitle,
  buildReminderPayload,
} from "./lib/state/push";
import {
  loadAccountVault, upsertVaultAccount, removeVaultAccount, clearAccountVault,
  getMainAccountCode, setMainAccountCode,
} from "./lib/state/accountVault";
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
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPassword2, setSignupPassword2] = useState("");
  const [signupAvatar, setSignupAvatar] = useState("");
  const [signupGender, setSignupGender] = useState(""); // "male" | "female"
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

  // Device layout mode (user-chosen): mobile | tablet | desktop
  // null until the user picks — we still apply a soft guess for first paint.
  const [deviceMode, setDeviceModeState] = useState(() => loadDeviceMode());
  function setDeviceMode(mode) {
    if (mode !== "mobile" && mode !== "tablet" && mode !== "desktop") return;
    setDeviceModeState(mode);
    saveDeviceMode(mode);
    applyDeviceModeToDom(mode);
  }
  useEffect(() => {
    const effective = deviceMode || guessDeviceMode();
    applyDeviceModeToDom(effective);
  }, [deviceMode]);

  const [entries, setEntries] = useState([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  // Tracks the version of the shared record we last read from the server —
  // sent back on every save as `expectedVersion` so the server can detect
  // (and reject) a write that would silently clobber someone else's change
  // made in between. See the concurrency comment in api/jsonbin.js.
  const [recordVersion, setRecordVersion] = useState(0);
  // Always keep a ref in sync so concurrent saves (two toggles in a row, two
  // tabs, quiz answers firing back-to-back) never send a stale expectedVersion
  // just because React hasn't re-rendered the useCallback closure yet.
  const recordVersionRef = useRef(0);
  function commitRecordVersion(v) {
    const n = typeof v === "number" ? v : 0;
    recordVersionRef.current = n;
    setRecordVersion(n);
  }
  // Serialize all cloud writes from this tab. Parallel persist* calls were the
  // main source of fake "updated elsewhere" errors when marking studied /
  // favorites quickly or when login session write raced a background sync.
  const saveChainRef = useRef(Promise.resolve());
  function enqueueSave(task) {
    const run = saveChainRef.current.then(task, task);
    // Swallow so the chain never permanently rejects.
    saveChainRef.current = run.catch(() => {});
    return run;
  }
  // Live mirrors so a queued/coalesced save always sees the latest data,
  // not a stale React closure from when the user clicked earlier.
  const entriesRef = useRef([]);
  const accountsRef = useRef([]);
  const logsRef = useRef([]);
  const siteBannerRef = useRef(null);
  // Batch rapid studied/favorite/quiz ops into a single network write.
  const pendingAccountOpsRef = useRef([]);
  const pendingEntryOpsRef = useRef([]);
  const [loadError, setLoadError] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [offlineCachedAt, setOfflineCachedAt] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [siteBanner, setSiteBanner] = useState(null); // admin-published site-wide announcement
  const [examConfig, setExamConfig] = useState(() => loadExamConfigCache()); // admin-published exam countdown
  const examConfigRef = useRef(loadExamConfigCache());
  const [accountCode, setAccountCode] = useState(""); // this browser's signed-in account's personal code
  const [vaultAccounts, setVaultAccounts] = useState(() => loadAccountVault());
  const [mainAccountCode, setMainAccountCodeState] = useState(() => getMainAccountCode());
  const [linkMode, setLinkMode] = useState(false);
  const [section, setSection] = useState("en-ar");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState(loadSavedTheme);
  const [accentTheme, setAccentTheme] = useState(loadSavedAccent);

  // Drop legacy shared-access-code key from older builds (no longer used).
  useEffect(() => {
    try {
      localStorage.removeItem("twoTongues.accessCode");
      sessionStorage.removeItem("twoTongues.accessCode");
    } catch (_) {}
  }, []);

  useEffect(() => {
    const resolved = resolveTheme(theme);
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.setAttribute("data-theme-pref", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }, [theme]);

  // Follow OS dark/light when preference is "system"
  useEffect(() => {
    if (theme !== "system") return undefined;
    let mq;
    try { mq = window.matchMedia("(prefers-color-scheme: dark)"); } catch (_) { return undefined; }
    const apply = () => {
      document.documentElement.setAttribute("data-theme", resolveTheme("system"));
    };
    apply();
    try { mq.addEventListener("change", apply); return () => mq.removeEventListener("change", apply); }
    catch (_) {
      try { mq.addListener(apply); return () => mq.removeListener(apply); } catch (__) {}
    }
    return undefined;
  }, [theme]);

  const [uiScale, setUiScaleState] = useState(() => loadUiScale());
  function setUiScale(scale) {
    setUiScaleState(scale);
    saveUiScale(scale);
    try { document.documentElement.style.setProperty("--ui-scale", String(scale)); } catch (_) {}
  }
  useEffect(() => {
    try { document.documentElement.style.setProperty("--ui-scale", String(uiScale)); } catch (_) {}
  }, [uiScale]);

  useEffect(() => { entriesRef.current = entries; }, [entries]);
  useEffect(() => { accountsRef.current = accounts; }, [accounts]);
  useEffect(() => { logsRef.current = logs; }, [logs]);
  useEffect(() => { siteBannerRef.current = siteBanner; }, [siteBanner]);
  useEffect(() => {
    examConfigRef.current = examConfig;
    saveExamConfigCache(examConfig);
  }, [examConfig]);

  // Re-applies the chosen accent color palette whenever the accent choice
  // or the light/dark mode changes (each accent has its own light+dark
  // variant so contrast stays correct either way).
  useEffect(() => {
    applyAccentTheme(accentTheme, resolveTheme(theme), accentTheme === 'custom' ? loadCustomAccentHex() : null);
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
    setTheme((t) => {
      // cycle light → dark → system → light
      if (t === "light") return "dark";
      if (t === "dark") return "system";
      return "light";
    });
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
      const newVersion = await saveRecord(
        { entries: rec.entries || [], accounts: migrated, logs: rec.logs || [], siteBanner: rec.siteBanner || null, examConfig: rec.examConfig || examConfigRef.current},
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
    (async () => {
      try {
        let rec = await fetchRecord();
        rec = await ensureMigratedAccounts(rec);
        setEntries(rec.entries);
        setAccounts(rec.accounts);
        setLogs(rec.logs);
        setSiteBanner(rec.siteBanner || null);
        setExamConfig(normalizeExamConfig(rec.examConfig));
        setLogsLoaded(true);
        commitRecordVersion(rec.version);
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
              setExamConfig(normalizeExamConfig(freshRec.examConfig));
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
            setIsAdmin(account.role === "admin");
            setAccountCode(account.code);
            // مزامنة سريعة للخزنة بعد استعادة الجلسة
            try {
              const v = upsertVaultAccount(account, { allowMulti: account.role === "admin" });
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
                    const newVersion = await saveRecord(
                      { entries: rec.entries, accounts: nextAccounts, logs: rec.logs, siteBanner: rec.siteBanner || null},
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
          setIsOffline(true);
          setOfflineCachedAt(cached.cachedAt);
          if (savedPersonalCode) {
            const account = migrated.find((a) => a.code === savedPersonalCode);
            if (account && account.status !== "pending" && account.status !== "rejected" && account.status !== "blocked") {
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
    if (err.fresh.examConfig !== undefined) setExamConfig(normalizeExamConfig(err.fresh.examConfig));
    commitRecordVersion(err.fresh.version || 0);
    setSaveError(""); // conflict recovered by resync — no scary banner
  }

  // Max number of automatic retries on a version conflict before giving up
  // and falling back to handleSaveConflict (which discards the pending
  // change and asks the user to retry manually). In practice a single
  // retry resolves the vast majority of real-world races (two people
  // adding a word within the same second), since each retry re-reads the
  // absolute latest server state.
  const MAX_SAVE_RETRIES = 10;

  // Apply a list of ops (each op is { fn, logFn }) onto base state.
  // Functional fns compose; plain-array ops replace.
  function applyOps(base, ops, kind) {
    let cur = base;
    const logsToAdd = [];
    for (const op of ops) {
      const fn = op.fn;
      cur = typeof fn === "function" ? fn(cur) : fn;
      if (op.logFn) {
        const logEntry = typeof op.logFn === "function" ? op.logFn(cur) : op.logFn;
        if (logEntry) logsToAdd.push(logEntry);
      }
    }
    return { next: cur, logsToAdd };
  }

  // Flush every pending account op in ONE save. Many studied/favorite clicks
  // while a write is in flight become a single composed write afterward.
  function flushPendingAccounts() {
    return enqueueSave(async () => {
      while (pendingAccountOpsRef.current.length > 0) {
        const ops = pendingAccountOpsRef.current.slice();
        pendingAccountOpsRef.current = [];

        // attempt 0: UI already has ops applied optimistically → save refs as-is.
        // later attempts: re-apply ops on top of fresh server data.
        let curEntries = entriesRef.current;
        let curAccounts = accountsRef.current;
        let curLogs = logsRef.current;
        let curBanner = siteBannerRef.current;
        let curVersion = recordVersionRef.current;
        let useOptimisticSnapshot = true;

        for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt++) {
          let nextAccounts;
          let nextLogs = curLogs;
          if (useOptimisticSnapshot && attempt === 0) {
            nextAccounts = curAccounts;
          } else {
            const applied = applyOps(curAccounts, ops, "accounts");
            nextAccounts = applied.next;
            nextLogs = curLogs;
            for (const le of applied.logsToAdd) nextLogs = capLogs([...nextLogs, le]);
          }

          setAccounts(nextAccounts);
          accountsRef.current = nextAccounts;
          if (nextLogs !== curLogs) {
            setLogs(nextLogs);
            logsRef.current = nextLogs;
          }

          try {
            const newVersion = await saveRecord(
              { entries: curEntries, accounts: nextAccounts, logs: nextLogs, siteBanner: curBanner},
              curVersion
            );
            commitRecordVersion(newVersion);
            saveOfflineCache({ entries: curEntries, accounts: nextAccounts, logs: nextLogs, siteBanner: curBanner});
            setSaveError("");
            break;
          } catch (e) {
            if (e instanceof SaveConflictError && attempt < MAX_SAVE_RETRIES) {
              curEntries = e.fresh.entries || [];
              curAccounts = e.fresh.accounts || [];
              curLogs = e.fresh.logs || [];
              if (e.fresh.siteBanner !== undefined) curBanner = e.fresh.siteBanner || null;
              curVersion = e.fresh.version || 0;
              entriesRef.current = curEntries;
              accountsRef.current = curAccounts;
              logsRef.current = curLogs;
              siteBannerRef.current = curBanner;
              commitRecordVersion(curVersion);
              useOptimisticSnapshot = false; // must re-apply ops onto server state
              await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
              continue;
            }
            if (e instanceof SaveConflictError && e.fresh) {
              setEntries(e.fresh.entries || []);
              setAccounts(e.fresh.accounts || []);
              setLogs(e.fresh.logs || []);
              if (e.fresh.siteBanner !== undefined) setSiteBanner(e.fresh.siteBanner || null);
              entriesRef.current = e.fresh.entries || [];
              accountsRef.current = e.fresh.accounts || [];
              logsRef.current = e.fresh.logs || [];
              commitRecordVersion(e.fresh.version || 0);
              setSaveError("");
            } else if (String(e && e.message) === "unauthorized") {
              setSaveError("Session expired — sign out and sign in again.");
            } else {
              setSaveError("Couldn't save — check your connection and try again.");
            }
            break;
          }
        }
      }
    });
  }

  function flushPendingEntries() {
    return enqueueSave(async () => {
      while (pendingEntryOpsRef.current.length > 0) {
        const ops = pendingEntryOpsRef.current.slice();
        pendingEntryOpsRef.current = [];

        let curEntries = entriesRef.current;
        let curAccounts = accountsRef.current;
        let curLogs = logsRef.current;
        let curBanner = siteBannerRef.current;
        let curVersion = recordVersionRef.current;
        let useOptimisticSnapshot = true;

        for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt++) {
          let nextEntries;
          let nextLogs = curLogs;
          if (useOptimisticSnapshot && attempt === 0) {
            nextEntries = curEntries;
          } else {
            const applied = applyOps(curEntries, ops, "entries");
            nextEntries = applied.next;
            nextLogs = curLogs;
            for (const le of applied.logsToAdd) nextLogs = capLogs([...nextLogs, le]);
          }

          setEntries(nextEntries);
          entriesRef.current = nextEntries;
          if (nextLogs !== curLogs) {
            setLogs(nextLogs);
            logsRef.current = nextLogs;
          }

          try {
            const newVersion = await saveRecord(
              { entries: nextEntries, accounts: curAccounts, logs: nextLogs, siteBanner: curBanner},
              curVersion
            );
            commitRecordVersion(newVersion);
            saveOfflineCache({ entries: nextEntries, accounts: curAccounts, logs: nextLogs, siteBanner: curBanner});
            setSaveError("");
            break;
          } catch (e) {
            if (e instanceof SaveConflictError && attempt < MAX_SAVE_RETRIES) {
              curEntries = e.fresh.entries || [];
              curAccounts = e.fresh.accounts || [];
              curLogs = e.fresh.logs || [];
              if (e.fresh.siteBanner !== undefined) curBanner = e.fresh.siteBanner || null;
              curVersion = e.fresh.version || 0;
              entriesRef.current = curEntries;
              accountsRef.current = curAccounts;
              logsRef.current = curLogs;
              siteBannerRef.current = curBanner;
              commitRecordVersion(curVersion);
              useOptimisticSnapshot = false;
              await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
              continue;
            }
            if (e instanceof SaveConflictError && e.fresh) {
              setEntries(e.fresh.entries || []);
              setAccounts(e.fresh.accounts || []);
              setLogs(e.fresh.logs || []);
              if (e.fresh.siteBanner !== undefined) setSiteBanner(e.fresh.siteBanner || null);
              entriesRef.current = e.fresh.entries || [];
              accountsRef.current = e.fresh.accounts || [];
              logsRef.current = e.fresh.logs || [];
              commitRecordVersion(e.fresh.version || 0);
              setSaveError("");
            } else if (String(e && e.message) === "unauthorized") {
              setSaveError("Session expired — sign out and sign in again.");
            } else {
              setSaveError("Couldn't save — check your connection and try again.");
            }
            break;
          }
        }
      }
    });
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
    pendingAccountOpsRef.current.push({ fn: accountsFn, logFn: logEntryFn || null });
    return flushPendingAccounts();
  }, []);

  // For events that don't touch entries/accounts (sign in/out) — still saved
  // into the same shared record so it stays in sync with everything else.
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
      let curEntries = entriesRef.current;
      let curAccounts = accountsRef.current;
      let curLogs = logsRef.current;
      for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt++) {
        try {
          const newVersion = await saveRecord({ entries: curEntries, accounts: curAccounts, logs: curLogs, siteBanner: nextBanner}, curVersion);
          commitRecordVersion(newVersion);
          saveOfflineCache({ entries: curEntries, accounts: curAccounts, logs: curLogs, siteBanner: nextBanner});
          return { ok: true };
        } catch (e) {
          if (e instanceof SaveConflictError && attempt < MAX_SAVE_RETRIES) {
            curEntries = e.fresh.entries || [];
            curAccounts = e.fresh.accounts || [];
            curLogs = e.fresh.logs || [];
            setEntries(curEntries);
            setAccounts(curAccounts);
            setLogs(curLogs);
            entriesRef.current = curEntries;
            accountsRef.current = curAccounts;
            logsRef.current = curLogs;
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
      let curEntries = entriesRef.current;
      let curAccounts = accountsRef.current;
      let curLogs = logsRef.current;
      let curBanner = siteBannerRef.current;
      for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt++) {
        try {
          const newVersion = await saveRecord({
            entries: curEntries, accounts: curAccounts, logs: curLogs,
            siteBanner: curBanner, examConfig: normalized,
          }, curVersion);
          commitRecordVersion(newVersion);
          saveOfflineCache({
            entries: curEntries, accounts: curAccounts, logs: curLogs,
            siteBanner: curBanner, examConfig: normalized,
          });
          return { ok: true };
        } catch (e) {
          if (e instanceof SaveConflictError && attempt < MAX_SAVE_RETRIES) {
            curEntries = e.fresh.entries || [];
            curAccounts = e.fresh.accounts || [];
            curLogs = e.fresh.logs || [];
            if (e.fresh.siteBanner !== undefined) curBanner = e.fresh.siteBanner || null;
            if (e.fresh.examConfig !== undefined) {
              const freshExam = normalizeExamConfig(e.fresh.examConfig);
              // keep our intended write; only sync other fields
            }
            setEntries(curEntries);
            setAccounts(curAccounts);
            setLogs(curLogs);
            entriesRef.current = curEntries;
            accountsRef.current = curAccounts;
            logsRef.current = curLogs;
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
    // Desired absolute state (not relative toggle) so a conflict-retry that
    // re-runs this function against fresher data still ends up where the
    // user clicked, instead of flipping twice.
    const acct = accounts.find((a) => a.code === accountCode);
    const current = (acct && acct.studied) || [];
    const wantStudied = !current.includes(entryId);
    const stampedAt = Date.now();
    await persistAccounts((curAccounts) => curAccounts.map((a) => {
      if (a.code !== accountCode) return a;
      const studied = a.studied || [];
      const studiedAt = { ...(a.studiedAt || {}) };
      const has = studied.includes(entryId);
      if (wantStudied && !has) {
        return { ...a, studied: [...studied, entryId], studiedAt: { ...studiedAt, [entryId]: stampedAt } };
      }
      if (!wantStudied && has) {
        const nextAt = { ...studiedAt };
        delete nextAt[entryId];
        return { ...a, studied: studied.filter((id) => id !== entryId), studiedAt: nextAt };
      }
      return a;
    }));
  }

  // Toggles whether the current signed-in account has bookmarked a word as
  // a "favorite" — separate from "studied", so someone can flag a word to
  // come back to later without that being read as "I've already learned
  // this". Stored per-account (account.favorites: [entryId, ...]).
  async function handleToggleFavorite(entryId) {
    const acct = accounts.find((a) => a.code === accountCode);
    const current = (acct && acct.favorites) || [];
    const wantFavorite = !current.includes(entryId);
    await persistAccounts((curAccounts) => curAccounts.map((a) => {
      if (a.code !== accountCode) return a;
      const favorites = a.favorites || [];
      const has = favorites.includes(entryId);
      if (wantFavorite && !has) return { ...a, favorites: [...favorites, entryId] };
      if (!wantFavorite && has) return { ...a, favorites: favorites.filter((id) => id !== entryId) };
      return a;
    }));
  }

  // Called once per answered quiz question. Adds to the word's cumulative
  // correct/total tally (never resets on a wrong answer — see
  // srsLevelFromStats) and reschedules its next due date based on the
  // resulting level. Best-effort: a failed save shouldn't interrupt the
  // quiz the user is in the middle of taking.
  async function handleRecordSrsAnswer(entryId, correct, qualityOverride) {
    // SM-2 style scheduling with backward-compatible srsStats / srsDueAt / srsBox.
    // qualityOverride: 0 again, 1 hard, 2 good, 3 easy — optional.
    try {
      await persistAccounts((curAccounts) => curAccounts.map((a) => {
        if (a.code !== accountCode) return a;
        const prevStats = (a.srsStats && a.srsStats[entryId]) || { correct: 0, total: 0 };
        const isCorrect = qualityOverride != null ? qualityOverride > 0 : !!correct;
        const nextStats = { correct: prevStats.correct + (isCorrect ? 1 : 0), total: prevStats.total + 1 };
        const quality = qualityOverride != null ? qualityOverride : correctToQuality(!!correct);
        const prevCard = getCardState(entryId, a.srsCards, a.srsStats, a.srsDueAt);
        const { card, dueAt } = applySm2(prevCard, quality, loadSrsPrefs());
        return {
          ...a,
          srsStats: { ...(a.srsStats || {}), [entryId]: nextStats },
          srsDueAt: { ...(a.srsDueAt || {}), [entryId]: dueAt },
          srsCards: { ...(a.srsCards || {}), [entryId]: card },
        };
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

    const uCheck = validateUsername(signupUsername);
    if (!uCheck.ok) { setSignupError(uCheck.error); return; }
    const pCheck = validatePassword(signupPassword);
    if (!pCheck.ok) { setSignupError(pCheck.error); return; }
    if (signupPassword !== signupPassword2) {
      setSignupError("Passwords do not match.");
      return;
    }
    if (signupGender !== "male" && signupGender !== "female") {
      setSignupError("Please select Male or Female.");
      return;
    }

    setSignupSaving(true);
    const code = generatePersonalCode();
    let passwordHash;
    try {
      passwordHash = await hashPassword(pCheck.password, code);
    } catch (e) {
      setSignupSaving(false);
      setSignupError("Couldn't create the account — check your connection and try again.");
      return;
    }

    const newAccount = {
      name: trimmedName,
      username: uCheck.username,
      passwordHash,
      code,
      role: "user",
      status: "pending",
      createdAt: Date.now(),
      ...(signupAvatar ? { avatar: signupAvatar } : {}),
      gender: signupGender,
    };

    // Retry on conflict so concurrent signups in the same second don't lose requests.
    const MAX_SIGNUP_RETRIES = 8;
    try {
      let lastErr = null;
      for (let attempt = 0; attempt <= MAX_SIGNUP_RETRIES; attempt++) {
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
            setExamConfig(normalizeExamConfig(rec.examConfig));
            commitRecordVersion(rec.version);
            return;
          }
          // Ensure our pending account is present (merge by code on server too).
          const withoutSelf = (rec.accounts || []).filter((a) => a.code !== code);
          const nextAccounts = [...withoutSelf, newAccount];
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
            {
              entries: rec.entries,
              accounts: nextAccounts,
              logs: nextLogs,
              siteBanner: rec.siteBanner || null,
              mergeAccounts: true,
            },
            rec.version
          );
          setEntries(rec.entries);
          setAccounts(nextAccounts);
          setLogs(nextLogs);
          setSiteBanner(rec.siteBanner || null);
          setExamConfig(normalizeExamConfig(rec.examConfig));
          commitRecordVersion(newVersion);
          setSignupPassword("");
          setSignupPassword2("");
          setSignupAvatar("");
          setSignupGender("");
          goToStage("pendingShown");
          return;
        } catch (err) {
          lastErr = err;
          if (err instanceof SaveConflictError && attempt < MAX_SIGNUP_RETRIES) {
            // Brief backoff, then retry with a fresh server snapshot.
            await new Promise((r) => setTimeout(r, 40 + attempt * 30));
            continue;
          }
          throw err;
        }
      }
      if (lastErr) throw lastErr;
    } catch (err) {
      if (err instanceof SaveConflictError) {
        setSignupError("Too many people signing up at once — please try again.");
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

    if (!accountsLoaded) { setAuthError("Still loading — please try again in a moment."); return; }

    const uCheck = validateUsername(usernameInput);
    if (!uCheck.ok) { setAuthError(uCheck.error); return; }
    if (!passwordInput) { setAuthError("Enter your password."); return; }

    setLoggingIn(true);

    let curAccounts = accounts;
    let account = curAccounts.find((a) => normalizeUsername(a.username) === uCheck.username);
    // Only hit the network if the account isn't already in memory
    if (!account) {
      try {
        const rec = await ensureMigratedAccounts(await fetchRecord({ fresh: true }));
        curAccounts = rec.accounts;
        setAccounts(rec.accounts);
        setEntries(rec.entries);
        setLogs(rec.logs);
        setSiteBanner(rec.siteBanner || null);
        commitRecordVersion(rec.version);
        account = curAccounts.find((a) => normalizeUsername(a.username) === uCheck.username);
      } catch (_) { /* fall through */ }
    }
    if (!account) {
      setLoggingIn(false);
      setAuthError("That username doesn't match any account.");
      return;
    }
    if (account.status === "pending") {
      setLoggingIn(false);
      setAuthError("Your account is still waiting for admin approval.");
      return;
    }
    if (account.status === "rejected") {
      setLoggingIn(false);
      setAuthError("Your account request was declined. Contact an admin.");
      return;
    }
    if (account.status === "blocked") {
      setLoggingIn(false);
      setAuthError(appIsAr
        ? "تم حظر حسابك من دخول الموقع. تواصل مع المسؤول."
        : "Your account is blocked from accessing the site. Contact an admin.");
      return;
    }

    let passwordOk = false;
    let shouldUpgradeHash = false;
    try {
      if (account.passwordHash) {
        const result = await verifyPasswordDetailed(passwordInput, account.code, account.passwordHash);
        passwordOk = result.ok;
        shouldUpgradeHash = !!(result.ok && result.needsUpgrade);
      }
      // Legacy / recovery: personal code accepted as password once.
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
      }
    } catch (_) {
      setLoggingIn(false);
      setAuthError("Couldn't verify the password — try again.");
      return;
    }
    if (!passwordOk) {
      setLoggingIn(false);
      setAuthError("Wrong password.");
      return;
    }

    // Enter the app immediately — network writes must never block the UI.
    setName(account.name);
    setIsAdmin(account.role === "admin");
    setAccountCode(account.code);
    savePersonalCode(account.code);
    let linking = false;
    try { linking = sessionStorage.getItem("twoTongues.linkMode") === "1"; } catch (_) {}
    const nextVault = upsertVaultAccount(account, {
      allowMulti: account.role === "admin" || linking || linkMode,
    });
    setVaultAccounts(nextVault);
    try { sessionStorage.removeItem("twoTongues.linkMode"); } catch (_) {}
    setLinkMode(false);
    if (!getMainAccountCode()) {
      setMainAccountCode(account.code);
      setMainAccountCodeState(account.code);
    } else {
      setMainAccountCodeState(getMainAccountCode());
    }

    const sid = generateSessionId();
    saveSessionId(sid);
    const accountCodeLogin = account.code;
    const isFirstSignIn = account.role !== "admin" && !account.firstSignInAt;
    const stamped = Date.now();
    const logEntry = account.role !== "admin"
      ? makeLogEntry(
          isFirstSignIn ? "first_sign_in" : "sign_in",
          isFirstSignIn
            ? `${account.name} (@${account.username}) signed in for the first time`
            : `${account.name} (@${account.username}) signed in`,
          account.name,
          account.code
        )
      : null;

    setPasswordInput("");
    setLoggingIn(false);
    goToStage("in");

    // Background: hash upgrade + session stamp (non-blocking)
    (async () => {
      if (shouldUpgradeHash) {
        try {
          const newVersion = await saveRecord(
            { entries, accounts: curAccounts, logs, siteBanner },
            recordVersionRef.current
          );
          setAccounts(curAccounts);
          commitRecordVersion(newVersion);
        } catch (_) {
          setAccounts(curAccounts);
        }
      }
      try {
        await persistAccounts((accs) => accs.map((a) =>
          a.code === accountCodeLogin
            ? {
                ...a,
                sessionId: sid,
                sessionAt: stamped,
                ...(isFirstSignIn ? { firstSignInAt: stamped } : {}),
              }
            : a
        ), logEntry);
      } catch (_) {
        // Signed in locally regardless.
      }
    })();
  }

  /** تبديل فوري لحساب محفوظ — بدون تسجيل خروج كامل */
  function switchToVaultAccount(code) {
    if (!code || code === accountCode) return { ok: true };
    const vault = loadAccountVault();
    const entry = vault.find((a) => a.code === code);
    if (!entry) return { ok: false, error: "Account not saved on this device." };

    // قيود: غير الأدمن لا يملك إلا حسابه الوحيد
    if (!isAdmin && entry.role !== "admin") {
      // مسموح لو هو نفس المستخدم المحفوظ الوحيد
    }
    // التبديل بين حسابات الخزنة مسموح طالما اتحفظت مسبقاً.
    // تقييد "الأدمن فقط" يكون عند إضافة حساب جديد للخزنة (upsert)،
    // مش عند التنقل بين حسابات محفوظة — وإلا الأدمن يعجز يرجع لحسابه لو حوّل لحساب عادي.

    // تطبيق فوري للواجهة
    setAccountCode(entry.code);
    setName(entry.name || "");
    setIsAdmin(entry.role === "admin");
    savePersonalCode(entry.code);
    setShowAccount(false);
    setShowAdmin(false);
    setShowAdd(false);

    // مزامنة خفيفة من الكاش المحلي للحساب (studied/favorites من accounts في الذاكرة)
    const live = (accounts || []).find((a) => a.code === entry.code);
    if (live) {
      setName(live.name || entry.name || "");
      setIsAdmin(live.role === "admin");
    }

    // تحديث تذكيرات/prefs للحساب الجديد بشكل غير حاجز
    try {
      setRemindersOn(loadRemindersEnabled(entry.code));
      setReminderTitle(loadReminderTitle(entry.code));
      setReminderMessage(loadReminderMessage(entry.code));
    } catch (_) {}

    return { ok: true };
  }

  /** أدمن فقط: ربط حساب إضافي بدون مسح الخزنة */
  function beginLinkAccount() {
    if (!isAdmin) return;
    try { sessionStorage.setItem("twoTongues.linkMode", "1"); } catch (_) {}
    setLinkMode(true);
    // نخرج من الجلسة الحالية فقط — الخزنة تفضل
    clearPersonalCode();
    try { localStorage.removeItem("twoTongues.sessionId"); } catch (_) {}
    setAccountCode("");
    setName("");
    // نبقي isAdmin مؤقتاً للسماح بالواجهة؛ الدخول الجديد هيظبط الدور
    setUsernameInput("");
    setPasswordInput("");
    setAuthError("");
    setShowAdd(false);
    setShowAccount(false);
    setShowAdmin(false);
    goToStage("login");
  }

  function cancelLinkAccount() {
    try { sessionStorage.removeItem("twoTongues.linkMode"); } catch (_) {}
    setLinkMode(false);
    const main = getMainAccountCode() || (loadAccountVault()[0] && loadAccountVault()[0].code);
    if (main) {
      const r = switchToVaultAccount(main);
      if (r && r.ok) {
        setAuthStage("in");
        return;
      }
    }
    goToStage("login");
  }

    function markMainAccount(code) {
    if (!isAdmin) return { ok: false, error: "Only admins can set a main account." };
    if (!code) return { ok: false };
    const vault = loadAccountVault();
    if (!vault.some((a) => a.code === code)) return { ok: false, error: "Account not in vault." };
    setMainAccountCode(code);
    setMainAccountCodeState(code);
    return { ok: true };
  }

  function unlinkVaultAccount(code) {
    if (!code) return;
    // غير الأدمن: إزالة = تسجيل خروج
    if (!isAdmin) {
      handleLogout({ clearVault: true });
      return;
    }
    const next = removeVaultAccount(code);
    setVaultAccounts(next);
    setMainAccountCodeState(getMainAccountCode());
    if (code === accountCode) {
      // لو شلنا الحساب الحالي — نروح للأساسي أو نسجّل خروج
      const main = getMainAccountCode();
      if (main && main !== code) switchToVaultAccount(main);
      else handleLogout({ clearVault: false });
    }
  }

  function handleLogout(opts = {}) {
    const clearVault = !!opts.clearVault;
    if (accountCode && !isAdmin) {
      logEvent("sign_out", `${name} signed out`, name, accountCode);
    }
    clearPersonalCode();
    try { localStorage.removeItem("twoTongues.sessionId"); } catch (_) {}
    if (clearVault) {
      clearAccountVault();
      setVaultAccounts([]);
      setMainAccountCodeState("");
    }
    setName("");
    setIsAdmin(false);
    setAccountCode("");
    setUsernameInput("");
    setPasswordInput("");
    setAuthError("");
    setShowAdd(false);
    setShowAccount(false);
    setShowAdmin(false);
    goToStage("login");
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
        const rec = await fetchRecord({ fresh: true });
        if (cancelled) return;
        if (rec.accounts) setAccounts(rec.accounts);
        if (rec.siteBanner !== undefined) setSiteBanner(rec.siteBanner || null);
        if (typeof rec.version === "number") commitRecordVersion(rec.version);
        const account = (rec.accounts || []).find((a) => a.code === accountCode);
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
    const interval = setInterval(softSync, 120000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authStage, accountCode]);

  async function handleUpdateOwnAccount({ name: newName, password: newPassword, avatar: nextAvatar, gender: nextGender }) {
    const trimmed = (newName || "").trim();
    if (!trimmed) return { error: "Enter your name." };
    const updates = { name: trimmed };
    if (typeof nextAvatar === "string") {
      updates.avatar = nextAvatar.slice(0, 400000);
    }
    if (nextGender === "male" || nextGender === "female") {
      updates.gender = nextGender;
    }
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
    let nextStatus = target && target.status === "pending" ? "active" : (target && target.status) || "active";
    if (updates.status === "blocked" || updates.status === "active") {
      nextStatus = updates.status;
    }
    // Never block yourself from the admin panel by accident
    if (targetCode === accountCode && nextStatus === "blocked") {
      return { error: appIsAr ? "لا يمكنك حظر حسابك أنت." : "You cannot block your own account." };
    }
    const nextAccounts = accounts.map((a) => {
      if (a.code !== targetCode) return a;
      const patch = {
        name: trimmedName,
        role: nextRole,
        status: nextStatus,
      };
      if (nextUsername) patch.username = nextUsername;
      return { ...a, ...patch };
    });
    const logEntry = makeLogEntry(
      "account_edit",
      `${name} edited account "${(target && target.name) || targetCode}" → name: "${trimmedName}", role: ${nextRole === "admin" ? "Admin" : "User"}, access: ${nextStatus}`,
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
        authStage={authStage} appIsAr={appIsAr} appLang={appLang} atr={atr} theme={theme} toggleTheme={toggleTheme} toggleAppLang={toggleAppLang} onChangeAppLang={setAppLang} deviceMode={deviceMode} onChangeDeviceMode={setDeviceMode}
        moreFeaturesOpen={moreFeaturesOpen} setMoreFeaturesOpen={setMoreFeaturesOpen} goToStage={goToStage}
        name={name} setName={setName}
        signupUsername={signupUsername} setSignupUsername={setSignupUsername}
        signupPassword={signupPassword} setSignupPassword={setSignupPassword}
        signupPassword2={signupPassword2} setSignupPassword2={setSignupPassword2}
        signupAvatar={signupAvatar} setSignupAvatar={setSignupAvatar}
        signupGender={signupGender} setSignupGender={setSignupGender}
        signupError={signupError} setSignupError={setSignupError} signupSaving={signupSaving} handleSignup={handleSignup}
        usernameInput={usernameInput} setUsernameInput={setUsernameInput}
        passwordInput={passwordInput} setPasswordInput={setPasswordInput}
        authError={authError} setAuthError={setAuthError} loggingIn={loggingIn} handleLogin={handleLogin}
        linkMode={linkMode} onCancelLink={cancelLinkAccount}
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
      deviceMode={deviceMode} onChangeDeviceMode={setDeviceMode} uiScale={uiScale} onChangeUiScale={setUiScale}
      section={section} onChangeSection={changeSection} query={query} setQuery={setQuery}
      showAdd={showAdd} onOpenAdd={openAddModal} onCloseAdd={closeAddModal} persistEntries={persistEntries} saveError={saveError}
      onLogout={handleLogout}
      accounts={accounts} accountCode={accountCode} logs={logs} onClearLogs={clearLogsExceptFirstSignIn}
      studiedIds={studiedIds} studiedAt={studiedAt} onToggleStudied={handleToggleStudied}
      favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite}
      srsBox={srsBox} srsDueAt={srsDueAt} quizHistory={quizHistory}
      onRecordSrsAnswer={handleRecordSrsAnswer} onSaveQuizResult={handleSaveQuizResult}
      showAccount={showAccount} onOpenAccount={openAccountModal} onCloseAccount={closeAccountModal} onUpdateOwnAccount={handleUpdateOwnAccount}
      vaultAccounts={vaultAccounts}
      mainAccountCode={mainAccountCode}
      onSwitchAccount={switchToVaultAccount}
      onSetMainAccount={markMainAccount}
      onUnlinkVaultAccount={unlinkVaultAccount}
      onLogoutAll={() => handleLogout({ clearVault: true })}
      onLinkAccount={beginLinkAccount}
      siteBanner={siteBanner} examConfig={examConfig} onPersistExamConfig={persistExamConfig} onPersistSiteBanner={persistSiteBanner}
      showAdmin={showAdmin} onOpenAdmin={openAdminModal} onCloseAdmin={closeAdminModal}
      onAdminAddAccount={handleAdminAddAccount} onAdminEditAccount={handleAdminEditAccount} onAdminDeleteAccount={handleAdminDeleteAccount}
      onApproveRequest={handleApproveRequest} onRejectRequest={handleRejectRequest}
      toast={toast} showToast={showToast}
      theme={theme} onToggleTheme={toggleTheme} onChangeTheme={setTheme}
      accentTheme={accentTheme} onChangeAccent={setAccentTheme}
      appIsAr={appIsAr} appLang={appLang} onToggleAppLang={toggleAppLang} onChangeAppLang={setAppLang}
      sessionStart={sessionStartRef.current}
      remindersOn={remindersOn} remindersBusy={remindersBusy} onEnableReminders={enableReminders} onDisableReminders={disableReminders} onTestReminder={testReminderPush}
      reminderTitle={reminderTitle} onChangeReminderTitle={handleChangeReminderTitle}
      reminderMessage={reminderMessage} onChangeReminderMessage={handleChangeReminderMessage}
    />
  );
}

