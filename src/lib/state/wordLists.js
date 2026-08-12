// Named word lists + share codes (local per account, share payload in localStorage).

import { uid } from "../utils/quizHelpers";

const LISTS_KEY = "twoTongues.wordLists.";
const SHARED_KEY = "twoTongues.sharedLists"; // map code → list snapshot

function key(accountCode) {
  return LISTS_KEY + (accountCode || "anon");
}

export function loadWordLists(accountCode) {
  try {
    const raw = localStorage.getItem(key(accountCode));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

export function saveWordLists(accountCode, lists) {
  try {
    localStorage.setItem(key(accountCode), JSON.stringify(lists || []));
  } catch (_) {}
}

export function createWordList(accountCode, { name, entryIds, section }) {
  const lists = loadWordLists(accountCode);
  const list = {
    id: uid(),
    name: String(name || "List").trim() || "List",
    entryIds: Array.isArray(entryIds) ? entryIds.slice() : [],
    section: section || "en-ar",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    shareCode: null,
  };
  lists.unshift(list);
  saveWordLists(accountCode, lists);
  return list;
}

export function updateWordList(accountCode, listId, patch) {
  const lists = loadWordLists(accountCode);
  const next = lists.map((l) => {
    if (l.id !== listId) return l;
    return { ...l, ...patch, updatedAt: Date.now() };
  });
  saveWordLists(accountCode, next);
  return next.find((l) => l.id === listId);
}

export function deleteWordList(accountCode, listId) {
  const lists = loadWordLists(accountCode).filter((l) => l.id !== listId);
  saveWordLists(accountCode, lists);
  return lists;
}

export function shareWordList(accountCode, listId, entries) {
  const lists = loadWordLists(accountCode);
  const list = lists.find((l) => l.id === listId);
  if (!list) return null;
  const code = (list.shareCode || uid().slice(0, 8)).toUpperCase();
  const snapshot = {
    code,
    name: list.name,
    section: list.section,
    words: (list.entryIds || [])
      .map((id) => {
        const e = (entries || []).find((x) => x.id === id);
        if (!e) return null;
        return {
          word: e.word,
          meaning: e.meaning,
          definition: e.definition || "",
          example: e.example || "",
          pos: e.pos || "",
          section: e.section || list.section,
        };
      })
      .filter(Boolean),
    sharedAt: Date.now(),
    from: accountCode,
  };
  try {
    const raw = localStorage.getItem(SHARED_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[code] = snapshot;
    localStorage.setItem(SHARED_KEY, JSON.stringify(map));
  } catch (_) {}
  updateWordList(accountCode, listId, { shareCode: code });
  return { code, snapshot };
}

export function loadSharedList(code) {
  try {
    const raw = localStorage.getItem(SHARED_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[String(code || "").toUpperCase()] || null;
  } catch (_) {
    return null;
  }
}

/** Import a shared list into own lists (by word text match or as new entries payload). */
export function importSharedList(accountCode, code) {
  const snap = loadSharedList(code);
  if (!snap) return null;
  return createWordList(accountCode, {
    name: snap.name + " (shared)",
    entryIds: [], // caller may match words later
    section: snap.section,
  });
}
