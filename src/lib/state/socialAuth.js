/**
 * Google / Facebook sign-in — loads each SDK lazily (only when the user
 * actually taps the button, so accounts without either configured pay
 * nothing) and hands the resulting token to our own /api/auth-* endpoint
 * for real verification before performSocialLogin() ever runs.
 *
 * Required env vars (Vite exposes anything prefixed VITE_ to the client —
 * these are PUBLIC identifiers, not secrets, so that's fine):
 *   VITE_GOOGLE_CLIENT_ID
 *   VITE_FACEBOOK_APP_ID
 *
 * The matching *secrets* (GOOGLE_CLIENT_ID is reused server-side;
 * FACEBOOK_APP_SECRET) live only in Vercel's server env — see
 * api/auth-google.js / api/auth-facebook.js.
 */

let googleScriptPromise = null;
function loadGoogleScript() {
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      resolve();
      return;
    }
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

let fbScriptPromise = null;
function loadFacebookScript(appId) {
  if (fbScriptPromise) return fbScriptPromise;
  fbScriptPromise = new Promise((resolve, reject) => {
    if (window.FB) {
      resolve();
      return;
    }
    window.fbAsyncInit = function fbAsyncInit() {
      window.FB.init({ appId, cookie: true, xfbml: false, version: "v19.0" });
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Facebook sign-in."));
    document.head.appendChild(s);
  });
  return fbScriptPromise;
}

/**
 * Opens the Google One Tap / popup flow and resolves with a verified
 * profile ({ providerId, email, name, picture }), or rejects with an
 * Error whose .message is safe to show the user.
 */
export function signInWithGoogle() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return Promise.reject(new Error("Google sign-in isn't set up yet — missing VITE_GOOGLE_CLIENT_ID."));
  }
  return loadGoogleScript().then(
    () =>
      new Promise((resolve, reject) => {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response) => {
              try {
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
          });
          // The One Tap prompt is skippable/unreliable in some browsers
          // (cookie settings, already-dismissed, etc.); fall back to the
          // classic popup button flow when it doesn't show.
          window.google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              renderFallbackGoogleButton(clientId, resolve, reject);
            }
          });
        } catch (err) {
          reject(new Error("Couldn't start Google sign-in."));
        }
      })
  );
}

// Invisible one-off button used only as a fallback trigger for the popup
// flow when One Tap can't display — clicked programmatically, never shown.
function renderFallbackGoogleButton(clientId, resolve, reject) {
  try {
    const holder = document.createElement("div");
    holder.style.position = "fixed";
    holder.style.top = "-9999px";
    document.body.appendChild(holder);
    window.google.accounts.id.renderButton(holder, { type: "standard" });
    const btn = holder.querySelector('div[role="button"]');
    if (btn) btn.click();
    else reject(new Error("Google sign-in popup was blocked."));
    setTimeout(() => holder.remove(), 4000);
  } catch (_) {
    reject(new Error("Couldn't start Google sign-in."));
  }
}

/**
 * Opens the Facebook login popup and resolves with a verified profile,
 * same shape as signInWithGoogle().
 */
export function signInWithFacebook() {
  const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
  if (!appId) {
    return Promise.reject(new Error("Facebook sign-in isn't set up yet — missing VITE_FACEBOOK_APP_ID."));
  }
  return loadFacebookScript(appId).then(
    () =>
      new Promise((resolve, reject) => {
        window.FB.login(
          async (response) => {
            if (!response.authResponse) {
              reject(new Error("Facebook sign-in was cancelled."));
              return;
            }
            try {
              const r = await fetch("/api/auth-facebook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accessToken: response.authResponse.accessToken }),
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
              reject(new Error("Couldn't verify Facebook sign-in — check your connection."));
            }
          },
          { scope: "public_profile,email" }
        );
      })
  );
}
