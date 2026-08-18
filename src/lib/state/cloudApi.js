/* =========================================================================
   SHARED CLOUD STORAGE — via /api/jsonbin (Vercel serverless proxy → Supabase)
   -------------------------------------------------------------------------
   The actual Supabase URL and key live only in Vercel's server-side
   environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or
   SUPABASE_ANON_KEY) — see api/jsonbin.js. This file never sees them, so
   nothing secret ships to the browser. Set the env vars in your Vercel
   project settings, then deploy; everyone reads/writes the same data
   through this proxy.
   ========================================================================= */
// Auth is username + password only. Writes go through /api/jsonbin; the
// Supabase key never ships to the browser.

// In-memory short TTL for non-fresh reads in the same tab session.
// Does NOT replace fresh:true (signup/login/conflict paths still hit network).
// Safe: 20s is short; any successful write invalidates immediately.
let _memRecord = null;
let _memAt = 0;
const MEM_TTL_MS = 20 * 1000;

function invalidateRecordCache() {
  _memRecord = null;
  _memAt = 0;
}

function normalizeRecord(data) {
  return {
    entries: data.entries || [],
    accounts: data.accounts || [],
    logs: data.logs || [],
    siteBanner: data.siteBanner || null,
    examConfig: data.examConfig || null,
    academicUnits: data.academicUnits || null,
    version: data.version || 0,
  };
}

// `fresh: true` must bypass BOTH browser cache and Vercel edge cache.
// `cache: "no-store"` alone is not enough — the edge still serves responses
// for up to s-maxage / stale-while-revalidate (30s–120s). That made a second
// signup ~50s later keep reading an old version, hit 409 forever, and look
// like "nothing happened". We bust the CDN with a unique query string and
// ask the API to emit private no-store headers.
export async function fetchRecord({ fresh = false } = {}) {
  if (!fresh && _memRecord && Date.now() - _memAt < MEM_TTL_MS) {
    return _memRecord;
  }
  const url = fresh
    ? `/api/jsonbin?fresh=1&_t=${Date.now()}`
    : "/api/jsonbin";
  const res = await fetch(url, fresh
    ? {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      }
    : undefined
  );
  if (!res.ok) throw new Error("fetch failed");
  const data = await res.json();
  const record = normalizeRecord(data);
  _memRecord = record;
  _memAt = Date.now();
  return record;
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
  const headers = { "Content-Type": "application/json" };
  const res = await fetch("/api/jsonbin", {
    method: "PUT",
    headers,
    body: JSON.stringify({ ...record, expectedVersion }),
  });
  if (res.status === 401) {
    throw new Error("unauthorized");
  }
  if (res.status === 409) {
    invalidateRecordCache();
    const data = await res.json().catch(() => null);
    throw new SaveConflictError(data || { entries: [], accounts: [], logs: [], siteBanner: null, examConfig: null, academicUnits: null, version: expectedVersion });
  }
  if (!res.ok) throw new Error("save failed");
  invalidateRecordCache();
  const data = await res.json().catch(() => ({}));
  return typeof data.version === "number" ? data.version : expectedVersion + 1;
}

/**
 * Fast path: update accounts (+ optional remove/approve codes) without
 * rewriting the entire dictionary (entries/logs/banners).
 */
export async function saveAccountsOnly(
  {
    accounts,
    removeAccountCodes,
    approveAccountCodes,
  },
  expectedVersion
) {
  const headers = { "Content-Type": "application/json" };
  const res = await fetch("/api/jsonbin", {
    method: "PUT",
    headers,
    body: JSON.stringify({
      scope: "accounts",
      accounts: accounts || [],
      ...(removeAccountCodes?.length ? { removeAccountCodes } : {}),
      ...(approveAccountCodes?.length ? { approveAccountCodes } : {}),
      expectedVersion,
    }),
  });
  if (res.status === 401) {
    throw new Error("unauthorized");
  }
  if (res.status === 409) {
    invalidateRecordCache();
    const data = await res.json().catch(() => null);
    throw new SaveConflictError(
      data || {
        entries: [],
        accounts: [],
        logs: [],
        siteBanner: null,
        examConfig: null,
        academicUnits: null,
        version: expectedVersion,
      }
    );
  }
  if (!res.ok) throw new Error("save failed");
  invalidateRecordCache();
  const data = await res.json().catch(() => ({}));
  return typeof data.version === "number" ? data.version : expectedVersion + 1;
}

async function putScoped(body, expectedVersion) {
  const headers = { "Content-Type": "application/json" };
  const res = await fetch("/api/jsonbin", {
    method: "PUT",
    headers,
    body: JSON.stringify({ ...body, expectedVersion }),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (res.status === 409) {
    invalidateRecordCache();
    const data = await res.json().catch(() => null);
    throw new SaveConflictError(
      data || {
        entries: [],
        accounts: [],
        logs: [],
        siteBanner: null,
        examConfig: null,
        academicUnits: null,
        version: expectedVersion,
      }
    );
  }
  if (!res.ok) throw new Error("save failed");
  invalidateRecordCache();
  return res.json().catch(() => ({}));
}

/** Patch only selected fields on one account (birthDate, path, name, …). */
export async function patchAccountFields(code, patch, expectedVersion) {
  const data = await putScoped(
    { scope: "accountPatch", code, patch: patch || {} },
    expectedVersion
  );
  return {
    version: typeof data.version === "number" ? data.version : expectedVersion + 1,
    account: data.account || null,
  };
}

/** Create/update a single dictionary entry — does not rewrite the whole list. */
export async function patchEntry(entry, expectedVersion) {
  const data = await putScoped({ scope: "entryPatch", entry }, expectedVersion);
  return typeof data.version === "number" ? data.version : expectedVersion + 1;
}

/** Delete a single dictionary entry by id. */
export async function deleteEntryRemote(id, expectedVersion) {
  const data = await putScoped({ scope: "entryDelete", id }, expectedVersion);
  return typeof data.version === "number" ? data.version : expectedVersion + 1;
}

/** Update one settings key only (site_banner, exam_config, academic_units, …). */
export async function patchSettings(key, value, expectedVersion) {
  const data = await putScoped(
    { scope: "settingsPatch", key, value },
    expectedVersion
  );
  return typeof data.version === "number" ? data.version : expectedVersion + 1;
}
