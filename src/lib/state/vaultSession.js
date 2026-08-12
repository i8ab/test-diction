/**
 * Multi-account vault session helpers (switch / link / unlink / logout).
 * Callers pass React setters so behavior stays identical.
 */
import {
  loadAccountVault,
  removeVaultAccount,
  clearAccountVault,
  getMainAccountCode,
  setMainAccountCode,
  clearPersonalCode,
  savePersonalCode,
} from "./storage";

export function switchToVaultAccount({
  code,
  accountCode,
  isAdmin,
  accounts,
  setAccountCode,
  setName,
  setIsAdmin,
  setShowAccount,
  setShowAdmin,
  setShowAdd,
}) {
  if (!code || code === accountCode) return { ok: true };
  const vault = loadAccountVault();
  const entry = vault.find((a) => a.code === code);
  if (!entry) return { ok: false, error: "Account not saved on this device." };

  setAccountCode(entry.code);
  setName(entry.name || "");
  setIsAdmin(entry.role === "admin");
  savePersonalCode(entry.code);
  setShowAccount(false);
  setShowAdmin(false);
  setShowAdd(false);

  const live = (accounts || []).find((a) => a.code === entry.code);
  if (live) {
    setName(live.name || entry.name || "");
    setIsAdmin(live.role === "admin");
  }
  return { ok: true };
}

export function beginLinkAccount({
  isAdmin,
  setLinkMode,
  setAccountCode,
  setName,
  setUsernameInput,
  setPasswordInput,
  setAuthError,
  setShowAdd,
  setShowAccount,
  setShowAdmin,
  goToStage,
}) {
  if (!isAdmin) return;
  try {
    sessionStorage.setItem("twoTongues.linkMode", "1");
  } catch (_) {}
  setLinkMode(true);
  clearPersonalCode();
  try {
    localStorage.removeItem("twoTongues.sessionId");
  } catch (_) {}
  setAccountCode("");
  setName("");
  setUsernameInput("");
  setPasswordInput("");
  setAuthError("");
  setShowAdd(false);
  setShowAccount(false);
  setShowAdmin(false);
  goToStage("login");
}

export function cancelLinkAccount({
  setLinkMode,
  setAuthStage,
  switchToVaultAccountFn,
  goToStage,
}) {
  try {
    sessionStorage.removeItem("twoTongues.linkMode");
  } catch (_) {}
  setLinkMode(false);
  const main = getMainAccountCode() || (loadAccountVault()[0] && loadAccountVault()[0].code);
  if (main) {
    const r = switchToVaultAccountFn(main);
    if (r && r.ok) {
      setAuthStage("in");
      return;
    }
  }
  goToStage("login");
}

export function markMainAccount({ code, isAdmin, setMainAccountCodeState }) {
  if (!isAdmin) return { ok: false, error: "Only admins can set a main account." };
  if (!code) return { ok: false };
  const vault = loadAccountVault();
  if (!vault.some((a) => a.code === code)) return { ok: false, error: "Account not in vault." };
  setMainAccountCode(code);
  setMainAccountCodeState(code);
  return { ok: true };
}

export function unlinkVaultAccountFn({
  code,
  isAdmin,
  accountCode,
  setVaultAccounts,
  setMainAccountCodeState,
  handleLogout,
  switchToVaultAccountFn,
}) {
  if (!code) return;
  if (!isAdmin) {
    handleLogout({ clearVault: true });
    return;
  }
  const next = removeVaultAccount(code);
  setVaultAccounts(next);
  setMainAccountCodeState(getMainAccountCode());
  if (code === accountCode) {
    const main = getMainAccountCode();
    if (main && main !== code) switchToVaultAccountFn(main);
    else handleLogout({ clearVault: false });
  }
}

export function performLogout({
  opts = {},
  accountCode,
  isAdmin,
  name,
  logEvent,
  setVaultAccounts,
  setMainAccountCodeState,
  setName,
  setIsAdmin,
  setAccountCode,
  setUsernameInput,
  setPasswordInput,
  setAuthError,
  setShowAdd,
  setShowAccount,
  setShowAdmin,
  goToStage,
}) {
  const clearVault = !!opts.clearVault;
  if (accountCode && !isAdmin) {
    logEvent("sign_out", `${name} signed out`, name, accountCode);
  }
  clearPersonalCode();
  try {
    localStorage.removeItem("twoTongues.sessionId");
  } catch (_) {}
  if (clearVault) {
    clearAccountVault();
    setVaultAccounts([]);
    setMainAccountCodeState("");
  }
  setName("");
  setIsAdmin(false);
  setAccountCode("");
  setUsernameInput("");
  setPasswordInput("");
  setAuthError("");
  setShowAdd(false);
  setShowAccount(false);
  setShowAdmin(false);
  goToStage("login");
}
