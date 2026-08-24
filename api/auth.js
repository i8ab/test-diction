/**
 * Consolidated Auth endpoint (Hobby plan safe).
 *
 * Routes (via vercel.json rewrites OR query/body):
 *   POST /api/auth-google     → provider=google
 *   POST /api/auth-facebook   → provider=facebook
 *   POST /api/login           → provider=legacy  (retired → 410)
 *
 * Direct call also supported:
 *   POST /api/auth?provider=google|facebook|legacy
 *   POST /api/auth  + body.provider
 *
 * Google  → verifies ID token server-side (never trust client JWT)
 * Facebook → verifies access token + fetches profile server-side
 * Legacy  → Access-code login was removed
 */

import { rateLimit, clientIp } from "../lib/rateLimit.js";

function getProvider(req) {
  const q = req.query?.provider;
  if (typeof q === "string" && q.trim()) return q.trim().toLowerCase();
  if (Array.isArray(q) && q[0]) return String(q[0]).trim().toLowerCase();

  const body = parseBody(req);
  if (body && typeof body.provider === "string" && body.provider.trim()) {
    return body.provider.trim().toLowerCase();
  }
  return "";
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  return body && typeof body === "object" ? body : {};
}

async function handleGoogle(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({
      ok: false,
      error: "Google sign-in is not configured on the server.",
    });
  }

  const body = parseBody(req);
  const credential = body.credential;
  if (!credential || typeof credential !== "string") {
    return res.status(400).json({ ok: false, error: "Missing credential." });
  }

  try {
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
  } catch {
    return res.status(500).json({ ok: false, error: "Could not verify Google sign-in." });
  }
}

async function handleFacebook(req, res) {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    return res.status(500).json({
      ok: false,
      error: "Facebook sign-in is not configured on the server.",
    });
  }

  const body = parseBody(req);
  let accessToken = typeof body.accessToken === "string" ? body.accessToken : "";

  try {
    // Prefer authorization code exchange (mobile redirect).
    if (!accessToken && body.code && typeof body.code === "string") {
      const primary =
        typeof body.redirectUri === "string" && body.redirectUri.trim()
          ? body.redirectUri.trim()
          : "";
      const candidates = [];
      if (primary) candidates.push(primary);
      if (primary.endsWith("/")) candidates.push(primary.slice(0, -1));
      else if (primary) candidates.push(primary + "/");
      try {
        const u = new URL(primary);
        if (!candidates.includes(u.origin + "/")) candidates.push(u.origin + "/");
        if (!candidates.includes(u.origin)) candidates.push(u.origin);
      } catch (_) {}

      if (!candidates.length) {
        return res.status(400).json({
          ok: false,
          error: "Missing redirectUri for Facebook code exchange.",
        });
      }

      let tokenData = null;
      let lastErr = "";
      for (const redirectUri of candidates) {
        const tokenUrl =
          `https://graph.facebook.com/v21.0/oauth/access_token` +
          `?client_id=${encodeURIComponent(appId)}` +
          `&client_secret=${encodeURIComponent(appSecret)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&code=${encodeURIComponent(body.code)}`;
        const tokenRes = await fetch(tokenUrl);
        const td = await tokenRes.json().catch(() => ({}));
        if (tokenRes.ok && td.access_token) {
          tokenData = td;
          break;
        }
        lastErr =
          (td && (td.error_message || (td.error && td.error.message))) ||
          lastErr ||
          "token exchange failed";
      }
      if (!tokenData || !tokenData.access_token) {
        return res.status(401).json({
          ok: false,
          error:
            lastErr ||
            "Could not exchange Facebook code. Check Valid OAuth Redirect URIs matches the site URL exactly.",
        });
      }
      accessToken = tokenData.access_token;
    }

    if (!accessToken) {
      return res.status(400).json({ ok: false, error: "Missing access token or code." });
    }

    const appAccessToken = `${appId}|${appSecret}`;
    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appAccessToken)}`
    );
    const debug = await debugRes.json();
    const info = debug && debug.data;
    // Compare as strings — Meta sometimes returns app_id as number-like string
    if (!info || !info.is_valid || String(info.app_id) !== String(appId)) {
      return res.status(401).json({ ok: false, error: "Invalid or expired Facebook token." });
    }

    const profileRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`
    );
    if (!profileRes.ok) {
      return res.status(401).json({ ok: false, error: "Could not fetch Facebook profile." });
    }
    const profile = await profileRes.json();

    // Some FB accounts hide email — still allow sign-in via stable social id.
    const email =
      (profile.email && String(profile.email).trim()) ||
      `fb_${profile.id}@facebook.local`;

    return res.status(200).json({
      ok: true,
      providerId: profile.id,
      email,
      name: profile.name || (profile.email ? profile.email.split("@")[0] : `user_${profile.id}`),
      picture: (profile.picture && profile.picture.data && profile.picture.data.url) || null,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Could not verify Facebook sign-in.",
    });
  }
}

function handleLegacy(_req, res) {
  return res.status(410).json({
    ok: false,
    error: "Access code login has been removed. Sign in with username and password only.",
  });
}

export default async function handler(req, res) {
  res.setHeader("Allow", "POST");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Auth attempts: 20 / minute / IP (fail-open if Redis missing).
  const ip = clientIp(req);
  const rl = await rateLimit(`auth:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({
      ok: false,
      error: "Too many sign-in attempts. Please wait a minute and try again.",
    });
  }

  const provider = getProvider(req);

  switch (provider) {
    case "google":
      return handleGoogle(req, res);
    case "facebook":
      return handleFacebook(req, res);
    case "legacy":
    case "login":
      return handleLegacy(req, res);
    default:
      return res.status(400).json({
        ok: false,
        error: 'Missing or invalid provider. Use "google", "facebook", or "legacy".',
      });
  }
}
