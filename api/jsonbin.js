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

      const r = await fetch(API_BASE, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Master-Key": JSONBIN_MASTER_KEY },
        body: JSON.stringify(body),
      });
      if (!r.ok) return res.status(502).json({ error: "Upstream save failed" });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "Proxy error" });
  }
}
