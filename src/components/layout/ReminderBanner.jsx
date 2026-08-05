import { useState, useEffect, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { FlameIcon, XIcon } from "../common/Icons";
import { pushSupported } from "../../lib/state/push";

/* =========================================================================
   STUDY REMINDER BANNER
   -------------------------------------------------------------------------
   Shown above the entry list once it's been a day+ since the person last
   studied. The on/off control for reminders now lives in the top header
   menu (see HeaderMenu.jsx) so it's reachable anytime, not just while this
   banner happens to be showing — this banner just reflects that setting
   (via the `remindersOn` prop, lifted to App.jsx) and still handles the
   local in-app notification fallback + "review now" / dismiss actions.
   ========================================================================= */
const REMINDER_DISMISS_KEY = "twoTongues.reminderDismissedOn";
const REMINDER_NOTIFIED_KEY = "twoTongues.reminderNotifiedOn";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function ReminderBanner({ studiedAt, isAr, cfg, onOpenQuiz, remindersOn }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(REMINDER_DISMISS_KEY) === todayKey(); } catch (e) { return false; }
  });

  const lastStudied = useMemo(() => {
    const values = Object.values(studiedAt || {});
    return values.length ? Math.max(...values) : null;
  }, [studiedAt]);

  const daysSince = lastStudied == null ? null : Math.floor((Date.now() - lastStudied) / (24 * 60 * 60 * 1000));
  const shouldShow = daysSince !== null && daysSince >= 1 && !dismissed;

  // Fire a soft, local notification (only while the app is open) once per
  // day if the person has opted in, it's been a day+ since they studied,
  // AND real push isn't set up (server-side cron handles that case instead
  // — firing both would double-notify). This is the fallback for when
  // push is unsupported/unconfigured; while the app happens to be open,
  // it still nudges the person.
  useEffect(() => {
    if (!remindersOn || daysSince === null || daysSince < 1) return;
    if (pushSupported()) return; // real push (server cron) owns notifying in this case
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      if (localStorage.getItem(REMINDER_NOTIFIED_KEY) === todayKey()) return;
      new Notification(tr(isAr, "Time to review!", "وقت المراجعة!"), {
        body: tr(isAr, `It's been ${daysSince} day${daysSince === 1 ? "" : "s"} since you studied.`, `عدّى ${daysSince} يوم من غير ما تراجع.`),
      });
      localStorage.setItem(REMINDER_NOTIFIED_KEY, todayKey());
    } catch (e) { /* Notification API not available/blocked — ignore */ }
  }, [remindersOn, daysSince, isAr]);

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(REMINDER_DISMISS_KEY, todayKey()); } catch (e) {}
  }

  if (!shouldShow) return null;

  return (
    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: cfg.accentSoft, border: `1px solid ${cfg.accent}`, borderRadius: 8, padding: "10px 14px" }}>
      <FlameIcon size={17} color={cfg.accent} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 200, fontSize: 13.5, color: "var(--muted-strong)" }}>
        {tr(isAr,
          `It's been ${daysSince} day${daysSince === 1 ? "" : "s"} since your last review — a quick quiz keeps it fresh.`,
          `عدّى ${daysSince} يوم من غير ما تراجع — اختبار سريع هيفضّل الكلام طازة.`)}
      </span>
      <button type="button" onClick={onOpenQuiz} style={{ padding: "6px 12px", fontSize: 13, fontWeight: 700, color: "#fff", background: cfg.accent, border: "none", borderRadius: 6, cursor: "pointer" }}>
        {tr(isAr, "Review now", "راجع دلوقتي")}
      </button>
      {!remindersOn && (
        <span style={{ fontSize: 12, color: "var(--icon-muted)" }}>
          {tr(isAr, "Tip: turn on daily reminders from the menu ☰ above.", "تلميح: فعّل التذكير اليومي من القائمة ☰ اللي فوق.")}
        </span>
      )}
      <button type="button" onClick={dismiss} aria-label={tr(isAr, "Dismiss", "إخفاء")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", padding: 4 }}>
        <XIcon size={16} />
      </button>
    </div>
  );
}
