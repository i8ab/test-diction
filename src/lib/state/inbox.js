/**
 * Synced Inbox state – fetched from server, mutations go to server
 * so clearing / marking read is visible on all devices of the same account.
 */

const API = "/api/push-subscribe";

export async function fetchInbox(code) {
  if (!code) return { inbox: [], unread: 0 };
  try {
    const res = await fetch(`${API}?code=${encodeURIComponent(code)}`);
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    return {
      inbox: data.inbox || [],
      unread: data.unread || 0,
    };
  } catch (err) {
    console.warn("fetchInbox error", err);
    return { inbox: [], unread: 0 };
  }
}

export async function markInboxRead(code, ids = null) {
  if (!code) return { inbox: [], unread: 0 };
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markInboxRead", code, ids }),
    });
    const data = await res.json();
    return {
      inbox: data.inbox || [],
      unread: data.unread || 0,
    };
  } catch (err) {
    console.warn("markInboxRead error", err);
    return { inbox: [], unread: 0 };
  }
}

export async function deleteInboxItems(code, ids) {
  // ids = "all" or array of ids
  if (!code) return { inbox: [], unread: 0 };
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteInbox", code, ids }),
    });
    const data = await res.json();
    return {
      inbox: data.inbox || [],
      unread: data.unread || 0,
    };
  } catch (err) {
    console.warn("deleteInboxItems error", err);
    return { inbox: [], unread: 0 };
  }
}

export async function clearInbox(code) {
  return deleteInboxItems(code, "all");
}

/**
 * Local helper – still keep a small local cache for instant UI,
 * but server is the source of truth.
 */
const LOCAL_KEY = (code) => `inbox_cache_${code}`;

export function getLocalCache(code) {
  try {
    const raw = localStorage.getItem(LOCAL_KEY(code));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setLocalCache(code, list) {
  try {
    localStorage.setItem(LOCAL_KEY(code), JSON.stringify(list));
  } catch {}
}
