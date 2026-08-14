/**
 * Coalesced flush of pending account/entry ops to the cloud record.
 * `ctx` holds the live refs + setters from App so behavior stays identical.
 */
import { SaveConflictError, saveRecord } from "./cloudApi";
import { saveOfflineCache, clearPendingCloudSync, markPendingCloudSync, removePendingApproveCode } from "./storage";
import { capLogs } from "./logs";
import { attachXpToAccounts } from "./xp";
import { applyOps, MAX_SAVE_RETRIES } from "./cloudQueue";

export function flushPendingAccounts(ctx) {
  const {
    enqueueSave,
    pendingAccountOpsRef,
    pendingRemoveCodesRef,
    pendingApprovedCodesRef,
    entriesRef,
    accountsRef,
    logsRef,
    siteBannerRef,
    recordVersionRef,
    commitRecordVersion,
    setAccounts,
    setLogs,
    setEntries,
    setSiteBanner,
    setSaveError,
    accountCode,
  } = ctx;

  return enqueueSave(async () => {
    while (pendingAccountOpsRef.current.length > 0) {
      const ops = pendingAccountOpsRef.current.slice();
      pendingAccountOpsRef.current = [];

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
          nextAccounts = attachXpToAccounts(nextAccounts, accountCode);
          if (pendingRemoveCodesRef.current.size) {
            const drop = pendingRemoveCodesRef.current;
            nextAccounts = nextAccounts.filter((a) => a && a.code && !drop.has(String(a.code)));
          }
          if (pendingApprovedCodesRef.current.size) {
            const approved = pendingApprovedCodesRef.current;
            nextAccounts = nextAccounts.map((a) =>
              a && a.code && approved.has(String(a.code)) && a.status === "pending"
                ? { ...a, status: "active" }
                : a
            );
          }
          accountsRef.current = nextAccounts;
          setAccounts(nextAccounts);
          const removeCodes = [...pendingRemoveCodesRef.current];
          const approveCodes = [...pendingApprovedCodesRef.current];
          const newVersion = await saveRecord(
            {
              entries: curEntries,
              accounts: nextAccounts,
              logs: nextLogs,
              siteBanner: curBanner,
              ...(removeCodes.length ? { removeAccountCodes: removeCodes } : {}),
              ...(approveCodes.length ? { approveAccountCodes: approveCodes } : {}),
            },
            curVersion
          );
          commitRecordVersion(newVersion);
          if (approveCodes.length) {
            for (const a of nextAccounts) {
              if (a && a.code && pendingApprovedCodesRef.current.has(String(a.code)) && a.status === "active") {
                pendingApprovedCodesRef.current.delete(String(a.code));
                removePendingApproveCode(a.code);
              }
            }
          }
          saveOfflineCache({ entries: curEntries, accounts: nextAccounts, logs: nextLogs, siteBanner: curBanner });
          clearPendingCloudSync();
          setSaveError("");
          break;
        } catch (e) {
          if (e instanceof SaveConflictError && attempt < MAX_SAVE_RETRIES) {
            curEntries = e.fresh.entries || [];
            curAccounts = e.fresh.accounts || [];
            curLogs = e.fresh.logs || [];
            if (e.fresh.siteBanner !== undefined) curBanner = e.fresh.siteBanner || null;
            if (e.fresh.examConfig !== undefined) curExam = e.fresh.examConfig || null;
            if (e.fresh.academicUnits !== undefined) curUnits = e.fresh.academicUnits || null;
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
            // Re-apply the user's pending ops on top of the latest server data
            // so an add/edit is not silently discarded after conflicts.
            const baseEntries = e.fresh.entries || [];
            const applied = applyOps(baseEntries, ops, "entries");
            let mergedEntries = applied.next;
            let mergedLogs = e.fresh.logs || [];
            for (const le of applied.logsToAdd) mergedLogs = capLogs([...mergedLogs, le]);
            setEntries(mergedEntries);
            entriesRef.current = mergedEntries;
            let freshAccounts = e.fresh.accounts || [];
            if (pendingRemoveCodesRef.current.size) {
              const drop = pendingRemoveCodesRef.current;
              freshAccounts = freshAccounts.filter((a) => a && a.code && !drop.has(String(a.code)));
            }
            if (pendingApprovedCodesRef.current.size) {
              const approved = pendingApprovedCodesRef.current;
              freshAccounts = freshAccounts.map((a) =>
                a && a.code && approved.has(String(a.code)) && a.status === "pending"
                  ? { ...a, status: "active" }
                  : a
              );
            }
            setAccounts(freshAccounts);
            setLogs(mergedLogs);
            logsRef.current = mergedLogs;
            if (e.fresh.siteBanner !== undefined) setSiteBanner(e.fresh.siteBanner || null);
            accountsRef.current = freshAccounts;
            commitRecordVersion(e.fresh.version || 0);
            // Put ops back so a later flush can still push to the server
            pendingEntryOpsRef.current = ops.concat(pendingEntryOpsRef.current);
            setSaveError("Save conflict — changes kept locally. Retrying…");
            // one more immediate attempt will happen if more ops arrive; snapshot local
            try {
              saveOfflineCache({
                entries: mergedEntries,
                accounts: freshAccounts,
                logs: mergedLogs,
                siteBanner: e.fresh.siteBanner,
                examConfig: e.fresh.examConfig,
                academicUnits: e.fresh.academicUnits,
                version: e.fresh.version || 0,
              });
            } catch (_) {}
          } else if (String(e && e.message) === "unauthorized") {
            setSaveError("Session expired — sign out and sign in again.");
          } else {
            // Keep optimistic local data — do not wipe the user's new word
            try {
              saveOfflineCache({
                entries: entriesRef.current,
                accounts: accountsRef.current,
                logs: logsRef.current,
                siteBanner: siteBannerRef.current,
                examConfig: examConfigRef?.current || null,
                academicUnits: academicUnitsRef?.current || null,
                version: recordVersionRef.current,
              });
              markPendingCloudSync();
            } catch (_) {}
            // re-queue ops so next successful online flush can push them
            pendingEntryOpsRef.current = ops.concat(pendingEntryOpsRef.current);
            setSaveError("Couldn't save — check your connection and try again.");
          }
          break;
        }
      }
    }
  });
}

