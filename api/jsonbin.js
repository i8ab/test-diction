// Server-side proxy — now backed by Supabase instead of JSONBin.
//
// Endpoint stays /api/jsonbin so the frontend (cloudApi.js) needs ZERO changes.
//
// Set these in Vercel → Project Settings → Environment Variables:
//   SUPABASE_URL                 e.g. https://pcuqzpdkpdsoiwlmspbo.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    (preferred)  OR  SUPABASE_ANON_KEY
//
// Tables (public):
//   entries      (id, data jsonb)
//   accounts     (id, code text, data jsonb)
//   logs         (id, action, message, actor_name, actor_code, at)
//   settings     (key text PK, value jsonb)   ← version + site_banner
//   site_banner  (optional mirror)
//
// Optimistic locking uses the integer `version` in settings.

import { redisConfigured, acquireLock, releaseLock } from "../lib/redis.js";
import { rateLimit, clientIp } from "../lib/rateLimit.js";
import { verifySession, bearerFromReq } from "../lib/sessionToken.js";

const LOCK_KEY = "twoTongues:dictWriteLock";

function sbHeaders() {
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

function pickBanner(raw) {
  if (!raw || typeof raw !== "object") return null;
  const b = raw;
  let shine = typeof b.shine === "number" ? b.shine : 40;
  if (shine < 0) shine = 0;
  if (shine > 100) shine = 100;
  let speed = typeof b.speed === "number" ? b.speed : 1;
  if (speed < 0.4) speed = 0.4;
  if (speed > 2) speed = 2;
  let letterSpacing =
    typeof b.letterSpacing === "number"
      ? b.letterSpacing
      : typeof b.letter_spacing === "number"
        ? b.letter_spacing
        : 0;
  if (letterSpacing < 0) letterSpacing = 0;
  if (letterSpacing > 30) letterSpacing = 30;
  let repeats = typeof b.repeats === "number" ? b.repeats : 4;
  if (repeats < 1) repeats = 1;
  if (repeats > 12) repeats = 12;
  repeats = Math.round(repeats);
  let durationMinutes =
    typeof b.durationMinutes === "number"
      ? b.durationMinutes
      : typeof b.duration_minutes === "number"
        ? b.duration_minutes
        : 0;
  if (!durationMinutes && typeof b.durationHours === "number" && b.durationHours > 0) {
    durationMinutes = Math.round(b.durationHours * 60);
  }
  if (durationMinutes < 0) durationMinutes = 0;
  if (durationMinutes > 60 * 24 * 30) durationMinutes = 60 * 24 * 30;
  const updatedAt =
    typeof b.updatedAt === "number"
      ? b.updatedAt
      : typeof b.updated_at === "number"
        ? b.updated_at
        : 0;
  return {
    id: typeof b.id === "string" ? b.id : "",
    message: typeof b.message === "string" ? b.message : "",
    color: typeof b.color === "string" ? b.color : "#146C94",
    enabled: !!b.enabled,
    updatedAt,
    shine,
    speed,
    letterSpacing,
    flash: !!b.flash,
    repeats,
    durationMinutes,
  };
}


function normalizeExamTime(t) {
  if (typeof t !== "string" || !/^\d{1,2}:\d{2}$/.test(t)) return "09:00";
  const [hh, mm] = t.split(":");
  return `${String(Number(hh)).padStart(2, "0")}:${mm}`;
}

function pickExamItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const date =
    typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
      ? raw.date
      : null;
  if (!date) return null;
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const color =
    typeof raw.color === "string" && raw.color.trim()
      ? raw.color.trim()
      : "#e85d04";
  return {
    id,
    date,
    time: normalizeExamTime(raw.time),
    color,
    labelEn: typeof raw.labelEn === "string" ? raw.labelEn : "",
    labelAr: typeof raw.labelAr === "string" ? raw.labelAr : "",
  };
}

/**
 * Supports both legacy single-exam shape { enabled, date, time, ... }
 * and the queue shape { enabled, exams: [...] }.
 * Always persists the full exams array so every client sees the next exam
 * when the current one passes (not only the device that saved it).
 */
