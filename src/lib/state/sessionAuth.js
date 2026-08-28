/**
 * Session auth — DISABLED.
 * All session token logic has been removed per project requirements.
 * Writes no longer require (or send) a Bearer token.
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

/** Always empty — no Authorization header is sent. */
export function authHeaders() {
  return {};
}

/**
 * Kept for call-site compatibility; should never surface after session removal.
 */
export function sessionExpiredMessage(isAr) {
  return isAr
    ? "انتهت صلاحية الجلسة. سجّل دخولك مرة أخرى."
    : "Session expired. Sign in again.";
}

/** No longer issues tokens. */
export async function ensureSessionToken(_opts = {}) {
  return null;
}
