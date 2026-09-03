/**
 * Account self-edit and admin add/edit helpers.
 * Approve / reject / delete stay in App.jsx (heavy use of save refs + retries).
 */
import {
  validateUsername,
  validatePassword,
  validateBirthDate,
  hashPassword,
  normalizeUsername,
} from "../utils/authUtils";
import { generatePersonalCode } from "./storage";
import { makeLogEntry } from "./logs";
import { apiErrorMessage } from "../utils/apiErrorMessage";

/**
 * Current user updates their own profile.
 * Only fields that actually changed are sent (accountPatch) — not the whole
 * account list and not unrelated fields.
 */
export async function updateOwnAccount({
  newName,
  newPassword,
  nextAvatar,
  nextGender,
  nextBirthDate,
  nextBacTrack,
  nextBacGrade,
  nextBacSpecialty,
  accountCode,
  name,
  accounts,
  appIsAr,
  persistAccounts,
  setName,
  showToast,
  setAccounts,
  recordVersionRef,
  commitRecordVersion,
  patchAccountFields,
}) {
  const trimmed = (newName || "").trim();
  if (!trimmed) return { error: "Enter your name." };

  const current = (accounts || []).find((a) => a && a.code === accountCode) || {};
  const patch = {};

  if (trimmed !== (current.name || "")) patch.name = trimmed;

  if (typeof nextAvatar === "string" && nextAvatar !== (current.avatar || "")) {
    patch.avatar = nextAvatar.slice(0, 400000);
  }
  if (nextGender === "male" || nextGender === "female" || nextGender === "") {
    if (nextGender !== (current.gender || "")) patch.gender = nextGender;
  }
  if (typeof nextBirthDate === "string") {
    const bCheck = validateBirthDate(nextBirthDate);
    if (!bCheck.ok) return { error: bCheck.error };
    const bd = bCheck.birthDate || "";
    if (bd !== (current.birthDate || "")) patch.birthDate = bd;
  }
  if (nextBacTrack !== undefined) {
    const v = typeof nextBacTrack === "string" ? nextBacTrack : "";
    if (v !== (current.bacTrack || "")) patch.bacTrack = v;
  }
  if (nextBacGrade !== undefined) {
    const v = nextBacGrade === "2" || nextBacGrade === "3" ? nextBacGrade : "";
    if (v !== (current.bacGrade || "")) patch.bacGrade = v;
  }
  if (nextBacSpecialty !== undefined || patch.bacGrade !== undefined) {
    const grade = patch.bacGrade !== undefined ? patch.bacGrade : current.bacGrade;
    const v =
      grade === "2"
        ? typeof nextBacSpecialty === "string"
          ? nextBacSpecialty
          : current.bacSpecialty || ""
        : "";
    if (v !== (current.bacSpecialty || "")) patch.bacSpecialty = v;
  }
  if (newPassword) {
    const pCheck = validatePassword(newPassword);
    if (!pCheck.ok) return { error: pCheck.error };
    patch.passwordHash = await hashPassword(pCheck.password, accountCode);
  }

  if (!Object.keys(patch).length) {
    showToast(appIsAr ? "مفيش تغييرات." : "No changes to save.");
    return { ok: true };
  }

  const oldName = name;
  const nextAccounts = accounts.map((a) =>
    a.code === accountCode ? { ...a, ...patch } : a
  );
  // Optimistic UI
  if (typeof setAccounts === "function") setAccounts(nextAccounts);

  try {
    if (typeof patchAccountFields === "function" && recordVersionRef && commitRecordVersion) {
      const { version } = await patchAccountFields(
        accountCode,
        patch,
        recordVersionRef.current || 0
      );
      commitRecordVersion(version);
    } else {
      // Fallback: accounts-only full list path
      const logEntry = makeLogEntry(
        "account_edit",
        newPassword
          ? `${oldName} updated their account (name/password)`
          : `${oldName} updated their account`,
        trimmed,
        accountCode
      );
      await persistAccounts(nextAccounts, logEntry);
    }
  } catch (_) {
    if (typeof setAccounts === "function") setAccounts(accounts);
    return {
      error: appIsAr
        ? "تعذّر حفظ التغييرات — حاول مرة أخرى."
        : "Couldn't save changes — try again.",
    };
  }
  setName(trimmed);
  showToast(appIsAr ? "تم تحديث الحساب." : "Account info updated.");
  return { ok: true };
}

