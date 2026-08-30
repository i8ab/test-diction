/**
 * Coalesced flush of pending account/entry ops to the cloud record.
 * `ctx` holds the live refs + setters from App so behavior stays identical.
 */
import {
  SaveConflictError,
  saveRecord,
  saveAccountsOnly,
  patchEntry,
  deleteEntryRemote,
} from "./cloudApi";
import { saveOfflineCache, clearPendingCloudSync, markPendingCloudSync, removePendingApproveCode } from "./storage";
import { capLogs } from "./logs";
import { attachXpToAccounts } from "./xp";
import { applyOps, MAX_SAVE_RETRIES } from "./cloudQueue";
import { diffEntries, GRANULAR_ENTRY_LIMIT } from "./partialSave";

/**
 * Merge progress fields when two account snapshots race.
 *
 * studied is NOT a pure union — un-study must win when it is newer.
 * We use studiedAt (when marked studied) + studiedRevokedAt (when un-studied).
 * For each id: studied wins only if study stamp > revoke stamp (and > 0).
 */
export function mergeAccountProgress(local, remote) {
  if (!local) return remote || null;
  if (!remote) return local;
  // Profile fields from remote (name, avatar, …); progress merged below
  const out = { ...remote, ...local };

  const localStudied = Array.isArray(local.studied) ? local.studied.map(String) : [];
  const remoteStudied = Array.isArray(remote.studied) ? remote.studied.map(String) : [];
  const localAt = local.studiedAt && typeof local.studiedAt === "object" ? local.studiedAt : {};
  const remoteAt = remote.studiedAt && typeof remote.studiedAt === "object" ? remote.studiedAt : {};
  const localRev =
    local.studiedRevokedAt && typeof local.studiedRevokedAt === "object"
      ? local.studiedRevokedAt
      : {};
  const remoteRev =
    remote.studiedRevokedAt && typeof remote.studiedRevokedAt === "object"
      ? remote.studiedRevokedAt
      : {};

  const allIds = new Set([
    ...localStudied,
    ...remoteStudied,
    ...Object.keys(localAt).map(String),
    ...Object.keys(remoteAt).map(String),
    ...Object.keys(localRev).map(String),
    ...Object.keys(remoteRev).map(String),
  ]);

  const mergedAt = {};
  const mergedRev = {};
  const studied = [];

  for (const id of allIds) {
    const studyTs = Math.max(Number(localAt[id]) || 0, Number(remoteAt[id]) || 0);
    const revTs = Math.max(Number(localRev[id]) || 0, Number(remoteRev[id]) || 0);
    // Also treat "in list without stamp" as studied at epoch 1 so old data still works
    const inLocal = localStudied.includes(id);
    const inRemote = remoteStudied.includes(id);
    const effectiveStudy = studyTs > 0 ? studyTs : inLocal || inRemote ? 1 : 0;

    if (revTs > 0) mergedRev[id] = revTs;
    if (effectiveStudy > 0 && effectiveStudy >= revTs) {
      studied.push(id);
      if (studyTs > 0) mergedAt[id] = studyTs;
      else if (Number(localAt[id]) || Number(remoteAt[id])) {
        mergedAt[id] = Number(localAt[id]) || Number(remoteAt[id]);
      }
    }
  }

  out.studied = studied;
  out.studiedAt = mergedAt;
  out.studiedRevokedAt = mergedRev;

  // favorites: same last-write idea via optional favoritesRevokedAt; else union
  // (toggleFavorite does not stamp revoke yet — keep union for adds, but if
  // local removed an id that remote still has, prefer local when lists differ
  // only for the signed-in merge path that calls this with intentional local.)
  const lf = Array.isArray(local.favorites) ? local.favorites.map(String) : [];
  const rf = Array.isArray(remote.favorites) ? remote.favorites.map(String) : [];
  const localFavRev =
    local.favoritesRevokedAt && typeof local.favoritesRevokedAt === "object"
      ? local.favoritesRevokedAt
      : {};
  const remoteFavRev =
    remote.favoritesRevokedAt && typeof remote.favoritesRevokedAt === "object"
      ? remote.favoritesRevokedAt
      : {};
  if (Object.keys(localFavRev).length || Object.keys(remoteFavRev).length) {
    const favIds = new Set([...lf, ...rf, ...Object.keys(localFavRev), ...Object.keys(remoteFavRev)]);
    const fav = [];
    const favRev = {};
    for (const id of favIds) {
      const rev = Math.max(Number(localFavRev[id]) || 0, Number(remoteFavRev[id]) || 0);
      if (rev > 0) favRev[id] = rev;
      const wasFav = lf.includes(id) || rf.includes(id);
      // Without favoriteAt timestamps, revoke always wins if present
      if (wasFav && rev === 0) fav.push(id);
      if (wasFav && rev > 0) {
        // revoked — stay out
      }
      if (!wasFav && rev === 0) {
        /* nothing */
      }
    }
    // Recompute: id is favorite if in either list and no revoke (or re-added after — no stamp)
    // Simpler: start from union then drop revoked
    const union = [...new Set([...lf, ...rf])];
    out.favorites = union.filter((id) => !favRev[id]);
    out.favoritesRevokedAt = favRev;
  } else {
    // No revoke metadata: if local has fewer items, local may have un-favorited —
    // prefer intersection-plus-local for safety on the active account only when
    // local is a subset (unfavorite). If local is superset, union (new favorites).
    const localSet = new Set(lf);
    const remoteSet = new Set(rf);
    const localOnly = lf.filter((id) => !remoteSet.has(id));
    const remoteOnly = rf.filter((id) => !localSet.has(id));
    if (localOnly.length === 0 && remoteOnly.length > 0) {
      // local removed some — trust local
      out.favorites = lf;
    } else {
      out.favorites = [...new Set([...lf, ...rf])];
    }
  }

  // SRS maps: merge by max total / newer due
  for (const key of ["srsStats", "srsDueAt", "srsCards", "srsBox"]) {
    const lmap = local[key] && typeof local[key] === "object" ? local[key] : {};
    const rmap = remote[key] && typeof remote[key] === "object" ? remote[key] : {};
    out[key] = { ...rmap, ...lmap };
    if (key === "srsStats") {
      for (const id of Object.keys(rmap)) {
        const l = lmap[id];
        const r = rmap[id];
        if (l && r) {
          const lt = Number(l.total) || 0;
          const rt = Number(r.total) || 0;
          out[key][id] = lt >= rt ? l : r;
        }
      }
    }
  }

  // xp: prefer higher total
  if (local.xp || remote.xp) {
    const lt = Number(local.xp && local.xp.total) || 0;
    const rt = Number(remote.xp && remote.xp.total) || 0;
    out.xp = lt >= rt ? local.xp || remote.xp : remote.xp || local.xp;
  }
  if (local.achievements || remote.achievements) {
    const la = Array.isArray(local.achievements) ? local.achievements : [];
    const ra = Array.isArray(remote.achievements) ? remote.achievements : [];
    out.achievements = [...new Set([...la, ...ra].map(String))];
  }
  return out;
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
  } = ctx;

  return enqueueSave(async () => {
    while (pendingAccountOpsRef.current.length > 0) {
      const ops = pendingAccountOpsRef.current.slice();
      pendingAccountOpsRef.current = [];

      let curEntries = entriesRef.current;
      let curAccounts = accountsRef.current;
      let curLogs = logsRef.current;
      let curBanner = siteBannerRef.current;
      let curExam = examConfigRef?.current || null;
      let curUnits = academicUnitsRef?.current || null;
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
          // Accounts-only scope: do not rewrite entries/logs on every profile tweak
          const newVersion = await saveAccountsOnly(
            {
              accounts: nextAccounts,
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
          saveOfflineCache({
            entries: curEntries,
            accounts: nextAccounts,
            logs: nextLogs,
            siteBanner: curBanner,
            examConfig: curExam,
            academicUnits: curUnits,
            version: newVersion,
          });
          clearPendingCloudSync();
          setSaveError("");
          break;
        } catch (e) {
          if (e instanceof SaveConflictError && attempt < MAX_SAVE_RETRIES) {
            curEntries = e.fresh.entries || curEntries;
            // Prefer server accounts, then re-apply our account ops on the next loop
            curAccounts = e.fresh.accounts || [];
            curLogs = e.fresh.logs || curLogs;
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
            // Re-apply ACCOUNT ops on top of latest server accounts (never treat as entries).
            const baseAccounts = e.fresh.accounts || [];
            let mergedAccounts = baseAccounts;
            let mergedLogs = e.fresh.logs || curLogs;
            try {
              const applied = applyOps(baseAccounts, ops, "accounts");
              mergedAccounts = applied.next;
              for (const le of applied.logsToAdd) mergedLogs = capLogs([...mergedLogs, le]);
            } catch (_) {}
            if (pendingRemoveCodesRef.current.size) {
              const drop = pendingRemoveCodesRef.current;
              mergedAccounts = mergedAccounts.filter((a) => a && a.code && !drop.has(String(a.code)));
            }
            if (pendingApprovedCodesRef.current.size) {
              const approved = pendingApprovedCodesRef.current;
              mergedAccounts = mergedAccounts.map((a) =>
                a && a.code && approved.has(String(a.code)) && a.status === "pending"
                  ? { ...a, status: "active" }
                  : a
              );
            }
            // Also merge progress with any optimistic local row for the active account
            if (accountCode && accountsRef.current) {
              const localMine = accountsRef.current.find((a) => a && a.code === accountCode);
              mergedAccounts = mergedAccounts.map((a) => {
                if (!a || a.code !== accountCode || !localMine) return a;
                return mergeAccountProgress(localMine, a);
              });
            }
            setAccounts(mergedAccounts);
            accountsRef.current = mergedAccounts;
            setLogs(mergedLogs);
            logsRef.current = mergedLogs;
            if (e.fresh.entries) {
              setEntries(e.fresh.entries);
              entriesRef.current = e.fresh.entries;
            }
            if (e.fresh.siteBanner !== undefined) setSiteBanner(e.fresh.siteBanner || null);
            commitRecordVersion(e.fresh.version || 0);
            // Re-queue ACCOUNT ops (not entry ops!) so a later flush can still push
            pendingAccountOpsRef.current = ops.concat(pendingAccountOpsRef.current);
            setSaveError("Save conflict — changes kept locally. Retrying…");
            try {
              saveOfflineCache({
                entries: entriesRef.current,
                accounts: mergedAccounts,
                logs: mergedLogs,
                siteBanner: e.fresh.siteBanner !== undefined ? e.fresh.siteBanner : curBanner,
                examConfig: e.fresh.examConfig !== undefined ? e.fresh.examConfig : curExam,
                academicUnits: e.fresh.academicUnits !== undefined ? e.fresh.academicUnits : curUnits,
                version: e.fresh.version || 0,
              });
              markPendingCloudSync();
            } catch (_) {}
          } else if (String(e && e.message) === "unauthorized") {
            setSaveError("Session expired — sign out and sign in again.");
          } else {
            // Keep optimistic local data — do not wipe studied/favorites
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
            // re-queue ACCOUNT ops so next successful online flush can push them
            pendingAccountOpsRef.current = ops.concat(pendingAccountOpsRef.current);
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
            // Preserve local studied/favorites that may not be on server yet
            const localAccounts = accountsRef.current || [];
            if (localAccounts.length && freshAccounts.length) {
              const localBy = new Map(
                localAccounts.filter((a) => a && a.code).map((a) => [String(a.code), a])
              );
              freshAccounts = freshAccounts.map((remote) => {
                if (!remote || !remote.code) return remote;
                const local = localBy.get(String(remote.code));
                return local ? mergeAccountProgress(local, remote) : remote;
              });
            }
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
                version: e.fresh.version || 0,
              });
              markPendingCloudSync();
            } catch (_) {}
            setSaveError("Couldn't finish sync — will retry. Local deletes were kept.");
          } else if (String(e && e.message) === "unauthorized") {
            setSaveError("Session expired — sign out and sign in again.");
          } else {
            // Keep optimistic local data and re-queue so edit/add is not lost
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
            if (ops.length) {
              pendingEntryOpsRef.current = [...ops, ...pendingEntryOpsRef.current];
            }
            setSaveError("Couldn't save — check your connection and try again.");
          }
          break;
        }
      }
    }
  });
}
