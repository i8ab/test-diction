// Server-side proxy — Supabase backend. Public contract unchanged: /api/jsonbin
// Phase D: helpers live in lib/jsonbinMappers.js, lib/jsonbinDb.js, lib/jsonbinAuthz.js
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)
// Optimistic locking via integer `version` in settings.

import {
  redisConfigured,
  acquireLock,
  releaseLock,
  cacheGet,
  cacheSet,
  invalidateHotCaches,
} from "../lib/redis.js";
import { rateLimit, clientIp } from "../lib/rateLimit.js";
import {
  authorizeWrite,
  sanitizePublicAccountsMerge,
  badRequestPayload,
  notFoundPayload,
} from "../lib/jsonbinAuthz.js";
import {
  requestId,
  applySecurityHeaders,
  applyCors,
  applyRateLimitHeaders,
  guardBodySize,
  normalizeActorCode,
} from "../lib/jsonbinHttp.js";
import {
  pickBanner,
  pickExamConfig,
  pickAcademicUnits,
  logFromRow,
  logToRow,
  pruneLogsLast24h,
  mapEntriesLight,
  mapAccountsLight,
  resolveEntriesForSave
} from "../lib/jsonbinMappers.js";
import {
  sbHeaders,
  sbFetch,
  loadVersionOnly,
  loadOneAccount,
  loadAccountsDataOnly,
  bumpVersion,
  upsertAccountRow,
  upsertAccountsBatch,
  loadRecord,
  clearTable,
  patchEntryByWordId,
  saveFullRecord,
  buildConflictPayload
} from "../lib/jsonbinDb.js";

const LOCK_KEY = "twoTongues:dictWriteLock";

