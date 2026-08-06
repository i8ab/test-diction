// Server-side proxy for JSONBin.io.
//
// This file runs on Vercel's servers, never in the browser — so the env
// vars it reads are never shipped to visitors. The client (index.html)
// calls /api/jsonbin instead of talking to JSONBin directly.
//
// Set these in Vercel: Project Settings -> Environment Variables
//   JSONBIN_BIN_ID     e.g. 6a6b0f42f5f4af5e29d4be46
//   JSONBIN_MASTER_KEY your JSONBin X-Master-Key
//
// After adding/changing env vars you must redeploy for them to take effect.
//
// ---------------------------------------------------------------------------
// CONCURRENCY — a real distributed lock (Redis) + a `version` counter
// ---------------------------------------------------------------------------
// The whole dictionary (entries + accounts + logs + siteBanner) lives in a
// single JSONBin record, so without any guard, two people saving around the
// same moment could silently clobber each other: A reads, B reads, B writes,
// A writes — A's write overwrites B's change with no warning ("last write
// wins").
//
//   - Every record carries a `version` integer, bumped by 1 on every PUT.
//     The client sends back the version it last read as `expectedVersion`.
//   - Right before writing, the server re-fetches the CURRENT record from
//     JSONBin and compares its version against `expectedVersion`. If they
//     don't match, someone else saved in between — reject with 409 and hand
//     back the fresh record so the client can reapply its change on top and
//     retry (see persistEntries/persistAccounts in src/App.jsx).
//
// On its own, that read-compare-write is only an OPTIMISTIC check, not a
// true atomic transaction — two requests landing within the same handful of
// milliseconds could both read the same version, both pass the comparison,
// and both write, the second silently clobbering the first. To close that
// completely we wrap the whole read-compare-write in a real distributed
// lock (lib/redis.js, backed by Upstash Redis — the same one used for
// login rate-limiting in api/login.js): only one request can hold the lock
// at a time, so no two writes can ever overlap.
//
// If UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN aren't configured,
// this falls back to the version check alone (no lock) — same
// graceful-degradation pattern as api/login.js. That's still useful (it
// catches and reports the common case) but leaves the small residual race
// described above. Set those two env vars (free Upstash database) to close
// it completely.

import { redisConfigured, acquireLock, releaseLock } from "../lib/redis.js";

const LOCK_KEY = "twoTongues:dictWriteLock";

function pickBanner(record) {
  const b = record && record.siteBanner;
  if (!b || typeof b !== "object") return null;
  let shine = typeof b.shine === "number" ? b.shine : 40;
  if (shine < 0) shine = 0;
  if (shine > 100) shine = 100;
  let speed = typeof b.speed === "number" ? b.speed : 1;
  if (speed < 0.4) speed = 0.4;
  if (speed > 2) speed = 2;
  // Hours the banner stays live after updatedAt. 0 = until turned off.
  let durationHours = typeof b.durationHours === "number" ? b.durationHours : 0;
  if (durationHours < 0) durationHours = 0;
  if (durationHours > 720) durationHours = 720;
  return {
    id: typeof b.id === "string" ? b.id : "",
    message: typeof b.message === "string" ? b.message : "",
    color: typeof b.color === "string" ? b.color : "#146C94",
    enabled: !!b.enabled,
    updatedAt: typeof b.updatedAt === "number" ? b.updatedAt : 0,
    shine,
    speed,
    durationHours,
  };
}

function shapeRecord(record) {
  return {
    entries: (record && record.entries) || [],
    accounts: (record && record.accounts) || [],
    logs: (record && record.logs) || [],
    siteBanner: pickBanner(record),
    version: (record && record.version) || 0,
  };
}

