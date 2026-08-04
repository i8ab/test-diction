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
// CONCURRENCY — optimistic locking with a `version` counter
// ---------------------------------------------------------------------------
// The whole dictionary (entries + accounts + logs) lives in a single
// JSONBin record, so without any guard, two people saving around the same
// moment could silently clobber each other: A reads, B reads, B writes, A
// writes — A's write overwrites B's change with no warning ("last write
// wins"). To catch that instead of silently losing data:
//   - Every record carries a `version` integer, bumped by 1 on every PUT.
//   - The client must send back the `version` it last read as
//     `expectedVersion`.
//   - Right before writing, the server re-fetches the CURRENT record from
//     JSONBin and compares its version against `expectedVersion`. If they
//     don't match, someone else saved in between — reject with 409 and hand
//     back the fresh record so the client can show a "reload / merge"
//     message instead of destroying that change.
// Honest caveat: this closes the common case, but the read-compare-write
// here still isn't a true atomic transaction (JSONBin has no built-in
// compare-and-swap), so a write landing in the handful of milliseconds
// between our re-fetch and our PUT could still race. For a small shared
// app like this, that's an acceptable residual risk; a proper database
// (e.g. Postgres with a real transaction, or Vercel KV) would remove it
// completely if this ever needs to be airtight.

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
      return res.status(200).json({
        entries: (data.record && data.record.entries) || [],
        accounts: (data.record && data.record.accounts) || [],
        logs: (data.record && data.record.logs) || [],
        version: (data.record && data.record.version) || 0,
      });
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

      // Re-fetch the freshest copy right before writing (no-cache, bypassing
      // the CDN) so the version check is against the true current state,
      // not a stale edge-cached response from up to ~10s ago.
      const freshRes = await fetch(`${API_BASE}/latest`, {
        headers: { "X-Master-Key": JSONBIN_MASTER_KEY },
      });
      if (!freshRes.ok) return res.status(502).json({ error: "Upstream fetch failed" });
      const freshData = await freshRes.json();
      const currentVersion = (freshData.record && freshData.record.version) || 0;

      if (currentVersion !== body.expectedVersion) {
        // Someone else saved since the client last read — refuse the write
        // instead of overwriting their change, and hand back the current
        // record so the client can refresh/retry against it.
        return res.status(409).json({
          error: "conflict",
          message: "The dictionary changed since you last loaded it.",
          entries: (freshData.record && freshData.record.entries) || [],
          accounts: (freshData.record && freshData.record.accounts) || [],
          logs: (freshData.record && freshData.record.logs) || [],
          version: currentVersion,
        });
      }

      const nextVersion = currentVersion + 1;
      const r = await fetch(API_BASE, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Master-Key": JSONBIN_MASTER_KEY },
        body: JSON.stringify({ entries: body.entries, accounts: body.accounts, logs: body.logs, version: nextVersion }),
      });
      if (!r.ok) return res.status(502).json({ error: "Upstream save failed" });
      return res.status(200).json({ ok: true, version: nextVersion });
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "Proxy error" });
  }
}
