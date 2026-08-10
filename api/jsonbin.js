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


function pickExamConfig(raw) {
  if (!raw || typeof raw !== "object") return null;
  const date =
    typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
      ? raw.date
      : null;
  let time =
    typeof raw.time === "string" && /^\d{1,2}:\d{2}$/.test(raw.time)
      ? raw.time
      : "09:00";
  if (time) {
    const [hh, mm] = time.split(":");
    time = `${String(Number(hh)).padStart(2, "0")}:${mm}`;
  }
  const color =
    typeof raw.color === "string" && raw.color.trim()
      ? raw.color.trim()
      : "#e85d04";
  return {
    enabled: raw.enabled === true && !!date,
    date,
    time,
    color,
    labelEn: typeof raw.labelEn === "string" ? raw.labelEn : "",
    labelAr: typeof raw.labelAr === "string" ? raw.labelAr : "",
  };
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

async function loadRecord() {
  const [entriesRows, accountsRows, logsRows, settingsRows] = await Promise.all([
    sbFetch("GET", "entries?select=data"),
    sbFetch("GET", "accounts?select=data"),
    // Only the newest 200 logs from the DB (ordered by at desc)
    sbFetch("GET", "logs?select=*&order=at.desc&limit=500"),
    sbFetch("GET", "settings?select=key,value"),
  ]);

  const entries = (entriesRows || []).map((r) => r.data).filter(Boolean);
  const accounts = (accountsRows || []).map((r) => r.data).filter(Boolean);
  // Activity log: last 24 hours only (older rows are dropped from the response
  // and cleaned from the DB on save / daily cron).
  let logs = pruneLogsLast24h((logsRows || []).map(logFromRow));
  logs.sort((a, b) => (a.at || 0) - (b.at || 0));

  let version = 0;
  let siteBanner = null;
  let examConfig = null;
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
  }

  if (!siteBanner) {
    try {
      const bannerRows = await sbFetch("GET", "site_banner?select=*&limit=1");
      if (bannerRows && bannerRows[0]) siteBanner = pickBanner(bannerRows[0]);
    } catch (_) {}
  }

  return { entries, accounts, logs, siteBanner, examConfig, version };
}

/** Delete every row in a table (PostgREST requires a filter). */
async function clearTable(table) {
  // id=not.is.null matches every row that has an id
  await sbFetch("DELETE", `${table}?id=not.is.null`, undefined, {
    Prefer: "return=minimal",
  });
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
    ],
    { Prefer: "resolution=merge-duplicates,return=minimal" }
  );

  // 2) entries
  await clearTable("entries");
  if (record.entries?.length) {
    const rows = record.entries.map((e) => ({ data: e }));
    for (let i = 0; i < rows.length; i += 50) {
      await sbFetch("POST", "entries", rows.slice(i, i + 50), {
        Prefer: "return=minimal",
      });
    }
  }

  // 3) accounts
  await clearTable("accounts");
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
      const record = await loadRecord();
      // Longer edge cache → fewer round-trips to Supabase on repeated opens.
      // Browser still revalidates (max-age=0); Vercel edge can serve a copy
      // up to 30s old and refresh in the background for another 2 minutes.
      res.setHeader(
        "Cache-Control",
        "public, max-age=0, s-maxage=30, stale-while-revalidate=120"
      );
      return res.status(200).json(record);
    }

    if (req.method === "PUT") {
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

        // Accounts are ALWAYS merged by `code` so concurrent signups and
        // stale clients never silently drop a pending (or any other) account.
        // Intentional deletes must send `removeAccountCodes: ["code1", ...]`.
        // The old `mergeAccounts` / full-replace behaviour was the root cause
        // of "one of two signups disappears".
        let nextAccounts = Array.isArray(body.accounts) ? body.accounts : [];
        if (Array.isArray(current.accounts) && current.accounts.length) {
          const byCode = new Map();
          for (const a of current.accounts) {
            if (a && a.code) byCode.set(String(a.code), a);
          }
          for (const a of nextAccounts) {
            if (a && a.code) byCode.set(String(a.code), a);
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

        const payload = {
          entries: Array.isArray(body.entries) ? body.entries : current.entries || [],
          accounts: nextAccounts,
          logs: pruneLogsLast24h(Array.isArray(body.logs) ? body.logs : []),
          siteBanner: nextBanner,
          examConfig: nextExam,
          version: nextVersion,
        };

        await saveFullRecord(payload, nextVersion);
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
