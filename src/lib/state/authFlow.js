/**
 * Signup / login flows extracted from App.jsx.
 * Kept as plain async functions (not a hook) because they need many
 * cloud/state setters from the parent. Behavior matches the original 1:1.
 */
import { fetchRecord, saveRecord, SaveConflictError } from "./cloudApi";
import {
  validateUsername,
  validatePassword,
  hashPassword,
  verifyPasswordDetailed,
  normalizeUsername,
} from "../utils/authUtils";
import { generatePersonalCode, savePersonalCode, saveSessionId, generateSessionId } from "./storage";
import { capLogs, makeLogEntry } from "./logs";
import {
  upsertVaultAccount,
  getMainAccountCode,
  setMainAccountCode,
} from "./accountVault";
import { normalizeExamConfig } from "./exam";

const MAX_SIGNUP_RETRIES = 8;

/**
 * @param {object} p
 * @returns {Promise<void>}
 */
export async function performSignup(p) {
  const {
    e,
    name,
    signupUsername,
    signupPassword,
    signupPassword2,
    signupAvatar,
    signupGender,
    appIsAr,
    ensureMigratedAccounts,
    commitRecordVersion,
    setSignupError,
    setSignupSaving,
    setSignupPassword,
    setSignupPassword2,
    setSignupAvatar,
    setSignupGender,
    setAccounts,
    setEntries,
    setLogs,
    setSiteBanner,
    setExamConfig,
    goToStage,
  } = p;

  e.preventDefault();
  setSignupError("");
  const trimmedName = name.trim();
  if (!trimmedName) {
    setSignupError("Enter a name.");
    return;
  }

  const uCheck = validateUsername(signupUsername);
  if (!uCheck.ok) {
    setSignupError(uCheck.error);
    return;
  }
  const pCheck = validatePassword(signupPassword);
  if (!pCheck.ok) {
    setSignupError(pCheck.error);
    return;
  }
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
  } catch (_) {
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

  try {
    let lastErr = null;
    let rec = await ensureMigratedAccounts(await fetchRecord({ fresh: true }));
    for (let attempt = 0; attempt <= MAX_SIGNUP_RETRIES; attempt++) {
      try {
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
          if (err.fresh && typeof err.fresh.version === "number") {
            rec = await ensureMigratedAccounts({
              entries: err.fresh.entries || [],
              accounts: err.fresh.accounts || [],
              logs: err.fresh.logs || [],
              siteBanner: err.fresh.siteBanner ?? null,
              examConfig: err.fresh.examConfig ?? null,
              version: err.fresh.version,
            });
          } else {
            rec = await ensureMigratedAccounts(await fetchRecord({ fresh: true }));
          }
          await new Promise((r) => setTimeout(r, 40 + attempt * 30));
          continue;
        }
        throw err;
      }
    }
    if (lastErr) throw lastErr;
  } catch (err) {
    if (err instanceof SaveConflictError) {
      try {
        const rec = await ensureMigratedAccounts(await fetchRecord({ fresh: true }));
        const clash = (rec.accounts || []).some(
          (a) => normalizeUsername(a.username) === uCheck.username
        );
        if (clash) {
          setSignupError("That username is already taken. Pick another.");
          return;
        }
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
      } catch (_) {
        setSignupError(
          appIsAr
            ? "تعذّر إنشاء الحساب حالياً — حاول مرة أخرى بعد لحظات."
            : "Couldn't create the account right now — please try again in a moment."
        );
      }
    } else {
      setSignupError(
        appIsAr
          ? "تعذّر إنشاء الحساب — تحقق من الاتصال وحاول مرة أخرى."
          : "Couldn't create the account — check your connection and try again."
      );
    }
  } finally {
    setSignupSaving(false);
  }
}

/**
 * @param {object} p
 * @returns {Promise<void>}
 */
export async function performLogin(p) {
  const {
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
    setAccountCode,
    setVaultAccounts,
    setLinkMode,
    setMainAccountCodeState,
    setPasswordInput,
    goToStage,
    persistAccounts,
  } = p;

  e.preventDefault();
  setAuthError("");

  if (!accountsLoaded) {
    setAuthError("Still loading — please try again in a moment.");
    return;
  }

  const uCheck = validateUsername(usernameInput);
  if (!uCheck.ok) {
    setAuthError(uCheck.error);
    return;
  }
  if (!passwordInput) {
    setAuthError("Enter your password.");
    return;
  }

  setLoggingIn(true);

  let curAccounts = accounts;
  let account = null;
  try {
    const rec = await ensureMigratedAccounts(await fetchRecord({ fresh: true }));
    curAccounts = rec.accounts || [];
    if (pendingRemoveCodesRef.current.size) {
      const drop = pendingRemoveCodesRef.current;
      curAccounts = curAccounts.filter((a) => a && a.code && !drop.has(String(a.code)));
    }
    setAccounts(curAccounts);
    accountsRef.current = curAccounts;
    setEntries(rec.entries || []);
    setLogs(rec.logs || []);
    setSiteBanner(rec.siteBanner || null);
    if (rec.examConfig !== undefined) setExamConfig(normalizeExamConfig(rec.examConfig));
    commitRecordVersion(rec.version);
    account = curAccounts.find((a) => normalizeUsername(a.username) === uCheck.username);
  } catch (_) {
    curAccounts = accountsRef.current.length ? accountsRef.current : accounts;
    account = curAccounts.find((a) => normalizeUsername(a.username) === uCheck.username);
  }
  if (!account) {
    setLoggingIn(false);
    setAuthError(appIsAr ? "اسم المستخدم ده مش موجود." : "That username doesn't match any account.");
    return;
  }
  if (account.status === "pending") {
    setLoggingIn(false);
    setAuthError(
      appIsAr
        ? "حسابك لسه مستني موافقة المسؤول. لو اتقبلت حاول تاني بعد لحظات."
        : "Your account is still waiting for admin approval. If you were just approved, try again in a moment."
    );
    return;
  }
  if (account.status === "rejected") {
    setLoggingIn(false);
    setAuthError(
      appIsAr
        ? "تم رفض طلب حسابك. تواصل مع المسؤول."
        : "Your account request was declined. Contact an admin."
    );
    return;
  }
  if (account.status === "blocked") {
    setLoggingIn(false);
    setAuthError(
      appIsAr
        ? "تم حظر حسابك من دخول الموقع. تواصل مع المسؤول."
        : "Your account is blocked from accessing the site. Contact an admin."
    );
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
  try {
    linking = sessionStorage.getItem("twoTongues.linkMode") === "1";
  } catch (_) {}
  const nextVault = upsertVaultAccount(account, {
    allowMulti: account.role === "admin" || linking || linkMode,
  });
  setVaultAccounts(nextVault);
  try {
    sessionStorage.removeItem("twoTongues.linkMode");
  } catch (_) {}
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
  const logEntry =
    account.role !== "admin"
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
      await persistAccounts(
        (accs) =>
          accs.map((a) =>
            a.code === accountCodeLogin
              ? {
                  ...a,
                  sessionId: sid,
                  sessionAt: stamped,
                  ...(isFirstSignIn ? { firstSignInAt: stamped } : {}),
                }
              : a
          ),
        logEntry
      );
    } catch (_) {
      // Signed in locally regardless.
    }
  })();
}
