/**
 * Social sign-in helpers — load provider SDKs lazily and hand tokens to
 * /api/auth for server-side verification before performSocialLogin() runs.
 *
 * Required env (client, public):
 *   VITE_GOOGLE_CLIENT_ID
 *   VITE_FACEBOOK_APP_ID
 *
 * Server secrets (Vercel):
 *   GOOGLE_CLIENT_ID
 *   FACEBOOK_APP_ID
 *   FACEBOOK_APP_SECRET
 */

let googleScriptPromise = null;
let facebookScriptPromise = null;

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google sign-in."));
    document.head.appendChild(s);
  });
  return googleScriptPromise;
}

/**
 * Opens Google One Tap / popup and resolves with a verified profile:
 *   { providerId, email, name, picture }
 */
export function signInWithGoogle() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return Promise.reject(
      new Error("Google sign-in isn't set up yet — missing VITE_GOOGLE_CLIENT_ID.")
    );
  }

  return loadGoogleScript().then(
    () =>
      new Promise((resolve, reject) => {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response) => {
              if (!response?.credential) {
                reject(new Error("Google sign-in was cancelled."));
                return;
              }
              try {
                // Rewrites map /api/auth-google → /api/auth?provider=google
                const r = await fetch("/api/auth-google", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ credential: response.credential }),
                });
                const data = await r.json();
                if (!data.ok) {
                  reject(new Error(data.error || "Google sign-in failed."));
                  return;
                }
                resolve({
                  providerId: data.providerId,
                  email: data.email,
                  name: data.name,
                  picture: data.picture,
                });
              } catch (_) {
                reject(new Error("Couldn't verify Google sign-in — check your connection."));
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          // Prefer the popup button flow (more reliable than One Tap alone)
          window.google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              // Fallback: render a temporary invisible button and click it
              const host = document.createElement("div");
              host.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;";
              document.body.appendChild(host);
              window.google.accounts.id.renderButton(host, {
                type: "standard",
                theme: "outline",
                size: "large",
                text: "continue_with",
                shape: "rectangular",
                logo_alignment: "left",
              });
              const btn = host.querySelector("div[role=button]");
              if (btn) {
                btn.click();
              } else {
                reject(new Error("Couldn't start Google sign-in."));
              }
              setTimeout(() => host.remove(), 4000);
            }
          });
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Couldn't start Google sign-in."));
        }
      })
  );
}
/**
 * Facebook Login — desktop: JS SDK popup; mobile: full-page OAuth redirect
 * (popups are unreliable on phones / in-app browsers).
 *
 * Required env:
 *   VITE_FACEBOOK_APP_ID (client)
 *   FACEBOOK_APP_ID + FACEBOOK_APP_SECRET (server)
 *
 * Meta App must list this site's origin in:
 *   Valid OAuth Redirect URIs  e.g. https://your-app.vercel.app/
 *   App Domains                e.g. your-app.vercel.app
 */

const FB_PENDING_KEY = "tt_fb_oauth_pending"; // "login" | "link"
const FB_STATE_KEY = "tt_fb_oauth_state";

function isMobileUa() {
  try {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    if (/Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      return true;
    }
    // iPadOS desktop UA still has touch
    if (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) return true;
  } catch (_) {}
  return false;
}

function facebookAppId() {
  const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
  if (!appId || !String(appId).trim()) return "";
  return String(appId).trim();
}

function redirectBaseUri() {
  // Must match a Valid OAuth Redirect URI in Meta (trailing slash variants matter).
  const u = new URL(window.location.href);
  return `${u.origin}/`;
}