/** Admin creates an active account (password defaults to personal code). */
export async function adminAddAccount({
  newName,
  role,
  username,
  name,
  accountCode,
  accounts,
  persistAccounts,
  appIsAr = false,
  showToast,
}) {
  const trimmed = (newName || "").trim();
  if (!trimmed) return { error: "Enter a name." };
  const uCheck = validateUsername(username || "");
  if (!uCheck.ok) return { error: uCheck.error };
  if (accounts.some((a) => normalizeUsername(a.username) === uCheck.username)) {
    return { error: "That username is already taken." };
  }
  const code = generatePersonalCode();
  const nextRole = role === "admin" ? "admin" : role === "teacher" ? "teacher" : "user";
  const roleLabel = nextRole === "admin" ? "Admin" : nextRole === "teacher" ? "Teacher" : "User";
  const passwordHash = await hashPassword(code, code);
  const nextAccounts = [
    ...accounts,
    {
      name: trimmed,
      username: uCheck.username,
      passwordHash,
      code,
      role: nextRole,
      status: "active",
      createdAt: Date.now(),
    },
  ];
  const logEntry = makeLogEntry(
    "account_add",
    `${name} added account "${trimmed}" (@${uCheck.username}, ${roleLabel})`,
    name,
    accountCode
  );
  try {
    await persistAccounts(nextAccounts, logEntry);
  } catch (err) {
    const msg = apiErrorMessage(err, appIsAr);
    if (typeof showToast === "function") showToast(msg);
    return { error: msg };
  }
  return { ok: true, code, username: uCheck.username };
}

/** Admin edits name / role / username / blocked status. */
export async function adminEditAccount({
  targetCode,
  updates,
  name,
  accountCode,
  accounts,
  appIsAr,
  persistAccounts,
  setName,
  setIsAdmin,
  showToast,
}) {
  const trimmedName = (updates.name || "").trim();
  if (!trimmedName) return { error: "Enter a name." };
  const nextRole =
    updates.role === "admin" ? "admin" : updates.role === "teacher" ? "teacher" : "user";
  const roleLabel = nextRole === "admin" ? "Admin" : nextRole === "teacher" ? "Teacher" : "User";
  let nextUsername;
  if (updates.username != null) {
    const uCheck = validateUsername(updates.username);
    if (!uCheck.ok) return { error: uCheck.error };
    if (
      accounts.some(
        (a) => a.code !== targetCode && normalizeUsername(a.username) === uCheck.username
      )
    ) {
      return { error: "That username is already taken." };
    }
    nextUsername = uCheck.username;
  }
  const target = accounts.find((a) => a.code === targetCode);
  let nextStatus =
    target && target.status === "pending"
      ? "active"
      : (target && target.status) || "active";
  if (updates.status === "blocked" || updates.status === "active") {
    nextStatus = updates.status;
  }
  if (targetCode === accountCode && nextStatus === "blocked") {
    return {
      error: appIsAr ? "لا يمكنك حظر حسابك أنت." : "You cannot block your own account.",
    };
  }
  const nextAccounts = accounts.map((a) => {
    if (a.code !== targetCode) return a;
    const patch = {
      name: trimmedName,
      role: nextRole,
      status: nextStatus,
    };
    if (nextUsername) patch.username = nextUsername;
    return { ...a, ...patch };
  });
  const logEntry = makeLogEntry(
    "account_edit",
    `${name} edited account "${(target && target.name) || targetCode}" → name: "${trimmedName}", role: ${roleLabel}, access: ${nextStatus}`,
    name,
    accountCode
  );
  try {
    await persistAccounts(nextAccounts, logEntry);
  } catch (err) {
    const msg = apiErrorMessage(err, appIsAr);
    if (typeof showToast === "function") showToast(msg);
    return { error: msg };
  }
  if (targetCode === accountCode) {
    setName(trimmedName);
    setIsAdmin(nextRole === "admin" || nextRole === "teacher");
  }
  return { ok: true };
}

/** Normalize role string for display / storage */
export function normalizeRole(role) {
  if (role === "admin") return "admin";
  if (role === "teacher") return "teacher";
  return "user";
}
