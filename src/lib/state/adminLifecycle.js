/**
 * Admin approve / reject / delete account flows.
 * Optimized: single write path, robust 409 recovery, no redundant post-save round-trips.
 */
import {
  SaveConflictError,
  saveAccountsOnly,
  fetchAccountsOnly,
  fetchVersionOnly,
} from "./cloudApi";
import {
  saveOfflineCache,
  addPendingApproveCode,
  removePendingApproveCode,
  addPendingRemoveCode,
  removePendingRemoveCode,
} from "./storage";
import { makeLogEntry, capLogs } from "./logs";

const MAX_RETRIES = 5;

/** On 409, prefer server accounts from the conflict payload; otherwise refetch lightly. */
async function accountsFromConflict(err, fallbackAccounts, fallbackVersion) {
  let accounts = (err && err.fresh && Array.isArray(err.fresh.accounts) && err.fresh.accounts.length)
    ? err.fresh.accounts
    : null;
  let version =
    err && err.fresh && typeof err.fresh.version === "number"
      ? err.fresh.version
      : fallbackVersion;

  if (!accounts) {
    try {
      const [list, ver] = await Promise.all([
        fetchAccountsOnly({ fresh: true }),
        fetchVersionOnly({ fresh: true }),
      ]);
      accounts = Array.isArray(list) ? list : fallbackAccounts;
      if (typeof ver === "number") version = ver;
    } catch (_) {
      accounts = fallbackAccounts;
    }
  }
  return { accounts, version };
}

function cacheAccounts(ctx, accounts, logs) {
  try {
    saveOfflineCache({
      entries: ctx.entriesRef.current,
      accounts,
      logs: logs || ctx.logsRef.current,
      siteBanner: ctx.siteBannerRef.current,
      examConfig: ctx.examConfigRef.current,
    });
  } catch (_) {}
}

/**
 * Approve a pending signup request → status active.
 */
export async function approveAccountRequest(targetCode, ctx) {
  const {
    accounts,
    accountsRef,
    logsRef,
    recordVersionRef,
    pendingApprovedCodesRef,
    commitRecordVersion,
    setAccounts,
    setLogs,
    enqueueSave,
    name,
    accountCode,
    appIsAr,
    showToast,
  } = ctx;

  const codeKey = String(targetCode || "");
  if (!codeKey) {
    return { error: appIsAr ? "الطلب غير موجود." : "Request not found." };
  }

  const target = (accountsRef.current || accounts || []).find(
    (a) => a && String(a.code) === codeKey
  );
  if (!target || target.status !== "pending") {
    return { error: appIsAr ? "الطلب غير موجود أو تمت معالجته." : "Request not found." };
  }

  const logEntry = makeLogEntry(
    "account_edit",
    `${name} approved @${target.username || target.name}`,
    name,
    accountCode
  );

  // Sticky until server confirms active (survives reload).
  pendingApprovedCodesRef.current.add(codeKey);
  addPendingApproveCode(codeKey);

  const previousAccounts = accountsRef.current || accounts || [];
  const previousLogs = logsRef.current || [];

  const optimisticAccounts = previousAccounts.map((a) =>
    a && String(a.code) === codeKey ? { ...a, status: "active" } : a
  );
  const optimisticLogs = capLogs([...previousLogs, logEntry]);
  setAccounts(optimisticAccounts);
  accountsRef.current = optimisticAccounts;
  setLogs(optimisticLogs);
  logsRef.current = optimisticLogs;
  cacheAccounts(ctx, optimisticAccounts, optimisticLogs);

  try {
    await enqueueSave(async () => {
      let curVersion = recordVersionRef.current || 0;
      let curAccounts = previousAccounts;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        // Force active on the target; keep the rest as-is.
        const nextAccounts = (curAccounts || []).map((a) =>
          a && String(a.code) === codeKey ? { ...a, status: "active" } : a
        );
        // Always include sticky approvals so concurrent tabs can't wipe them.
        const approveList = [
          codeKey,
          ...[...pendingApprovedCodesRef.current].filter((c) => c && c !== codeKey),
        ];

        try {
          const newVersion = await saveAccountsOnly(
            {
              accounts: nextAccounts,
              approveAccountCodes: approveList,
            },
            curVersion
          );
          commitRecordVersion(newVersion);
          setAccounts(nextAccounts);
          accountsRef.current = nextAccounts;
          const nextLogs = capLogs([...(logsRef.current || previousLogs), logEntry]);
          setLogs(nextLogs);
          logsRef.current = nextLogs;
          cacheAccounts(ctx, nextAccounts, nextLogs);

          // Confirmed — clear sticky flag for this code.
          pendingApprovedCodesRef.current.delete(codeKey);
          removePendingApproveCode(codeKey);
          return;
        } catch (e) {
          if (e instanceof SaveConflictError && attempt < MAX_RETRIES) {
            const resolved = await accountsFromConflict(e, curAccounts, curVersion);
            curAccounts = resolved.accounts;
            curVersion = resolved.version;
            commitRecordVersion(curVersion);
            // Keep optimistic active in UI while retrying.
            const stillActive = (curAccounts || []).map((a) =>
              a && String(a.code) === codeKey ? { ...a, status: "active" } : a
            );
            setAccounts(stillActive);
            accountsRef.current = stillActive;
            await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
            continue;
          }
          throw e;
        }
      }
      throw new Error("approve_retries_exhausted");
    });

    showToast(appIsAr ? "تمت الموافقة على الطلب." : "Request approved.");
    return { ok: true };
  } catch (err) {
    // Roll back optimistic UI; keep sticky code so boot can retry later.
    setAccounts(previousAccounts);
    accountsRef.current = previousAccounts;
    setLogs(previousLogs);
    logsRef.current = previousLogs;
    cacheAccounts(ctx, previousAccounts, previousLogs);

    const msg =
      appIsAr
        ? "تعذّر قبول الطلب — حاول مرة أخرى."
        : "Couldn't approve the request — try again.";
    showToast(msg);
    return { error: msg };
  }
}

