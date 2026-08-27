/**
 * Language Notes — independent study tool (like timer).
 * Structure:
 * {
 *   id, name, description, section ("external"|"curriculum"),
 *   createdAt, updatedAt,
 *   groups: [
 *     {
 *       id,
 *       relatedWords: ["word1", "word2"],
 *       entries: [{ word, type, meaning, example, note, additionalNote, role }]
 *     }
 *   ]
 * }
 */

const KEY_PREFIX = "twoTongues.languageNotes.";

export const NOTE_SECTIONS = {
  external: { id: "external", en: "External", ar: "خارجي" },
  curriculum: { id: "curriculum", en: "Curriculum", ar: "المنهج" },
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function normalizeNote(n) {
  if (!n || typeof n !== "object") return n;
  const section =
    n.section === "curriculum" || n.section === "external"
      ? n.section
      : "external";
  return {
    ...n,
    section,
    groups: Array.isArray(n.groups) ? n.groups : [],
  };
}

export function loadLanguageNotes(accountCode) {
  if (!accountCode) return [];
  try {
    const raw = localStorage.getItem(KEY_PREFIX + accountCode);
    if (!raw) return [];
    const p = JSON.parse(raw);
    if (!Array.isArray(p)) return [];
    return p.map(normalizeNote);
  } catch (_) {
    return [];
  }
}

function saveAll(accountCode, list) {
  try {
    localStorage.setItem(KEY_PREFIX + accountCode, JSON.stringify(list || []));
  } catch (_) {}
}

export function createLanguageNote(
  accountCode,
  { name, description = "", section = "external" } = {}
) {
  const list = loadLanguageNotes(accountCode);
  const note = {
    id: uid(),
    name: String(name || "").trim() || "Untitled note",
    description: String(description || "").trim(),
    section: section === "curriculum" ? "curriculum" : "external",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    groups: [],
  };
  list.unshift(note);
  saveAll(accountCode, list);
  return note;
}

export function updateLanguageNote(accountCode, noteId, patch) {
  const list = loadLanguageNotes(accountCode);
  const i = list.findIndex((n) => n.id === noteId);
  if (i < 0) return null;
  const next = { ...list[i], ...patch, updatedAt: Date.now() };
  if (patch.section != null) {
    next.section = patch.section === "curriculum" ? "curriculum" : "external";
  }
  list[i] = normalizeNote(next);
  saveAll(accountCode, list);
  return list[i];
}

export function deleteLanguageNote(accountCode, noteId) {
  const list = loadLanguageNotes(accountCode).filter((n) => n.id !== noteId);
  saveAll(accountCode, list);
  return list;
}

export function addGroup(accountCode, noteId, relatedWords = []) {
  const list = loadLanguageNotes(accountCode);
  const note = list.find((n) => n.id === noteId);
  if (!note) return null;
  const words = (relatedWords || []).map((w) => String(w || "").trim()).filter(Boolean);
  const group = {
    id: uid(),
    relatedWords: words,
    entries: words.map((w) => ({
      word: w,
      type: "",
      meaning: "",
      example: "",
      note: "",
      additionalNote: "",
      role: "",
    })),
  };
  note.groups = [...(note.groups || []), group];
  note.updatedAt = Date.now();
  saveAll(accountCode, list);
  return group;
}

export function updateGroup(accountCode, noteId, groupId, patch) {
  const list = loadLanguageNotes(accountCode);
  const note = list.find((n) => n.id === noteId);
  if (!note) return null;
  const gi = (note.groups || []).findIndex((g) => g.id === groupId);
  if (gi < 0) return null;
  note.groups[gi] = { ...note.groups[gi], ...patch };
  if (Array.isArray(patch.relatedWords)) {
    const existing = {};
    for (const e of note.groups[gi].entries || []) existing[e.word] = e;
    note.groups[gi].entries = patch.relatedWords.map((w) => {
      const word = String(w || "").trim();
      return (
        existing[word] || {
          word,
          type: "",
          meaning: "",
          example: "",
          note: "",
          additionalNote: "",
          role: "",
        }
      );
    });
  }
  note.updatedAt = Date.now();
  saveAll(accountCode, list);
  return note.groups[gi];
}

export function updateEntry(accountCode, noteId, groupId, word, fields) {
  const list = loadLanguageNotes(accountCode);
  const note = list.find((n) => n.id === noteId);
  if (!note) return null;
  const group = (note.groups || []).find((g) => g.id === groupId);
  if (!group) return null;
  const ei = (group.entries || []).findIndex((e) => e.word === word);
  if (ei < 0) return null;
  group.entries[ei] = { ...group.entries[ei], ...fields };
  note.updatedAt = Date.now();
  saveAll(accountCode, list);
  return group.entries[ei];
}

export function removeGroup(accountCode, noteId, groupId) {
  const list = loadLanguageNotes(accountCode);
  const note = list.find((n) => n.id === noteId);
  if (!note) return null;
  note.groups = (note.groups || []).filter((g) => g.id !== groupId);
  note.updatedAt = Date.now();
  saveAll(accountCode, list);
  return note;
}

const VIEW_KEY = "twoTongues.languageNotesView";

export function loadLanguageNotesView() {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    if (!raw) return { open: false, bubble: false };
    const p = JSON.parse(raw);
    return { open: !!p.open, bubble: !!p.bubble };
  } catch (_) {
    return { open: false, bubble: false };
  }
}

export function saveLanguageNotesView(open, bubble) {
  try {
    if (!open) localStorage.removeItem(VIEW_KEY);
    else localStorage.setItem(VIEW_KEY, JSON.stringify({ open: true, bubble: !!bubble }));
  } catch (_) {}
}
