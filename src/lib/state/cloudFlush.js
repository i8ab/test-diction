/**
 * Coalesced flush of pending account/entry ops to the cloud record.
 * `ctx` holds the live refs + setters from App so behavior stays identical.
 */
import {
  SaveConflictError,
  saveRecord,
  saveAccountsOnly,
  patchAccountFields,
  patchEntry,
  deleteEntryRemote,
  fetchVersionOnly,
} from "./cloudApi";
import {
  saveOfflineCache,
  clearPendingCloudSync,
  markPendingCloudSync,
  removePendingApproveCode,
  PROGRESS_KEYS,
} from "./storage";
import { capLogs } from "./logs";
import { attachXpToAccounts } from "./xp";
import { applyOps, MAX_SAVE_RETRIES } from "./cloudQueue";
import { diffEntries, GRANULAR_ENTRY_LIMIT } from "./partialSave";

/** Build a progress-only patch for accountPatch (studied / favorites / SRS / xp). */
function progressPatchFromAccount(account) {
  if (!account || typeof account !== "object") return null;
  const patch = {};
  let any = false;
  for (const k of PROGRESS_KEYS) {
    if (account[k] !== undefined) {
      patch[k] = account[k];
      any = true;
    }
  }
  return any ? patch : null;
}

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
      // Snapshot the accounts as they were when this batch started. Concurrent
      // rapid studied toggles can race on accountsRef (last optimistic write
      // wins → only one word kept). We ALWAYS re-apply every op in `ops` onto
      // a base so marking word2 never drops word1.
      const batchBaseAccounts = curAccounts;

      for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt++) {
        let nextLogs = curLogs;
        // Always compose from ops (absolute toggles are idempotent). Never save
        // a bare optimistic snapshot — that was why only the first studied word stuck.
        const baseForOps = attempt === 0 ? batchBaseAccounts : curAccounts;
        const applied = applyOps(baseForOps, ops, "accounts");
        let nextAccounts = applied.next;
        for (const le of applied.logsToAdd) nextLogs = capLogs([...nextLogs, le]);

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

          let newVersion = curVersion;
          // Prefer narrow accountPatch for the signed-in user's progress
          // (studied / favorites / SRS). Full saveAccountsOnly races with softSync
          // and other tabs → 409 after the first word; only the first mark stuck.
          const self =
            accountCode &&
            nextAccounts.find((a) => a && String(a.code) === String(accountCode));
          const progressPatch = self ? progressPatchFromAccount(self) : null;
          const useProgressPatch =
            !removeCodes.length &&
            !approveCodes.length &&
            accountCode &&
            progressPatch;

          // Refresh version right before write — softSync / other tabs often
          // bump it; using a stale expectedVersion was the main source of 409
          // after the first studied mark.
          try {
            const latest = await fetchVersionOnly({ fresh: true });
            if (typeof latest === "number" && latest > curVersion) {
              curVersion = latest;
              commitRecordVersion(latest);
            }
          } catch (_) {}

          if (useProgressPatch) {
            const result = await patchAccountFields(
              accountCode,
              progressPatch,
              curVersion
            );
            newVersion = result.version;
            // Merge server-confirmed account back so subsequent toggles
            // start from the truth the DB just wrote.
            if (result.account) {
              nextAccounts = nextAccounts.map((a) =>
                a && String(a.code) === String(accountCode)
                  ? { ...a, ...result.account }
                  : a
              );
              accountsRef.current = nextAccounts;
              setAccounts(nextAccounts);
            }
          } else {
            // Admin approve/remove or bulk profile path
            newVersion = await saveAccountsOnly(
              {
                accounts: nextAccounts,
                ...(removeCodes.length ? { removeAccountCodes: removeCodes } : {}),
                ...(approveCodes.length ? { approveAccountCodes: approveCodes } : {}),
              },
              curVersion
            );
          }
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
            // Prefer server accounts (full rows from conflict payload) then
            // re-apply our account ops on the next loop iteration.
            curEntries = e.fresh.entries || curEntries;
            curAccounts = Array.isArray(e.fresh.accounts) ? e.fresh.accounts : curAccounts;
            curLogs = e.fresh.logs || curLogs;
            if (e.fresh.siteBanner !== undefined) curBanner = e.fresh.siteBanner || null;
            curVersion = e.fresh.version || 0;
            if (e.fresh.entries) entriesRef.current = curEntries;
            accountsRef.current = curAccounts;
            logsRef.current = curLogs;
            siteBannerRef.current = curBanner;
            commitRecordVersion(curVersion);
            await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
            continue;
          }
          if (e instanceof SaveConflictError && e.fresh) {
            // CRITICAL (accounts path): re-apply pending *account* ops on top of
            // the latest server accounts so studied/favorites/SRS are never
            // silently discarded after a version conflict.
            // (Previously this block wrongly treated ops as entry ops and
            // re-queued them on pendingEntryOpsRef — that dropped studied.)
            let baseAccounts = Array.isArray(e.fresh.accounts)
              ? e.fresh.accounts
              : accountsRef.current || [];
            let mergedAccounts = baseAccounts;
            let mergedLogs = curLogs;
            try {
              const reapplied = applyOps(baseAccounts, ops, "accounts");
              mergedAccounts = reapplied.next;
              for (const le of reapplied.logsToAdd) {
                mergedLogs = capLogs([...mergedLogs, le]);
              }
            } catch (_) {}
            if (pendingRemoveCodesRef.current.size) {
              const drop = pendingRemoveCodesRef.current;
              mergedAccounts = mergedAccounts.filter(
                (a) => a && a.code && !drop.has(String(a.code))
              );
            }
            if (pendingApprovedCodesRef.current.size) {
              const approved = pendingApprovedCodesRef.current;
              mergedAccounts = mergedAccounts.map((a) =>
                a && a.code && approved.has(String(a.code)) && a.status === "pending"
                  ? { ...a, status: "active" }
                  : a
              );
            }
            try {
              mergedAccounts = attachXpToAccounts(mergedAccounts, accountCode);
            } catch (_) {}
            setAccounts(mergedAccounts);
            accountsRef.current = mergedAccounts;
            if (mergedLogs !== curLogs) {
              setLogs(mergedLogs);
              logsRef.current = mergedLogs;
            }
            if (e.fresh.siteBanner !== undefined) setSiteBanner(e.fresh.siteBanner || null);
            commitRecordVersion(e.fresh.version || 0);
            // Re-queue account ops so a later flush still pushes to the server.
            if (ops.length) {
              pendingAccountOpsRef.current = [...ops, ...pendingAccountOpsRef.current];
            }
            markPendingCloudSync();
            setSaveError("Save conflict — progress kept locally. Retrying…");
            try {
              saveOfflineCache({
                entries: entriesRef.current,
                accounts: mergedAccounts,
                logs: logsRef.current,
                siteBanner:
                  e.fresh.siteBanner !== undefined ? e.fresh.siteBanner : curBanner,
                version: e.fresh.version || 0,
              });
            } catch (_) {}
          } else if (String(e && e.message) === "unauthorized") {
            setSaveError("Session expired — sign out and sign in again.");
          } else {
            // Keep optimistic local data (including studied) — do not wipe progress.
            try {
              saveOfflineCache({
                entries: entriesRef.current,
                accounts: accountsRef.current,
                logs: logsRef.current,
                siteBanner: siteBannerRef.current,
                version: recordVersionRef.current,
              });
              markPendingCloudSync();
            } catch (_) {}
            // Re-queue *account* ops (not entry ops) for the next successful flush.
            if (ops.length) {
              pendingAccountOpsRef.current = [...ops, ...pendingAccountOpsRef.current];
            }
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
    lastSyncedEntriesRef,
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
      // Baseline for granular diff (last successful cloud sync)
      let syncBase =
        lastSyncedEntriesRef?.current && Array.isArray(lastSyncedEntriesRef.current)
          ? lastSyncedEntriesRef.current
          : null;

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
          const baseForDiff = syncBase || curEntries;
          const { added, updated, removed } = diffEntries(baseForDiff, nextEntries);
          const changeCount = added.length + updated.length + removed.length;

          let newVersion = curVersion;
          if (changeCount > 0 && changeCount <= GRANULAR_ENTRY_LIMIT) {
            // Per-word patches — do not rewrite the whole dictionary
            for (const e of [...added, ...updated]) {
              newVersion = await patchEntry(e, newVersion);
            }
            for (const id of removed) {
              newVersion = await deleteEntryRemote(id, newVersion);
            }
          } else if (changeCount > GRANULAR_ENTRY_LIMIT) {
            // Bulk (e.g. large CSV import) — full entries write once
            newVersion = await saveRecord(
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
          }
          // changeCount === 0: nothing to push

          commitRecordVersion(newVersion);
          if (lastSyncedEntriesRef) {
            lastSyncedEntriesRef.current = nextEntries;
          }
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
            if (lastSyncedEntriesRef) lastSyncedEntriesRef.current = curEntries;
            syncBase = curEntries;
            commitRecordVersion(curVersion);
            useOptimisticSnapshot = false;
            await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
            continue;
          }
          if (e instanceof SaveConflictError && e.fresh) {
            // CRITICAL: re-apply local ops on top of server state so deletes
            // (and other pending mutations) are not wiped by a conflict.
            let mergedEntries = e.fresh.entries || [];
            try {
              const reapplied = applyOps(mergedEntries, ops, "entries");
              mergedEntries = reapplied.next;
            } catch (_) {}
            setEntries(mergedEntries);
            entriesRef.current = mergedEntries;
            // Keep ops queued so the next flush can still push to the server.
            if (ops.length) {
              pendingEntryOpsRef.current = [...ops, ...pendingEntryOpsRef.current];
            }
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
            accountsRef.current = freshAccounts;
            logsRef.current = e.fresh.logs || [];
            commitRecordVersion(e.fresh.version || 0);
            // Persist the merged (post-delete) snapshot locally so reload
            // does not resurrect words that the user already removed.
            try {
              saveOfflineCache({
                entries: mergedEntries,
                accounts: freshAccounts,
                logs: e.fresh.logs || [],
                siteBanner: e.fresh.siteBanner !== undefined ? e.fresh.siteBanner : curBanner,
                examConfig: curExam,
                academicUnits: curUnits,
              });
            } catch (_) {}
            setSaveError("Couldn't finish sync — will retry. Local deletes were kept.");
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
