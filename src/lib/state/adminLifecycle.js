/**
 * Admin approve / reject / delete account flows (optimistic UI + conflict retries).
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
import { MAX_SAVE_RETRIES } from "./cloudQueue";

export async function approveAccountRequest(targetCode, ctx) {
  const {
    accounts,
    accountsRef,
    logsRef,
    entriesRef,
    siteBannerRef,
    examConfigRef,
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
  if (!codeKey) return { error: "Request not found." };
  const target = (accountsRef.current || accounts).find(
    (a) => a && String(a.code) === codeKey
  );
  if (!target || target.status !== "pending") return { error: "Request not found." };
  const logEntry = makeLogEntry(
    "account_edit",
    `${name} approved @${target.username || target.name}`,
    name,
    accountCode
  );

  pendingApprovedCodesRef.current.add(codeKey);
  addPendingApproveCode(codeKey);

  const previousAccounts = accountsRef.current;
  const previousLogs = logsRef.current;
  const optimisticAccounts = previousAccounts.map((a) =>
    a && String(a.code) === codeKey ? { ...a, status: "active" } : a
  );
  const optimisticLogs = capLogs([...previousLogs, logEntry]);
  setAccounts(optimisticAccounts);
  accountsRef.current = optimisticAccounts;
  setLogs(optimisticLogs);
  logsRef.current = optimisticLogs;
  try {
    saveOfflineCache({
      entries: entriesRef.current,
      accounts: optimisticAccounts,
      logs: optimisticLogs,
      siteBanner: siteBannerRef.current,
      examConfig: examConfigRef.current,
    });
  } catch (_) {}

  try {
    await enqueueSave(async () => {
      let curVersion = recordVersionRef.current;
      let curEntries = entriesRef.current;
      let curAccounts = previousAccounts;
      let curLogs = previousLogs;
      let curBanner = siteBannerRef.current;
      for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt++) {
        const nextAccounts = curAccounts.map((a) =>
          a && String(a.code) === codeKey ? { ...a, status: "active" } : a
        );
        const nextLogs = capLogs([...curLogs, logEntry]);
        try {
          const newVersion = await saveAccountsOnly(
            {
              accounts: nextAccounts,
              approveAccountCodes: [codeKey, ...pendingApprovedCodesRef.current],
            },
            curVersion
          );
          commitRecordVersion(newVersion);
          setAccounts(nextAccounts);
          accountsRef.current = nextAccounts;
          setLogs(nextLogs);
          logsRef.current = nextLogs;
          try {
            saveOfflineCache({
              entries: curEntries,
              accounts: nextAccounts,
              logs: nextLogs,
              siteBanner: curBanner,
              examConfig: examConfigRef.current,
            });
          } catch (_) {}
          break;
        } catch (e) {
          if (e instanceof SaveConflictError && attempt < MAX_SAVE_RETRIES) {
            curEntries = e.fresh.entries || [];
            curAccounts = e.fresh.accounts || [];
            curLogs = e.fresh.logs || [];
            if (e.fresh.siteBanner !== undefined) curBanner = e.fresh.siteBanner || null;
            curVersion = e.fresh.version || 0;
            commitRecordVersion(curVersion);
            const stillActive = curAccounts.map((a) =>
              a && String(a.code) === codeKey ? { ...a, status: "active" } : a
            );
            setAccounts(stillActive);
            accountsRef.current = stillActive;
            await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
            continue;
          }
          throw e;
        }
      }
    });

    // Accounts + version only — no full dictionary load (isolation rule).
    try {
      const [accountsList, version] = await Promise.all([
        fetchAccountsOnly({ fresh: true }),
        fetchVersionOnly({ fresh: true }),
      ]);
      const serverAcc = (accountsList || []).find((a) => a && String(a.code) === codeKey);
      if (serverAcc && serverAcc.status === "active") {
        pendingApprovedCodesRef.current.delete(codeKey);
        removePendingApproveCode(codeKey);
        setAccounts(accountsList || []);
        accountsRef.current = accountsList || [];
        if (typeof version === "number") commitRecordVersion(version);
      } else if (serverAcc && serverAcc.status === "pending") {
        const forced = (accountsList || []).map((a) =>
          a && String(a.code) === codeKey ? { ...a, status: "active" } : a
        );
        try {
          const newVersion = await saveAccountsOnly(
            {
              accounts: forced,
              approveAccountCodes: [codeKey],
            },
            version || 0
          );
          commitRecordVersion(newVersion);
          setAccounts(forced);
          accountsRef.current = forced;
          pendingApprovedCodesRef.current.delete(codeKey);
          removePendingApproveCode(codeKey);
        } catch (_) {}
      }
    } catch (_) {}

    showToast(appIsAr ? "تمت الموافقة على الطلب." : "Request approved.");
    return { ok: true };
  } catch (err) {
    return { error: appIsAr ? "تعذّر قبول الطلب — حاول مرة أخرى." : "Couldn't approve the request — try again." };
  }
}

export async function rejectAccountRequest(targetCode, ctx) {
  const {
    accounts, accountsRef, logsRef, entriesRef, siteBannerRef, examConfigRef,
    recordVersionRef, pendingRemoveCodesRef, commitRecordVersion,
    setAccounts, setLogs, name, accountCode, appIsAr, showToast,
  } = ctx;

  const target = accounts.find((a) => a.code === targetCode);
  if (!target || target.status !== "pending") return { error: "Request not found." };
  const logEntry = makeLogEntry(
    "account_delete",
    `${name} rejected request from @${target.username || target.name}`,
    name,
    accountCode
  );

  const previousAccounts = accountsRef.current;
  const previousLogs = logsRef.current;
  const optimisticAccounts = previousAccounts.filter((a) => a.code !== targetCode);
  const optimisticLogs = capLogs([...previousLogs, logEntry]);
  setAccounts(optimisticAccounts);
  accountsRef.current = optimisticAccounts;
  setLogs(optimisticLogs);
  logsRef.current = optimisticLogs;
  pendingRemoveCodesRef.current.add(String(targetCode));
  addPendingRemoveCode(targetCode);
  try {
    saveOfflineCache({
      entries: entriesRef.current,
      accounts: optimisticAccounts,
      logs: optimisticLogs,
      siteBanner: siteBannerRef.current,
      examConfig: examConfigRef.current,
    });
  } catch (_) {}

  try {
    let curVersion = recordVersionRef.current;
    let curEntries = entriesRef.current;
    let curAccounts = previousAccounts;
    let curLogs = previousLogs;
    let curBanner = siteBannerRef.current;
    for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt++) {
      const nextAccounts = curAccounts.filter((a) => a.code !== targetCode);
      const nextLogs = capLogs([...curLogs, logEntry]);
      try {
        const newVersion = await saveAccountsOnly(
          {
            accounts: nextAccounts,
            removeAccountCodes: [targetCode, ...pendingRemoveCodesRef.current],
          },
          curVersion
        );
        commitRecordVersion(newVersion);
        setAccounts(nextAccounts);
        accountsRef.current = nextAccounts;
        setLogs(nextLogs);
        logsRef.current = nextLogs;
        try {
          saveOfflineCache({
            entries: curEntries,
            accounts: nextAccounts,
            logs: nextLogs,
            siteBanner: curBanner,
            examConfig: examConfigRef.current,
          });
        } catch (_) {}
        break;
      } catch (e) {
        if (e instanceof SaveConflictError && attempt < MAX_SAVE_RETRIES) {
          curEntries = e.fresh.entries || [];
          curAccounts = e.fresh.accounts || [];
          curLogs = e.fresh.logs || [];
          if (e.fresh.siteBanner !== undefined) curBanner = e.fresh.siteBanner || null;
          curVersion = e.fresh.version || 0;
          commitRecordVersion(curVersion);
          const stillWithout = curAccounts.filter((a) => a.code !== targetCode);
          setAccounts(stillWithout);
          accountsRef.current = stillWithout;
          await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
  } catch (err) {
    pendingRemoveCodesRef.current.delete(String(targetCode));
    removePendingRemoveCode(targetCode);
    setAccounts(previousAccounts);
    accountsRef.current = previousAccounts;
    setLogs(previousLogs);
    logsRef.current = previousLogs;
    
    return { error: appIsAr ? "تعذّر رفض الطلب — حاول مرة أخرى." : "Couldn't reject the request — try again." };
  }
  showToast(appIsAr ? "تم رفض الطلب." : "Request rejected.");
  return { ok: true };
}

export async function deleteAccount(targetCode, ctx) {
  const {
    accounts, accountsRef, logsRef, entriesRef, siteBannerRef, examConfigRef,
    recordVersionRef, pendingRemoveCodesRef, commitRecordVersion,
    setAccounts, setLogs, name, accountCode, appIsAr, showToast, handleLogout,
  } = ctx;

  const target = accounts.find((a) => a.code === targetCode);
  const logEntry = makeLogEntry(
    "account_delete",
    `${name} deleted account "${(target && target.name) || targetCode}"`,
    name,
    accountCode
  );

  const previousAccounts = accountsRef.current;
  const previousLogs = logsRef.current;
  const optimisticAccounts = previousAccounts.filter((a) => a.code !== targetCode);
  const optimisticLogs = capLogs([...previousLogs, logEntry]);
  setAccounts(optimisticAccounts);
  accountsRef.current = optimisticAccounts;
  setLogs(optimisticLogs);
  logsRef.current = optimisticLogs;
  pendingRemoveCodesRef.current.add(String(targetCode));
  addPendingRemoveCode(targetCode);
  try {
    saveOfflineCache({
      entries: entriesRef.current,
      accounts: optimisticAccounts,
      logs: optimisticLogs,
      siteBanner: siteBannerRef.current,
      examConfig: examConfigRef.current,
    });
  } catch (_) {}

  const persistDelete = async () => {
    try {
      let curVersion = recordVersionRef.current;
      let curEntries = entriesRef.current;
      let curAccounts = previousAccounts;
      let curLogs = previousLogs;
      let curBanner = siteBannerRef.current;
      for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt++) {
        const nextAccounts = curAccounts.filter((a) => a.code !== targetCode);
        const nextLogs = capLogs([...curLogs, logEntry]);
        try {
          const newVersion = await saveAccountsOnly(
            {
              accounts: nextAccounts,
              removeAccountCodes: [targetCode, ...pendingRemoveCodesRef.current],
            },
            curVersion
          );
          commitRecordVersion(newVersion);
          if (targetCode !== accountCode) {
            setAccounts(nextAccounts);
            accountsRef.current = nextAccounts;
            setLogs(nextLogs);
            logsRef.current = nextLogs;
            try {
              saveOfflineCache({
                entries: curEntries,
                accounts: nextAccounts,
                logs: nextLogs,
                siteBanner: curBanner,
                examConfig: examConfigRef.current,
              });
            } catch (_) {}
          }
          return true;
        } catch (e) {
          if (e instanceof SaveConflictError && attempt < MAX_SAVE_RETRIES) {
            curEntries = e.fresh.entries || [];
            curAccounts = e.fresh.accounts || [];
            curLogs = e.fresh.logs || [];
            if (e.fresh.siteBanner !== undefined) curBanner = e.fresh.siteBanner || null;
            curVersion = e.fresh.version || 0;
            commitRecordVersion(curVersion);
            if (targetCode !== accountCode) {
              const stillWithout = curAccounts.filter((a) => a.code !== targetCode);
              setAccounts(stillWithout);
              accountsRef.current = stillWithout;
            }
            await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
            continue;
          }
          throw e;
        }
      }
      return false;
    } catch (err) {
      if (targetCode === accountCode) return false;
      pendingRemoveCodesRef.current.delete(String(targetCode));
      removePendingRemoveCode(targetCode);
      setAccounts(previousAccounts);
      accountsRef.current = previousAccounts;
      setLogs(previousLogs);
      logsRef.current = previousLogs;
      showToast(
        appIsAr
          ? "تعذّر حذف الحساب — حاول مرة أخرى."
          : "Couldn't delete the account — try again."
      );
      return false;
    }
  };

  if (targetCode === accountCode) {
    persistDelete();
    handleLogout();
    return;
  }

  await persistDelete();
}
