/* =========================================================================
   FULL BACKUP — downloads the entire shared record (entries, accounts,
   activity logs) as one JSON file the user keeps on their own device.
   -------------------------------------------------------------------------
   This is separate from exportEntriesAsCsv (csvUtils.js): the CSV export is
   a per-section, words-only snapshot meant for reading/re-importing words.
   This backup is meant for disaster recovery — it captures everything
   needed to reconstruct the shared cloud record (including accounts'
   personal codes, roles, study/SRS progress, and the activity log), so
   restoring it puts things back exactly as they were.
   ========================================================================= */
import { downloadTextFile } from "./csvUtils";

const BACKUP_FORMAT = "two-tongues-backup";
const BACKUP_VERSION = 1;

// Wraps the raw record in a small envelope (format tag + version) so a
// restore step can recognize the file and reject anything else before
// touching real data.
function buildBackupPayload(record) {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_VERSION,
    exportedAt: Date.now(),
    entries: record.entries || [],
    accounts: record.accounts || [],
    logs: record.logs || [],
    dataVersion: typeof record.version === "number" ? record.version : null,
  };
}

function downloadFullBackup(record) {
  const payload = buildBackupPayload(record);
  const date = new Date().toISOString().slice(0, 10);
  downloadTextFile(`two-tongues-backup-${date}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8;");
  markBackupDone();
}

// Parses + sanity-checks a previously-downloaded backup file (used by a
// future "restore from backup" flow). Throws a short, translatable-by-key
// error string on anything that doesn't look like our own backup.
function parseBackupFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error("invalid_json");
  }
  if (!data || data.format !== BACKUP_FORMAT) throw new Error("not_a_backup");
  if (!Array.isArray(data.entries) || !Array.isArray(data.accounts)) throw new Error("malformed_backup");
  return {
    entries: data.entries,
    accounts: data.accounts,
    logs: Array.isArray(data.logs) ? data.logs : [],
    exportedAt: data.exportedAt || null,
    dataVersion: typeof data.dataVersion === "number" ? data.dataVersion : null,
  };
}

/* =========================================================================
   LAST-BACKUP TRACKING (local device only) — powers the "you haven't
   backed up in a while" reminder. Purely a nudge; nothing here is synced,
   so it doesn't know if your co-admin already downloaded one.
   ========================================================================= */
const LAST_BACKUP_KEY = "twoTongues.lastBackupAt";

function markBackupDone() {
  try { localStorage.setItem(LAST_BACKUP_KEY, String(Date.now())); } catch (e) {}
}

function getLastBackupAt() {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    return null;
  }
}

function daysSinceLastBackup() {
  const at = getLastBackupAt();
  if (at == null) return null; // never backed up on this device
  return Math.floor((Date.now() - at) / (24 * 60 * 60 * 1000));
}

export { downloadFullBackup, parseBackupFile, markBackupDone, getLastBackupAt, daysSinceLastBackup };
