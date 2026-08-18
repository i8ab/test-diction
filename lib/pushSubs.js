/**
 * Multi-device push subscriptions + Inbox helpers (Redis)
 * Key patterns:
 *   push:subs:{code}     → list of subscription objects
 *   push:prefs:{code}    → JSON prefs (messages, enabled, etc.)
 *   inbox:{code}         → list of inbox items (newest first)
 *
 * Serverless-safe: creates the client lazily, fails fast if no Redis URL,
 * and uses short timeouts so the function never hangs for minutes.
 */

import Redis from "ioredis";

let redis = null;
let redisError = null;

function getRedis() {
  if (redis) return redis;
  if (redisError) throw redisError;

  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
  if (!url || typeof url !== "string" || url.trim() === "") {
    redisError = new Error(
      "Redis not configured. Set REDIS_URL or UPSTASH_REDIS_URL in Vercel Environment Variables (use the redis:// or rediss:// connection string from Upstash)."
    );
    throw redisError;
  }

  redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 8000,
    commandTimeout: 8000,
    enableReadyCheck: false,
    lazyConnect: true,
    // Prevent ioredis from retrying forever in serverless
    retryStrategy: (times) => {
      if (times > 2) return null; // stop retrying
      return Math.min(times * 200, 1000);
    },
  });

  redis.on("error", (err) => {
    console.error("Redis connection error:", err.message);
  });

  return redis;
}

async function ensureConnected() {
  const client = getRedis();
  if (client.status === "wait" || client.status === "end") {
    await client.connect();
  }
  return client;
}

// ---------- Subscriptions ----------

export async function getSubs(code) {
  const client = await ensureConnected();
  const raw = await client.get(`push:subs:${code}`);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveSubs(code, subs) {
  const client = await ensureConnected();
  // keep only valid unique endpoints
  const unique = [];
  const seen = new Set();
  for (const s of subs) {
    if (!s?.endpoint || seen.has(s.endpoint)) continue;
    seen.add(s.endpoint);
    unique.push(s);
  }
  if (unique.length === 0) {
    await client.del(`push:subs:${code}`);
  } else {
    await client.set(`push:subs:${code}`, JSON.stringify(unique));
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
  const client = await ensureConnected();
  await client.del(`push:subs:${code}`);
}

// ---------- Prefs (messages + settings) ----------

export async function getPrefs(code) {
  const client = await ensureConnected();
  const raw = await client.get(`push:prefs:${code}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function savePrefs(code, prefs) {
  const client = await ensureConnected();
  await client.set(`push:prefs:${code}`, JSON.stringify(prefs));
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
  const client = await ensureConnected();
  // scan all push:prefs:* and clear schedule fields
  const keys = [];
  let cursor = "0";
  do {
    const [next, found] = await client.scan(cursor, "MATCH", "push:prefs:*", "COUNT", 100);
    cursor = next;
    keys.push(...found);
  } while (cursor !== "0");

  let count = 0;
  for (const key of keys) {
    const raw = await client.get(key);
    if (!raw) continue;
    try {
      const prefs = JSON.parse(raw);
      delete prefs.lastSent;
      delete prefs.lastSlot;
      delete prefs.msgIndex;
      await client.set(key, JSON.stringify(prefs));
      count++;
    } catch {}
  }
  return count;
}

// ---------- Inbox (synced across devices) ----------

const MAX_INBOX = 50; // keep last 50 items per account

export async function getInbox(code) {
  const client = await ensureConnected();
  const raw = await client.get(`inbox:${code}`);
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
  const client = await ensureConnected();
  await client.set(`inbox:${code}`, JSON.stringify(trimmed));
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
  const client = await ensureConnected();
  await client.set(`inbox:${code}`, JSON.stringify(updated));
  return updated;
}

export async function deleteInboxItems(code, ids) {
  // ids can be array or "all"
  const client = await ensureConnected();
  if (ids === "all" || (Array.isArray(ids) && ids.length === 0)) {
    await client.del(`inbox:${code}`);
    return [];
  }
  const list = await getInbox(code);
  const updated = list.filter((item) => !ids.includes(item.id));
  if (updated.length === 0) {
    await client.del(`inbox:${code}`);
  } else {
    await client.set(`inbox:${code}`, JSON.stringify(updated));
  }
  return updated;
}

export async function clearInbox(code) {
  const client = await ensureConnected();
  await client.del(`inbox:${code}`);
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
