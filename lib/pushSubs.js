/**
 * Multi-device push subscriptions + Inbox helpers (Redis)
 * Key patterns:
 *   push:subs:{code}     → list of subscription objects
 *   push:prefs:{code}    → JSON prefs (messages, enabled, etc.)
 *   inbox:{code}         → list of inbox items (newest first)
 */

import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL);

// ---------- Subscriptions ----------

export async function getSubs(code) {
  const raw = await redis.get(`push:subs:${code}`);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveSubs(code, subs) {
  // keep only valid unique endpoints
  const unique = [];
  const seen = new Set();
  for (const s of subs) {
    if (!s?.endpoint || seen.has(s.endpoint)) continue;
    seen.add(s.endpoint);
    unique.push(s);
  }
  if (unique.length === 0) {
    await redis.del(`push:subs:${code}`);
  } else {
    await redis.set(`push:subs:${code}`, JSON.stringify(unique));
  }
  return unique;
}

export async function addSub(code, sub) {
  const current = await getSubs(code);
  const filtered = current.filter((s) => s.endpoint !== sub.endpoint);
  filtered.push(sub);
  return saveSubs(code, filtered);
}

export async function removeSub(code, endpoint) {
  const current = await getSubs(code);
  const filtered = current.filter((s) => s.endpoint !== endpoint);
  return saveSubs(code, filtered);
}

export async function removeAllSubs(code) {
  await redis.del(`push:subs:${code}`);
}

// ---------- Prefs (messages + settings) ----------

export async function getPrefs(code) {
  const raw = await redis.get(`push:prefs:${code}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function savePrefs(code, prefs) {
  await redis.set(`push:prefs:${code}`, JSON.stringify(prefs));
}

export async function clearSchedule(code) {
  const prefs = (await getPrefs(code)) || {};
  delete prefs.lastSent;
  delete prefs.lastSlot;
  delete prefs.msgIndex;
  await savePrefs(code, prefs);
  return prefs;
}

export async function clearAllSchedules() {
  // scan all push:prefs:* and clear schedule fields
  const keys = [];
  let cursor = "0";
  do {
    const [next, found] = await redis.scan(cursor, "MATCH", "push:prefs:*", "COUNT", 100);
    cursor = next;
    keys.push(...found);
  } while (cursor !== "0");

  let count = 0;
  for (const key of keys) {
    const raw = await redis.get(key);
    if (!raw) continue;
    try {
      const prefs = JSON.parse(raw);
      delete prefs.lastSent;
      delete prefs.lastSlot;
      delete prefs.msgIndex;
      await redis.set(key, JSON.stringify(prefs));
      count++;
    } catch {}
  }
  return count;
}

// ---------- Inbox (synced across devices) ----------

const MAX_INBOX = 50; // keep last 50 items per account

export async function getInbox(code) {
  const raw = await redis.get(`inbox:${code}`);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function addInboxItem(code, item) {
  const list = await getInbox(code);
  const entry = {
    id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: item.title || "",
    body: item.body || "",
    type: item.type || "push",
    ts: item.ts || Date.now(),
    read: false,
  };
  // newest first
  list.unshift(entry);
  // trim
  const trimmed = list.slice(0, MAX_INBOX);
  await redis.set(`inbox:${code}`, JSON.stringify(trimmed));
  return entry;
}

export async function markInboxRead(code, ids = null) {
  // ids === null → mark all
  const list = await getInbox(code);
  const updated = list.map((item) => {
    if (ids === null || ids.includes(item.id)) {
      return { ...item, read: true };
    }
    return item;
  });
  await redis.set(`inbox:${code}`, JSON.stringify(updated));
  return updated;
}

export async function deleteInboxItems(code, ids) {
  // ids can be array or "all"
  if (ids === "all" || (Array.isArray(ids) && ids.length === 0)) {
    await redis.del(`inbox:${code}`);
    return [];
  }
  const list = await getInbox(code);
  const updated = list.filter((item) => !ids.includes(item.id));
  if (updated.length === 0) {
    await redis.del(`inbox:${code}`);
  } else {
    await redis.set(`inbox:${code}`, JSON.stringify(updated));
  }
  return updated;
}

export async function clearInbox(code) {
  await redis.del(`inbox:${code}`);
}

export default {
  getSubs,
  saveSubs,
  addSub,
  removeSub,
  removeAllSubs,
  getPrefs,
  savePrefs,
  clearSchedule,
  clearAllSchedules,
  getInbox,
  addInboxItem,
  markInboxRead,
  deleteInboxItems,
  clearInbox,
};
