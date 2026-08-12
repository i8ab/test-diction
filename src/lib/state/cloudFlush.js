/**
 * Coalesced flush of pending account/entry ops to the cloud record.
 * `ctx` holds the live refs + setters from App so behavior stays identical.
 */
import { SaveConflictError, saveRecord } from "./cloudApi";
import { saveOfflineCache, clearPendingCloudSync, removePendingApproveCode } from "./storage";
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
            { entries: nextEntries, accounts: curAccounts, logs: nextLogs, siteBanner: curBanner },
            curVersion
          );
          commitRecordVersion(newVersion);
          saveOfflineCache({ entries: nextEntries, accounts: curAccounts, logs: nextLogs, siteBanner: curBanner });
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
