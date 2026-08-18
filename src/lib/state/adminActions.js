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

/**
 * Current user updates their own profile (name / password / avatar / gender / birthDate / bac path).
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
}) {
  const trimmed = (newName || "").trim();
  if (!trimmed) return { error: "Enter your name." };
  const updates = { name: trimmed };
  if (typeof nextAvatar === "string") {
    updates.avatar = nextAvatar.slice(0, 400000);
  }
  if (nextGender === "male" || nextGender === "female") {
    updates.gender = nextGender;
  } else if (nextGender === "") {
    updates.gender = "";
  }
  if (typeof nextBirthDate === "string") {
    const bCheck = validateBirthDate(nextBirthDate);
    if (!bCheck.ok) return { error: bCheck.error };
    updates.birthDate = bCheck.birthDate || "";
  }
  // Baccalaureate path (stored on the account; private — not shown in public lists)
  if (nextBacTrack !== undefined) {
    updates.bacTrack = typeof nextBacTrack === "string" ? nextBacTrack : "";
  }
  if (nextBacGrade !== undefined) {
    updates.bacGrade = nextBacGrade === "2" || nextBacGrade === "3" ? nextBacGrade : "";
  }
  if (nextBacSpecialty !== undefined) {
    updates.bacSpecialty = typeof nextBacSpecialty === "string" ? nextBacSpecialty : "";
  }
  if (updates.bacGrade !== "2") {
    updates.bacSpecialty = "";
  }
  if (newPassword) {
    const pCheck = validatePassword(newPassword);
    if (!pCheck.ok) return { error: pCheck.error };
    updates.passwordHash = await hashPassword(pCheck.password, accountCode);
  }
  const oldName = name;
  const nextAccounts = accounts.map((a) =>
    a.code === accountCode ? { ...a, ...updates } : a
  );
  const logEntry = makeLogEntry(
    "account_edit",
    newPassword
      ? `${oldName} updated their account (name/password)`
      : `${oldName} renamed their own account to "${trimmed}"`,
    trimmed,
    accountCode
  );
  try {
    await persistAccounts(nextAccounts, logEntry);
  } catch (_) {
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
}) {
  const trimmed = (newName || "").trim();
  if (!trimmed) return { error: "Enter a name." };
  const uCheck = validateUsername(username || "");
  if (!uCheck.ok) return { error: uCheck.error };
  if (accounts.some((a) => normalizeUsername(a.username) === uCheck.username)) {
    return { error: "That username is already taken." };
  }
  const code = generatePersonalCode();
  const nextRole = role === "admin" ? "admin" : "user";
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
    `${name} added account "${trimmed}" (@${uCheck.username}, ${nextRole === "admin" ? "Admin" : "User"})`,
    name,
    accountCode
  );
  await persistAccounts(nextAccounts, logEntry);
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
}) {
  const trimmedName = (updates.name || "").trim();
  if (!trimmedName) return { error: "Enter a name." };
  const nextRole = updates.role === "admin" ? "admin" : "user";
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
    `${name} edited account "${(target && target.name) || targetCode}" → name: "${trimmedName}", role: ${nextRole === "admin" ? "Admin" : "User"}, access: ${nextStatus}`,
    name,
    accountCode
  );
  await persistAccounts(nextAccounts, logEntry);
  if (targetCode === accountCode) {
    setName(trimmedName);
    setIsAdmin(nextRole === "admin");
  }
  return { ok: true };
}
