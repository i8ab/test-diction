// In-app notification inbox — account-level (synced via /api/push-inbox).
// localStorage is a fast offline cache; server is the source of truth so
// deleting one item removes it for the account on every device.
//
// Only the inbox list is touched — never subscriptions, prefs, words, or
// any other account data.

const KEY = "twoTongues.inbox.";
const MAX_ITEMS = 80;

function safeParse(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch (_) {
    return [];
  }
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLocal(accountCode) {
  if (!accountCode) return [];
  try {
    return safeParse(localStorage.getItem(KEY + accountCode));
  } catch (_) {
    return [];
  }
}

function writeLocal(accountCode, list) {
  if (!accountCode) return;
  try {
    localStorage.setItem(KEY + accountCode, JSON.stringify((list || []).slice(0, MAX_ITEMS)));
  } catch (_) {}
}

function emit(accountCode, extra = {}) {
  try {
    window.dispatchEvent(
      new CustomEvent("twotongues:inbox", { detail: { accountCode, ...extra } })
    );
  } catch (_) {}
}

async function api(method, accountCode, bodyExtra = {}) {
  if (!accountCode) throw new Error("no code");
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  };
  if (method === "GET") {
    const r = await fetch(`/api/push-inbox?code=${encodeURIComponent(accountCode)}`, {
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`inbox GET ${r.status}`);
    return r.json();
  }
  opts.body = JSON.stringify({ code: accountCode, ...bodyExtra });
  const r = await fetch("/api/push-inbox", opts);
  if (!r.ok) throw new Error(`inbox ${method} ${r.status}`);
  return r.json();
}

/** Sync from server into local cache. Safe to call often; fails quietly offline. */
export async function syncInboxFromServer(accountCode) {
  if (!accountCode) return readLocal(accountCode);
  try {
    const data = await api("GET", accountCode);
    const items = Array.isArray(data.items) ? data.items : [];
    writeLocal(accountCode, items);
    emit(accountCode);
    return items;
  } catch (_) {
    return readLocal(accountCode);
  }
}

export function loadInbox(accountCode) {
  return readLocal(accountCode);
}

/**
 * @param {string} accountCode
 * @param {{ type?: string, title: string, body?: string, url?: string, id?: string, at?: number }} item
 */
export function pushInboxItem(accountCode, item) {
  if (!accountCode || !item || !item.title) return null;
  const list = readLocal(accountCode);
  const entry = {
    id: item.id || uid(),
    type: item.type || "system",
    title: String(item.title).slice(0, 160),
    body: item.body ? String(item.body).slice(0, 400) : "",
    url: item.url || "/",
    at: typeof item.at === "number" ? item.at : Date.now(),
    read: false,
  };
  // Dedupe identical title+body within 2 minutes
  const recent = list.find(
    (x) =>
      x.title === entry.title &&
      x.body === entry.body &&
      Math.abs((x.at || 0) - entry.at) < 120000
  );
  if (recent) return recent;
  const next = [entry, ...list].slice(0, MAX_ITEMS);
  writeLocal(accountCode, next);
  emit(accountCode, { item: entry });

  // Best-effort account sync (so other devices see it too)
  api("POST", accountCode, { item: entry }).then((data) => {
    if (data && Array.isArray(data.items)) {
      writeLocal(accountCode, data.items);
      emit(accountCode);
    }
  }).catch(() => {});

  return entry;
}

export function unreadCount(accountCode) {
  return readLocal(accountCode).filter((x) => !x.read).length;
}

export function markInboxRead(accountCode, id) {
  if (!accountCode || !id) return;
  const list = readLocal(accountCode).map((x) =>
    x.id === id ? { ...x, read: true } : x
  );
  writeLocal(accountCode, list);
  emit(accountCode);
  api("PATCH", accountCode, { id }).then((data) => {
    if (data && Array.isArray(data.items)) {
      writeLocal(accountCode, data.items);
      emit(accountCode);
    }
  }).catch(() => {});
}

export function markAllInboxRead(accountCode) {
  if (!accountCode) return;
  const list = readLocal(accountCode).map((x) => ({ ...x, read: true }));
  writeLocal(accountCode, list);
  emit(accountCode);
  api("PATCH", accountCode, { markAllRead: true }).then((data) => {
    if (data && Array.isArray(data.items)) {
      writeLocal(accountCode, data.items);
      emit(accountCode);
    }
  }).catch(() => {});
}

export function clearInbox(accountCode) {
  if (!accountCode) return;
  try {
    localStorage.removeItem(KEY + accountCode);
  } catch (_) {}
  emit(accountCode, { cleared: true });
  api("DELETE", accountCode, { clearAll: true }).catch(() => {});
}

/** Remove one notification from the account (all devices). Nothing else is touched. */
export function removeInboxItem(accountCode, id) {
  if (!accountCode || !id) return;
  const list = readLocal(accountCode).filter((x) => x.id !== id);
  writeLocal(accountCode, list);
  emit(accountCode, { removedId: id });
  api("DELETE", accountCode, { id }).then((data) => {
    if (data && Array.isArray(data.items)) {
      writeLocal(accountCode, data.items);
      emit(accountCode);
    }
  }).catch(() => {});
}
