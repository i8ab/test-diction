import { useState, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { DownloadIcon, XIcon } from "../common/Icons";
import { daysSinceLastBackup } from "../../lib/utils/backupUtils";

/* =========================================================================
   BACKUP REMINDER BANNER (admins only)
   -------------------------------------------------------------------------
   Nudges an admin to download a full backup (see backupUtils.js) once it's
   been BACKUP_REMINDER_DAYS+ since the last one downloaded on this device,
   or if none has ever been downloaded here. Purely a local, best-effort
   reminder — it has no way to know a co-admin already backed up elsewhere.
   Dismissing snoozes it for the rest of the day, same pattern as the study
   ReminderBanner.
   ========================================================================= */
const BACKUP_REMINDER_DAYS = 7;
const DISMISS_KEY = "twoTongues.backupReminderDismissedOn";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function BackupReminderBanner({ isAr, cfg, onOpenBackup }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === todayKey(); } catch (e) { return false; }
  });

  const days = useMemo(() => daysSinceLastBackup(), []); // null = never backed up on this device

  const shouldShow = !dismissed && (days === null || days >= BACKUP_REMINDER_DAYS);
  if (!shouldShow) return null;

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, todayKey()); } catch (e) {}
  }

  const message = days === null
    ? tr(isAr, "You haven't downloaded a backup on this device yet — worth having one in case anything goes wrong.", "لسه معملتش نسخة احتياطية من الجهاز ده — يفضل يكون عندك واحدة لو حصل أي مشكلة.")
    : tr(isAr, `It's been ${days} days since your last backup download.`, `عدّى ${days} يوم من آخر نسخة احتياطية نزّلتها.`);

  return (
    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: cfg.accentSoft, border: `1px solid ${cfg.accent}`, borderRadius: 8, padding: "10px 14px" }}>
      <DownloadIcon size={17} color={cfg.accent} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 200, fontSize: 13.5, color: "var(--muted-strong)" }}>{message}</span>
      <button type="button" onClick={onOpenBackup} style={{ padding: "6px 12px", fontSize: 13, fontWeight: 700, color: "#fff", background: cfg.accent, border: "none", borderRadius: 6, cursor: "pointer" }}>
        {tr(isAr, "Back up now", "خد نسخة دلوقتي")}
      </button>
      <button type="button" onClick={dismiss} aria-label={tr(isAr, "Dismiss", "إخفاء")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", padding: 4 }}>
        <XIcon size={16} />
      </button>
    </div>
  );
}