async function verifyFacebookToken(accessToken) {
  const r = await fetch("/api/auth-facebook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  let data = {};
  try {
    data = await r.json();
  } catch (_) {
    throw new Error(
      r.status === 404
        ? "Facebook auth API not found — redeploy with /api/auth rewrite."
        : `Facebook server error (${r.status}).`
    );
  }
  if (!data.ok) {
    throw new Error(data.error || "Facebook sign-in failed on server.");
  }
  return {
    providerId: data.providerId,
    email: data.email,
    name: data.name,
    picture: data.picture,
  };
}

/**
 * If the user just returned from Facebook OAuth redirect, finish the flow.
 * Call once on app boot. Returns profile or null.
 */
export async function completeFacebookRedirectIfPresent() {
  if (typeof window === "undefined") return null;
  const pending = sessionStorage.getItem(FB_PENDING_KEY);
  if (!pending) return null;

  // response_type=token → access_token in hash
  // response_type=code → code in query (we use token for SPA)
  const hash = (window.location.hash || "").replace(/^#/, "");
  const hashParams = new URLSearchParams(hash);
  const queryParams = new URLSearchParams(window.location.search || "");
  const accessToken =
    hashParams.get("access_token") || queryParams.get("access_token");
  const error =
    hashParams.get("error_message") ||
    hashParams.get("error") ||
    queryParams.get("error_description") ||
    queryParams.get("error");
  const state = hashParams.get("state") || queryParams.get("state");
  const expectedState = sessionStorage.getItem(FB_STATE_KEY);

  // Clean URL immediately so refresh does not re-process
  try {
    const clean = window.location.pathname + (window.location.search || "");
    window.history.replaceState(null, "", clean.split("?")[0] || "/");
  } catch (_) {}

  sessionStorage.removeItem(FB_PENDING_KEY);
  sessionStorage.removeItem(FB_STATE_KEY);

  if (error) {
    throw new Error(
      String(error) === "access_denied"
        ? "Facebook sign-in was cancelled."
        : `Facebook: ${error}`
    );
  }
  if (!accessToken) {
    // User bounced back without completing — treat as cancel, not crash
    return null;
  }
  if (expectedState && state && expectedState !== state) {
    throw new Error("Facebook login state mismatch. Please try again.");
  }

  return verifyFacebookToken(accessToken);
}

function startFacebookRedirect(mode /* 'login' | 'link' */) {
  const APP_ID = facebookAppId();
  if (!APP_ID) {
    return Promise.reject(
      new Error(
        "Facebook sign-in isn't configured (missing VITE_FACEBOOK_APP_ID). Add it in Vercel env and redeploy."
      )
    );
  }
  const state =
    Math.random().toString(36).slice(2) + Date.now().toString(36);
  try {
    sessionStorage.setItem(FB_PENDING_KEY, mode || "login");
    sessionStorage.setItem(FB_STATE_KEY, state);
  } catch (_) {}

  const redirectUri = encodeURIComponent(redirectBaseUri());
  const url =
    `https://www.facebook.com/v21.0/dialog/oauth` +
    `?client_id=${encodeURIComponent(APP_ID)}` +
    `&redirect_uri=${redirectUri}` +
    `&state=${encodeURIComponent(state)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent("public_profile")}`;

  // Full navigation — popup not used on mobile
  window.location.assign(url);
  // Page is unloading; keep the promise pending so UI stays on "Connecting…"
  return new Promise(() => {});
}

/**
 * Facebook Login — loads the FB JS SDK on desktop (popup), uses redirect on mobile.
 */
export function signInWithFacebook() {
  const APP_ID = facebookAppId();
  if (!APP_ID) {
    return Promise.reject(
      new Error(
        "Facebook sign-in isn't configured (missing VITE_FACEBOOK_APP_ID). Add it in Vercel env and redeploy."
      )
    );
  }

  // Phones / tablets: redirect flow (reliable). Desktop: SDK popup.
  if (isMobileUa()) {
    return startFacebookRedirect("login");
  }

  const SDK_LOAD_MS = 12000;
  const LOGIN_MS = 90000;

  function initFb() {
    if (!window.FB) throw new Error("Facebook SDK not available.");
    window.FB.init({
      appId: APP_ID,
      cookie: true,
      xfbml: false,
      version: "v21.0",
      status: false,
    });
  }

  function loadFacebookScript() {
    if (window.FB) {
      try {
        initFb();
      } catch (_) {}
      return Promise.resolve();
    }
    if (facebookScriptPromise) return facebookScriptPromise;

    facebookScriptPromise = new Promise((resolve, reject) => {
      let settled = false;
      const done = (fn) => (val) => {
        if (settled) return;
        settled = true;
        fn(val);
      };
      const ok = done(resolve);
      const fail = done((err) => {
        facebookScriptPromise = null;
        reject(err);
      });

      const timer = setTimeout(() => {
        fail(
          new Error(
            "Facebook SDK timed out. Check network / ad-blockers, or that connect.facebook.net is allowed."
          )
        );
      }, SDK_LOAD_MS);

      const finishInit = () => {
        try {
          initFb();
          clearTimeout(timer);
          ok();
        } catch (e) {
          clearTimeout(timer);
          fail(e instanceof Error ? e : new Error("Facebook SDK init failed."));
        }
      };

      window.fbAsyncInit = finishInit;

      const existing = document.getElementById("facebook-jssdk");
      if (existing) {
        const wait = setInterval(() => {
          if (window.FB) {
            clearInterval(wait);
            finishInit();
          }
        }, 40);
        setTimeout(() => clearInterval(wait), SDK_LOAD_MS);
        return;
      }

      const s = document.createElement("script");
      s.id = "facebook-jssdk";
      s.async = true;
      s.defer = true;
      s.src = "https://connect.facebook.net/en_US/sdk.js";
      s.onerror = () => {
        clearTimeout(timer);
        fail(
          new Error(
            "Couldn't load Facebook SDK (blocked or offline). Disable ad-block and try again."
          )
        );
      };
      document.head.appendChild(s);
    });

    return facebookScriptPromise;
  }

  return loadFacebookScript().then(
    () =>
      new Promise((resolve, reject) => {
        let settled = false;
        const finish = (fn) => (val) => {
          if (settled) return;
          settled = true;
          clearTimeout(watchdog);
          fn(val);
        };
        const ok = finish(resolve);
        const fail = finish(reject);

        const watchdog = setTimeout(() => {
          fail(
            new Error(
              "Facebook login timed out. Allow pop-ups, or try again from the phone browser (Chrome/Safari)."
            )
          );
        }, LOGIN_MS);

        try {
          if (!window.FB || typeof window.FB.login !== "function") {
            fail(new Error("Facebook SDK failed to initialize."));
            return;
          }

          window.FB.login(
            async (response) => {
              try {
                if (!response) {
                  fail(new Error("Facebook returned no response."));
                  return;
                }
                if (
                  response.status !== "connected" ||
                  !response.authResponse?.accessToken
                ) {
                  const st = response.status || "unknown";
                  if (st === "not_authorized") {
                    fail(
                      new Error(
                        "Facebook access was not granted. Allow email/public profile and try again."
                      )
                    );
                  } else {
                    fail(new Error("Facebook sign-in was cancelled."));
                  }
                  return;
                }
                const profile = await verifyFacebookToken(
                  response.authResponse.accessToken
                );
                ok(profile);
              } catch (e) {
                fail(
                  e instanceof Error ? e : new Error("Facebook sign-in failed.")
                );
              }
            },
            {
              // public_profile only until email is approved in Meta App Review
              scope: "public_profile",
              return_scopes: true,
            }
          );
        } catch (err) {
          fail(
            err instanceof Error
              ? err
              : new Error("Couldn't start Facebook sign-in.")
          );
        }
      })
  );
}

/** Same as sign-in but marks pending mode as "link" for mobile redirect return. */
export function signInWithFacebookForLink() {
  if (isMobileUa()) {
    return startFacebookRedirect("link");
  }
  return signInWithFacebook();
}
