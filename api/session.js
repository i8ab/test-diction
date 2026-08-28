/**
 * /api/session — DISABLED.
 * Session issuance endpoint is a no-op.
 */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  return res.status(410).json({
    ok: false,
    error: "sessions_disabled",
    message: "Session tokens have been removed from this project.",
  });
}
