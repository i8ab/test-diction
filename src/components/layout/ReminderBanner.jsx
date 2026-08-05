import { useState, useEffect, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { FlameIcon, XIcon } from "../common/Icons";
import { pushSupported, buildReminderPayload } from "../../lib/state/push";

/* =========================================================================
   STUDY REMINDER BANNER
   -------------------------------------------------------------------------
   Shown above the entry list once the user's chosen reminder interval has
   elapsed since they last studied. The on/off control + interval + custom
   message live in the header menu's Notifications section.
   ========================================================================= */
const REMINDER_DISMISS_KEY = "twoTongues.reminderDismissedOn";
const REMINDER_NOTIFIED_KEY = "twoTongues.reminderNotifiedOn";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function ReminderBanner({
  studiedAt, isAr, cfg, onOpenQuiz, remindersOn,
  reminderIntervalHours = 24,
  reminderTitle = "",
  reminderMessage = "",
}) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(REMINDER_DISMISS_KEY) === todayKey(); } catch (e) { return false; }
  });

  const lastStudied = useMemo(() => {
    const values = Object.values(studiedAt || {});
    return values.length ? Math.max(...values) : null;
  }, [studiedAt]);

  const intervalMs = Math.max(1, Number(reminderIntervalHours) || 24) * 60 * 60 * 1000;
  const hoursSince = lastStudied == null ? null : Math.floor((Date.now() - lastStudied) / (60 * 60 * 1000));
  const shouldShow = hoursSince !== null && (Date.now() - lastStudied) >= intervalMs && !dismissed;

  // Soft local notification fallback (only while the app is open) when real
  // push isn't configured — uses the same final title/body the user set.
  useEffect(() => {
    if (!remindersOn || hoursSince === null || (Date.now() - lastStudied) < intervalMs) return;
    if (pushSupported()) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      if (localStorage.getItem(REMINDER_NOTIFIED_KEY) === todayKey()) return;
      const payload = buildReminderPayload({
        title: reminderTitle,
        body: reminderMessage,
        daysSince: Math.floor(hoursSince / 24),
      });
      new Notification(payload.title, { body: payload.body });
      localStorage.setItem(REMINDER_NOTIFIED_KEY, todayKey());
    } catch (e) { /* ignore */ }
  }, [remindersOn, hoursSince, lastStudied, intervalMs, isAr, reminderTitle, reminderMessage]);

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(REMINDER_DISMISS_KEY, todayKey()); } catch (e) {}
  }

  if (!shouldShow) return null;

  const daysSince = Math.floor(hoursSince / 24);

  return (
    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: cfg.accentSoft, border: `1px solid ${cfg.accent}`, borderRadius: 8, padding: "10px 14px" }}>
      <FlameIcon size={17} color={cfg.accent} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 200, fontSize: 13.5, color: "var(--muted-strong)" }}>
        {daysSince >= 1
          ? tr(isAr,
            `It's been ${daysSince} day${daysSince === 1 ? "" : "s"} since your last review — a quick quiz keeps it fresh.`,
            `عدّى ${daysSince} يوم من غير ما تراجع — اختبار سريع هيفضّل الكلام طازة.`)
          : tr(isAr,
            `It's been ${hoursSince} hour${hoursSince === 1 ? "" : "s"} since your last review — a quick quiz keeps it fresh.`,
            `عدّى ${hoursSince} ساعة من غير ما تراجع — اختبار سريع هيفضّل الكلام طازة.`)}
      </span>
      <button type="button" onClick={onOpenQuiz} style={{ padding: "6px 12px", fontSize: 13, fontWeight: 700, color: "#fff", background: cfg.accent, border: "none", borderRadius: 6, cursor: "pointer" }}>
        {tr(isAr, "Review now", "راجع دلوقتي")}
      </button>
      {!remindersOn && (
        <span style={{ fontSize: 12, color: "var(--icon-muted)" }}>
          {tr(isAr, "Tip: turn on reminders from Notifications in the menu ☰ above.", "تلميح: فعّل التذكيرات من الإشعارات في القائمة ☰ اللي فوق.")}
        </span>
      )}
      <button type="button" onClick={dismiss} aria-label={tr(isAr, "Dismiss", "إخفاء")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", padding: 4 }}>
        <XIcon size={16} />
      </button>
    </div>
  );
}
