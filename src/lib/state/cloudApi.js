/* =========================================================================
   SHARED CLOUD STORAGE — via /api/jsonbin (Vercel serverless proxy)
   -------------------------------------------------------------------------
   The actual JSONBin bin ID and master key live only in Vercel's server-side
   environment variables (JSONBIN_BIN_ID, JSONBIN_MASTER_KEY) — see
   api/jsonbin.js. This file never sees them, so nothing secret ships to
   the browser. Set the env vars in your Vercel project settings, then
   deploy; both of you read/write the same bin through this proxy.
   ========================================================================= */
// The shared access code is verified server-side by /api/login (env var
// ACCESS_CODE) — it never ships to the browser. The one-time admin-bootstrap
// code has been retired: an admin account already exists, so manage roles
// from the Admin panel from here on.

// `fresh: true` bypasses the browser/edge cache (see api/jsonbin.js) for the
// rare calls where we must have the absolute latest data — e.g. checking for
// a duplicate name right before creating an account. Everywhere else (most
// notably the initial page load) we're happy to accept a response that's up
// to ~10s old in exchange for it arriving instantly instead of waiting on a
// round trip to JSONBin.io on every single visit.
export async function fetchRecord({ fresh = false } = {}) {
  const res = await fetch("/api/jsonbin", fresh ? { cache: "no-store" } : undefined);
  if (!res.ok) throw new Error("fetch failed");
  const data = await res.json();
  return {
    entries: data.entries || [],
    accounts: data.accounts || [],
    logs: data.logs || [],
    version: data.version || 0,
  };
}

// Thrown when the server rejects a save because someone else saved first
// (see the `version` / optimistic-locking comment in api/jsonbin.js). Carries
// the fresh server record so callers can resync instead of guessing.
export class SaveConflictError extends Error {
  constructor(freshRecord) {
    super("conflict");
    this.name = "SaveConflictError";
    this.fresh = freshRecord;
  }
}

export async function saveRecord(record, expectedVersion) {
  const res = await fetch("/api/jsonbin", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...record, expectedVersion }),
  });
  if (res.status === 409) {
    const data = await res.json().catch(() => null);
    throw new SaveConflictError(data || { entries: [], accounts: [], logs: [], version: expectedVersion });
  }
  if (!res.ok) throw new Error("save failed");
  const data = await res.json().catch(() => ({}));
  return typeof data.version === "number" ? data.version : expectedVersion + 1;
}
