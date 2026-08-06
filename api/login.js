// Retired: shared ACCESS_CODE login was removed.
// Authentication is username + password only (client-side against accounts).
// This endpoint remains so old clients get a clear response instead of 404.

export default async function handler(req, res) {
  res.setHeader("Allow", "POST");
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  return res.status(410).json({
    ok: false,
    error: "Access code login has been removed. Sign in with username and password only.",
  });
}
