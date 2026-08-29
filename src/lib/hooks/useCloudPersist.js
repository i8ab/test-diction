import { useCallback } from "react";
import { SaveConflictError, saveLogsOnly, patchSettings } from "../state/cloudApi";
import {
  saveOfflineCache,
  markPendingCloudSync,
} from "../state/storage";
import { flushPendingAccounts as flushAccountsCloud, flushPendingEntries as flushEntriesCloud } from "../state/cloudFlush";
import { MAX_SAVE_RETRIES as MAX_SAVE_RETRIES_CONST } from "../state/cloudQueue";
import { capLogs, makeLogEntry } from "../state/logs";
import { normalizeExamConfig } from "../state/exam";
import { normalizeAcademicUnits, saveAcademicUnitsCache } from "../state/academicUnits";
import { saveExamConfigCache } from "../state/exam";
import { apiErrorMessage } from "../utils/apiErrorMessage";

/**
 * Cloud persist / flush helpers extracted from App.jsx.
 * Same behavior: optimistic local apply + coalesced flush + conflict retries.
 */
export function useCloudPersist({
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
  appIsAr = false,
}) {
  const MAX_SAVE_RETRIES = MAX_SAVE_RETRIES_CONST;

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
    setSaveError("");
  }

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

  function snapshotLocalNow() {
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
      markPendingCloudSync();
    } catch (_) {}
  }

  function failMsg(err, fallbackEn, fallbackAr) {
    if (err instanceof SaveConflictError) {
      return apiErrorMessage(err, appIsAr);
    }
    const mapped = apiErrorMessage(err, appIsAr);
    if (mapped && err && err.message && err.message !== "save failed") return mapped;
    return appIsAr ? fallbackAr : fallbackEn;
  }

  const persistEntries = useCallback(async (entriesFn, logEntryFn) => {
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
    snapshotLocalNow();
    pendingEntryOpsRef.current.push({ fn: entriesFn, logFn: logEntryFn || null });
    try {
      return await flushPendingEntries();
    } catch (e) {
      const msg = failMsg(e, "Couldn't save words — try again.", "تعذّر حفظ الكلمات — حاول تاني.");
      if (typeof showToast === "function") showToast(msg);
      setSaveError(msg);
      return { ok: false, error: msg };
    }
  }, [appIsAr, showToast]);

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
    snapshotLocalNow();
    pendingAccountOpsRef.current.push({ fn: accountsFn, logFn: logEntryFn || null });
    try {
      return await flushPendingAccounts();
    } catch (e) {
      const msg = failMsg(e, "Couldn't save account — try again.", "تعذّر حفظ الحساب — حاول تاني.");
      if (typeof showToast === "function") showToast(msg);
      return { ok: false, error: msg };
    }
  }, [appIsAr, showToast]);

  const persistLogs = useCallback(async (next) => {
    setLogs(next);
    logsRef.current = next;
    return enqueueSave(async () => {
      let curVersion = recordVersionRef.current;
      for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt++) {
        try {
          const newVersion = await saveLogsOnly(next, curVersion);
          commitRecordVersion(newVersion);
          return;
        } catch (e) {
          if (e instanceof SaveConflictError && attempt < MAX_SAVE_RETRIES) {
            curVersion = e.fresh?.version || curVersion;
            commitRecordVersion(curVersion);
            await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
            continue;
          }
          if (e instanceof SaveConflictError && e.fresh) {
            if (Array.isArray(e.fresh.logs)) {
              setLogs(e.fresh.logs);
              logsRef.current = e.fresh.logs;
            }
            if (e.fresh.accounts) {
              setAccounts(e.fresh.accounts || []);
              accountsRef.current = e.fresh.accounts || [];
            }
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
          const msg = failMsg(e, "Couldn't save the announcement — try again.", "تعذّر حفظ الإعلان — حاول تاني.");
          if (typeof showToast === "function") showToast(msg);
          return { ok: false, error: msg };
        }
      }
      return { ok: false, error: appIsAr ? "تعذّر حفظ الإعلان — حاول تاني." : "Couldn't save the announcement — try again." };
    });
  }, [appIsAr, showToast]);

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
          const msg = failMsg(e, "Couldn't save exam settings — try again.", "تعذّر حفظ إعدادات الامتحان — حاول تاني.");
          if (typeof showToast === "function") showToast(msg);
          return { ok: false, error: msg };
        }
      }
      return { ok: false, error: appIsAr ? "تعذّر حفظ إعدادات الامتحان — حاول تاني." : "Couldn't save exam settings — try again." };
    });
  }, [appIsAr, showToast]);

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
          const msg = failMsg(e, "Couldn't save units — try again.", "تعذّر حفظ الوحدات — حاول تاني.");
          if (typeof showToast === "function") showToast(msg);
          return { ok: false, error: msg };
        }
      }
      return { ok: false, error: appIsAr ? "تعذّر حفظ الوحدات — حاول تاني." : "Couldn't save units — try again." };
    });
  }, [appIsAr, showToast]);

  function clearLogsExceptFirstSignIn() {
    persistLogs(logs.filter((entry) => entry.action === "first_sign_in"));
  }

  return {
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
  };
}
