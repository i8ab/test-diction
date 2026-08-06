// Username / password validation and hashing (Web Crypto).

const USERNAME_RE = /^[a-zA-Z0-9_\u0600-\u06FF]{3,24}$/;

export function normalizeUsername(u) {
  return String(u || "").trim().toLowerCase();
}

export function validateUsername(raw) {
  const username = normalizeUsername(raw);
  if (!username) return { ok: false, error: "Username is required." };
  if (username.length < 3) return { ok: false, error: "Username must be at least 3 characters." };
  if (username.length > 24) return { ok: false, error: "Username is too long (max 24)." };
  if (!USERNAME_RE.test(username) && !/^[\u0600-\u06FFa-zA-Z0-9_]{3,24}$/.test(String(raw || "").trim())) {
    return { ok: false, error: "Username can only use letters, numbers, and underscore." };
  }
  return { ok: true, username };
}

export function validatePassword(raw) {
  const password = String(raw || "");
  if (password.length < 4) return { ok: false, error: "Password must be at least 4 characters." };
  if (password.length > 128) return { ok: false, error: "Password is too long." };
  return { ok: true, password };
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash password with personal code as salt */
export async function hashPassword(password, saltCode) {
  return sha256(`${saltCode}::${password}`);
}

export async function verifyPassword(password, saltCode, expectedHash) {
  if (!expectedHash) return false;
  const h = await hashPassword(password, saltCode);
  return h === expectedHash;
}

/**
 * Migrate legacy accounts (plain code-only) to username/password shape if needed.
 * Returns { accounts, changed }.
 */
export function migrateAccounts(accounts) {
  if (!Array.isArray(accounts)) return { accounts: [], changed: false };
  let changed = false;
  const next = accounts.map((a) => {
    if (!a || typeof a !== "object") return a;
    const copy = { ...a };
    if (!copy.role) {
      copy.role = copy.isAdmin ? "admin" : "user";
      changed = true;
    }
    if (!copy.status) {
      copy.status = "active";
      changed = true;
    }
    if (!copy.studied) {
      copy.studied = [];
      changed = true;
    }
    if (!copy.studiedAt) {
      copy.studiedAt = {};
      changed = true;
    }
    if (!copy.favorites) {
      copy.favorites = [];
      changed = true;
    }
    if (!copy.srsStats) {
      copy.srsStats = {};
      changed = true;
    }
    if (!copy.srsDueAt) {
      copy.srsDueAt = {};
      changed = true;
    }
    if (!copy.quizHistory) {
      copy.quizHistory = [];
      changed = true;
    }
    if (!copy.achievements) {
      copy.achievements = [];
      changed = true;
    }
    return copy;
  });
  return { accounts: next, changed };
}