/**
 * Reject a pending signup request → remove account.
 */
export async function rejectAccountRequest(targetCode, ctx) {
  const {
    accounts,
    accountsRef,
    logsRef,
    recordVersionRef,
    pendingRemoveCodesRef,
    commitRecordVersion,
    setAccounts,
    setLogs,
    enqueueSave,
    name,
    accountCode,
    appIsAr,
    showToast,
  } = ctx;

  const codeKey = String(targetCode || "");
  const target = (accountsRef.current || accounts || []).find(
    (a) => a && String(a.code) === codeKey
  );
  if (!target || target.status !== "pending") {
    return { error: appIsAr ? "الطلب غير موجود أو تمت معالجته." : "Request not found." };
  }

  const logEntry = makeLogEntry(
    "account_delete",
    `${name} rejected request from @${target.username || target.name}`,
    name,
    accountCode
  );

  pendingRemoveCodesRef.current.add(codeKey);
  addPendingRemoveCode(codeKey);

  const previousAccounts = accountsRef.current || accounts || [];
  const previousLogs = logsRef.current || [];
  const optimisticAccounts = previousAccounts.filter(
    (a) => a && String(a.code) !== codeKey
  );
  const optimisticLogs = capLogs([...previousLogs, logEntry]);
  setAccounts(optimisticAccounts);
  accountsRef.current = optimisticAccounts;
  setLogs(optimisticLogs);
  logsRef.current = optimisticLogs;
  cacheAccounts(ctx, optimisticAccounts, optimisticLogs);

  try {
    await enqueueSave(async () => {
      let curVersion = recordVersionRef.current || 0;
      let curAccounts = previousAccounts;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const nextAccounts = (curAccounts || []).filter(
          (a) => a && String(a.code) !== codeKey
        );
        const removeList = [
          codeKey,
          ...[...pendingRemoveCodesRef.current].filter((c) => c && c !== codeKey),
        ];

        try {
          const newVersion = await saveAccountsOnly(
            {
              accounts: nextAccounts,
              removeAccountCodes: removeList,
            },
            curVersion
          );
          commitRecordVersion(newVersion);
          setAccounts(nextAccounts);
          accountsRef.current = nextAccounts;
          const nextLogs = capLogs([...(logsRef.current || previousLogs), logEntry]);
          setLogs(nextLogs);
          logsRef.current = nextLogs;
          cacheAccounts(ctx, nextAccounts, nextLogs);

          pendingRemoveCodesRef.current.delete(codeKey);
          removePendingRemoveCode(codeKey);
          return;
        } catch (e) {
          if (e instanceof SaveConflictError && attempt < MAX_RETRIES) {
            const resolved = await accountsFromConflict(e, curAccounts, curVersion);
            curAccounts = resolved.accounts;
            curVersion = resolved.version;
            commitRecordVersion(curVersion);
            const stillWithout = (curAccounts || []).filter(
              (a) => a && String(a.code) !== codeKey
            );
            setAccounts(stillWithout);
            accountsRef.current = stillWithout;
            await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
            continue;
          }
          throw e;
        }
      }
      throw new Error("reject_retries_exhausted");
    });

    showToast(appIsAr ? "تم رفض الطلب." : "Request rejected.");
    return { ok: true };
  } catch (err) {
    pendingRemoveCodesRef.current.delete(codeKey);
    removePendingRemoveCode(codeKey);
    setAccounts(previousAccounts);
    accountsRef.current = previousAccounts;
    setLogs(previousLogs);
    logsRef.current = previousLogs;
    cacheAccounts(ctx, previousAccounts, previousLogs);

    const msg =
      appIsAr
        ? "تعذّر رفض الطلب — حاول مرة أخرى."
        : "Couldn't reject the request — try again.";
    showToast(msg);
    return { error: msg };
  }
}

