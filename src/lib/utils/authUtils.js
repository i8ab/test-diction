// Username / password validation and hashing (Web Crypto).
// Rules matched to the app's original error strings in logs.js / AuthScreens.

export function normalizeUsername(u) {
  return String(u || "").trim().toLowerCase().replace(/\s/g, "");
}

/**
 * Username: 3–30 chars, letters/numbers/_/. only, no consecutive dots,
 * must start and end with a letter or number.
 */
export function validateUsername(raw) {
  const username = normalizeUsername(raw);
  if (!username) return { ok: false, error: "Enter a username." };
  if (username.length < 3) return { ok: false, error: "Username must be at least 3 characters." };
  if (username.length > 30) return { ok: false, error: "Username must be at most 30 characters." };
  if (/\.\./.test(username)) return { ok: false, error: "Username can't contain consecutive periods." };
  if (!/^[a-z0-9\u0600-\u06FF]/i.test(username) || !/[a-z0-9\u0600-\u06FF]$/i.test(username)) {
    return {
      ok: false,
      error:
        "Username can only use letters, numbers, underscores and periods, and must start/end with a letter or number.",
    };
  }
  if (!/^[a-z0-9._\u0600-\u06FF]+$/i.test(username)) {
    return {
      ok: false,
      error:
        "Username can only use letters, numbers, underscores and periods, and must start/end with a letter or number.",
    };
  }
  return { ok: true, username };
}

export function validatePassword(raw) {
  const password = String(raw ?? "");
  if (!password) return { ok: false, error: "Enter a password." };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
  if (password.length > 128) return { ok: false, error: "Password is too long." };
  return { ok: true, password };
}

async function sha256Bytes(text) {
  const data = new TextEncoder().encode(String(text));
  return crypto.subtle.digest("SHA-256", data);
}

async function sha256Hex(text) {
  const buf = await sha256Bytes(text);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Base64(text) {
  const buf = await sha256Bytes(text);
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Canonical form for NEW hashes: hex SHA-256 of `${salt}::${password}` */
export async function hashPassword(password, saltCode) {
  const pw = String(password ?? "");
  const salt = String(saltCode ?? "");
  return sha256Hex(`${salt}::${pw}`);
}

export async function verifyPassword(password, saltCode, expectedHash) {
  const result = await verifyPasswordDetailed(password, saltCode, expectedHash);
  return result.ok;
}

/**
 * Try canonical + legacy encodings (hex/base64, several salt layouts).
 * Returns { ok, needsUpgrade } so login can rewrite to the canonical hash.
 */
export async function verifyPasswordDetailed(password, saltCode, expectedHash) {
  if (!expectedHash) return { ok: false, needsUpgrade: false };
  const pw = String(password ?? "");
  const salt = String(saltCode ?? "");
  const expected = String(expectedHash).trim();
  const expectedLower = expected.toLowerCase();

  const material = [
    `${salt}::${pw}`,
    `${pw}::${salt}`,
    `${salt}:${pw}`,
    `${pw}:${salt}`,
    `${salt}${pw}`,
    `${pw}${salt}`,
    `${salt}|${pw}`,
    pw,
    `${salt}::${pw.trim()}`,
    `twoTongues:${salt}:${pw}`,
    `tt:${salt}:${pw}`,
  ];

  const seen = new Set();
  for (const m of material) {
    if (seen.has(m)) continue;
    seen.add(m);
    const hex = await sha256Hex(m);
    const b64 = await sha256Base64(m);
    if (hex === expectedLower || hex === expected) {
      const canonical = await hashPassword(pw, salt);
      return { ok: true, needsUpgrade: hex !== canonical.toLowerCase() };
    }
    if (b64 === expected || b64 === expectedLower) {
      return { ok: true, needsUpgrade: true };
    }
  }

  // PBKDF2 variants (some older builds may have used deriveBits)
  try {
    const enc = new TextEncoder();
    const pwKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(pw),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    for (const iterations of [100000, 10000, 1000]) {
      for (const saltStr of [salt, `${salt}::pw`, pw]) {
        const bits = await crypto.subtle.deriveBits(
          { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(saltStr), iterations },
          pwKey,
          256
        );
        const hex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
        if (hex === expectedLower || hex === expected) {
          return { ok: true, needsUpgrade: true };
        }
      }
    }
  } catch (_) {
    /* PBKDF2 unavailable or failed — ignore */
  }

  return { ok: false, needsUpgrade: false };
}
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
    if (!Array.isArray(copy.studied)) {
      copy.studied = [];
      changed = true;
    }
    if (!copy.studiedAt || typeof copy.studiedAt !== "object") {
      copy.studiedAt = {};
      changed = true;
    }
    if (!Array.isArray(copy.favorites)) {
      copy.favorites = [];
      changed = true;
    }
    if (!copy.srsStats || typeof copy.srsStats !== "object") {
      copy.srsStats = {};
      changed = true;
    }
    if (!copy.srsDueAt || typeof copy.srsDueAt !== "object") {
      copy.srsDueAt = {};
      changed = true;
    }
    if (!copy.srsCards || typeof copy.srsCards !== "object") {
      copy.srsCards = {};
      changed = true;
    }
    if (!Array.isArray(copy.quizHistory)) {
      copy.quizHistory = [];
      changed = true;
    }
    if (!Array.isArray(copy.achievements)) {
      copy.achievements = [];
      changed = true;
    }
    if (copy.username) {
      const n = normalizeUsername(copy.username);
      if (n !== copy.username) {
        copy.username = n;
        changed = true;
      }
    }
    return copy;
  });
  return { accounts: next, changed };
}
