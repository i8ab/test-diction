import { useState, useEffect, useRef, useCallback } from "react";
import {
  pushSupported,
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  savePushPrefs,
  loadRemindersEnabled,
  saveRemindersEnabled,
  loadReminderMessage,
  saveReminderMessage,
  loadReminderTitle,
  saveReminderTitle,
  buildReminderPayload,
} from "../state/push";

/**
 * Study reminder preferences + Web Push subscribe/unsubscribe.
 * Tied to the currently signed-in accountCode.
 *
 * @param {string} accountCode
 * @param {(msg: string) => void} showToast
 */
export function useStudyReminders(accountCode, showToast) {
  const [remindersOn, setRemindersOn] = useState(false);
  const [remindersBusy, setRemindersBusy] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const prefsSaveTimerRef = useRef(null);

  // Reload this account's own notification prefs whenever the signed-in
  // account changes — never reuse another account's title/body/on-state.
  useEffect(() => {
    if (!accountCode) {
      setRemindersOn(false);
      setReminderTitle("");
      setReminderMessage("");
      return;
    }
    setRemindersOn(loadRemindersEnabled(accountCode));
    setReminderTitle(loadReminderTitle(accountCode));
    setReminderMessage(loadReminderMessage(accountCode));
  }, [accountCode]);

  const schedulePrefsSave = useCallback(
    (next) => {
      if (prefsSaveTimerRef.current) clearTimeout(prefsSaveTimerRef.current);
      prefsSaveTimerRef.current = setTimeout(() => {
        if (!accountCode || !remindersOn) return;
        savePushPrefs(accountCode, next).catch(() => {});
      }, 700);
    },
    [accountCode, remindersOn]
  );

  const getReminderPrefs = useCallback(
    () => ({
      title: reminderTitle,
      message: reminderMessage,
    }),
    [reminderTitle, reminderMessage]
  );

  const handleChangeReminderTitle = useCallback(
    (title) => {
      setReminderTitle(title);
      if (accountCode) saveReminderTitle(title, accountCode);
      schedulePrefsSave({ title, message: reminderMessage });
    },
    [accountCode, reminderMessage, schedulePrefsSave]
  );

  const handleChangeReminderMessage = useCallback(
    (message) => {
      setReminderMessage(message);
      if (accountCode) saveReminderMessage(message, accountCode);
      schedulePrefsSave({ title: reminderTitle, message });
    },
    [accountCode, reminderTitle, schedulePrefsSave]
  );

  // On load, if the person previously opted in AND permission is still
  // granted but the subscription was somehow lost (e.g. cleared site
  // data), re-subscribe quietly so reminders keep working.
  useEffect(() => {
    (async () => {
      if (!remindersOn || !accountCode || !pushSupported()) return;
      const status = await getPushStatus();
      if (status === "granted") await subscribeToPush(accountCode, getReminderPrefs());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountCode]);

  // Optimistic UI: flip the toggle immediately so the menu feels instant.
  // Network / permission work runs in the background; if enable fails
  // (permission denied, unsupported, server error) we roll the flag back.
  const enableReminders = useCallback(async () => {
    if (remindersBusy) return;
    setRemindersOn(true);
    if (accountCode) saveRemindersEnabled(accountCode, true);
    setRemindersBusy(true);
    try {
      if (pushSupported() && accountCode) {
        const result = await subscribeToPush(accountCode, getReminderPrefs());
        if (!result.ok) {
          setRemindersOn(false);
          if (accountCode) saveRemindersEnabled(accountCode, false);
        }
      } else if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setRemindersOn(false);
          if (accountCode) saveRemindersEnabled(accountCode, false);
        }
      }
    } catch (_) {
      setRemindersOn(false);
      if (accountCode) saveRemindersEnabled(accountCode, false);
    }
    setRemindersBusy(false);
  }, [accountCode, remindersBusy, getReminderPrefs]);

  const disableReminders = useCallback(async () => {
    setRemindersOn(false);
    if (accountCode) saveRemindersEnabled(accountCode, false);
    setRemindersBusy(false);
    // Unsubscribe in the background — UI is already off, no lag.
    if (accountCode) {
      try {
        await unsubscribeFromPush(accountCode);
      } catch (_) {
        /* ignore */
      }
    }
  }, [accountCode]);

  // Test push — sends the FINAL notification shape (custom title/body the
  // user typed, or the default if empty) so they can preview exactly what
  // the real reminder will look like.
  const testReminderPush = useCallback(async () => {
    if (!accountCode) {
      if (typeof showToast === "function") showToast("سجّل الدخول أولاً / Sign in first");
      return;
    }
    try {
      if (pushSupported()) {
        const sub = await subscribeToPush(accountCode, getReminderPrefs());
        if (!sub.ok) {
          const err = sub.error || sub.reason || "";
          if (typeof showToast === "function") {
            if (err === "denied") {
              showToast("الإذن مرفوض — فعّل الإشعارات من إعدادات المتصفح");
            } else if (err === "no_vapid") {
              showToast("مفتاح VAPID ناقص — حط VITE_VAPID_PUBLIC_KEY في Vercel ثم redeploy");
            } else {
              showToast(sub.message || "مفيش اشتراك Push — فعّل التذكيرات ووافق على الإذن");
            }
          }
          return;
        }
        setRemindersOn(true);
        if (accountCode) saveRemindersEnabled(accountCode, true);
      }
      const payload = buildReminderPayload({
        title: reminderTitle,
        message: reminderMessage,
      });
      const r = await fetch("/api/push-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accountCode, title: payload.title, body: payload.body }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        // Success: the OS notification itself is the feedback — no in-app toast.
      } else if (typeof showToast === "function") {
        if (data.error === "no_subscription") {
          showToast("مفيش اشتراك محفوظ — فعّل التذكيرات ووافق على الإذن");
        } else if (data.error === "subscription_expired") {
          showToast("الاشتراك انتهى — أوقف التذكيرات وشغّلها تاني");
        } else if (
          data.error === "vapid_invalid" ||
          /unexpected response code/i.test(String(data.error || data.message || ""))
        ) {
          showToast("مفاتيح VAPID غلط — ولّد مفاتيح جديدة وحطها في Vercel ثم redeploy");
        } else {
          showToast(data.message || data.error || `فشل الإرسال (${r.status})`);
        }
      }
    } catch (_) {
      if (typeof showToast === "function") showToast("خطأ شبكة أثناء تجربة الإشعار");
    }
  }, [accountCode, getReminderPrefs, reminderTitle, reminderMessage, showToast]);

  return {
    remindersOn,
    remindersBusy,
    reminderTitle,
    reminderMessage,
    handleChangeReminderTitle,
    handleChangeReminderMessage,
    enableReminders,
    disableReminders,
    testReminderPush,
  };
}
