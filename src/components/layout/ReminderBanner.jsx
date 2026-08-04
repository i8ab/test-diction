import { useState, useEffect, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { FlameIcon, XIcon } from "../common/Icons";

/* =========================================================================
   STUDY REMINDER BANNER
   -------------------------------------------------------------------------
   Shown above the entry list once it's been a day+ since the person last
   studied. Can optionally opt in to a local (in-app only) browser
   notification once per day. Everything here is derived from data already
   loaded client-side (per-entry `studiedAt` timestamps) — no extra
   network calls or stored fields.
   ========================================================================= */
const REMINDER_PREF_KEY = "twoTongues.remindersEnabled";
const REMINDER_DISMISS_KEY = "twoTongues.reminderDismissedOn";
const REMINDER_NOTIFIED_KEY = "twoTongues.reminderNotifiedOn";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function ReminderBanner({ studiedAt, isAr, cfg, onOpenQuiz }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(REMINDER_DISMISS_KEY) === todayKey(); } catch (e) { return false; }
  });
  const [remindersOn, setRemindersOn] = useState(() => {
    try { return localStorage.getItem(REMINDER_PREF_KEY) === "1"; } catch (e) { return false; }
  });

  const lastStudied = useMemo(() => {
    const values = Object.values(studiedAt || {});
    return values.length ? Math.max(...values) : null;
  }, [studiedAt]);

  const daysSince = lastStudied == null ? null : Math.floor((Date.now() - lastStudied) / (24 * 60 * 60 * 1000));
  const shouldShow = daysSince !== null && daysSince >= 1 && !dismissed;

  // Fire a soft, local notification (only while the app is open) once per
  // day if the person has opted in and it's been a day+ since they studied.
  useEffect(() => {
    if (!remindersOn || daysSince === null || daysSince < 1) return;
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

  async function enableReminders() {
    try {
      if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return;
      }
      setRemindersOn(true);
      localStorage.setItem(REMINDER_PREF_KEY, "1");
    } catch (e) { /* Notification API not available — the in-app banner still works */ }
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
        <button type="button" onClick={enableReminders} style={{ padding: "6px 12px", fontSize: 13, fontWeight: 600, color: cfg.accent, background: "none", border: `1px solid ${cfg.accent}`, borderRadius: 6, cursor: "pointer" }}>
          {tr(isAr, "Remind me daily", "ذكّرني يوميًا")}
        </button>
      )}
      <button type="button" onClick={dismiss} aria-label={tr(isAr, "Dismiss", "إخفاء")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", padding: 4 }}>
        <XIcon size={16} />
      </button>
    </div>
  );
}
