/**
 * Session tokens — DISABLED.
 * All JWT/session verification removed. Privileged ops no longer require a token.
 */

export function getSessionSecret() {
  return null;
}

export function signSession(_claims, _ttlSec) {
  return null;
}

export function verifySession(_token) {
  return { ok: false, error: "sessions_disabled" };
}

export function bearerFromReq(_req) {
  return null;
}
