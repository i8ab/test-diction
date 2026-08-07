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

  const daysSince = lastStudied == null ? null : Math.floor((Date.now() - lastStudied) / (24 * 60 * 60 * 1000));
  // In-app banner still only nudges when they haven't studied in a day+
  // (the real daily push at 5 AM is independent and always sends).
  const shouldShow = !dismissed && (daysSince === null || daysSince >= 1);

  useEffect(() => {
    if (!remindersOn || daysSince === null || daysSince < 1) return;
    if (pushSupported()) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      if (localStorage.getItem(REMINDER_NOTIFIED_KEY) === todayKey()) return;
      const payload = buildReminderPayload({
        title: reminderTitle,
        message: reminderMessage,
        dueCount: daysSince,
      });
      new Notification(payload.title, { body: payload.body });
      localStorage.setItem(REMINDER_NOTIFIED_KEY, todayKey());
    } catch (e) { /* ignore */ }
  }, [remindersOn, daysSince, isAr, reminderTitle, reminderMessage]);

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(REMINDER_DISMISS_KEY, todayKey()); } catch (e) {}
  }

  if (!shouldShow) return null;

  const timeLabel = daysSince === null
    ? tr(isAr, "You haven't reviewed yet", "لسه ما راجعتش")
    : daysSince === 0
    ? tr(isAr, "earlier today", "بدري النهارده")
    : daysSince === 1
    ? tr(isAr, "1 day ago", "من يوم واحد")
    : tr(isAr, `${daysSince} days ago`, `من ${daysSince} يوم`);

  return (
    <div
      style={{
        marginTop: 12,
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        background: `linear-gradient(135deg, ${cfg.accent}22, ${cfg.accent}10)`,
        border: `1px solid ${cfg.accent}55`,
        borderRadius: "var(--modal-radius, 14px)",
        padding: "12px 16px",
        boxShadow: `0 8px 24px -12px ${cfg.accent}66`,
      }}
    >
      <FlameIcon size={20} color={cfg.accent} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", lineHeight: 1.3 }}>
          {tr(isAr, "Let's review now!", "يلا راجع حالا!")}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--muted-strong)", marginTop: 3, lineHeight: 1.4 }}>
          {tr(isAr,
            `Last time you reviewed: ${timeLabel}. A short quiz keeps words fresh.`,
            `آخر مرة راجعت: ${timeLabel}. اختبار سريع بيخلّي الكلام طازة.`)}
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenQuiz}
        style={{
          padding: "10px 16px",
          fontSize: 13.5,
          fontWeight: 800,
          color: "#fff",
          background: `linear-gradient(135deg, ${cfg.accent}, ${cfg.accent})`,
          border: "none",
          borderRadius: 10,
          cursor: "pointer",
          boxShadow: `0 6px 16px -6px ${cfg.accent}99`,
        }}
      >
        {tr(isAr, "Review now", "يلا راجع حالا")}
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