/**
 * Delete any account (admin). If deleting self → logout after persist.
 */
export async function deleteAccount(targetCode, ctx) {
  const {
    accounts,
    accountsRef,
    logsRef,
    recordVersionRef,
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
  } = ctx;

  const codeKey = String(targetCode || "");
  const target = (accountsRef.current || accounts || []).find(
    (a) => a && String(a.code) === codeKey
  );
  if (!target) {
    return { error: appIsAr ? "الحساب غير موجود." : "Account not found." };
  }

  const logEntry = makeLogEntry(
    "account_delete",
    `${name} deleted @${target.username || target.name}`,
    name,
    accountCode
  );

  pendingRemoveCodesRef.current.add(codeKey);
  addPendingRemoveCode(codeKey);

  const previousAccounts = accountsRef.current || accounts || [];
  const previousLogs = logsRef.current || [];
  const isSelf = codeKey === String(accountCode || "");

  if (!isSelf) {
    const optimisticAccounts = previousAccounts.filter(
      (a) => a && String(a.code) !== codeKey
    );
    const optimisticLogs = capLogs([...previousLogs, logEntry]);
    setAccounts(optimisticAccounts);
    accountsRef.current = optimisticAccounts;
    setLogs(optimisticLogs);
    logsRef.current = optimisticLogs;
    cacheAccounts(ctx, optimisticAccounts, optimisticLogs);
  }

  const persistDelete = async () => {
    try {
      await enqueueSave(async () => {
        let curVersion = recordVersionRef.current || 0;
        let curAccounts = previousAccounts;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          const nextAccounts = (curAccounts || []).filter(
            (a) => a && String(a.code) !== codeKey
          );
          const removeList = [
            codeKey,
            ...[...pendingRemoveCodesRef.current].filter((c) => c && c !== codeKey),
          ];

          try {
            const newVersion = await saveAccountsOnly(
              {
                accounts: nextAccounts,
                removeAccountCodes: removeList,
              },
              curVersion
            );
            commitRecordVersion(newVersion);
            if (!isSelf) {
              setAccounts(nextAccounts);
              accountsRef.current = nextAccounts;
              const nextLogs = capLogs([
                ...(logsRef.current || previousLogs),
                logEntry,
              ]);
              setLogs(nextLogs);
              logsRef.current = nextLogs;
              cacheAccounts(ctx, nextAccounts, nextLogs);
            }
            pendingRemoveCodesRef.current.delete(codeKey);
            removePendingRemoveCode(codeKey);
            return;
          } catch (e) {
            if (e instanceof SaveConflictError && attempt < MAX_RETRIES) {
              const resolved = await accountsFromConflict(e, curAccounts, curVersion);
              curAccounts = resolved.accounts;
              curVersion = resolved.version;
              commitRecordVersion(curVersion);
              if (!isSelf) {
                const stillWithout = (curAccounts || []).filter(
                  (a) => a && String(a.code) !== codeKey
                );
                setAccounts(stillWithout);
                accountsRef.current = stillWithout;
              }
              await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
              continue;
            }
            throw e;
          }
        }
        throw new Error("delete_retries_exhausted");
      });
      return true;
    } catch (err) {
      if (!isSelf) {
        pendingRemoveCodesRef.current.delete(codeKey);
        removePendingRemoveCode(codeKey);
        setAccounts(previousAccounts);
        accountsRef.current = previousAccounts;
        setLogs(previousLogs);
        logsRef.current = previousLogs;
        cacheAccounts(ctx, previousAccounts, previousLogs);
        showToast(
          appIsAr
            ? "تعذّر حذف الحساب — حاول مرة أخرى."
            : "Couldn't delete the account — try again."
        );
      }
      return false;
    }
  };

  if (isSelf) {
    await persistDelete();
    if (typeof handleLogout === "function") handleLogout();
    return { ok: true };
  }

  const ok = await persistDelete();
  if (ok) {
    showToast(appIsAr ? "تم حذف الحساب." : "Account deleted.");
    return { ok: true };
  }
  return { error: appIsAr ? "تعذّر حذف الحساب." : "Couldn't delete the account." };
}
