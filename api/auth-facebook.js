// Verifies a Facebook Login access token server-side.
//
// The browser gets a short-lived user access token from the Facebook JS
// SDK and sends it here. We confirm it's genuinely ours (right app, not
// expired) via Facebook's debug_token endpoint, then fetch the profile
// ourselves — never trusting profile fields the client claims to have.
//
// Set in Vercel → Project Settings → Environment Variables:
//   FACEBOOK_APP_ID
//   FACEBOOK_APP_SECRET
//
// POST body: { accessToken: "<token from FB.login()>" }
// Response:  { ok: true, providerId, email, name, picture }
//         or { ok: false, error }

export default async function handler(req, res) {
  res.setHeader("Allow", "POST");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    return res.status(500).json({ ok: false, error: "Facebook sign-in is not configured on the server." });
  }

  const { accessToken } = req.body || {};
  if (!accessToken || typeof accessToken !== "string") {
    return res.status(400).json({ ok: false, error: "Missing access token." });
  }

  try {
    const appAccessToken = `${appId}|${appSecret}`;
    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appAccessToken)}`
    );
    const debug = await debugRes.json();
    const info = debug && debug.data;
    if (!info || !info.is_valid || info.app_id !== appId) {
      return res.status(401).json({ ok: false, error: "Invalid or expired Facebook token." });
    }

    const profileRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`
    );
    if (!profileRes.ok) {
      return res.status(401).json({ ok: false, error: "Could not fetch Facebook profile." });
    }
    const profile = await profileRes.json();

    if (!profile.email) {
      // Facebook accounts can have no email on file (rare, but possible) —
      // we require one since it's how we match/merge accounts.
      return res.status(400).json({
        ok: false,
        error: "This Facebook account has no email on file. Please use email/password or Google sign-in instead.",
      });
    }

    return res.status(200).json({
      ok: true,
      providerId: profile.id,
      email: profile.email,
      name: profile.name || profile.email.split("@")[0],
      picture: (profile.picture && profile.picture.data && profile.picture.data.url) || null,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Could not verify Facebook sign-in." });
  }
}
