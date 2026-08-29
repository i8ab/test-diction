/**
 * Supabase access + record load/save helpers for /api/jsonbin.
 * Phase D extract from api/jsonbin.js
 */

import { invalidateHotCaches } from "./redis.js";
import {
  entryIdOf,
  logFromRow,
  logToRow,
  pickAcademicUnits,
  pickBanner,
  pickExamConfig,
  pruneLogsLast24h
} from "./jsonbinMappers.js";

export function sbHeaders() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  return {
    url: url.replace(/\/$/, ""),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  };
}

export async function sbFetch(method, path, body, extraHeaders = {}) {
  const cfg = sbHeaders();
  if (!cfg) throw new Error("missing SUPABASE_URL or key");
  const opts = {
    method,
    headers: { ...cfg.headers, ...extraHeaders },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(`${cfg.url}/rest/v1/${path}`, opts);
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Supabase ${method} ${path} → ${r.status}: ${t.slice(0, 300)}`);
  }
  const text = await r.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

/** Version only — used by partial writes so we never pull the whole dictionary. */

export async function loadVersionOnly() {
  try {
    const rows = await sbFetch("GET", "settings?key=eq.version&select=value");
    const v = rows && rows[0] && rows[0].value;
    return typeof v === "number" ? v : Number(v) || 0;
  } catch (_) {
    return 0;
  }
}

export async function loadOneAccount(code) {
  const rows = await sbFetch(
    "GET",
    `accounts?code=eq.${encodeURIComponent(code)}&select=data`
  );
  if (rows && rows[0] && rows[0].data) return rows[0].data;
  return null;
}

export async function loadAccountsDataOnly() {
  const accountsRows = await sbFetch("GET", "accounts?select=data");
  const statusRankLoad = (s) =>
    s === "active" || s === "blocked" ? 2 : s === "pending" ? 1 : 0;
  const byCodeLoad = new Map();
  for (const a of (accountsRows || []).map((r) => r.data).filter(Boolean)) {
    if (!a || !a.code) continue;
    const key = String(a.code);
    const prev = byCodeLoad.get(key);
    if (!prev || statusRankLoad(a.status) >= statusRankLoad(prev.status)) {
      byCodeLoad.set(key, a);
    }
  }
  return Array.from(byCodeLoad.values());
}

export async function bumpVersion(nextVersion) {
  await sbFetch(
    "POST",
    "settings?on_conflict=key",
    [{ key: "version", value: nextVersion }],
    { Prefer: "resolution=merge-duplicates,return=minimal" }
  );
  // Drop hot caches so the next read sees the new version immediately.
  await invalidateHotCaches();
}

/**
 * Upsert one account row.
 * Prefers a single PostgREST upsert (on_conflict=code) — 1 round-trip.
 * Falls back to DELETE+INSERT if the unique constraint is missing or upsert fails.
 * Requires UNIQUE(code) on public.accounts (see docs/SUPABASE_INDEXES.sql).
 */

export async function upsertAccountRow(account) {
  const code = String((account && account.code) || "");
  if (!code) return;
  try {
    await sbFetch(
      "POST",
      "accounts?on_conflict=code",
      [{ code, data: account }],
      { Prefer: "resolution=merge-duplicates,return=minimal" }
    );
    return;
  } catch (_) {
    // Fallback for DBs without UNIQUE(code) yet
  }
  try {
    await sbFetch(
      "DELETE",
      `accounts?code=eq.${encodeURIComponent(code)}`,
      undefined,
      { Prefer: "return=minimal" }
    );
  } catch (_) {}
  await sbFetch(
    "POST",
    "accounts",
    [{ code, data: account }],
    { Prefer: "return=minimal" }
  );
}

/** Batch upsert accounts (chunks of 50) — one round-trip per chunk when UNIQUE(code) exists. */

export async function upsertAccountsBatch(accounts) {
  const list = (accounts || []).filter((a) => a && a.code);
  if (!list.length) return;
  const rows = list.map((a) => ({ code: String(a.code), data: a }));
  try {
    for (let i = 0; i < rows.length; i += 50) {
      await sbFetch(
        "POST",
        "accounts?on_conflict=code",
        rows.slice(i, i + 50),
        { Prefer: "resolution=merge-duplicates,return=minimal" }
      );
    }
    return;
  } catch (_) {
    // Fallback: per-row delete+insert
    for (const a of list) {
      await upsertAccountRow(a);
    }
  }
}

export async function loadRecord() {
  const [entriesRows, accountsRows, logsRows, settingsRows] = await Promise.all([
    sbFetch("GET", "entries?select=data"),
    sbFetch("GET", "accounts?select=data"),
    // Only the newest 200 logs from the DB (ordered by at desc)
    sbFetch("GET", "logs?select=*&order=at.desc&limit=500"),
    sbFetch("GET", "settings?select=key,value"),
  ]);

  const entries = (entriesRows || []).map((r) => r.data).filter(Boolean);
  // Dedupe by code preferring higher status (active/blocked > pending).
  // Duplicate rows can appear after a raced clear+insert; never show both.
  const statusRankLoad = (s) =>
    s === "active" || s === "blocked" ? 2 : s === "pending" ? 1 : 0;
  const byCodeLoad = new Map();
  for (const a of (accountsRows || []).map((r) => r.data).filter(Boolean)) {
    if (!a || !a.code) continue;
    const key = String(a.code);
    const prev = byCodeLoad.get(key);
    if (!prev || statusRankLoad(a.status) >= statusRankLoad(prev.status)) {
      byCodeLoad.set(key, a);
    }
  }
  const accounts = Array.from(byCodeLoad.values());
  // Activity log: last 24 hours only (older rows are dropped from the response
  // and cleaned from the DB on save / daily cron).
  let logs = pruneLogsLast24h((logsRows || []).map(logFromRow));
  logs.sort((a, b) => (a.at || 0) - (b.at || 0));

  let version = 0;
  let siteBanner = null;
  let examConfig = null;
  let academicUnits = null;
  for (const row of settingsRows || []) {
    if (row.key === "version") {
      version = typeof row.value === "number" ? row.value : Number(row.value) || 0;
    }
    if (row.key === "site_banner") {
      siteBanner = pickBanner(row.value);
    }
    if (row.key === "exam_config") {
      examConfig = pickExamConfig(row.value);
    }
    if (row.key === "academic_units") {
      academicUnits = pickAcademicUnits(row.value);
    }
  }

  if (!siteBanner) {
    try {
      const bannerRows = await sbFetch("GET", "site_banner?select=*&limit=1");
      if (bannerRows && bannerRows[0]) siteBanner = pickBanner(bannerRows[0]);
    } catch (_) {}
  }

  return { entries, accounts, logs, siteBanner, examConfig, academicUnits, version };
}

/** Delete every row in a table (PostgREST requires a filter). */

export async function clearTable(table) {
  // id=not.is.null matches every row that has an id
  await sbFetch("DELETE", `${table}?id=not.is.null`, undefined, {
    Prefer: "return=minimal",
  });
}

/**
 * Count rows currently in `entries` (lightweight head-style select).
 * Used to refuse accidental wipe when client sends an empty word list.
 */

export async function countEntriesInDb() {
  try {
    const rows = await sbFetch("GET", "entries?select=id");
    return Array.isArray(rows) ? rows.length : 0;
  } catch (_) {
    return -1; // unknown — be conservative in caller
  }
}

/**
 * Guard: never replace a non-empty dictionary with an empty one unless the
 * client explicitly opts in (`confirmWipeEntries: true`).
 * Returns the entries array that should be written.
 * Throws an Error with code EMPTY_ENTRIES_WIPE_BLOCKED when blocked.
 */

export async function loadEntryIdSet() {
  try {
    const rows = await sbFetch("GET", "entries?select=data");
    const ids = new Set();
    for (const r of rows || []) {
      const id = entryIdOf(r && r.data);
      if (id) ids.add(id);
    }
    return { ids, count: (rows || []).length };
  } catch (_) {
    return { ids: new Set(), count: -1 };
  }
}

/**
 * Find DB row primary keys for a word id stored in jsonb `data.id`.
 * GET then PATCH by integer PK is more reliable than filtering PATCH on jsonb.
 */

export async function findEntryRowIdsByWordId(wordId) {
  if (!wordId) return [];
  try {
    const rows = await sbFetch(
      "GET",
      `entries?data->>id=eq.${encodeURIComponent(wordId)}&select=id`
    );
    if (!Array.isArray(rows) || !rows.length) return [];
    return rows.map((r) => r.id).filter((id) => id != null);
  } catch (_) {
    return [];
  }
}

/**
 * Update existing word in place (PATCH by table primary key).
 * Returns true if at least one row was updated.
 */

export async function patchEntryByWordId(entry) {
  const wordId = entryIdOf(entry);
  if (!wordId) return false;
  const rowIds = await findEntryRowIdsByWordId(wordId);
  if (!rowIds.length) return false;

  const body = { data: { ...entry, id: wordId } };
  for (const pk of rowIds) {
    await sbFetch("PATCH", `entries?id=eq.${encodeURIComponent(String(pk))}`, body, {
      Prefer: "return=minimal",
    });
  }
  // Duplicates with same data.id: keep first, drop the rest
  if (rowIds.length > 1) {
    for (let i = 1; i < rowIds.length; i++) {
      try {
        await sbFetch(
          "DELETE",
          `entries?id=eq.${encodeURIComponent(String(rowIds[i]))}`,
          undefined,
          { Prefer: "return=minimal" }
        );
      } catch (_) {}
    }
  }
  return true;
}

/**
 * Differential save for entries (no full-table clear):
 *  1) Existing word ids → PATCH (update data in place).
 *  2) New word ids → POST (insert).
 *  3) DB ids missing from payload → DELETE (orphans only).
 *
 * Benefits vs wipe / delete+insert:
 *  - Row stays present during update (no empty gap for that word).
 *  - Crash mid-save cannot empty the dictionary.
 *  - Empty payload still blocked when DB has words.
 */

export async function saveEntriesSync(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const { ids: existingIds, count: dbCount } = await loadEntryIdSet();

  if (list.length === 0) {
    if (dbCount > 0) {
      const err = new Error(
        "Refusing to clear entries table: save payload is empty but DB has words."
      );
      err.code = "EMPTY_ENTRIES_WIPE_BLOCKED";
      err.serverCount = dbCount;
      throw err;
    }
    return;
  }

  // Dedupe by id (last wins).
  const byId = new Map();
  for (const e of list) {
    const id = entryIdOf(e);
    if (!id) continue;
    byId.set(id, { ...e, id });
  }
  const keepIds = new Set(byId.keys());

  const toPatch = [];
  const toInsert = [];
  for (const [id, e] of byId) {
    if (existingIds.has(id)) toPatch.push(e);
    else toInsert.push(e);
  }

  // 1) Update existing words in place (PATCH).
  for (const e of toPatch) {
    try {
      const ok = await patchEntryByWordId(e);
      // Race: row vanished between id-scan and patch → insert instead.
      if (!ok) toInsert.push(e);
    } catch (_) {
      toInsert.push(e);
    }
  }

  // 2) Insert brand-new words in batches.
  for (let i = 0; i < toInsert.length; i += 50) {
    const chunk = toInsert.slice(i, i + 50);
    if (!chunk.length) continue;
    await sbFetch(
      "POST",
      "entries",
      chunk.map((e) => ({ data: e })),
      { Prefer: "return=minimal" }
    );
  }

  // 3) Remove words no longer in the client set (orphans only).
  for (const id of existingIds) {
    if (keepIds.has(id)) continue;
    try {
      await sbFetch(
        "DELETE",
        `entries?data->>id=eq.${encodeURIComponent(id)}`,
        undefined,
        { Prefer: "return=minimal" }
      );
    } catch (_) {}
  }
}

export async function saveFullRecord(record, nextVersion) {
  // 1) Upsert version + site_banner
  await sbFetch(
    "POST",
    "settings?on_conflict=key",
    [
      { key: "version", value: nextVersion },
      { key: "site_banner", value: record.siteBanner },
      { key: "exam_config", value: record.examConfig || null },
      { key: "academic_units", value: record.academicUnits || null },
    ],
    { Prefer: "resolution=merge-duplicates,return=minimal" }
  );
  await invalidateHotCaches();

  // 2) entries — differential sync (no full-table wipe)
  await saveEntriesSync(record.entries);

  // 3) accounts — per-code replace (no full-table clear).
  // Full clear+reinsert raced when Redis lock was missing: two concurrent
  // PUTs both passed the version check, both cleared the table, and the
  // slower insert dropped accounts the faster one had just written (e.g. a
  // just-approved user flipped back to missing/pending after refresh).
  const keepCodes = new Set(
    (record.accounts || []).map((a) => String(a && a.code || "")).filter(Boolean)
  );
  // Drop rows whose code is no longer in the merged set (rejects / deletes).
  try {
    const existing = await sbFetch("GET", "accounts?select=code");
    const toDelete = (existing || [])
      .map((r) => String(r && r.code || ""))
      .filter((c) => c && !keepCodes.has(c));
    for (const code of toDelete) {
      await sbFetch("DELETE", `accounts?code=eq.${encodeURIComponent(code)}`, undefined, {
        Prefer: "return=minimal",
      });
    }
  } catch (_) {
    // Fallback: if we cannot list codes, clear then reinsert (old path).
    await clearTable("accounts");
  }
  // Upsert kept accounts (1 round-trip per 50 rows when UNIQUE(code) exists).
  await upsertAccountsBatch(record.accounts || []);

  // 4) logs — only keep last 24 hours
  await clearTable("logs");
  const logsToSave = pruneLogsLast24h(record.logs);
  if (logsToSave.length) {
    const rows = logsToSave.map(logToRow);
    for (let i = 0; i < rows.length; i += 100) {
      await sbFetch("POST", "logs", rows.slice(i, i + 100), {
        Prefer: "return=minimal",
      });
    }
  }

  // 5) optional site_banner mirror
  try {
    await clearTable("site_banner");
    if (record.siteBanner) {
      const b = record.siteBanner;
      await sbFetch(
        "POST",
        "site_banner",
        [
          {
            id: b.id || `banner-${Date.now()}`,
            message: b.message || "",
            color: b.color || "#146C94",
            enabled: !!b.enabled,
            updated_at: b.updatedAt || Date.now(),
            shine: b.shine ?? 40,
            speed: b.speed ?? 1,
            letter_spacing: b.letterSpacing ?? 0,
            flash: !!b.flash,
            repeats: b.repeats ?? 4,
            duration_minutes: b.durationMinutes ?? 0,
          },
        ],
        { Prefer: "return=minimal" }
      );
    }
  } catch (_) {}
}

export async function buildConflictPayload(scope = "full", extra = {}) {
  const version = await loadVersionOnly();
  const base = {
    ok: false,
    error: "conflict",
    message: "The dictionary changed since you last loaded it.",
    version,
    ...extra,
  };

  const s = String(scope || "full").toLowerCase();

  // Account-related scopes only need the accounts list (or nothing).
  if (
    s === "accounts" ||
    s === "accountstatus" ||
    s === "accountdelete" ||
    s === "accountpatch" ||
    s === "account"
  ) {
    try {
      const accounts = await loadAccountsDataOnly();
      return { ...base, accounts };
    } catch (_) {
      return base;
    }
  }

  // Entry / settings / logs patches: client already has local data; just give version.
  if (
    s === "entrypatch" ||
    s === "entrydelete" ||
    s === "settingspatch" ||
    s === "logsreplace" ||
    s === "entries"
  ) {
    return base;
  }

  // Legacy full path still gets the complete record for safety.
  try {
    const full = await loadRecord();
    return { ...base, ...full, version: full.version ?? version };
  } catch (_) {
    return base;
  }
}

