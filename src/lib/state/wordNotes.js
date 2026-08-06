// Per-account personal notes on dictionary entries (local only).

const KEY_PREFIX = "twoTongues.wordNotes.";

export function loadWordNotes(accountCode) {
  if (!accountCode) return {};
  try {
    const raw = localStorage.getItem(KEY_PREFIX + accountCode);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === "object" ? p : {};
  } catch (_) {
    return {};
  }
}

export function setWordNote(accountCode, entryId, note) {
  const map = loadWordNotes(accountCode);
  const text = String(note || "").trim();
  if (text) map[entryId] = text;
  else delete map[entryId];
  try {
    localStorage.setItem(KEY_PREFIX + accountCode, JSON.stringify(map));
  } catch (_) {}
  return map;
}
