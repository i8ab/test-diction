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
 * Facebook Login — loads the FB JS SDK, opens the login dialog, then verifies
 * the access token via /api/auth-facebook.
 * Resolves with: { providerId, email, name, picture }
 */
export function signInWithFacebook() {
  const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
  if (!appId) {
    return Promise.reject(
      new Error(
        "Facebook sign-in isn't set up yet — missing VITE_FACEBOOK_APP_ID."
      )
    );
  }

  function loadFacebookScript() {
    if (window.FB) return Promise.resolve();
    if (facebookScriptPromise) return facebookScriptPromise;
    facebookScriptPromise = new Promise((resolve, reject) => {
      window.fbAsyncInit = function () {
        try {
          window.FB.init({
            appId: String(appId),
            cookie: true,
            xfbml: false,
            version: "v21.0",
          });
          resolve();
        } catch (e) {
          reject(e instanceof Error ? e : new Error("Facebook SDK init failed."));
        }
      };
      if (document.getElementById("facebook-jssdk")) {
        // Script tag already present — wait for FB or fail
        const wait = setInterval(() => {
          if (window.FB) {
            clearInterval(wait);
            try {
              window.FB.init({
                appId: String(appId),
                cookie: true,
                xfbml: false,
                version: "v21.0",
              });
            } catch (_) {}
            resolve();
          }
        }, 50);
        setTimeout(() => {
          clearInterval(wait);
          if (!window.FB) reject(new Error("Failed to load Facebook sign-in."));
        }, 8000);
        return;
      }
      const s = document.createElement("script");
      s.id = "facebook-jssdk";
      s.src = "https://connect.facebook.net/en_US/sdk.js";
      s.async = true;
      s.defer = true;
      s.onerror = () => reject(new Error("Failed to load Facebook sign-in."));
      document.head.appendChild(s);
    });
    return facebookScriptPromise;
  }

  return loadFacebookScript().then(
    () =>
      new Promise((resolve, reject) => {
        try {
          window.FB.login(
            async (response) => {
              if (!response || response.status !== "connected" || !response.authResponse?.accessToken) {
                reject(new Error("Facebook sign-in was cancelled."));
                return;
              }
              const accessToken = response.authResponse.accessToken;
              try {
                const r = await fetch("/api/auth-facebook", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ accessToken }),
                });
                const data = await r.json();
                if (!data.ok) {
                  reject(new Error(data.error || "Facebook sign-in failed."));
                  return;
                }
                resolve({
                  providerId: data.providerId,
                  email: data.email,
                  name: data.name,
                  picture: data.picture,
                });
              } catch (_) {
                reject(
                  new Error("Couldn't verify Facebook sign-in — check your connection.")
                );
              }
            },
            { scope: "public_profile,email", return_scopes: true }
          );
        } catch (err) {
          reject(
            err instanceof Error ? err : new Error("Couldn't start Facebook sign-in.")
          );
        }
      })
  );
}
