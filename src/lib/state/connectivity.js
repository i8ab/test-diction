/**
 * Lightweight connectivity helpers.
 * navigator.onLine alone is unreliable (false positives on some mobile networks / proxies).
 * We combine it with a real probe against our own API.
 */

const PROBE_URL = "/api/jsonbin?scope=version&_t=";

/**
 * Returns true if the app can reach our API (not just "browser thinks online").
 */
export async function probeCloudReachable(timeoutMs = 6000) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(PROBE_URL + Date.now(), {
      method: "GET",
      cache: "no-store",
      signal: ctrl ? ctrl.signal : undefined,
    });
    // Any HTTP response means the network path works (even 4xx/5xx).
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * While isOffline, periodically probe and call onBackOnline() when reachable.
 * Also listens to window 'online'.
 * @returns {() => void} cleanup
 */
export function watchForReconnect({ onBackOnline, intervalMs = 20000 } = {}) {
  if (typeof window === "undefined") return () => {};

  let stopped = false;
  let busy = false;

  const tryRecover = async () => {
    if (stopped || busy) return;
    busy = true;
    try {
      const ok = await probeCloudReachable();
      if (ok && !stopped && typeof onBackOnline === "function") {
        onBackOnline();
      }
    } finally {
      busy = false;
    }
  };

  const onOnline = () => {
    tryRecover();
  };

  window.addEventListener("online", onOnline);
  const id = setInterval(tryRecover, intervalMs);
  // Immediate first probe
  tryRecover();

  return () => {
    stopped = true;
    window.removeEventListener("online", onOnline);
    clearInterval(id);
  };
}
