import { useState, useEffect, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { FlameIcon, XIcon } from "../common/Icons";
import { pushSupported, subscribeToPush, unsubscribeFromPush, getPushStatus } from "../../lib/state/push";

/* =========================================================================
   STUDY REMINDER BANNER
   -------------------------------------------------------------------------
   Shown above the entry list once it's been a day+ since the person last
   studied. "Remind me daily" now registers a REAL push subscription
   (src/lib/state/push.js + api/push-send-reminders.js's daily cron) that
   reaches the person even if the site/tab is closed — not just the old
   in-app-only Notification, which only ever fired while this component
   itself was mounted and on-screen. If push isn't supported (or the VAPID
   key isn't configured), this quietly falls back to the old local-only
   notification so the banner still works everywhere.
   ========================================================================= */
const REMINDER_PREF_KEY = "twoTongues.remindersEnabled";
const REMINDER_DISMISS_KEY = "twoTongues.reminderDismissedOn";
const REMINDER_NOTIFIED_KEY = "twoTongues.reminderNotifiedOn";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function ReminderBanner({ studiedAt, isAr, cfg, onOpenQuiz, accountCode }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(REMINDER_DISMISS_KEY) === todayKey(); } catch (e) { return false; }
  });
  const [remindersOn, setRemindersOn] = useState(() => {
    try { return localStorage.getItem(REMINDER_PREF_KEY) === "1"; } catch (e) { return false; }
  });
  const [subscribing, setSubscribing] = useState(false);

  // On mount, if the user previously opted in AND the browser's push
  // permission is still granted but somehow lost its subscription (e.g.
  // cleared site data), re-subscribe quietly so reminders keep working.
  useEffect(() => {
    (async () => {
      if (!remindersOn || !accountCode || !pushSupported()) return;
      const status = await getPushStatus();
      if (status === "granted") await subscribeToPush(accountCode);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function enableReminders() {
    setSubscribing(true);
    try {
      if (pushSupported() && accountCode) {
        // Real push: reaches the person even with the site closed. Handles
        // its own permission prompt.
        const result = await subscribeToPush(accountCode);
        if (!result.ok) { setSubscribing(false); return; }
      } else if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
        // Fallback: old local-only notification (VAPID key missing, or
        // browser doesn't support Push API at all — e.g. some iOS versions).
        const perm = await Notification.requestPermission();
        if (perm !== "granted") { setSubscribing(false); return; }
      }
      setRemindersOn(true);
      localStorage.setItem(REMINDER_PREF_KEY, "1");
    } catch (e) { /* ignore — the in-app banner still works either way */ }
    setSubscribing(false);
  }

  async function disableReminders() {
    setSubscribing(true);
    try {
      if (accountCode) await unsubscribeFromPush(accountCode);
    } catch (e) { /* ignore — still clear the local flag below */ }
    setRemindersOn(false);
    try { localStorage.removeItem(REMINDER_PREF_KEY); } catch (e) {}
    setSubscribing(false);
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
      {!remindersOn ? (
        <button type="button" onClick={enableReminders} disabled={subscribing} style={{ padding: "6px 12px", fontSize: 13, fontWeight: 600, color: cfg.accent, background: "none", border: `1px solid ${cfg.accent}`, borderRadius: 6, cursor: subscribing ? "default" : "pointer", opacity: subscribing ? 0.6 : 1 }}>
          {subscribing ? tr(isAr, "Enabling...", "بيتفعّل...") : tr(isAr, "Remind me daily", "ذكّرني يوميًا")}
        </button>
      ) : (
        <button type="button" onClick={disableReminders} disabled={subscribing} style={{ padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "var(--muted-strong)", background: "none", border: "1px solid var(--muted-strong)", borderRadius: 6, cursor: subscribing ? "default" : "pointer", opacity: subscribing ? 0.6 : 1 }}>
          {subscribing ? tr(isAr, "Disabling...", "بيتلغي...") : tr(isAr, "Stop reminders", "وقف التذكيرات")}
        </button>
      )}
      <button type="button" onClick={dismiss} aria-label={tr(isAr, "Dismiss", "إخفاء")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", padding: 4 }}>
        <XIcon size={16} />
      </button>
    </div>
  );
}
