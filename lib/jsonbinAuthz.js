/**
 * Server-side ownership / authorization for /api/jsonbin writes.
 * No JWT — actor is identified by body.actorCode and loaded from DB.
 * Role and status always come from the stored account record.
 */

/**
 * @param {object|null} account - account data from DB
 * @returns {boolean}
 */
export function isStaff(account) {
  if (!account || typeof account !== "object") return false;
  const role = String(account.role || "").toLowerCase();
  if (role === "admin" || role === "teacher") return true;
  if (account.isAdmin === true) return true;
  return false;
}

/**
 * Active (or staff) accounts may write. Blocked cannot. Pending cannot write
 * privileged paths; signup uses the public accounts-merge path instead.
 * @param {object|null} account
 */
export function canAct(account) {
  if (!account || typeof account !== "object") return false;
  const st = String(account.status || "").toLowerCase();
  if (st === "blocked") return false;
  if (st === "active") return true;
  // Staff flagged active elsewhere; treat missing status as active for legacy rows
  if (!st && isStaff(account)) return true;
  if (!st) return true;
  return false;
}

/**
 * Standard 403 body.
 * @param {string} message
 */
export function forbiddenPayload(message) {
  return {
    ok: false,
    error: "forbidden",
    message: message || "You are not allowed to perform this action.",
  };
}

/**
 * Standard 400 body.
 */
export function badRequestPayload(message, error = "bad_request") {
  return {
    ok: false,
    error,
    message: message || "Invalid request.",
  };
}

/**
 * Standard 404 body.
 */
export function notFoundPayload(message) {
  return {
    ok: false,
    error: "not_found",
    message: message || "Not found.",
  };
}

/**
 * Resolve actor from body.actorCode using the provided loader.
 * @param {object} body
 * @param {(code: string) => Promise<object|null>} loadOneAccount
 */
export async function resolveActor(body, loadOneAccount) {
  const code = String(
    (body && (body.actorCode || body.actor_code)) || ""
  ).trim();
  if (!code) return { actor: null, actorCode: "" };
  const actor = await loadOneAccount(code);
  return { actor, actorCode: code };
}

/**
 * Authorization decision for a write scope.
 * @returns {{ ok: true, actor: object|null, actorCode: string, staff: boolean }
 *   | { ok: false, status: number, payload: object }}
 */
export async function authorizeWrite(scope, body, loadOneAccount) {
  const scoped = String(scope || "").toLowerCase();
  const { actor, actorCode } = await resolveActor(body, loadOneAccount);
  const staff = isStaff(actor) && canAct(actor);

  // Privileged staff-only scopes
  if (
    scoped === "accountstatus" ||
    scoped === "accountdelete" ||
    scoped === "settingspatch" ||
    scoped === "logsreplace"
  ) {
    if (!staff) {
      return {
        ok: false,
        status: 403,
        payload: forbiddenPayload(
          "Admin or teacher account required for this action."
        ),
      };
    }
    return { ok: true, actor, actorCode, staff: true };
  }

  // accountPatch: own account OR staff
  if (scoped === "accountpatch") {
    const target = String((body && body.code) || "").trim();
    if (!actorCode || !actor || !canAct(actor)) {
      return {
        ok: false,
        status: 403,
        payload: forbiddenPayload(
          "Sign in required to update an account."
        ),
      };
    }
    if (staff) return { ok: true, actor, actorCode, staff: true };
    if (target && target === actorCode) {
      return { ok: true, actor, actorCode, staff: false };
    }
    return {
      ok: false,
      status: 403,
      payload: forbiddenPayload("You can only update your own account."),
    };
  }

  // Dictionary mutations: any active signed-in user (or staff)
  if (scoped === "entrypatch" || scoped === "entrydelete") {
    if (!actor || !canAct(actor)) {
      return {
        ok: false,
        status: 403,
        payload: forbiddenPayload(
          "Sign in required to change dictionary entries."
        ),
      };
    }
    return { ok: true, actor, actorCode, staff };
  }

  // accounts bulk: staff full power; public path only for signup-style merges
  if (scoped === "accounts") {
    const removeCodes = Array.isArray(body.removeAccountCodes)
      ? body.removeAccountCodes
      : [];
    const approveCodes = Array.isArray(body.approveAccountCodes)
      ? body.approveAccountCodes
      : [];
    if (removeCodes.length || approveCodes.length) {
      if (!staff) {
        return {
          ok: false,
          status: 403,
          payload: forbiddenPayload(
            "Admin or teacher required to approve or remove accounts."
          ),
        };
      }
      return { ok: true, actor, actorCode, staff: true };
    }
    if (staff) return { ok: true, actor, actorCode, staff: true };
    // Public / signup path — allowed; server will sanitize privileges below.
    return { ok: true, actor, actorCode, staff: false, publicAccounts: true };
  }

  // Full/legacy record write — staff only (dangerous bulk path)
  if (!scoped || scoped === "full") {
    if (!staff) {
      return {
        ok: false,
        status: 403,
        payload: forbiddenPayload(
          "Admin or teacher required for full record save. Use scoped writes."
        ),
      };
    }
    return { ok: true, actor, actorCode, staff: true };
  }

  // Unknown scope: deny by default
  return {
    ok: false,
    status: 403,
    payload: forbiddenPayload("Unknown or unauthorized write scope."),
  };
}

/**
 * For non-staff accounts bulk writes: force safe roles/status on new rows
 * and lock privilege fields on existing rows to the DB values.
 * @param {object[]} nextIncoming - accounts from client
 * @param {object[]} currentAccounts - accounts from DB
 * @returns {object[]} sanitized list to merge
 */
export function sanitizePublicAccountsMerge(nextIncoming, currentAccounts) {
  const existing = new Map(
    (currentAccounts || [])
      .filter((a) => a && a.code)
      .map((a) => [String(a.code), a])
  );
  const out = [];
  for (const a of Array.isArray(nextIncoming) ? nextIncoming : []) {
    if (!a || !a.code) continue;
    const key = String(a.code);
    const prev = existing.get(key);
    if (prev) {
      // Non-staff cannot change role / isAdmin / status of existing accounts
      out.push({
        ...prev,
        // allow soft profile fields from incoming if same identity retry
        name: a.name != null ? a.name : prev.name,
        username: a.username != null ? a.username : prev.username,
        passwordHash:
          a.passwordHash != null ? a.passwordHash : prev.passwordHash,
        birthDate: a.birthDate != null ? a.birthDate : prev.birthDate,
        path: a.path != null ? a.path : prev.path,
        gender: a.gender != null ? a.gender : prev.gender,
        avatar: a.avatar != null ? a.avatar : prev.avatar,
        authProvider:
          a.authProvider !== undefined ? a.authProvider : prev.authProvider,
        socialId: a.socialId !== undefined ? a.socialId : prev.socialId,
        email: a.email !== undefined ? a.email : prev.email,
        role: prev.role,
        isAdmin: prev.isAdmin,
        status: prev.status,
        code: prev.code,
      });
    } else {
      // New account (signup): never staff, always pending
      out.push({
        ...a,
        code: key,
        role: "user",
        isAdmin: false,
        status: a.status === "active" ? "pending" : a.status || "pending",
      });
      if (out[out.length - 1].status === "blocked") {
        out[out.length - 1].status = "pending";
      }
    }
  }
  return out;
}