export function flushPendingEntries(ctx) {
  const {
    enqueueSave,
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
    setEntries,
    setAccounts,
    setLogs,
    setSiteBanner,
    setSaveError,
  } = ctx;

  return enqueueSave(async () => {
    while (pendingEntryOpsRef.current.length > 0) {
      const ops = pendingEntryOpsRef.current.slice();
      pendingEntryOpsRef.current = [];

      let curEntries = entriesRef.current;
      let curAccounts = accountsRef.current;
      let curLogs = logsRef.current;
      let curBanner = siteBannerRef.current;
      let curExam = examConfigRef?.current || null;
      let curUnits = academicUnitsRef?.current || null;
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
            {
              entries: nextEntries,
              accounts: curAccounts,
              logs: nextLogs,
              siteBanner: curBanner,
              examConfig: curExam,
              academicUnits: curUnits,
            },
            curVersion
          );
          commitRecordVersion(newVersion);
          saveOfflineCache({
            entries: nextEntries,
            accounts: curAccounts,
            logs: nextLogs,
            siteBanner: curBanner,
            examConfig: curExam,
            academicUnits: curUnits,
          });
          clearPendingCloudSync();
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
            let freshAccounts = e.fresh.accounts || [];
            if (pendingRemoveCodesRef.current.size) {
              const drop = pendingRemoveCodesRef.current;
              freshAccounts = freshAccounts.filter((a) => a && a.code && !drop.has(String(a.code)));
            }
            if (pendingApprovedCodesRef.current.size) {
              const approved = pendingApprovedCodesRef.current;
              freshAccounts = freshAccounts.map((a) =>
                a && a.code && approved.has(String(a.code)) && a.status === "pending"
                  ? { ...a, status: "active" }
                  : a
              );
            }
            setAccounts(freshAccounts);
            setLogs(e.fresh.logs || []);
            if (e.fresh.siteBanner !== undefined) setSiteBanner(e.fresh.siteBanner || null);
            entriesRef.current = e.fresh.entries || [];
            accountsRef.current = freshAccounts;
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
