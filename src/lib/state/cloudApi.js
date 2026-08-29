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
// Auth is username + password only. No JWT / server session tokens.
// Writes go through /api/jsonbin; the Supabase key never ships to the browser.

function writeHeaders() {
  return { "Content-Type": "application/json" };
}

// In-memory short TTL for non-fresh reads in the same tab session.
// Does NOT replace fresh:true (signup/login/conflict paths still hit network).
// Safe: 20s is short; any successful write invalidates immediately.
let _memRecord = null;
let _memAt = 0;
const MEM_TTL_MS = 20 * 1000;

function invalidateRecordCache() {
  _memRecord = null;
  _memAt = 0;
  // إبطال كاش النطاقات المجزأة أيضاً بعد أي كتابة
  try {
    if (typeof _scopedCache !== "undefined" && _scopedCache) _scopedCache.clear();
  } catch (_) {}
  try {
    if (typeof _versionEtag !== "undefined") _versionEtag = null;
  } catch (_) {}
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
/**
 * جلب السجل الكامل — مكلف جداً (باندويث + latency).
 * استخدمه فقط عند الحاجة الفعلية (ترحيل نادر / استرداد).
 * المسار العادي: fetchBootstrap, fetchEntriesOnly, fetchMyAccount, fetchVersionOnly…
 */
export async function fetchRecord({ fresh = false } = {}) {
  if (typeof console !== "undefined" && console.warn) {
    console.warn(
      "[cloudApi] fetchRecord() loads the full dictionary — prefer scoped fetches."
    );
  }
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

// =====================================================================
// دوال جلب مجزأة — كل دالة تجلب فقط ما تحتاجه الوظيفة الحالية
// (تطبيق قاعدة عزل الإجراءات الصارم + تقليل الباندويث)
// =====================================================================

const NO_STORE = {
  cache: "no-store",
  headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
};

// كاش قصير المدى لكل نطاق على حدة (يقلل الطلبات المتكررة في نفس التبويب)
const _scopedCache = new Map(); // key → { at, data }
const SCOPED_TTL_MS = {
  bootstrap: 30 * 1000,
  account: 20 * 1000,
  accounts: 15 * 1000,
  entries: 45 * 1000,
  logs: 15 * 1000,
  settings: 30 * 1000,
  version: 10 * 1000,
};

function scopedGet(key) {
  const hit = _scopedCache.get(key);
  if (!hit) return null;
  const ttl = SCOPED_TTL_MS[key.split(":")[0]] || 15 * 1000;
  if (Date.now() - hit.at > ttl) {
    _scopedCache.delete(key);
    return null;
  }
  return hit.data;
}

function scopedSet(key, data) {
  _scopedCache.set(key, { at: Date.now(), data });
}

/** In-flight GET dedupe — concurrent identical reads share one network call. */
const _inflight = new Map();
function inflight(key, fn) {
  if (_inflight.has(key)) return _inflight.get(key);
  const p = Promise.resolve()
    .then(fn)
    .finally(() => {
      _inflight.delete(key);
    });
  _inflight.set(key, p);
  return p;
}

/** إبطال كاش النطاقات بعد أي كتابة ناجحة */
export function invalidateScopedCaches() {
  _scopedCache.clear();
  invalidateRecordCache();
}

/** إعدادات عامة فقط (بانر + امتحانات + وحدات أكاديمية + version) */
export async function fetchBootstrap({ fresh = false } = {}) {
  if (!fresh) {
    const cached = scopedGet("bootstrap");
    if (cached) return cached;
  }
  return inflight(`bootstrap:${fresh ? 1 : 0}`, async () => {
    const res = await fetch(`/api/jsonbin?scope=bootstrap&_t=${Date.now()}`, NO_STORE);
    if (!res.ok) throw new Error("fetchBootstrap failed");
    const data = await res.json();
    scopedSet("bootstrap", data);
    return data;
  });
}

/** حساب واحد فقط حسب الكود */
export async function fetchMyAccount(code, { fresh = false } = {}) {
  if (!code) return null;
  const cacheKey = `account:${code}`;
  if (!fresh) {
    const cached = scopedGet(cacheKey);
    if (cached !== null && cached !== undefined) return cached;
  }
  const res = await fetch(
    `/api/jsonbin?scope=account&code=${encodeURIComponent(code)}&_t=${Date.now()}`,
    NO_STORE
  );
  if (!res.ok) throw new Error("fetchMyAccount failed");
  const data = await res.json();
  const account = data.account || null;
  scopedSet(cacheKey, account);
  return account;
}

/**
 * قائمة الحسابات — للأدمن/المعلم.
 * @param {{ fresh?: boolean, fields?: 'light'|'full' }} opts
 *   default light = بدون passwordHash/progress (أسرع + آمن أكثر للقائمة)
 *   fields: "full" مطلوب لتسجيل الدخول / الترحيل
 */
export async function fetchAccountsOnly({ fresh = false, fields = "light" } = {}) {
  const light = fields !== "full";
  const cacheKey = light ? "accounts-light" : "accounts";
  if (!fresh) {
    const cached = scopedGet(cacheKey);
    if (cached) return cached;
  }
  return inflight(`accounts:${light ? "L" : "F"}:${fresh ? 1 : 0}`, async () => {
    const params = new URLSearchParams({
      scope: "accounts",
      _t: String(Date.now()),
    });
    if (light) params.set("fields", "light");
    const res = await fetch(`/api/jsonbin?${params}`, NO_STORE);
    if (!res.ok) throw new Error("fetchAccountsOnly failed");
    const data = await res.json();
    const accounts = Array.isArray(data.accounts) ? data.accounts : [];
    scopedSet(cacheKey, accounts);
    return accounts;
  });
}

/**
 * كلمات القاموس فقط.
 * @param {{ fresh?: boolean, section?: string|null }} opts
 *   section: "en-ar" | "ar-ar" | "academic" — لو اتحدد يرجع ذلك القسم فقط (أخف)
 */
/**
 * كلمات القاموس فقط.
 * @param {{ fresh?: boolean, section?: string|null, limit?: number, after?: string|null }} opts
 *   - section: "en-ar" | "ar-ar" | "academic"
 *   - limit + after: cursor pagination (لما limit > 0 يرجع { entries, nextCursor, hasMore })
 *   - بدون limit: يرجع Array زي السلوك القديم (توافق عكسي)
 */
export async function fetchEntriesOnly({
  fresh = false,
  section = null,
  limit = 0,
  after = null,
  /** Default "light" = smaller list payloads. Pass "full" for export/admin bulk. */
  fields = "light",
} = {}) {
  const sec =
    section === "en-ar" || section === "ar-ar" || section === "academic"
      ? section
      : null;
  const light = fields === "light" || fields === "list";
  const usePage = Number(limit) > 0;
  const cacheKey = usePage
    ? null
    : `${light ? "entries-light" : "entries"}${sec ? `:${sec}` : ""}`;
  if (!fresh && cacheKey) {
    const cached = scopedGet(cacheKey);
    if (cached) return cached;
  }
  const inflightKey = `entries:${sec || "all"}:${light ? "L" : "F"}:${limit}:${after || ""}:${fresh ? 1 : 0}`;
  return inflight(inflightKey, async () => {
    const params = new URLSearchParams({
      scope: "entries",
      _t: String(Date.now()),
    });
    if (sec) params.set("section", sec);
    if (light) params.set("fields", "light");
    if (usePage) {
      params.set("limit", String(Math.min(Number(limit) || 40, 200)));
      if (after) params.set("after", String(after));
    }
    const res = await fetch(`/api/jsonbin?${params}`, NO_STORE);
    if (!res.ok) throw new Error("fetchEntriesOnly failed");
    const data = await res.json();
    const entries = Array.isArray(data.entries) ? data.entries : [];
    if (usePage) {
      return {
        entries,
        nextCursor: data.nextCursor || null,
        hasMore: !!data.hasMore,
        fields: data.fields || (light ? "light" : "full"),
      };
    }
    if (cacheKey) scopedSet(cacheKey, entries);
    return entries;
  });
}

/** كلمة واحدة كاملة (تفاصيل / تعديل) — بدل تحميل القائمة كلها */
export async function fetchEntryById(id, { fresh = false } = {}) {
  if (!id) return null;
  const cacheKey = `entry:${id}`;
  if (!fresh) {
    const cached = scopedGet(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(
    `/api/jsonbin?scope=entry&id=${encodeURIComponent(id)}&_t=${Date.now()}`,
    NO_STORE
  );
  if (!res.ok) throw new Error("fetchEntryById failed");
  const data = await res.json();
  const entry = data.entry || null;
  if (entry) scopedSet(cacheKey, entry);
  return entry;
}

/** سجل النشاط فقط (للأدمن) */
export async function fetchLogsOnly({ fresh = false } = {}) {
  if (!fresh) {
    const cached = scopedGet("logs");
    if (cached) return cached;
  }
  return inflight(`logs:${fresh ? 1 : 0}`, async () => {
    const res = await fetch(`/api/jsonbin?scope=logs&_t=${Date.now()}`, NO_STORE);
    if (!res.ok) throw new Error("fetchLogsOnly failed");
    const data = await res.json();
    const logs = Array.isArray(data.logs) ? data.logs : [];
    scopedSet("logs", logs);
    return logs;
  });
}

/**
 * إعدادات محددة حسب المفاتيح المطلوبة.
 * keys مثال: "site_banner,exam_config,academic_units,version"
 */
export async function fetchSettings(
  keys = "site_banner,exam_config,academic_units,version",
  { fresh = false } = {}
) {
  const cacheKey = `settings:${keys}`;
  if (!fresh) {
    const cached = scopedGet(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(
    `/api/jsonbin?scope=settings&keys=${encodeURIComponent(keys)}&_t=${Date.now()}`,
    NO_STORE
  );
  if (!res.ok) throw new Error("fetchSettings failed");
  const data = await res.json();
  scopedSet(cacheKey, data);
  return data;
}

/** Last ETag from version endpoint — enables 304 Not Modified on soft polls. */
let _versionEtag = null;

/** رقم الإصدار فقط (خفيف جداً) + دعم ETag */
export async function fetchVersionOnly({ fresh = false } = {}) {
  if (!fresh) {
    const cached = scopedGet("version");
    if (cached !== null && cached !== undefined) return cached;
  }
  const headers = {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
  if (!fresh && _versionEtag) {
    headers["If-None-Match"] = _versionEtag;
  }
  const res = await fetch(`/api/jsonbin?scope=version&_t=${Date.now()}`, {
    cache: "no-store",
    headers,
  });
  if (res.status === 304) {
    const cached = scopedGet("version");
    return typeof cached === "number" ? cached : 0;
  }
  if (!res.ok) throw new Error("fetchVersionOnly failed");
  const et = res.headers.get("ETag");
  if (et) _versionEtag = et;
  const data = await res.json();
  const version = typeof data.version === "number" ? data.version : 0;
  scopedSet("version", version);
  return version;
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
    headers: writeHeaders(),
    body: JSON.stringify({ ...record, expectedVersion }),
  });
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
  const res = await fetch("/api/jsonbin", {
    method: "PUT",
    headers: writeHeaders(),
    body: JSON.stringify({
      scope: "accounts",
      accounts: accounts || [],
      ...(removeAccountCodes?.length ? { removeAccountCodes } : {}),
      ...(approveAccountCodes?.length ? { approveAccountCodes } : {}),
      expectedVersion,
    }),
  });
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

/**
 * Fastest path: change status of a single account (approve / reject / block).
 * Does not rewrite the whole accounts list.
 */
export async function setAccountStatus(code, status, expectedVersion) {
  const data = await putScoped(
    { scope: "accountStatus", code, status },
    expectedVersion
  );
  return {
    version:
      typeof data.version === "number" ? data.version : expectedVersion + 1,
    account: data.account || null,
  };
}

/**
 * Fastest path: delete a single account (reject / remove).
 * Does not rewrite the whole accounts list.
 */
export async function deleteAccount(code, expectedVersion) {
  const data = await putScoped(
    { scope: "accountDelete", code },
    expectedVersion
  );
  return typeof data.version === "number" ? data.version : expectedVersion + 1;
}

async function putScoped(body, expectedVersion) {
  const res = await fetch("/api/jsonbin", {
    method: "PUT",
    headers: writeHeaders(),
    body: JSON.stringify({ ...body, expectedVersion }),
  });
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

/**
 * Replace activity logs only (no entries/accounts rewrite).
 * Used by persistLogs — sign-in/out events are rare.
 */
export async function saveLogsOnly(logs, expectedVersion) {
  const data = await putScoped(
    { scope: "logsReplace", logs: Array.isArray(logs) ? logs : [] },
    expectedVersion
  );
  return typeof data.version === "number" ? data.version : expectedVersion + 1;
}

/**
 * Accounts + version only — preferred over fetchRecord for auth/migration paths
 * that do not need the dictionary.
 */
export async function fetchAccountsBundle({ fresh = false } = {}) {
  // full required: login needs passwordHash; migration may touch all fields
  const [accounts, version] = await Promise.all([
    fetchAccountsOnly({ fresh, fields: "full" }),
    fetchVersionOnly({ fresh }),
  ]);
  return {
    accounts: accounts || [],
    version: typeof version === "number" ? version : 0,
    entries: [],
    logs: [],
    siteBanner: null,
    examConfig: null,
    academicUnits: null,
  };
}
