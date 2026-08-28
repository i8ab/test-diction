/**
 * App boot / cloud bootstrap — extracted from App.jsx (Phase A).
 * Loads offline cache, scoped cloud data, migrates accounts, restores session.
 * Behavior matches the original 1:1; App.jsx only mounts a thin useEffect.
 */
import {
  fetchBootstrap,
  fetchMyAccount,
  fetchAccountsOnly,
  fetchEntriesOnly,
  fetchLogsOnly,
  saveAccountsOnly,
  patchAccountFields,
  SaveConflictError,
} from "./cloudApi";
import {
  loadOfflineCache,
  loadOfflineMeta,
  loadPersonalCode,
  clearPersonalCode,
  clearPendingCloudSync,
  markPendingCloudSync,
  mergeOfflineProgress,
  saveOfflineCache,
  loadSessionId,
  saveSessionId,
  generateSessionId,
  removePendingRemoveCode,
  removePendingApproveCode,
  addPendingRemoveCode,
  addPendingApproveCode,
} from "./storage";
import { migrateAccounts } from "../utils/authUtils";
import { normalizeExamConfig } from "./exam";
import { normalizeAcademicUnits } from "./academicUnits";
import { ensureMigratedAccounts } from "./authFlow";
import { upsertVaultAccount, getMainAccountCode } from "./accountVault";

/**
 * @param {object} ctx - setters, refs, and helpers from App
 * @param {{ current: boolean }} cancelledRef - abort flag { current: true } on unmount
 */
export async function runAppBoot(ctx, cancelledRef) {
  const isCancelled = () => cancelledRef && cancelledRef.current;
  const {
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
  } = ctx;

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

        rec = await ensureMigratedAccounts(rec, migrationDoneRef);

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
              }, migrationDoneRef);
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
        // Distinguish real network failure from other bootstrap errors.
        // navigator.onLine is unreliable alone; treat TypeError / Failed to fetch / 503 as offline.
        const msg = String((e && e.message) || e || "");
        const looksOffline =
          (typeof navigator !== "undefined" && navigator.onLine === false) ||
          (e && e.name === "TypeError") ||
          /failed to fetch|networkerror|load failed|503|net::|internet/i.test(msg);

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
          // Only show the offline banner when it actually looks like a connectivity problem.
          // Other errors (5xx, parse, logic) should NOT lock the UI into "You're offline".
          if (looksOffline) {
            setIsOffline(true);
            setOfflineCachedAt(cached.cachedAt);
          } else {
            setIsOffline(false);
            // Surface a soft error instead of a false offline state.
            try {
              setLoadError(
                msg && msg.length < 180
                  ? msg
                  : "Couldn't fully sync with the server. Some data may be from the last cache."
              );
            } catch (_) {}
          }
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
        if (!isCancelled()) {
          setEntriesLoaded(true);
          setAccountsLoaded(true);
          setLogsLoaded(true);
        }
      }

}
