const PREFIX = "twoTongues.wordNotes.";

export function loadWordNotes(accountCode) {
  if (!accountCode) return {};
  try {
    const raw = localStorage.getItem(PREFIX + accountCode);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return typeof p === "object" && p ? p : {};
  } catch (_) {
    return {};
  }
}

export function saveWordNotes(accountCode, notes) {
  if (!accountCode) return;
  try {
    localStorage.setItem(PREFIX + accountCode, JSON.stringify(notes));
  } catch (_) {}
}

export function setWordNote(accountCode, entryId, text) {
  const notes = loadWordNotes(accountCode);
  const t = (text || "").trim().slice(0, 1000);
  if (!t) delete notes[entryId];
  else notes[entryId] = t;
  saveWordNotes(accountCode, notes);
  return notes;
}
