// In-app notification inbox (per account, localStorage).
// Collects push copies, achievements, banners, and custom system events.

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

export function loadInbox(accountCode) {
  if (!accountCode) return [];
  try {
    return safeParse(localStorage.getItem(KEY + accountCode));
  } catch (_) {
    return [];
  }
}

function saveInbox(accountCode, list) {
  if (!accountCode) return;
  try {
    localStorage.setItem(KEY + accountCode, JSON.stringify(list.slice(0, MAX_ITEMS)));
  } catch (_) {}
}

/**
 * @param {string} accountCode
 * @param {{ type?: string, title: string, body?: string, url?: string, id?: string, at?: number }} item
 */
export function pushInboxItem(accountCode, item) {
  if (!accountCode || !item || !item.title) return null;
  const list = loadInbox(accountCode);
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
  saveInbox(accountCode, next);
  try {
    window.dispatchEvent(
      new CustomEvent("twotongues:inbox", { detail: { accountCode, item: entry } })
    );
  } catch (_) {}
  return entry;
}

export function unreadCount(accountCode) {
  return loadInbox(accountCode).filter((x) => !x.read).length;
}

export function markInboxRead(accountCode, id) {
  if (!accountCode) return;
  const list = loadInbox(accountCode).map((x) =>
    x.id === id ? { ...x, read: true } : x
  );
  saveInbox(accountCode, list);
}

export function markAllInboxRead(accountCode) {
  if (!accountCode) return;
  const list = loadInbox(accountCode).map((x) => ({ ...x, read: true }));
  saveInbox(accountCode, list);
}

export function clearInbox(accountCode) {
  if (!accountCode) return;
  try {
    localStorage.removeItem(KEY + accountCode);
  } catch (_) {}
  try {
    window.dispatchEvent(
      new CustomEvent("twotongues:inbox", { detail: { accountCode, cleared: true } })
    );
  } catch (_) {}
}

export function removeInboxItem(accountCode, id) {
  if (!accountCode) return;
  const list = loadInbox(accountCode).filter((x) => x.id !== id);
  saveInbox(accountCode, list);
}
