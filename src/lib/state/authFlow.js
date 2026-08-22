/**
 * Signup / login flows extracted from App.jsx.
 * Kept as plain async functions (not a hook) because they need many
 * cloud/state setters from the parent. Behavior matches the original 1:1.
 */
import {
  fetchRecord,
  saveAccountsOnly,
  patchAccountFields,
  SaveConflictError,
} from "./cloudApi";
import {
  validateUsername,
  validatePassword,
  validateBirthDate,
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
import { getBacTrack, getSpecialtyOptions } from "../config/baccalaureate";

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
    signupBirthDate,
    signupBacTrack,
    signupBacGrade,
    signupBacSpecialty,
    signupRole = "user",
    appIsAr,
    ensureMigratedAccounts,
    commitRecordVersion,
    setSignupError,
    setSignupSaving,
    setSignupPassword,
    setSignupPassword2,
    setSignupAvatar,
    setSignupGender,
    setSignupBirthDate,
    setSignupBacTrack,
    setSignupBacGrade,
    setSignupBacSpecialty,
    setSignupRole,
    setAccounts,
    setEntries,
    setLogs,
    setSiteBanner,
    setExamConfig,
    goToStage,
    socialDraft = null,
    setSocialDraft = null,
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
  const isSocialSignup = !!(socialDraft && socialDraft.provider && socialDraft.providerId);
  if (!isSocialSignup) {
    const pCheck = validatePassword(signupPassword);
    if (!pCheck.ok) {
      setSignupError(pCheck.error);
      return;
    }
    if (signupPassword !== signupPassword2) {
      setSignupError("Passwords do not match.");
      return;
    }
  }
  if (signupGender !== "male" && signupGender !== "female") {
    setSignupError("Please select Male or Female.");
    return;
  }

  const bCheck = validateBirthDate(signupBirthDate);
  if (!bCheck.ok) {
    setSignupError(bCheck.error);
    return;
  }

  const isTeacherSignup = signupRole === "teacher";
  let bacSpecialty = "";
  if (!isTeacherSignup) {
    const track = getBacTrack(signupBacTrack);
    if (!track) {
      setSignupError(appIsAr ? "اختَر مسار البكالوريا." : "Please select your baccalaureate track.");
      return;
    }
    if (signupBacGrade !== "2" && signupBacGrade !== "3") {
      setSignupError(appIsAr ? "اختَر الصف (ثاني أو ثالث ثانوي)." : "Please select your grade (2nd or 3rd secondary).");
      return;
    }
    if (signupBacGrade === "2") {
      const opts = getSpecialtyOptions(signupBacTrack);
      if (!opts.some((o) => o.id === signupBacSpecialty)) {
        setSignupError(appIsAr ? "اختَر المادة التخصصية." : "Please select your specialized subject.");
        return;
      }
      bacSpecialty = signupBacSpecialty;
    }
  }

  setSignupSaving(true);
  const code = generatePersonalCode();
  let passwordHash = "";
  if (!isSocialSignup) {
    try {
      passwordHash = await hashPassword(signupPassword, code);
    } catch (_) {
      setSignupSaving(false);
      setSignupError("Couldn't create the account — check your connection and try again.");
      return;
    }
  }

  const roleLabel = isTeacherSignup ? "teacher" : "user";
  const newAccount = {
    name: trimmedName,
    username: uCheck.username,
    ...(passwordHash ? { passwordHash } : {}),
    code,
    role: roleLabel,
    status: "pending",
    createdAt: Date.now(),
    ...(signupAvatar ? { avatar: signupAvatar } : {}),
    gender: signupGender,
    ...(bCheck.birthDate ? { birthDate: bCheck.birthDate } : {}),
    ...(isTeacherSignup
      ? {}
      : {
          bacTrack: signupBacTrack,
          bacGrade: signupBacGrade,
          ...(bacSpecialty ? { bacSpecialty } : {}),
        }),
    ...(isSocialSignup
      ? {
          authProvider: socialDraft.provider,
          socialId: socialDraft.providerId,
          email: socialDraft.email || "",
          ...(socialDraft.picture && !signupAvatar ? { avatar: socialDraft.picture } : {}),
        }
      : {}),
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
            `${trimmedName} (@${uCheck.username}) requested a ${roleLabel} account`,
            trimmedName,
            code
          ),
        ]);
        // كتابة جزئية: الحسابات فقط — لا نعيد إرسال القاموس عند التسجيل
        const newVersion = await saveAccountsOnly(
          { accounts: nextAccounts },
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
        if (typeof setSignupBirthDate === "function") setSignupBirthDate("");
        if (typeof setSignupBacTrack === "function") setSignupBacTrack("");
        if (typeof setSignupBacGrade === "function") setSignupBacGrade("");
        if (typeof setSignupBacSpecialty === "function") setSignupBacSpecialty("");
        if (typeof setSignupRole === "function") setSignupRole("user");
        if (typeof setSocialDraft === "function") setSocialDraft(null);
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
            `${trimmedName} (@${uCheck.username}) requested a ${roleLabel} account`,
            trimmedName,
            code
          ),
        ]);
        // كتابة جزئية: الحسابات فقط — لا نعيد إرسال القاموس عند التسجيل
        const newVersion = await saveAccountsOnly(
          { accounts: nextAccounts },
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
        if (typeof setSignupBirthDate === "function") setSignupBirthDate("");
        if (typeof setSignupBacTrack === "function") setSignupBacTrack("");
        if (typeof setSignupBacGrade === "function") setSignupBacGrade("");
        if (typeof setSignupBacSpecialty === "function") setSignupBacSpecialty("");
        if (typeof setSignupRole === "function") setSignupRole("user");
        if (typeof setSocialDraft === "function") setSocialDraft(null);
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
 * Shared "you're authenticated, now actually enter the app" tail — used by
 * both password login and social login so the two paths can't drift apart.
 * @param {object} account
 * @param {object} ctx
 */
function grantSession(account, ctx) {
  const {
    curAccounts,
    linkMode,
    setName,
    setIsAdmin,
    setIsTeacher,
    setAccountCode,
    setVaultAccounts,
    setLinkMode,
    setMainAccountCodeState,
    setPasswordInput,
    setLoggingIn,
    goToStage,
    persistAccounts,
    recordVersionRef,
    commitRecordVersion,
    setAccounts,
  } = ctx;

  setName(account.name);
  setIsAdmin(account.role === "admin" || account.role === "teacher");
  if (typeof setIsTeacher === "function") setIsTeacher(account.role === "teacher");
  setAccountCode(account.code);
  savePersonalCode(account.code);
  let linking = false;
  try {
    linking = sessionStorage.getItem("twoTongues.linkMode") === "1";
  } catch (_) {}
  const nextVault = upsertVaultAccount(account, {
    allowMulti: account.role === "admin" || account.role === "teacher" || linking || linkMode,
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

  if (typeof setPasswordInput === "function") setPasswordInput("");
  setLoggingIn(false);
  goToStage("in");

  // Background: session stamp (non-blocking)
  (async () => {
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
    setIsTeacher,
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

  if (shouldUpgradeHash) {
    const accountCodeToUpgrade = account.code;
    const upgradedAccounts = curAccounts;
    (async () => {
      try {
        const upgraded = upgradedAccounts.find((a) => a.code === accountCodeToUpgrade);
        // كتابة جزئية: تحديث هاش كلمة المرور للحساب فقط
        if (upgraded) {
          const newVersion = await patchAccountFields(
            accountCodeToUpgrade,
            {
              passwordHash: upgraded.passwordHash,
              passwordSalt: upgraded.passwordSalt,
              passwordAlgo: upgraded.passwordAlgo,
            },
            recordVersionRef.current
          );
          commitRecordVersion(newVersion);
        }
      } catch (_) {
        // Upgrade is best-effort; the plaintext-code fallback keeps working either way.
      }
    })();
  }

  grantSession(account, {
    curAccounts,
    linkMode,
    setName,
    setIsAdmin,
    setIsTeacher,
    setAccountCode,
    setVaultAccounts,
    setLinkMode,
    setMainAccountCodeState,
    setPasswordInput,
    setLoggingIn,
    goToStage,
    persistAccounts,
    recordVersionRef,
    commitRecordVersion,
    setAccounts,
  });
}

function usernameFromEmail(email, existingUsernames) {
  const local = String(email || "").split("@")[0] || "user";
  const base = local.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "user";
  let candidate = base;
  let n = 1;
  const taken = new Set(existingUsernames.map((u) => normalizeUsername(u)));
  while (taken.has(normalizeUsername(candidate))) {
    n += 1;
    candidate = `${base}${n}`;
  }
  return candidate;
}

/**
 * Google / Facebook sign-in. The ID token / access token has ALREADY been
 * verified server-side (see api/auth-google.js and api/auth-facebook.js) —
 * this function only ever receives a profile Claude — sorry, the app —
 * trusts because it came back from our own verify endpoint, never straight
 * from the client-side SDK callback.
 *
 * @param {object} p
 * @param {"google"|"facebook"} p.provider
 * @param {{ providerId: string, email: string, name: string, picture?: string }} p.profile
 */
export async function performSocialLogin(p) {
  const {
    provider,
    profile,
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
    setIsTeacher,
    setAccountCode,
    setVaultAccounts,
    linkMode,
    setLinkMode,
    setMainAccountCodeState,
    goToStage,
    persistAccounts,
  } = p;

  setAuthError("");
  setLoggingIn(true);

  if (!profile || !profile.email) {
    setLoggingIn(false);
    setAuthError(
      appIsAr
        ? "تعذّر قراءة بيانات الحساب من مزوّد الدخول. حاول مرة أخرى."
        : "Couldn't read your account details from the sign-in provider. Please try again."
    );
    return;
  }

  const email = String(profile.email).trim().toLowerCase();

  let rec;
  try {
    rec = await ensureMigratedAccounts(await fetchRecord({ fresh: true }));
  } catch (_) {
    setLoggingIn(false);
    setAuthError(
      appIsAr
        ? "تعذّر الاتصال — تحقق من الإنترنت وحاول مرة أخرى."
        : "Couldn't connect — check your connection and try again."
    );
    return;
  }

  const curAccounts = rec.accounts || [];
  setAccounts(curAccounts);
  setEntries(rec.entries);
  setLogs(rec.logs);
  setSiteBanner(rec.siteBanner || null);
  setExamConfig(normalizeExamConfig(rec.examConfig));
  commitRecordVersion(rec.version);

  // Match only by active social binding — orphaned emails after unlink must not block reuse
  const existing = curAccounts.find(
    (a) =>
      a &&
      ((a.authProvider === provider && a.socialId === profile.providerId) ||
        (a.authProvider === provider &&
          a.email &&
          String(a.email).toLowerCase() === email &&
          a.socialId))
  );

  if (existing) {
    if (existing.status === "pending") {
      setLoggingIn(false);
      setAuthError(
        appIsAr
          ? "حسابك لسه مستني موافقة المسؤول."
          : "Your account is still waiting for admin approval."
      );
      return;
    }
    if (existing.status === "rejected") {
      setLoggingIn(false);
      setAuthError(appIsAr ? "تم رفض طلب حسابك. تواصل مع المسؤول." : "Your account request was declined. Contact an admin.");
      return;
    }
    if (existing.status === "blocked") {
      setLoggingIn(false);
      setAuthError(appIsAr ? "تم حظر حسابك. تواصل مع المسؤول." : "Your account is blocked. Contact an admin.");
      return;
    }
    // Link the provider onto the account the first time it's used, so
    // repeat sign-ins match on socialId even if the email ever changes.
    const linkedAccounts = existing.authProvider
      ? curAccounts
      : curAccounts.map((a) =>
          a.code === existing.code ? { ...a, authProvider: provider, socialId: profile.providerId } : a
        );
    grantSession(existing.authProvider ? existing : { ...existing, authProvider: provider, socialId: profile.providerId }, {
      curAccounts: linkedAccounts,
      linkMode,
      setName,
      setIsAdmin,
      setIsTeacher,
      setAccountCode,
      setVaultAccounts,
      setLinkMode,
      setMainAccountCodeState,
      setPasswordInput: null,
      setLoggingIn,
      goToStage,
      persistAccounts,
      recordVersionRef: { current: rec.version },
      commitRecordVersion,
      setAccounts,
    });
    return;
  }

  // First time — prefill signup form from Google profile and ask user to
  // complete remaining required fields (gender, birth date, bac path, etc.).
  // Account is created only after they submit the signup form.
  setLoggingIn(false);
  const username = usernameFromEmail(email, curAccounts.map((a) => a.username));
  const displayName = (profile.name || email.split("@")[0] || "").trim();
  if (typeof p.setName === "function") p.setName(displayName);
  if (typeof p.setSignupUsername === "function") p.setSignupUsername(username);
  if (typeof p.setSignupAvatar === "function" && profile.picture) {
    p.setSignupAvatar(profile.picture);
  }
  if (typeof p.setSocialDraft === "function") {
    p.setSocialDraft({
      provider,
      providerId: profile.providerId,
      email,
      name: displayName,
      picture: profile.picture || "",
    });
  }
  if (typeof p.setSignupError === "function") {
    p.setSignupError(
      appIsAr
        ? "أكمل البيانات المطلوبة لإتمام طلب الحساب (الجنس، تاريخ الميلاد، مسار البكالوريا…)."
        : "Complete the required fields to finish your account request (gender, date of birth, baccalaureate track…)."
    );
  }
  // Dedicated step for missing profile fields only (not full signup form)
  goToStage("completeProfile");
}


/**
 * Link a verified Google profile to the currently signed-in account.
 * Must only be called after /api/auth-google (or /api/auth?provider=google)
 * has returned ok:true — never trust client-side SDK fields alone.
 *
 * @param {object} p
 * @param {{ providerId: string, email: string, name?: string, picture?: string }} p.profile
 * @param {string} p.accountCode
 * @param {object[]} p.accounts
 * @param {function} p.setAccounts
 * @param {function} p.persistAccounts  (accountsFn, logEntryFn?) => Promise
 * @param {boolean} [p.appIsAr]
 * @returns {Promise<{ ok: true, account: object } | { ok: false, error: string }>}
 */
export async function linkGoogleToCurrentAccount(p) {
  const {
    profile,
    accountCode,
    accounts,
    setAccounts,
    persistAccounts,
    appIsAr = false,
  } = p;

  if (!profile || !profile.providerId) {
    return {
      ok: false,
      error: appIsAr
        ? "تعذّر قراءة بيانات Google. حاول مرة أخرى."
        : "Couldn't read Google account details. Please try again.",
    };
  }
  if (!accountCode || accountCode === "guest") {
    return {
      ok: false,
      error: appIsAr
        ? "يجب تسجيل الدخول أولاً لربط Google."
        : "You must be signed in to link Google.",
    };
  }

  const providerId = String(profile.providerId);
  const email = profile.email ? String(profile.email).trim().toLowerCase() : "";

  const list = Array.isArray(accounts) ? accounts : [];
  const current = list.find((a) => a && a.code === accountCode);
  if (!current) {
    return {
      ok: false,
      error: appIsAr ? "الحساب الحالي غير موجود." : "Current account not found.",
    };
  }
  if (current.status && current.status !== "active") {
    return {
      ok: false,
      error: appIsAr
        ? "يمكن ربط Google للحسابات المفعّلة فقط."
        : "Only active accounts can link Google.",
    };
  }

  // Already linked to this same Google identity
  if (current.authProvider === "google" && current.socialId === providerId) {
    return { ok: true, account: current, alreadyLinked: true };
  }

  // Conflict: this Google identity belongs to another account
  const clash = list.find(
    (a) =>
      a &&
      a.code !== accountCode &&
      a.authProvider === "google" &&
      a.socialId === providerId
  );
  if (clash) {
    return {
      ok: false,
      error: appIsAr
        ? "حساب Google ده مربوط بحساب تاني في الموقع."
        : "This Google account is already linked to a different user.",
    };
  }

  // Email clash only if another account STILL has Google bound with that email
  if (email) {
    const emailClash = list.find(
      (a) =>
        a &&
        a.code !== accountCode &&
        a.authProvider === "google" &&
        a.socialId &&
        a.email &&
        String(a.email).toLowerCase() === email
    );
    if (emailClash) {
      return {
        ok: false,
        error: appIsAr
          ? "البريد الإلكتروني لـ Google مستخدم في حساب آخر مربوط بـ Google."
          : "This Google email is already linked to another account.",
      };
    }
  }

  const updated = {
    ...current,
    authProvider: "google",
    socialId: providerId,
    // Bind Google email to this account on link
    ...(email ? { email } : {}),
    // Apply Google profile picture to the local account on link (user can change later)
    ...(profile.picture ? { avatar: profile.picture } : {}),
  };

  try {
    await persistAccounts(
      (cur) =>
        (cur || []).map((a) => (a.code === accountCode ? { ...a, ...updated } : a)),
      () =>
        makeLogEntry(
          "account_link_google",
          `${updated.name || updated.username} linked Google (${email || providerId})`,
          updated.name || updated.username,
          accountCode
        )
    );
    if (typeof setAccounts === "function") {
      // persistAccounts already updates state optimistically
    }
    return { ok: true, account: updated };
  } catch (e) {
    return {
      ok: false,
      error: appIsAr
        ? "تعذّر حفظ الربط. حاول مرة أخرى."
        : "Couldn't save the link. Please try again.",
    };
  }
}

/**
 * Unlink Google from the current account.
 * Requires a password (or another non-social login) so the user is not locked out.
 *
 * @param {object} p
 * @param {string} p.accountCode
 * @param {object[]} p.accounts
 * @param {function} p.persistAccounts
 * @param {boolean} [p.appIsAr]
 */
export async function unlinkGoogleFromCurrentAccount(p) {
  const { accountCode, accounts, persistAccounts, appIsAr = false } = p;

  if (!accountCode || accountCode === "guest") {
    return {
      ok: false,
      error: appIsAr ? "يجب تسجيل الدخول أولاً." : "You must be signed in.",
    };
  }

  const list = Array.isArray(accounts) ? accounts : [];
  const current = list.find((a) => a && a.code === accountCode);
  if (!current) {
    return { ok: false, error: appIsAr ? "الحساب غير موجود." : "Account not found." };
  }

  if (current.authProvider !== "google" && !current.socialId) {
    return { ok: true, account: current, alreadyUnlinked: true };
  }

  // Prevent lock-out: must have a password hash to sign in without Google
  if (!current.passwordHash) {
    return {
      ok: false,
      error: appIsAr
        ? "ضع كلمة مرور للحساب قبل إلغاء ربط Google."
        : "Set a password on this account before unlinking Google.",
    };
  }

  try {
    // null (not omitted keys) so server-side merge deletes the fields permanently
    await persistAccounts(
      (cur) =>
        (cur || []).map((a) => {
          if (a.code !== accountCode) return a;
          const next = {
            ...a,
            authProvider: null,
            socialId: null,
            email: null,
          };
          return next;
        }),
      () =>
        makeLogEntry(
          "account_unlink_google",
          `${current.name || current.username} unlinked Google (email released)`,
          current.name || current.username,
          accountCode
        )
    );
    return { ok: true };
  } catch (_) {
    return {
      ok: false,
      error: appIsAr
        ? "تعذّر إلغاء الربط. حاول مرة أخرى."
        : "Couldn't unlink Google. Please try again.",
    };
  }
}
