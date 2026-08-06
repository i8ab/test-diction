// Full JSON backup download + last-backup tracking.

const LAST_BACKUP_KEY = "twoTongues.lastBackupAt";

export function markBackupDone() {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
  } catch (_) {}
}

export function daysSinceLastBackup() {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_KEY);
    if (!raw) return null;
    const t = Number(raw);
    if (!Number.isFinite(t)) return null;
    return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
  } catch (_) {
    return null;
  }
}

export function downloadFullBackup({ entries, accounts, logs }) {
  const payload = {
    exportedAt: new Date().toISOString(),
    entries: entries || [],
    accounts: (accounts || []).map((a) => {
      // strip sensitive hash for local safety? keep for restore ability
      const { passwordHash, ...rest } = a;
      return { ...rest, passwordHash: passwordHash || undefined };
    }),
    logs: logs || [],
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `two-tongues-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  markBackupDone();
}