function pickExamConfig(raw) {
  if (!raw || typeof raw !== "object") return null;

  let exams = [];
  if (Array.isArray(raw.exams) && raw.exams.length > 0) {
    const seen = new Set();
    for (const it of raw.exams) {
      const item = pickExamItem(it);
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      exams.push(item);
    }
  } else if (
    typeof raw.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
  ) {
    // migrate legacy single exam → queue of one
    const item = pickExamItem(raw);
    if (item) exams = [item];
  }

  // sort by date+time ascending
  exams.sort((a, b) => {
    const ta = examItemTs(a);
    const tb = examItemTs(b);
    return ta - tb;
  });

  const enabled = raw.enabled === true && exams.length > 0;
  // mirror of the first/active item for older readers
  const active = exams[0] || null;

  return {
    enabled,
    exams,
    date: active ? active.date : null,
    time: active ? active.time : "09:00",
    color: active ? active.color : "#e85d04",
    labelEn: active ? active.labelEn : "",
    labelAr: active ? active.labelAr : "",
  };
}

function examItemTs(item) {
  if (!item || !item.date) return Infinity;
  const [y, m, d] = item.date.split("-").map(Number);
  const time = normalizeExamTime(item.time);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? Infinity : dt.getTime();
}


function pickAcademicUnits(raw) {
  if (!Array.isArray(raw)) return null;
  const seen = new Set();
  const out = [];
  for (const u of raw) {
    if (!u || typeof u !== "object") continue;
    const id = typeof u.id === "string" && u.id.trim() ? u.id.trim() : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name =
      typeof u.name === "string" && u.name.trim()
        ? u.name.trim()
        : `Unit ${out.length + 1}`;
    const order =
      typeof u.order === "number" && Number.isFinite(u.order)
        ? u.order
        : out.length + 1;
    out.push({ id, name, order });
  }
  out.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return out.length ? out : null;
}

function logFromRow(row) {
  return {
    id: row.id,
    action: row.action || "",
    message: row.message || "",
    actorName: row.actor_name || row.actorName || "",
    actorCode: row.actor_code || row.actorCode || "",
    at: typeof row.at === "number" ? row.at : Number(row.at) || 0,
  };
}

function logToRow(log) {
  return {
    id: log.id,
    action: log.action || "",
    message: log.message || "",
    actor_name: log.actorName || log.actor_name || "",
    actor_code: log.actorCode || log.actor_code || "",
    at: typeof log.at === "number" ? log.at : Date.now(),
  };
}

/** Keep only logs from the last 24 hours. */
function pruneLogsLast24h(logs) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return (logs || []).filter((l) => (l.at || 0) >= cutoff);
}


