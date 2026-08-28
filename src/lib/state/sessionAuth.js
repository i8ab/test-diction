/**
 * Session auth — DISABLED.
 * All session token logic has been removed. Exports kept as no-ops
 * so existing imports (authFlow, vaultSession, cloudApi, …) still build.
 */

export function loadSessionToken() {
  return null;
}

export function getSessionStatus() {
  return "missing";
}

export function saveSessionToken(_token, _expiresAt) {
  /* no-op */
}

export function clearSessionToken(_opts = {}) {
  /* no-op */
}

/**
 * Previously issued a short-lived admin/teacher token after login.
 * Now a no-op that resolves to null.
 */
export async function requestSessionToken(_creds) {
  return null;
}

/** Always empty — no Authorization header is sent. */
export function authHeaders() {
  return {};
}

/** Kept for call-site compatibility only. */
export function sessionExpiredMessage(isAr) {
  return isAr
    ? "انتهت صلاحية الجلسة. سجّل دخولك مرة أخرى."
    : "Session expired. Sign in again.";
}
