/**
 * Google sign-in — loads the GIS SDK lazily (only when the user taps the
 * button) and hands the resulting ID token to our own /api/auth endpoint
 * for real verification before performSocialLogin() ever runs.
 *
 * Required env (client, public):
 *   VITE_GOOGLE_CLIENT_ID
 *
 * Server secret (Vercel only):
 *   GOOGLE_CLIENT_ID
 */

let googleScriptPromise = null;

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
