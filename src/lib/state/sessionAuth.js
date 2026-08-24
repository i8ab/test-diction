/**
 * Client session token storage + issuance helper.
 *
 * After ~12h the token expires. We do NOT force a full logout of the study app:
 * the user can keep using the dictionary. Privileged admin actions that need a
 * valid token will ask them to sign in again.
 */

const TOKEN_KEY = "twoTongues.sessionToken";
const EXPIRES_KEY = "twoTongues.sessionTokenExp";
const EXPIRED_FLAG = "twoTongues.sessionTokenExpired";

export function loadSessionToken() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const exp = Number(localStorage.getItem(EXPIRES_KEY) || 0);
    if (!token) return null;
    if (exp && Date.now() > exp) {
      // Expired — clear token and remember so UI can prompt on admin actions.
      clearSessionToken({ markExpired: true });
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

/**
 * @returns {"valid"|"expired"|"missing"}
 */
export function getSessionStatus() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const exp = Number(localStorage.getItem(EXPIRES_KEY) || 0);
    if (token && exp && Date.now() > exp) {
      clearSessionToken({ markExpired: true });
      return "expired";
    }
    if (token) return "valid";
    if (localStorage.getItem(EXPIRED_FLAG) === "1") return "expired";
    return "missing";
  } catch {
    return "missing";
  }
}

export function saveSessionToken(token, expiresAt) {
  try {
    if (!token) {
      clearSessionToken();
      return;
    }
    localStorage.setItem(TOKEN_KEY, String(token));
    if (expiresAt) localStorage.setItem(EXPIRES_KEY, String(expiresAt));
    localStorage.removeItem(EXPIRED_FLAG);
    try {
      window.dispatchEvent(new CustomEvent("bacaloria:session", { detail: { status: "valid" } }));
    } catch (_) {}
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * @param {{ markExpired?: boolean }} [opts]
 */
export function clearSessionToken(opts = {}) {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    if (opts.markExpired) {
      localStorage.setItem(EXPIRED_FLAG, "1");
      try {
        window.dispatchEvent(
          new CustomEvent("bacaloria:session", { detail: { status: "expired" } })
        );
      } catch (_) {}
    } else {
      localStorage.removeItem(EXPIRED_FLAG);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Ask the server for a short-lived session token after password login.
 * Best-effort: failures must not block sign-in.
 *
 * @param {{ code: string, passwordHash: string }} creds
 */
export async function requestSessionToken(creds) {
  const code = creds?.code;
  const passwordHash = creds?.passwordHash;
  if (!code || !passwordHash) return null;
  try {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, passwordHash }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data?.ok || !data.token) return null;
    saveSessionToken(data.token, data.expiresAt);
    return data.token;
  } catch {
    return null;
  }
}

/** Headers fragment for cloud writes when a token is available. */
export function authHeaders() {
  const token = loadSessionToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/**
 * Human-readable hint when an admin action needs a fresh login.
 */
export function sessionExpiredMessage(isAr) {
  return isAr
    ? "انتهت صلاحية الجلسة الأمنية (١٢ ساعة). سجّل دخولك مرة أخرى عشان تكمل الإجراء ده."
    : "Your secure session expired (12 hours). Sign in again to continue this action.";
}