async function sbFetch(method, path, body, extraHeaders = {}) {
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
async function loadVersionOnly() {
  try {
    const rows = await sbFetch("GET", "settings?key=eq.version&select=value");
    const v = rows && rows[0] && rows[0].value;
    return typeof v === "number" ? v : Number(v) || 0;
  } catch (_) {
    return 0;
  }
}

async function loadOneAccount(code) {
  const rows = await sbFetch(
    "GET",
    `accounts?code=eq.${encodeURIComponent(code)}&select=data`
  );
  if (rows && rows[0] && rows[0].data) return rows[0].data;
  return null;
}

async function loadAccountsDataOnly() {
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

async function bumpVersion(nextVersion) {
  await sbFetch(
    "POST",
    "settings?on_conflict=key",
    [{ key: "version", value: nextVersion }],
    { Prefer: "resolution=merge-duplicates,return=minimal" }
  );
}

/** Upsert one account row (delete-by-code then insert). */
async function upsertAccountRow(account) {
  const code = String((account && account.code) || "");
  if (!code) return;
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

async function loadRecord() {
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
async function clearTable(table) {
  // id=not.is.null matches every row that has an id
  await sbFetch("DELETE", `${table}?id=not.is.null`, undefined, {
    Prefer: "return=minimal",
  });
}

/**
 * Count rows currently in `entries` (lightweight head-style select).
 * Used to refuse accidental wipe when client sends an empty word list.
 */
async function countEntriesInDb() {
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
function resolveEntriesForSave(incomingEntries, currentEntries, { confirmWipe = false } = {}) {
  const incoming = Array.isArray(incomingEntries) ? incomingEntries : null;
  const current = Array.isArray(currentEntries) ? currentEntries : [];

  // Client omitted entries → keep whatever is already on the server.
  if (incoming === null) return current;

  if (incoming.length === 0 && current.length > 0 && !confirmWipe) {
    const err = new Error(
      "Refusing to wipe the dictionary: client sent 0 words but the server still has entries. " +
        "Pass confirmWipeEntries:true only for an intentional full clear."
    );
    err.code = "EMPTY_ENTRIES_WIPE_BLOCKED";
    err.serverCount = current.length;
    throw err;
  }
  return incoming;
}

/** Extract stable word id from an entry object. */
function entryIdOf(e) {
  if (!e || e.id == null || e.id === "") return "";
  return String(e.id);
}

/**
 * Load all entry ids currently stored in DB (from jsonb data.id).
 * Returns { ids: Set<string>, count: number }.
 */
async function loadEntryIdSet() {
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
async function findEntryRowIdsByWordId(wordId) {
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
async function patchEntryByWordId(entry) {
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
async function saveEntriesSync(entries) {
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

async function saveFullRecord(record, nextVersion) {
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
  // Replace each kept account by code (delete-then-insert avoids unique
  // conflicts and duplicate rows with the same code).
  for (const a of record.accounts || []) {
    const code = String(a && a.code || "");
    if (!code) continue;
    try {
      await sbFetch("DELETE", `accounts?code=eq.${encodeURIComponent(code)}`, undefined, {
        Prefer: "return=minimal",
      });
    } catch (_) {}
  }
  if (record.accounts?.length) {
    const rows = record.accounts.map((a) => ({
      code: a.code || "",
      data: a,
    }));
    for (let i = 0; i < rows.length; i += 50) {
      await sbFetch("POST", "accounts", rows.slice(i, i + 50), {
        Prefer: "return=minimal",
      });
    }
  }

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

export default async function handler(req, res) {
  if (!sbHeaders()) {
    return res.status(500).json({
      error:
        "Server not configured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY",
    });
  }

  try {
    if (req.method === "GET") {
      // دعم الطلبات المجزأة حسب الـ scope لتقليل حجم البيانات (عزل الإجراءات)
      // scope اختياري — لو مش موجود يرجع السجل الكامل (للتوافق مع الكود القديم)
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const scope = (url.searchParams.get("scope") || "full").toLowerCase();
      const code = url.searchParams.get("code") || "";
      const keysParam = url.searchParams.get("keys") || "";

      // Mutable dictionary data must not be cached by intermediaries.
      // The "version" scope is cheap to revalidate briefly (helps soft-sync
      // polling without hammering Supabase on every tab focus).
      if (scope === "version") {
        res.setHeader(
          "Cache-Control",
          "private, max-age=5, stale-while-revalidate=15"
        );
      } else {
        res.setHeader(
          "Cache-Control",
          "private, no-store, no-cache, max-age=0, must-revalidate"
        );
      }

      // ——— نطاقات مجزأة ———
      if (scope === "version") {
        const version = await loadVersionOnly();
        return res.status(200).json({ version });
      }

      if (scope === "account" && code) {
        const account = await loadOneAccount(code);
        return res.status(200).json({ account: account || null });
      }

      if (scope === "accounts") {
        const accounts = await loadAccountsDataOnly();
        return res.status(200).json({ accounts });
      }

      if (scope === "entries") {
        // section اختياري: en-ar | ar-ar | academic — يقلل حجم الرد
        const sectionFilter = (url.searchParams.get("section") || "").trim();
        const allowed = new Set(["en-ar", "ar-ar", "academic"]);
        let entriesRows;
        if (sectionFilter && allowed.has(sectionFilter)) {
          // تصفية على مستوى Supabase (jsonb) لتقليل النقل
          try {
            entriesRows = await sbFetch(
              "GET",
              `entries?select=data&data->>section=eq.${encodeURIComponent(sectionFilter)}`
            );
          } catch (_) {
            entriesRows = null;
          }
          // fallback: جلب الكل ثم تصفية محلياً لو الفلتر فشل
          if (!entriesRows) {
            const all = await sbFetch("GET", "entries?select=data");
            entriesRows = (all || []).filter(
              (r) => r && r.data && r.data.section === sectionFilter
            );
          }
        } else {
          entriesRows = await sbFetch("GET", "entries?select=data");
        }
        const entries = (entriesRows || []).map((r) => r.data).filter(Boolean);
        return res.status(200).json({
          entries,
          section: sectionFilter || null,
        });
      }

      if (scope === "logs") {
        const logsRows = await sbFetch(
          "GET",
          "logs?select=*&order=at.desc&limit=500"
        );
        let logs = pruneLogsLast24h((logsRows || []).map(logFromRow));
        logs.sort((a, b) => (a.at || 0) - (b.at || 0));
        return res.status(200).json({ logs });
      }

      if (scope === "settings") {
        // keys=site_banner,exam_config,academic_units,version
        const wanted = keysParam
          ? keysParam.split(",").map((k) => k.trim()).filter(Boolean)
          : ["site_banner", "exam_config", "academic_units", "version"];
        const settingsRows = await sbFetch("GET", "settings?select=key,value");
        const out = {};
        for (const row of settingsRows || []) {
          if (!wanted.includes(row.key)) continue;
          if (row.key === "version") {
            out.version =
              typeof row.value === "number" ? row.value : Number(row.value) || 0;
          } else if (row.key === "site_banner") {
            out.siteBanner = pickBanner(row.value);
          } else if (row.key === "exam_config") {
            out.examConfig = pickExamConfig(row.value);
          } else if (row.key === "academic_units") {
            out.academicUnits = pickAcademicUnits(row.value);
          }
        }
        // fallback للبانر لو مش موجود في settings
        if (wanted.includes("site_banner") && out.siteBanner == null) {
          try {
            const bannerRows = await sbFetch("GET", "site_banner?select=*&limit=1");
            if (bannerRows && bannerRows[0]) out.siteBanner = pickBanner(bannerRows[0]);
          } catch (_) {}
        }
        return res.status(200).json(out);
      }

      if (scope === "bootstrap") {
        // الحد الأدنى اللازم لبدء الجلسة: settings عامة + version فقط
        // (بدون entries ولا accounts ولا logs)
        const settingsRows = await sbFetch("GET", "settings?select=key,value");
        let version = 0;
        let siteBanner = null;
        let examConfig = null;
        let academicUnits = null;
        for (const row of settingsRows || []) {
          if (row.key === "version") {
            version =
              typeof row.value === "number" ? row.value : Number(row.value) || 0;
          }
          if (row.key === "site_banner") siteBanner = pickBanner(row.value);
          if (row.key === "exam_config") examConfig = pickExamConfig(row.value);
          if (row.key === "academic_units")
            academicUnits = pickAcademicUnits(row.value);
        }
        if (!siteBanner) {
          try {
            const bannerRows = await sbFetch("GET", "site_banner?select=*&limit=1");
            if (bannerRows && bannerRows[0]) siteBanner = pickBanner(bannerRows[0]);
          } catch (_) {}
        }
        return res.status(200).json({
          version,
          siteBanner,
          examConfig,
          academicUnits,
        });
      }

      // افتراضي: السجل الكامل (للتوافق العكسي)
      const record = await loadRecord();
      return res.status(200).json(record);
    }

    if (req.method === "PUT") {
      // Write rate limit: 60 requests / minute / IP (fail-open if Redis missing).
      const ip = clientIp(req);
      const rl = await rateLimit(`write:${ip}`, { limit: 60, windowMs: 60_000 });
      if (!rl.allowed) {
        res.setHeader("Retry-After", "60");
        return res.status(429).json({
          error: "rate_limited",
          message: "Too many write requests. Please wait a moment and try again.",
        });
      }

      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch (e) {
          body = null;
        }
      }
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Invalid body" });
      }
      if (typeof body.expectedVersion !== "number") {
        return res.status(400).json({
          error:
            "Missing expectedVersion — client must send the version it last read.",
        });
      }

      const useLock = redisConfigured();
      let lockToken = null;
      if (useLock) {
        lockToken = await acquireLock(LOCK_KEY);
        if (!lockToken) {
          const busy = await loadRecord();
          return res.status(409).json({
            error: "conflict",
            message: "The dictionary is busy — please try again.",
            ...busy,
          });
        }
      }

      try {
        // ——— Fast partial paths: never load entries/logs unless conflict ———
        const scoped = body.scope;
        if (
          scoped === "accountPatch" ||
          scoped === "entryPatch" ||
          scoped === "entryDelete" ||
          scoped === "settingsPatch" ||
          scoped === "accounts" ||
          scoped === "logsReplace"
        ) {
          const curVersion = await loadVersionOnly();
          if (curVersion !== body.expectedVersion) {
            const full = await loadRecord();
            return res.status(409).json({
              error: "conflict",
              message: "The dictionary changed since you last loaded it.",
              ...full,
            });
          }
          const nextVersion = curVersion + 1;

          if (scoped === "accountPatch") {
            const code = String(body.code || "").trim();
            const patch =
              body.patch && typeof body.patch === "object" ? body.patch : null;
            if (!code || !patch || !Object.keys(patch).length) {
              return res.status(400).json({
                error: "accountPatch requires code and a non-empty patch object",
              });
            }
            const prev = await loadOneAccount(code);
            if (!prev) {
              return res.status(404).json({ error: "Account not found" });
            }
            // Privilege fields must never be elevated via accountPatch from the client.
            // role / isAdmin / status changes go through the admin accounts scope only.
            const {
              code: _c,
              role: _r,
              isAdmin: _ia,
              status: _st,
              ...safePatch
            } = patch;
            if (patch.passwordHash != null) safePatch.passwordHash = patch.passwordHash;
            const merged = {
              ...prev,
              ...safePatch,
              code: prev.code,
              role: prev.role,
              isAdmin: prev.isAdmin,
              status: prev.status,
            };
            // Explicit null/empty removes Google binding fields permanently
            for (const k of ["authProvider", "socialId", "email"]) {
              if (
                Object.prototype.hasOwnProperty.call(safePatch, k) &&
                (safePatch[k] === null || safePatch[k] === "")
              ) {
                delete merged[k];
              }
            }
            await bumpVersion(nextVersion);
            await upsertAccountRow(merged);
            return res.status(200).json({
              ok: true,
              version: nextVersion,
              scope: "accountPatch",
              account: merged,
            });
          }

          if (scoped === "entryPatch") {
            const entry = body.entry && typeof body.entry === "object" ? body.entry : null;
            const entryId =
              entry && entry.id != null ? String(entry.id) : String(body.id || "");
            if (!entryId || !entry) {
              return res.status(400).json({
                error: "entryPatch requires entry object with id",
              });
            }
            const payload = { ...entry, id: entryId };
            await bumpVersion(nextVersion);
            // Prefer in-place UPDATE; insert only if the word does not exist yet.
            let patched = false;
            try {
              patched = await patchEntryByWordId(payload);
            } catch (_) {
              patched = false;
            }
            if (!patched) {
              await sbFetch(
                "POST",
                "entries",
                [{ data: payload }],
                { Prefer: "return=minimal" }
              );
            }
            return res.status(200).json({
              ok: true,
              version: nextVersion,
              scope: "entryPatch",
              id: entryId,
              updated: patched,
            });
          }

          if (scoped === "entryDelete") {
            const entryId = String(body.id || "").trim();
            if (!entryId) {
              return res.status(400).json({ error: "entryDelete requires id" });
            }
            await bumpVersion(nextVersion);
            try {
              await sbFetch(
                "DELETE",
                `entries?data->>id=eq.${encodeURIComponent(entryId)}`,
                undefined,
                { Prefer: "return=minimal" }
              );
            } catch (_) {}
            return res.status(200).json({
              ok: true,
              version: nextVersion,
              scope: "entryDelete",
              id: entryId,
            });
          }

          if (scoped === "settingsPatch") {
            const key = typeof body.key === "string" ? body.key.trim() : "";
            if (!key || key === "version") {
              return res.status(400).json({
                error: "settingsPatch requires a key (not version)",
              });
            }
            let value = body.value;
            if (key === "site_banner" && value != null) value = pickBanner(value);
            if (key === "exam_config" && value != null) value = pickExamConfig(value);
            if (key === "academic_units" && value != null) {
              value = pickAcademicUnits(value);
            }
            await sbFetch(
              "POST",
              "settings?on_conflict=key",
              [
                { key: "version", value: nextVersion },
                { key, value: value === undefined ? null : value },
              ],
              { Prefer: "resolution=merge-duplicates,return=minimal" }
            );
            return res.status(200).json({
              ok: true,
              version: nextVersion,
              scope: "settingsPatch",
              key,
            });
          }

          if (scoped === "accounts") {
            // Session rules (the right balance):
            // - If Bearer is sent, it must be valid (else 401).
            // - Approve/remove account (privilege ops): when SESSION_SECRET is
            //   configured, a valid admin|teacher token is REQUIRED.
            // - Ordinary account list saves without privilege flags: still
            //   allowed without token so study clients keep working after 12h.
            const bearer = bearerFromReq(req);
            let sessionClaims = null;
            if (bearer) {
              const verified = verifySession(bearer);
              if (!verified.ok) {
                return res.status(401).json({
                  error: "unauthorized",
                  message: verified.error || "Invalid or expired session token",
                });
              }
              sessionClaims = verified.claims;
            }
            const isPrivOp =
              (Array.isArray(body.removeAccountCodes) &&
                body.removeAccountCodes.length > 0) ||
              (Array.isArray(body.approveAccountCodes) &&
                body.approveAccountCodes.length > 0);
            const sessionsEnabled =
              typeof process.env.SESSION_SECRET === "string" &&
              process.env.SESSION_SECRET.length >= 16;
            if (isPrivOp && sessionsEnabled) {
              if (!sessionClaims) {
                return res.status(401).json({
                  error: "unauthorized",
                  message:
                    "Secure session required for this admin action. Sign in again.",
                });
              }
              if (
                sessionClaims.role !== "admin" &&
                sessionClaims.role !== "teacher"
              ) {
                return res.status(403).json({
                  error: "forbidden",
                  message: "Admin or teacher session required for this action",
                });
              }
            }

            // Load accounts table only (not entries/logs)
            const currentAccounts = await loadAccountsDataOnly();
            const statusRank = (s) => {
              if (s === "active" || s === "blocked") return 2;
              if (s === "pending") return 1;
              return 0;
            };
            const mergeAccountRow = (prev, incoming) => {
              if (!prev) return incoming;
              if (!incoming) return prev;
              const merged = { ...prev, ...incoming };
              if (statusRank(prev.status) > statusRank(incoming.status)) {
                merged.status = prev.status;
              }
              // Explicit null clears Google binding / email so unlink persists
              const CLEARABLE = ["authProvider", "socialId", "email"];
              for (const k of CLEARABLE) {
                if (
                  Object.prototype.hasOwnProperty.call(incoming, k) &&
                  (incoming[k] === null || incoming[k] === "")
                ) {
                  delete merged[k];
                }
              }
              return merged;
            };
            let nextAccounts = Array.isArray(body.accounts) ? body.accounts : [];
            if (currentAccounts.length) {
              const byCode = new Map();
              for (const a of currentAccounts) {
                if (a && a.code) byCode.set(String(a.code), a);
              }
              for (const a of nextAccounts) {
                if (a && a.code) {
                  const key = String(a.code);
                  byCode.set(key, mergeAccountRow(byCode.get(key), a));
                }
              }
              nextAccounts = Array.from(byCode.values());
            }
            const removeCodes = Array.isArray(body.removeAccountCodes)
              ? body.removeAccountCodes.map((c) => String(c)).filter(Boolean)
              : [];
            if (removeCodes.length) {
              const drop = new Set(removeCodes);
              nextAccounts = nextAccounts.filter(
                (a) => a && a.code && !drop.has(String(a.code))
              );
            }
            const approveCodes = Array.isArray(body.approveAccountCodes)
              ? body.approveAccountCodes.map((c) => String(c)).filter(Boolean)
              : [];
            if (approveCodes.length) {
              const forceActive = new Set(approveCodes);
              nextAccounts = nextAccounts.map((a) =>
                a && a.code && forceActive.has(String(a.code)) && a.status !== "blocked"
                  ? { ...a, status: "active" }
                  : a
              );
            }
            await bumpVersion(nextVersion);
            const keepCodes = new Set(
              nextAccounts.map((a) => String((a && a.code) || "")).filter(Boolean)
            );
            try {
              const existing = await sbFetch("GET", "accounts?select=code");
              const toDelete = (existing || [])
                .map((r) => String((r && r.code) || ""))
                .filter((c) => c && !keepCodes.has(c));
              for (const code of toDelete) {
                await sbFetch(
                  "DELETE",
                  `accounts?code=eq.${encodeURIComponent(code)}`,
                  undefined,
                  { Prefer: "return=minimal" }
                );
              }
            } catch (_) {}
            // Only rewrite accounts that changed vs current
            const prevMap = new Map(
              currentAccounts.map((a) => [String(a.code), a])
            );
            for (const a of nextAccounts) {
              const code = String((a && a.code) || "");
              if (!code) continue;
              const prev = prevMap.get(code);
              let changed = !prev;
              if (prev) {
                try {
                  changed = JSON.stringify(prev) !== JSON.stringify(a);
                } catch (_) {
                  changed = true;
                }
              }
              if (changed) await upsertAccountRow(a);
            }
            return res.status(200).json({
              ok: true,
              version: nextVersion,
              scope: "accounts",
            });
          }

          if (scoped === "logsReplace") {
            // Replace activity logs only — does not touch entries/accounts/settings.
            const logsToSave = pruneLogsLast24h(
              Array.isArray(body.logs) ? body.logs : []
            );
            await bumpVersion(nextVersion);
            await clearTable("logs");
            if (logsToSave.length) {
              const rows = logsToSave.map(logToRow);
              for (let i = 0; i < rows.length; i += 100) {
                await sbFetch("POST", "logs", rows.slice(i, i + 100), {
                  Prefer: "return=minimal",
                });
              }
            }
            return res.status(200).json({
              ok: true,
              version: nextVersion,
              scope: "logsReplace",
              count: logsToSave.length,
            });
          }
        }

        // ——— Full record path (bulk / legacy) ———
        const current = await loadRecord();
        if (current.version !== body.expectedVersion) {
          return res.status(409).json({
            error: "conflict",
            message: "The dictionary changed since you last loaded it.",
            ...current,
          });
        }

        const nextVersion = current.version + 1;

        let nextBanner;
        if (body.siteBanner !== undefined) {
          nextBanner =
            body.siteBanner === null ? null : pickBanner(body.siteBanner);
        } else {
          nextBanner = current.siteBanner;
        }

        // Exam countdown: only overwrite when the client explicitly sends it.
        // Otherwise keep whatever is already stored so normal saves cannot
        // wipe an admin-set countdown.
        let nextExam;
        if (body.examConfig !== undefined) {
          nextExam =
            body.examConfig === null ? null : pickExamConfig(body.examConfig);
        } else {
          nextExam = current.examConfig || null;
        }

        let nextAcademicUnits;
        if (body.academicUnits !== undefined) {
          nextAcademicUnits =
            body.academicUnits === null
              ? null
              : pickAcademicUnits(body.academicUnits);
        } else {
          nextAcademicUnits = current.academicUnits || null;
        }

        // Accounts are ALWAYS merged by `code` so concurrent signups and
        // stale clients never silently drop a pending (or any other) account.
        // Intentional deletes must send `removeAccountCodes: ["code1", ...]`.
        // The old `mergeAccounts` / full-replace behaviour was the root cause
        // of "one of two signups disappears".
        //
        // Status is never downgraded by a stale client: once an admin has
        // approved (active) or blocked an account, a concurrent save that
        // still carries status:"pending" must NOT resurrect the pending UI.
        const statusRank = (s) => {
          if (s === "active" || s === "blocked") return 2;
          if (s === "pending") return 1;
          return 0;
        };
        const mergeAccountRow = (prev, incoming) => {
          if (!prev) return incoming;
          if (!incoming) return prev;
          const merged = { ...prev, ...incoming };
          if (statusRank(prev.status) > statusRank(incoming.status)) {
            merged.status = prev.status;
          }
          const CLEARABLE = ["authProvider", "socialId", "email"];
          for (const k of CLEARABLE) {
            if (
              Object.prototype.hasOwnProperty.call(incoming, k) &&
              (incoming[k] === null || incoming[k] === "")
            ) {
              delete merged[k];
            }
          }
          return merged;
        };
        let nextAccounts = Array.isArray(body.accounts) ? body.accounts : [];
        if (Array.isArray(current.accounts) && current.accounts.length) {
          const byCode = new Map();
          for (const a of current.accounts) {
            if (a && a.code) byCode.set(String(a.code), a);
          }
          for (const a of nextAccounts) {
            if (a && a.code) {
              const key = String(a.code);
              byCode.set(key, mergeAccountRow(byCode.get(key), a));
            }
          }
          nextAccounts = Array.from(byCode.values());
        }

        // Explicit removals (reject / admin-delete). Applied after the merge
        // so a concurrent signup cannot be erased by accident.
        const removeCodes = Array.isArray(body.removeAccountCodes)
          ? body.removeAccountCodes.map((c) => String(c)).filter(Boolean)
          : [];
        if (removeCodes.length) {
          const drop = new Set(removeCodes);
          nextAccounts = nextAccounts.filter((a) => a && a.code && !drop.has(String(a.code)));
        }

        // Explicit approvals — force active so stale pending cannot win.
        const approveCodes = Array.isArray(body.approveAccountCodes)
          ? body.approveAccountCodes.map((c) => String(c)).filter(Boolean)
          : [];
        if (approveCodes.length) {
          const forceActive = new Set(approveCodes);
          nextAccounts = nextAccounts.map((a) =>
            a && a.code && forceActive.has(String(a.code)) && a.status !== "blocked"
              ? { ...a, status: "active" }
              : a
          );
        }

        // Entries: never allow a stale/empty client to wipe the shared dictionary.
        // - omitted body.entries → keep server copy
        // - body.entries: [] with server non-empty → 409 unless confirmWipeEntries
        let nextEntries;
        try {
          nextEntries = resolveEntriesForSave(body.entries, current.entries || [], {
            confirmWipe: body.confirmWipeEntries === true,
          });
        } catch (guardErr) {
          if (guardErr && guardErr.code === "EMPTY_ENTRIES_WIPE_BLOCKED") {
            return res.status(409).json({
              error: "empty_entries_wipe_blocked",
              message:
                guardErr.message ||
                "Refusing to wipe the dictionary with an empty word list.",
              serverCount: guardErr.serverCount || (current.entries || []).length,
              ...current,
            });
          }
          throw guardErr;
        }

        const payload = {
          entries: nextEntries,
          accounts: nextAccounts,
          logs: pruneLogsLast24h(Array.isArray(body.logs) ? body.logs : []),
          siteBanner: nextBanner,
          examConfig: nextExam,
          academicUnits: nextAcademicUnits,
          version: nextVersion,
        };

        try {
          await saveFullRecord(payload, nextVersion);
        } catch (saveErr) {
          if (saveErr && saveErr.code === "EMPTY_ENTRIES_WIPE_BLOCKED") {
            return res.status(409).json({
              error: "empty_entries_wipe_blocked",
              message: saveErr.message,
              serverCount: saveErr.serverCount,
              ...current,
            });
          }
          throw saveErr;
        }
        return res.status(200).json({ ok: true, version: nextVersion });
      } finally {
        if (useLock && lockToken) await releaseLock(LOCK_KEY, lockToken);
      }
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("Supabase proxy error:", e);
    return res.status(500).json({
      error: "Proxy error",
      detail: String(e.message || e),
    });
  }
}