export default async function handler(req, res) {
  const { JSONBIN_BIN_ID, JSONBIN_MASTER_KEY } = process.env;

  if (!JSONBIN_BIN_ID || !JSONBIN_MASTER_KEY) {
    return res.status(500).json({ error: "Server not configured: missing JSONBIN_BIN_ID or JSONBIN_MASTER_KEY env vars." });
  }

  const API_BASE = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

  try {
    if (req.method === "GET") {
      const r = await fetch(`${API_BASE}/latest`, {
        headers: { "X-Master-Key": JSONBIN_MASTER_KEY },
      });
      if (!r.ok) return res.status(502).json({ error: "Upstream fetch failed" });
      const data = await r.json();
      // Every GET used to round-trip all the way to JSONBin.io on Vercel's
      // servers, which is the main source of the "slow/laggy" feeling —
      // JSONBin's free tier can take a noticeable moment to respond, and we
      // paid that cost on *every single visit*, even when nothing changed.
      // Letting Vercel's edge cache serve a short-lived cached copy (and
      // refresh it in the background) means most visits get a near-instant
      // response instead of waiting on JSONBin at all.
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=10, stale-while-revalidate=55");
      return res.status(200).json(shapeRecord(data.record));
    }

    if (req.method === "PUT") {
      let body = req.body;
      // Vercel usually parses JSON bodies automatically, but guard in case
      // it arrives as a raw string.
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (e) { body = null; }
      }
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Invalid body" });
      }
      if (typeof body.expectedVersion !== "number") {
        return res.status(400).json({ error: "Missing expectedVersion — client must send the version it last read." });
      }

      // Hold the distributed lock for the entire read-compare-write below,
      // so no other request's write can land in the gap between our fresh
      // read and our PUT. Falls back to "no lock" if Redis isn't
      // configured — see the concurrency comment above.
      const useLock = redisConfigured();
      let lockToken = null;
      if (useLock) {
        lockToken = await acquireLock(LOCK_KEY);
        if (!lockToken) {
          // Someone else held the lock the whole time we were willing to
          // wait — tell the client it's a conflict (with a same-shaped
          // response as a version mismatch) so its existing retry logic
          // just re-fetches and tries again, rather than needing a
          // separate error path.
          const busyRes = await fetch(`${API_BASE}/latest`, { headers: { "X-Master-Key": JSONBIN_MASTER_KEY } });
          const busyData = busyRes.ok ? await busyRes.json() : {};
          return res.status(409).json({
            error: "conflict",
            message: "The dictionary is busy — please try again.",
            ...shapeRecord(busyData.record),
          });
        }
      }

      try {
        // Re-fetch the freshest copy right before writing (no-cache,
        // bypassing the CDN) so the version check is against the true
        // current state, not a stale edge-cached response from up to ~10s
        // ago. While we hold the lock, nobody else can be mid-write, so
        // this read is guaranteed not to be immediately stale.
        const freshRes = await fetch(`${API_BASE}/latest`, {
          headers: { "X-Master-Key": JSONBIN_MASTER_KEY },
        });
        if (!freshRes.ok) return res.status(502).json({ error: "Upstream fetch failed" });
        const freshData = await freshRes.json();
        const currentVersion = (freshData.record && freshData.record.version) || 0;

        if (currentVersion !== body.expectedVersion) {
          // Someone else saved since the client last read — refuse the write
          // instead of overwriting their change, and hand back the current
          // record so the client can reapply its change and retry.
          return res.status(409).json({
            error: "conflict",
            message: "The dictionary changed since you last loaded it.",
            ...shapeRecord(freshData.record),
          });
        }

        const nextVersion = currentVersion + 1;
        // Preserve siteBanner from body when provided (including null to
        // clear); otherwise keep the existing one so older clients that
        // don't know about the field don't wipe an active announcement.
        let nextBanner;
        if (body.siteBanner !== undefined) {
          nextBanner = body.siteBanner === null ? null : pickBanner({ siteBanner: body.siteBanner });
        } else {
          nextBanner = pickBanner(freshData.record);
        }

        const payload = {
          entries: body.entries,
          accounts: body.accounts,
          logs: body.logs,
          version: nextVersion,
          siteBanner: nextBanner,
        };

        const r = await fetch(API_BASE, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-Master-Key": JSONBIN_MASTER_KEY },
          body: JSON.stringify(payload),
        });
        if (!r.ok) return res.status(502).json({ error: "Upstream save failed" });
        return res.status(200).json({ ok: true, version: nextVersion });
      } finally {
        if (useLock && lockToken) await releaseLock(LOCK_KEY, lockToken);
      }
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "Proxy error" });
  }
}
