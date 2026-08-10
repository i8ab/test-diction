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

// `fresh: true` must bypass BOTH browser cache and Vercel edge cache.
// `cache: "no-store"` alone is not enough — the edge still serves responses
// for up to s-maxage / stale-while-revalidate (30s–120s). That made a second
// signup ~50s later keep reading an old version, hit 409 forever, and look
// like "nothing happened". We bust the CDN with a unique query string and
// ask the API to emit private no-store headers.
export async function fetchRecord({ fresh = false } = {}) {
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
  return {
    entries: data.entries || [],
    accounts: data.accounts || [],
    logs: data.logs || [],
    siteBanner: data.siteBanner || null,
    examConfig: data.examConfig || null,
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
    const data = await res.json().catch(() => null);
    throw new SaveConflictError(data || { entries: [], accounts: [], logs: [], siteBanner: null, examConfig: null, version: expectedVersion });
  }
  if (!res.ok) throw new Error("save failed");
  const data = await res.json().catch(() => ({}));
  return typeof data.version === "number" ? data.version : expectedVersion + 1;
}
