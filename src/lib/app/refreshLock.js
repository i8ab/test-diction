/** Single-flight refresh lock (survives navigation via sessionStorage). */
const REFRESH_LOCK_KEY = "twoTongues.refreshInFlight";
const REFRESH_LOCK_TTL_MS = 20000;

export function isRefreshInFlight() {
  try {
    const raw = sessionStorage.getItem(REFRESH_LOCK_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) {
      sessionStorage.removeItem(REFRESH_LOCK_KEY);
      return false;
    }
    if (Date.now() - ts > REFRESH_LOCK_TTL_MS) {
      sessionStorage.removeItem(REFRESH_LOCK_KEY);
      return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

export function beginRefreshLock() {
  try {
    sessionStorage.setItem(REFRESH_LOCK_KEY, String(Date.now()));
  } catch (_) {}
}

export function endRefreshLock() {
  try {
    sessionStorage.removeItem(REFRESH_LOCK_KEY);
  } catch (_) {}
}
