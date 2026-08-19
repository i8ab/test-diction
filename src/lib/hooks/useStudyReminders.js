import { useState, useEffect, useRef, useCallback } from "react";
import {
  pushSupported,
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  savePushPrefs,
  fetchPushPrefs,
  applyPushPrefsLocally,
  resetPushSlots,
  loadRemindersEnabled,
  saveRemindersEnabled,
  loadReminderMessage,
  saveReminderMessage,
  loadReminderMessages,
  saveReminderMessages,
  loadReminderTitle,
  saveReminderTitle,
  loadReminderIntervalHours,
  saveReminderIntervalHours,
  buildReminderPayload,
  DEFAULT_INTERVAL_HOURS,
  checkNeedsResubscribeFlag,
  clearNeedsResubscribeFlag,
  hasActiveBrowserSubscription,
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
  const [reminderMessages, setReminderMessages] = useState([]);
  const [reminderIntervalHours, setReminderIntervalHours] = useState(DEFAULT_INTERVAL_HOURS);
  const prefsSaveTimerRef = useRef(null);

  // Reload this account's own notification prefs whenever the signed-in
  // account changes — never reuse another account's title/body/on-state.
  // 1) Show local cache immediately (fast / offline)
  // 2) Then pull cloud prefs so phone B matches phone A
  useEffect(() => {
    if (!accountCode) {
      setRemindersOn(false);
      setReminderTitle("");
      setReminderMessage("");
      setReminderMessages([]);
      setReminderIntervalHours(DEFAULT_INTERVAL_HOURS);
      return;
    }
    setRemindersOn(loadRemindersEnabled(accountCode));
    setReminderTitle(loadReminderTitle(accountCode));
    setReminderMessage(loadReminderMessage(accountCode));
    setReminderMessages(loadReminderMessages(accountCode));
    setReminderIntervalHours(loadReminderIntervalHours(accountCode));

    let cancelled = false;
    (async () => {
      const cloud = await fetchPushPrefs(accountCode);
      if (cancelled || !cloud) return;
      // Prefer cloud when it has real content (messages / title / interval)
      const hasCloudContent =
        (cloud.messages && cloud.messages.length) ||
        (cloud.title && cloud.title.trim()) ||
        (cloud.message && cloud.message.trim());
      if (!hasCloudContent) return;
      applyPushPrefsLocally(accountCode, cloud);
      setReminderTitle(cloud.title || "");
      setReminderMessage(cloud.message || (cloud.messages && cloud.messages[0]) || "");
      setReminderMessages(
        cloud.messages && cloud.messages.length
          ? cloud.messages
          : cloud.message
            ? [cloud.message]
            : []
      );
      if (cloud.intervalHours) setReminderIntervalHours(cloud.intervalHours);
    })();
    return () => {
      cancelled = true;
    };
  }, [accountCode]);

  const schedulePrefsSave = useCallback(
    (next) => {
      if (prefsSaveTimerRef.current) clearTimeout(prefsSaveTimerRef.current);
      prefsSaveTimerRef.current = setTimeout(() => {
        // Always sync prefs to the server so other devices see the same
        // title/messages/interval — even if push is currently off on this phone.
        if (!accountCode) return;
        savePushPrefs(accountCode, next).catch(() => {});
      }, 700);
    },
    [accountCode]
  );

  const getReminderPrefs = useCallback(
    () => ({
      title: reminderTitle,
      message: reminderMessages[0] || reminderMessage,
      messages: reminderMessages,
      intervalHours: reminderIntervalHours,
    }),
    [reminderTitle, reminderMessage, reminderMessages, reminderIntervalHours]
  );

  const handleChangeReminderTitle = useCallback(
    (title) => {
      setReminderTitle(title);
      if (accountCode) saveReminderTitle(title, accountCode);
      schedulePrefsSave({
        title,
        message: reminderMessages[0] || reminderMessage,
        messages: reminderMessages,
        intervalHours: reminderIntervalHours,
      });
    },
    [accountCode, reminderMessage, reminderMessages, reminderIntervalHours, schedulePrefsSave]
  );

  const handleChangeReminderMessage = useCallback(
    (message) => {
      setReminderMessage(message);
      if (accountCode) saveReminderMessage(message, accountCode);
      schedulePrefsSave({ title: reminderTitle, message, messages: reminderMessages, intervalHours: reminderIntervalHours });
    },
    [accountCode, reminderTitle, reminderMessages, reminderIntervalHours, schedulePrefsSave]
  );

  const handleChangeReminderMessages = useCallback(
    (messages) => {
      // Keep empty slots while the user is typing; only persist non-empty ones.
      const draft = (Array.isArray(messages) ? messages : [])
        .map((m) => String(m || ""))
        .slice(0, 20);
      const cleaned = draft.map((m) => m.trim()).filter(Boolean).slice(0, 20);
      setReminderMessages(draft.length ? draft : []);
      setReminderMessage(cleaned[0] || "");
      if (accountCode) {
        saveReminderMessages(cleaned, accountCode);
        saveReminderMessage(cleaned[0] || "", accountCode);
      }
      schedulePrefsSave({
        title: reminderTitle,
        message: cleaned[0] || "",
        messages: cleaned,
        intervalHours: reminderIntervalHours,
      });
    },
    [accountCode, reminderTitle, reminderIntervalHours, schedulePrefsSave]
  );

  const handleChangeReminderIntervalHours = useCallback(
    (hours) => {
      const n = Number(hours);
      setReminderIntervalHours(n);
      if (accountCode) saveReminderIntervalHours(n, accountCode);
      schedulePrefsSave({ title: reminderTitle, message: reminderMessages[0] || reminderMessage, messages: reminderMessages, intervalHours: n });
    },
    [accountCode, reminderTitle, reminderMessage, schedulePrefsSave]
  );

  // Safety: never leave remindersBusy=true for more than ~25s even if a
  // promise hangs. This is the main fix for "the dialog freezes".
  const busySafetyTimerRef = useRef(null);
  const setBusySafe = useCallback((on) => {
    if (busySafetyTimerRef.current) {
      clearTimeout(busySafetyTimerRef.current);
      busySafetyTimerRef.current = null;
    }
    setRemindersBusy(!!on);
    if (on) {
      busySafetyTimerRef.current = setTimeout(() => {
        setRemindersBusy(false);
        busySafetyTimerRef.current = null;
      }, 25000);
    }
  }, []);

  /**
   * Keep the push subscription healthy.
   * Called on: account change, app becomes visible, SW says subscription changed.
   * - If SW left a "needs resubscribe" flag → force repair.
   * - If browser has no active subscription → create one.
   * - Otherwise quietly re-upsert the existing one to the server
   *   (covers the case where server lost it but browser still has it).
   * Never shows toasts here — this is silent background maintenance.
   */
  const ensureSubscriptionHealthy = useCallback(
    async (opts = {}) => {
      const forceFromCaller = !!(opts && opts.force);
      if (!accountCode || !pushSupported()) return;
      // Prefer the live toggle state; also honour localStorage so a cold
      // start right after enable still repairs even before state settles.
      const wantsReminders =
        remindersOn || loadRemindersEnabled(accountCode);
      if (!wantsReminders) return;

      try {
        const status = await getPushStatus();
        if (status !== "granted") return;

        let force = forceFromCaller;
        try {
          if (await checkNeedsResubscribeFlag()) {
            force = true;
            await clearNeedsResubscribeFlag();
          }
        } catch (_) {}

        if (!force) {
          const hasSub = await hasActiveBrowserSubscription();
          if (!hasSub) force = true;
        }

        await subscribeToPush(accountCode, getReminderPrefs(), { force });
      } catch (_) {
        /* quiet background repair — never disturb the user */
      }
    },
    [accountCode, remindersOn, getReminderPrefs]
  );

  // 1) On account change / first load: repair if needed
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await ensureSubscriptionHealthy({ force: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [accountCode, ensureSubscriptionHealthy]);

  // 2) When the app comes back to the foreground (user reopened it after
  //    closing / switching away): repair. This is the main fix for
  //    "notifications stop until I open the app".
  useEffect(() => {
    if (!accountCode || !pushSupported()) return;

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        ensureSubscriptionHealthy({ force: false });
      }
    };
    const onFocus = () => {
      ensureSubscriptionHealthy({ force: false });
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [accountCode, ensureSubscriptionHealthy]);

  // 3) Listen for SW message: pushsubscriptionchange while a tab was open
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onMessage = (event) => {
      const data = event && event.data;
      if (!data || data.type !== "PUSH_SUBSCRIPTION_CHANGE") return;
      // Force repair immediately — the old endpoint is dead
      ensureSubscriptionHealthy({ force: true });
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [ensureSubscriptionHealthy]);

  // Optimistic UI: flip the toggle immediately so the menu feels instant.
  // Network / permission work runs in the background; if enable fails
  // (permission denied, unsupported, server error) we roll the flag back.
  // We use force:true on explicit user enable so a previously broken /
  // stale subscription is replaced with a fresh one — this is the most
  // reliable fix for "it says On but notifications never come".
  const enableReminders = useCallback(async () => {
    if (remindersBusy) return;
    setRemindersOn(true);
    if (accountCode) saveRemindersEnabled(accountCode, true);
    setBusySafe(true);
    try {
      if (pushSupported() && accountCode) {
        // force:true → drop any stale browser subscription and create a new one
        const result = await subscribeToPush(accountCode, getReminderPrefs(), { force: true });
        if (result.ok) {
          try { await clearNeedsResubscribeFlag(); } catch (_) {}
        }
        if (!result.ok) {
          setRemindersOn(false);
          if (accountCode) saveRemindersEnabled(accountCode, false);
          if (typeof showToast === "function") {
            const err = result.error || result.reason || "";
            if (err === "denied") {
              showToast("الإذن مرفوض — افتح إعدادات المتصفح وفعّل الإشعارات للتطبيق");
            } else if (err === "no_vapid") {
              showToast("مفتاح VAPID ناقص — حط VITE_VAPID_PUBLIC_KEY في Vercel ثم redeploy");
            } else if (err === "sw_timeout" || err === "subscribe_timeout" || err === "timeout") {
              showToast("التفعيل استغرق وقت طويل — أقفل التطبيق وافتحه تاني ثم حاول");
            } else if (err === "network_timeout" || result.reason === "network") {
              showToast("مفيش إنترنت أو السيرفر مش راد — حاول تاني بعد شوية");
            } else {
              showToast(result.message || "فشل تفعيل الإشعارات — حاول تاني");
            }
          }
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
      if (typeof showToast === "function") {
        showToast("حصل خطأ أثناء التفعيل — حاول تاني");
      }
    } finally {
      setBusySafe(false);
    }
  }, [accountCode, remindersBusy, getReminderPrefs, showToast, setBusySafe]);

  // Turns off push on *this device only*. Other phones for the same account
  // keep their subscriptions and keep receiving reminders.
  const disableReminders = useCallback(async () => {
    if (remindersBusy) return;
    setRemindersOn(false);
    if (accountCode) saveRemindersEnabled(accountCode, false);
    setBusySafe(true);
    try {
      await unsubscribeFromPush(accountCode);
    } catch (_) {}
    finally {
      setBusySafe(false);
    }
  }, [accountCode, remindersBusy, setBusySafe]);

  const clearReminderSlots = useCallback(async () => {
    if (!accountCode) {
      if (typeof showToast === "function") showToast("سجّل الدخول أولاً / Sign in first");
      return { ok: false };
    }
    setBusySafe(true);
    try {
      const result = await resetPushSlots(accountCode);
      if (typeof showToast === "function") {
        if (result.ok) {
          showToast(
            "تم مسح الجدولة — التذكير الجاي هيشتغل من أول وجديد / Schedule cleared — next reminder starts fresh"
          );
        } else {
          showToast(result.error || "فشل مسح السلوتات / Could not clear slots");
        }
      }
      return result;
    } catch (_) {
      if (typeof showToast === "function") showToast("خطأ شبكة / Network error");
      return { ok: false };
    } finally {
      setBusySafe(false);
    }
  }, [accountCode, showToast, setBusySafe]);

  const testReminderPush = useCallback(async () => {
    if (!accountCode) {
      if (typeof showToast === "function") showToast("سجّل الدخول أولاً / Sign in first");
      return;
    }
    setBusySafe(true);
    try {
      if (pushSupported()) {
        // Force a fresh subscription before testing — this is the path users
        // hit when "it was On but nothing arrived". A clean sub is the fix.
        const sub = await subscribeToPush(accountCode, getReminderPrefs(), { force: true });
        if (!sub.ok) {
          const err = sub.error || sub.reason || "";
          if (typeof showToast === "function") {
            if (err === "denied") {
              showToast("الإذن مرفوض — فعّل الإشعارات من إعدادات المتصفح");
            } else if (err === "no_vapid") {
              showToast("مفتاح VAPID ناقص — حط VITE_VAPID_PUBLIC_KEY في Vercel ثم redeploy");
            } else if (err === "sw_timeout" || err === "subscribe_timeout" || err === "timeout") {
              showToast("التفعيل استغرق وقت طويل — أقفل وافتح التطبيق ثم حاول");
            } else if (err === "network_timeout") {
              showToast("مفيش إنترنت أو السيرفر مش راد — حاول تاني");
            } else {
              showToast(sub.message || "مفيش اشتراك Push — فعّل التذكيرات ووافق على الإذن");
            }
          }
          return;
        }
        try { await clearNeedsResubscribeFlag(); } catch (_) {}
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
    } finally {
      setBusySafe(false);
    }
  }, [accountCode, getReminderPrefs, reminderTitle, reminderMessage, showToast, setBusySafe]);

  return {
    remindersOn,
    remindersBusy,
    reminderTitle,
    reminderMessage,
    reminderMessages,
    reminderIntervalHours,
    handleChangeReminderTitle,
    handleChangeReminderMessage,
    handleChangeReminderMessages,
    handleChangeReminderIntervalHours,
    enableReminders,
    disableReminders,
    clearReminderSlots,
    testReminderPush,
  };
}
