// Username validation (Instagram-style), password hashing, and account
// migration helpers for the username+password auth system.

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
// Instagram-like: letters, numbers, underscores, periods; must start with
// a letter or number; no consecutive periods.
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/;

function normalizeUsername(raw) {
  return String(raw || "").trim().toLowerCase();
}

function validateUsername(raw) {
  const u = normalizeUsername(raw);
  if (!u) return { ok: false, error: "Enter a username." };
  if (u.length < USERNAME_MIN) return { ok: false, error: `Username must be at least ${USERNAME_MIN} characters.` };
  if (u.length > USERNAME_MAX) return { ok: false, error: `Username must be at most ${USERNAME_MAX} characters.` };
  if (u.includes("..")) return { ok: false, error: "Username can't contain consecutive periods." };
  if (!USERNAME_RE.test(u)) {
    return {
      ok: false,
      error: "Username can only use letters, numbers, underscores and periods, and must start/end with a letter or number.",
    };
  }
  return { ok: true, username: u };
}

function validatePassword(raw) {
  const p = String(raw || "");
  if (!p) return { ok: false, error: "Enter a password." };
  if (p.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
  if (p.length > 128) return { ok: false, error: "Password is too long." };
  return { ok: true, password: p };
}

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(String(password) + ":" + String(salt || ""));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyPassword(password, salt, storedHash) {
  if (!storedHash) return false;
  const h = await hashPassword(password, salt);
  return h === storedHash;
}

// Build a unique username from a display name (for migrating legacy accounts).
function slugFromName(name) {
  const base = String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  return base || "user";
}

function uniqueUsername(base, usedSet) {
  let candidate = base;
  let i = 1;
  while (usedSet.has(candidate)) {
    candidate = `${base}${i}`;
    i += 1;
    if (candidate.length > USERNAME_MAX) candidate = `${base.slice(0, 12)}${i}`;
  }
  usedSet.add(candidate);
  return candidate;
}

// Ensure every account has username + status. Legacy accounts without a
// username get a unique random-ish one derived from their name. Never deletes
// accounts. Returns { accounts, changed }.
function migrateAccounts(list) {
  if (!Array.isArray(list)) return { accounts: [], changed: false };
  const used = new Set();
  let changed = false;
  const accounts = list.map((a) => {
    let username = a.username ? normalizeUsername(a.username) : "";
    if (username && !used.has(username)) {
      used.add(username);
    } else {
      const base = slugFromName(a.name) || `user${String(a.code || "").slice(-4)}`;
      username = uniqueUsername(base, used);
      changed = true;
    }
    const status = a.status === "pending" || a.status === "rejected" ? a.status : "active";
    if (!a.username || a.username !== username || !a.status) changed = true;
    return { ...a, username, status };
  });
  return { accounts, changed };
}

export {
  USERNAME_MIN,
  USERNAME_MAX,
  normalizeUsername,
  validateUsername,
  validatePassword,
  hashPassword,
  verifyPassword,
  slugFromName,
  uniqueUsername,
  migrateAccounts,
};