export default async function handler(req, res) {
  const rid = requestId(req);
  applyCors(req, res);
  applySecurityHeaders(res, rid);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!sbHeaders()) {
    return res.status(500).json({
      ok: false,
      error: "not_configured",
      message:
        "Server not configured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY",
      requestId: rid,
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

      // Soft rate-limit only the expensive full record (scoped reads stay free).
      if (scope === "full") {
        const ip = clientIp(req);
        const rl = await rateLimit(`read-full:${ip}`, {
          limit: 30,
          windowMs: 60_000,
        });
        applyRateLimitHeaders(res, rl);
        if (!rl.allowed) {
          res.setHeader("Retry-After", "30");
          return res.status(429).json({
            ok: false,
            error: "rate_limited",
            message: "Too many full-record reads. Use scoped endpoints.",
            requestId: rid,
          });
        }
      }

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
        let version = await cacheGet("tt:version");
        if (version == null) {
          version = await loadVersionOnly();
          await cacheSet("tt:version", version, 8);
        }
        const etag = `W/"v${version}"`;
        res.setHeader("ETag", etag);
        res.setHeader(
          "Cache-Control",
          "private, max-age=5, stale-while-revalidate=15"
        );
        const inm = req.headers["if-none-match"];
        if (inm && String(inm).trim() === etag) {
          return res.status(304).end();
        }
        return res.status(200).json({ version });
      }

      if (scope === "account" && code) {
        const account = await loadOneAccount(code);
        return res.status(200).json({ account: account || null });
      }

      if (scope === "accounts") {
        const fields = (url.searchParams.get("fields") || "full").toLowerCase();
        const light = fields === "light" || fields === "list";
        let accounts = await cacheGet("tt:accounts");
        if (!accounts) {
          accounts = await loadAccountsDataOnly();
          await cacheSet("tt:accounts", accounts, 12);
        }
        const out = light ? mapAccountsLight(accounts) : accounts;
        const ver = await cacheGet("tt:version");
        const etag = `W/"a${light ? "L" : "F"}${ver != null ? ver : accounts.length}"`;
        res.setHeader("ETag", etag);
        const inm = req.headers["if-none-match"];
        if (inm && String(inm).trim() === etag) {
          return res.status(304).end();
        }
        return res.status(200).json({
          accounts: out,
          fields: light ? "light" : "full",
        });
      }

      // Single full entry (detail / edit) — small payload, full fields
      if (scope === "entry") {
        const entryId = (url.searchParams.get("id") || "").trim();
        if (!entryId) {
          return res.status(400).json({ error: "entry scope requires id" });
        }
        let row = null;
        try {
          const rows = await sbFetch(
            "GET",
            `entries?select=data&data->>id=eq.${encodeURIComponent(entryId)}&limit=1`
          );
          row = rows && rows[0] ? rows[0].data : null;
        } catch (_) {
          row = null;
        }
        if (!row) {
          const all = await sbFetch("GET", "entries?select=data");
          row =
            (all || [])
              .map((r) => r.data)
              .find((e) => e && String(e.id) === entryId) || null;
        }
        return res.status(200).json({ entry: row });
      }

      if (scope === "entries") {
        // section: en-ar | ar-ar | academic
        // fields=light → list-sized objects (bandwidth)
        // limit + after → cursor pagination
        const sectionFilter = (url.searchParams.get("section") || "").trim();
        const allowed = new Set(["en-ar", "ar-ar", "academic"]);
        const fields = (url.searchParams.get("fields") || "full").toLowerCase();
        const light = fields === "light" || fields === "list";
        const limitRaw = Number(url.searchParams.get("limit") || 0);
        const limit =
          Number.isFinite(limitRaw) && limitRaw > 0
            ? Math.min(Math.floor(limitRaw), 200)
            : 0;
        const after = (url.searchParams.get("after") || "").trim();

        const finish = (list, extra = {}) => {
          const entries = light ? mapEntriesLight(list) : list;
          return res.status(200).json({
            entries,
            section: sectionFilter || null,
            fields: light ? "light" : "full",
            ...extra,
          });
        };

        let entriesRows;
        if (limit > 0) {
          try {
            let path = `entries?select=data&order=data->>id.asc&limit=${limit}`;
            if (sectionFilter && allowed.has(sectionFilter)) {
              path += `&data->>section=eq.${encodeURIComponent(sectionFilter)}`;
            }
            if (after) {
              path += `&data->>id=gt.${encodeURIComponent(after)}`;
            }
            entriesRows = await sbFetch("GET", path);
          } catch (_) {
            entriesRows = null;
          }
          if (!entriesRows) {
            const all = await sbFetch("GET", "entries?select=data");
            let list = (all || []).map((r) => r.data).filter(Boolean);
            if (sectionFilter && allowed.has(sectionFilter)) {
              list = list.filter((e) => e && e.section === sectionFilter);
            }
            list.sort((a, b) =>
              String(a.id || "").localeCompare(String(b.id || ""))
            );
            if (after) {
              list = list.filter((e) => String(e.id || "") > after);
            }
            const page = list.slice(0, limit);
            const nextCursor =
              page.length === limit
                ? String(page[page.length - 1].id || "")
                : null;
            return finish(page, { nextCursor, hasMore: !!nextCursor });
          }
          const entries = (entriesRows || []).map((r) => r.data).filter(Boolean);
          const nextCursor =
            entries.length === limit
              ? String(entries[entries.length - 1].id || "")
              : null;
          return finish(entries, { nextCursor, hasMore: !!nextCursor });
        }

        if (sectionFilter && allowed.has(sectionFilter)) {
          try {
            entriesRows = await sbFetch(
              "GET",
              `entries?select=data&data->>section=eq.${encodeURIComponent(sectionFilter)}`
            );
          } catch (_) {
            entriesRows = null;
          }
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
        return finish(entries);
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
        const sendBootstrap = (payload) => {
          const etag = `W/"b${payload.version || 0}"`;
          res.setHeader("ETag", etag);
          res.setHeader(
            "Cache-Control",
            "private, max-age=10, stale-while-revalidate=20"
          );
          const inm = req.headers["if-none-match"];
          if (inm && String(inm).trim() === etag) {
            return res.status(304).end();
          }
          return res.status(200).json(payload);
        };

        let cached = await cacheGet("tt:bootstrap");
        if (cached && typeof cached === "object") {
          return sendBootstrap(cached);
        }
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
        const payload = {
          version,
          siteBanner,
          examConfig,
          academicUnits,
        };
        await cacheSet("tt:bootstrap", payload, 25);
        return sendBootstrap(payload);
      }

      // افتراضي: السجل الكامل (للتوافق العكسي فقط — تجنّبه في المسار العادي)
      res.setHeader("X-Deprecated-Scope", "full");
      res.setHeader(
        "Warning",
        '299 - "scope=full is expensive; use scoped endpoints (entries, accounts, bootstrap, version)"'
      );
      const record = await loadRecord();
      return res.status(200).json(record);
    }

    if (req.method === "PUT") {
      // Write rate limit: 60 requests / minute / IP (fail-open if Redis missing).
      const ip = clientIp(req);
      const rl = await rateLimit(`write:${ip}`, { limit: 60, windowMs: 60_000 });
      applyRateLimitHeaders(res, rl);
      if (!rl.allowed) {
        res.setHeader("Retry-After", "60");
        return res.status(429).json({
          ok: false,
          error: "rate_limited",
          message: "Too many write requests. Please wait a moment and try again.",
          requestId: rid,
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
        return res.status(400).json({
          ...badRequestPayload("Invalid body", "invalid_body"),
          requestId: rid,
        });
      }

      const sizeGuard = guardBodySize(body);
      if (!sizeGuard.ok) {
        return res.status(sizeGuard.status).json({
          ...sizeGuard.payload,
          requestId: rid,
        });
      }

      if (typeof body.expectedVersion !== "number" || !Number.isFinite(body.expectedVersion)) {
        return res.status(400).json({
          ...badRequestPayload(
            "Missing expectedVersion — client must send the version it last read.",
            "missing_expected_version"
          ),
          requestId: rid,
        });
      }

      // Normalize actorCode (reject weird shapes; empty stays empty for signup)
      if (body.actorCode != null || body.actor_code != null) {
        const normalized = normalizeActorCode(body.actorCode || body.actor_code);
        if ((body.actorCode || body.actor_code) && !normalized) {
          return res.status(400).json({
            ...badRequestPayload("Invalid actorCode format.", "invalid_actor"),
            requestId: rid,
          });
        }
        body.actorCode = normalized;
        delete body.actor_code;
      }

      // Ownership / role checks (actor loaded from DB — never trust body.role)
      const writeScope = body.scope || "full";
      const authz = await authorizeWrite(writeScope, body, loadOneAccount);
      if (!authz.ok) {
        return res.status(authz.status).json({
          ...authz.payload,
          requestId: rid,
        });
      }
      // Stash for handlers that need actor context
      body.__authz = authz;

      const useLock = redisConfigured();
      let lockToken = null;
      if (useLock) {
        lockToken = await acquireLock(LOCK_KEY);
        if (!lockToken) {
          // Busy lock: return minimal payload instead of the whole dictionary.
          const busyPayload = await buildConflictPayload(body.scope || "full", {
            message: "The dictionary is busy — please try again.",
          });
          return res.status(409).json(busyPayload);
        }
      }

      try {
        // ——— Fast partial paths: never load entries/logs unless conflict ———
        const scoped = body.scope;
        if (
          scoped === "accountPatch" ||
          scoped === "accountStatus" ||
          scoped === "accountDelete" ||
          scoped === "entryPatch" ||
          scoped === "entryDelete" ||
          scoped === "settingsPatch" ||
          scoped === "accounts" ||
          scoped === "logsReplace"
        ) {
          const curVersion = await loadVersionOnly();
          if (curVersion !== body.expectedVersion) {
            const payload = await buildConflictPayload(scoped);
            return res.status(409).json(payload);
          }
          const nextVersion = curVersion + 1;

          // ——— Fast path: change only one account's status (accept / reject / block) ———
          if (scoped === "accountStatus") {
            const code = String(body.code || "").trim();
            const newStatus = String(body.status || "").trim();
            const allowed = new Set(["active", "blocked", "pending"]);
            if (!code || !allowed.has(newStatus)) {
              return res.status(400).json(
                badRequestPayload(
                  "accountStatus requires code and status (active|blocked|pending)"
                )
              );
            }
            const prev = await loadOneAccount(code);
            if (!prev) {
              return res.status(404).json(notFoundPayload("Account not found"));
            }
            if (prev.status === newStatus) {
              return res.status(200).json({
                ok: true,
                version: curVersion,
                scope: "accountStatus",
                account: prev,
              });
            }
            const merged = { ...prev, status: newStatus };
            await bumpVersion(nextVersion);
            await upsertAccountRow(merged);
            return res.status(200).json({
              ok: true,
              version: nextVersion,
              scope: "accountStatus",
              account: merged,
            });
          }

          // ——— Fast path: delete one account (reject / remove) ———
          if (scoped === "accountDelete") {
            const code = String(body.code || "").trim();
            if (!code) {
              return res.status(400).json(
                badRequestPayload("accountDelete requires code")
              );
            }
            await bumpVersion(nextVersion);
            try {
              await sbFetch(
                "DELETE",
                `accounts?code=eq.${encodeURIComponent(code)}`,
                undefined,
                { Prefer: "return=minimal" }
              );
            } catch (_) {}
            return res.status(200).json({
              ok: true,
              version: nextVersion,
              scope: "accountDelete",
              code,
            });
          }

          if (scoped === "accountPatch") {
            const code = String(body.code || "").trim();
            const patch =
              body.patch && typeof body.patch === "object" ? body.patch : null;
            if (!code || !patch || !Object.keys(patch).length) {
              return res.status(400).json(
                badRequestPayload(
                  "accountPatch requires code and a non-empty patch object"
                )
              );
            }
            const prev = await loadOneAccount(code);
            if (!prev) {
              return res.status(404).json(notFoundPayload("Account not found"));
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
              return res.status(400).json(
                badRequestPayload("entryPatch requires entry object with id")
              );
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
              return res.status(400).json(
                badRequestPayload("entryDelete requires id")
              );
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
              return res.status(400).json(
                badRequestPayload("settingsPatch requires a key (not version)")
              );
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
            await invalidateHotCaches();
            return res.status(200).json({
              ok: true,
              version: nextVersion,
              scope: "settingsPatch",
              key,
            });
          }

          if (scoped === "accounts") {
            // Load accounts table only (not entries/logs).
            // Non-staff (signup) path is sanitized — cannot elevate role/status.
            const currentAccounts = await loadAccountsDataOnly();
            const authzInfo = body.__authz || {};
            const statusRank = (s) => {
              if (s === "active" || s === "blocked") return 2;
              if (s === "pending") return 1;
              return 0;
            };
            const mergeAccountRow = (prev, incoming) => {
              if (!prev) return incoming;
              if (!incoming) return prev;
              // Do not let undefined/light-omitted keys wipe profile fields
              // (bacTrack, avatar, Google link, …) already stored on prev.
              const merged = { ...prev };
              for (const k of Object.keys(incoming)) {
                if (incoming[k] !== undefined) merged[k] = incoming[k];
              }
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
            if (authzInfo.publicAccounts) {
              nextAccounts = sanitizePublicAccountsMerge(
                nextAccounts,
                currentAccounts
              );
            }
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
            // Only rewrite accounts that changed vs current (batched upsert)
            const prevMap = new Map(
              currentAccounts.map((a) => [String(a.code), a])
            );
            const changedAccounts = [];
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
              if (changed) changedAccounts.push(a);
            }
            await upsertAccountsBatch(changedAccounts);
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

    res.setHeader("Allow", "GET, PUT, OPTIONS");
    return res.status(405).json({
      ok: false,
      error: "method_not_allowed",
      message: "Method not allowed",
      requestId: rid,
    });
  } catch (e) {
    console.error("Supabase proxy error:", e);
    return res.status(500).json({
      ok: false,
      error: "proxy_error",
      message: "Proxy error",
      detail: String(e.message || e),
      requestId: rid,
    });
  }
}
