// Verifies a Google Sign-In ID token server-side.
//
// The browser gets a `credential` (a signed JWT) from Google Identity
// Services and sends it here. We never trust it client-side — a JWT can be
// copied/replayed by anyone, so it has to be checked against Google's own
// endpoint (which validates the signature, audience, and expiry) before we
// treat the sign-in as real.
//
// Set in Vercel → Project Settings → Environment Variables:
//   GOOGLE_CLIENT_ID   (from Google Cloud Console → OAuth 2.0 Client IDs)
//
// POST body: { credential: "<JWT from Google>" }
// Response:  { ok: true, providerId, email, name, picture }
//         or { ok: false, error }

export default async function handler(req, res) {
  res.setHeader("Allow", "POST");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ ok: false, error: "Google sign-in is not configured on the server." });
  }

  const { credential } = req.body || {};
  if (!credential || typeof credential !== "string") {
    return res.status(400).json({ ok: false, error: "Missing credential." });
  }

  try {
    // Google's tokeninfo endpoint validates signature + expiry + audience
    // for us — no crypto library needed on our side.
    const r = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!r.ok) {
      return res.status(401).json({ ok: false, error: "Invalid or expired Google token." });
    }
    const payload = await r.json();

    if (payload.aud !== clientId) {
      return res.status(401).json({ ok: false, error: "Token was not issued for this app." });
    }
    if (payload.email_verified !== "true" && payload.email_verified !== true) {
      return res.status(401).json({ ok: false, error: "Google account email is not verified." });
    }

    return res.status(200).json({
      ok: true,
      providerId: payload.sub,
      email: payload.email,
      name: payload.name || payload.email.split("@")[0],
      picture: payload.picture || null,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Could not verify Google sign-in." });
  }
}
