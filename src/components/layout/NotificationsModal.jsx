import { useState } from "react";
import { createPortal } from "react-dom";
import { tr } from "../../lib/config/i18n";
import { XIcon, BellIcon, BellOffIcon, LoaderIcon } from "../common/Icons";

/**
 * Notifications settings: study reminders + admin broadcast push.
 */
export default function NotificationsModal({
  open,
  onClose,
  isAr = false,
  appLang = "en",
  remindersOn = false,
  remindersBusy = false,
  onEnableReminders = null,
  onDisableReminders = null,
  onTestReminder = null,
  onClearReminderSlots = null,
  reminderTitle = "",
  onChangeReminderTitle = null,
  reminderMessage = "",
  onChangeReminderMessage = null,
  reminderMessages = [],
  onChangeReminderMessages = null,
  reminderIntervalHours = 24,
  onChangeReminderIntervalHours = null,
  isAdmin = false,
  myAccountCode = null,
}) {
  const lang = appLang || (isAr ? "ar" : "en");
  const T = (en, ar, de, fr) => tr(lang, en, ar, de, fr);

  const fieldLabel = {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "var(--muted-strong)",
    marginBottom: 6,
  };
  const fieldInput = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(var(--border-rgb),0.2)",
    background: "var(--input-bg)",
    color: "var(--ink)",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
  };

  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushSending, setPushSending] = useState(false);
  const [pushResult, setPushResult] = useState("");

  async function sendBroadcast(e) {
    e && e.preventDefault();
    if (!myAccountCode) return;
    setPushSending(true);
    setPushResult("");
    try {
      const r = await fetch("/api/push-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminCode: myAccountCode,
          title: pushTitle.trim(),
          body: pushBody.trim(),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setPushResult(data.error || T("Send failed.", "فشل الإرسال."));
      } else {
        setPushResult(
          tr(
            isAr,
            `Sent to ${data.sent || 0} device(s). Skipped ${data.skipped || 0}, expired ${data.expired || 0}.`,
            `اتبعت لـ ${data.sent || 0} جهاز. تم تخطي ${data.skipped || 0}، منتهي ${data.expired || 0}.`
          )
        );
      }
    } catch (_) {
      setPushResult(T("Network error — try again.", "خطأ في الشبكة — حاول مرة أخرى."));
    }
    setPushSending(false);
  }

  if (!open || typeof document === "undefined") return null;

  const closeNotifModal = onClose;

  return createPortal(
        <div
          onClick={() => { /* Stay open unless X */ }}
          className="modal-backdrop"
          style={{
            position: "fixed", inset: 0, zIndex: 3600,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notif-modal-title"
            className="modal-card"
            style={{
              width: "100%", maxWidth: "min(440px, 100%)",
              maxHeight: "min(90dvh, 820px)", overflow: "hidden", display: "flex", flexDirection: "column",
              background: "var(--card)", color: "var(--ink)",
              border: "1px solid rgba(var(--border-rgb),0.14)",
              borderRadius: 16,
              padding: "clamp(14px, 3vw, 22px)",
              boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexShrink: 0 }}>
              <h2 id="notif-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>
                {T( "Notifications", "الإشعارات")}
              </h2>
              <button
                type="button"
                onClick={closeNotifModal}
                aria-label={T( "Close", "إغلاق")}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
            <div
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{ padding: "6px 10px 12px", display: "flex", flexDirection: "column", gap: 10 }}
                    >
                      <button
                        type="button"
                        disabled={remindersBusy}
                        className="touch-target"
                        onClick={() => { if (remindersOn) onDisableReminders(); else onEnableReminders(); }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          width: "100%", padding: "9px 12px", minHeight: 44, borderRadius: 10, cursor: remindersBusy ? "default" : "pointer",
                          border: "1px solid rgba(var(--border-rgb),0.18)", background: "var(--input-bg)",
                          fontSize: 13, fontWeight: 600, color: "var(--ink)",
                        }}
                      >
                        <span>{remindersOn ? T( "Reminders: On (this device)", "التذكيرات: مفعّلة (الجهاز ده)") : T( "Reminders: Off (this device)", "التذكيرات: متوقفة (الجهاز ده)")}</span>
                        <span style={{
                          width: 36, height: 20, borderRadius: 10, position: "relative", flexShrink: 0,
                          background: remindersOn ? "#34c759" : "rgba(var(--border-rgb),0.35)",
                          transition: "background 0.2s ease",
                        }}>
                          <span style={{
                            position: "absolute", top: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff",
                            insetInlineStart: remindersOn ? 18 : 2, transition: "inset-inline-start 0.2s ease",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                          }} />
                        </span>
                      </button>

                      <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4, padding: "0 2px" }}>
                        {T(
                          "On/Off is per device: turning off here does not stop reminders on your other phones. Reminders fire on the clock (e.g. 6:00, 7:00). Pick how many hours between those hours.",
                          "التفعيل/الإيقاف للجهاز ده بس: لو وقّفت هنا، التليفونات التانية تفضل تستلم عادي. التذكيرات على رأس الساعة (مثلاً 6:00 و 7:00). اختار كل كام ساعة بين المواعيد دي.")}
                      </div>

                      <div>
                        <label style={fieldLabel}>{T("Repeat every", "كل قد إيه")}</label>
                        <select
                          value={reminderIntervalHours || 24}
                          onChange={(e) => onChangeReminderIntervalHours && onChangeReminderIntervalHours(Number(e.target.value))}
                          style={{ ...fieldInput, cursor: "pointer" }}
                        >
                          <option value={1}>{T("Every hour (on the hour)", "كل ساعة (على رأس الساعة)")}</option>
                          <option value={2}>{T("Every 2 hours (on the hour)", "كل ساعتين (على رأس الساعة)")}</option>
                          <option value={3}>{T("Every 3 hours", "كل 3 ساعات")}</option>
                          <option value={6}>{T("Every 6 hours", "كل 6 ساعات")}</option>
                          <option value={12}>{T("Every 12 hours", "كل 12 ساعة")}</option>
                          <option value={24}>{T("Every 24 hours (once a day)", "كل 24 ساعة (مرة في اليوم)")}</option>
                        </select>
                      </div>

                      <div>
                        <label style={fieldLabel}>{T( "Notification title", "عنوان الإشعار")}</label>
                        <input
                          type="text"
                          value={reminderTitle || ""}
                          onChange={(e) => onChangeReminderTitle && onChangeReminderTitle(e.target.value)}
                          placeholder={T( "Time to review!", "وقت المراجعة!")}
                          maxLength={120}
                          style={fieldInput}
                          dir="auto"
                        />
                      </div>

                      <div>
                        <label style={fieldLabel}>
                          {T("Notification messages (in order)", "رسائل الإشعارات (بالترتيب)")}
                        </label>
                        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4, marginBottom: 8 }}>
                          {T(
                            "Each reminder uses the next message. After the last one, it starts over from the first.",
                            "كل تذكير بياخد الرسالة اللي بعدها. بعد آخر رسالة يرجع من الأول تاني."
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {(reminderMessages && reminderMessages.length ? reminderMessages : [""]).map((msg, i) => (
                            <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                              <span style={{
                                flex: "0 0 22px", marginTop: 10, fontSize: 11, fontWeight: 800,
                                color: "var(--muted)", textAlign: "center",
                              }}>{i + 1}</span>
                              <textarea
                                value={msg}
                                onChange={(e) => {
                                  if (!onChangeReminderMessages) return;
                                  const base = (reminderMessages && reminderMessages.length)
                                    ? [...reminderMessages]
                                    : [""];
                                  while (base.length <= i) base.push("");
                                  base[i] = e.target.value;
                                  onChangeReminderMessages(base);
                                }}
                                placeholder={tr(
                                  isAr,
                                  i === 0 ? "It's been a while — time for a quick review." : "Next message…",
                                  i === 0 ? "عدّى وقت — يلا نراجع شوية." : "الرسالة التالية…"
                                )}
                                maxLength={300}
                                rows={2}
                                style={{ ...fieldInput, flex: 1, resize: "vertical", minHeight: 48, lineHeight: 1.4 }}
                                dir="auto"
                              />
                              <button
                                type="button"
                                className="touch-target"
                                title={T("Remove", "حذف")}
                                onClick={() => {
                                  if (!onChangeReminderMessages) return;
                                  const base = (reminderMessages && reminderMessages.length)
                                    ? reminderMessages.filter((_, j) => j !== i)
                                    : [];
                                  onChangeReminderMessages(base);
                                }}
                                style={{
                                  flex: "0 0 36px", marginTop: 4, height: 36, borderRadius: 10,
                                  border: "1px solid rgba(var(--border-rgb),0.2)", background: "var(--input-bg)",
                                  color: "var(--danger, #e5484d)", fontWeight: 800, cursor: "pointer", fontSize: 16,
                                }}
                              >×</button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="touch-target"
                          disabled={(reminderMessages || []).length >= 20}
                          onClick={() => {
                            if (!onChangeReminderMessages) return;
                            const base = [...(reminderMessages || [])];
                            if (base.length >= 20) return;
                            base.push("");
                            onChangeReminderMessages(base);
                          }}
                          style={{
                            marginTop: 8, width: "100%", minHeight: 40, borderRadius: 10, cursor: "pointer",
                            border: "1px dashed rgba(var(--border-rgb),0.35)", background: "transparent",
                            color: "var(--accent-1)", fontWeight: 700, fontSize: 13,
                            opacity: (reminderMessages || []).length >= 20 ? 0.5 : 1,
                          }}
                        >
                          + {T("Add message", "إضافة رسالة")}
                          {(reminderMessages || []).length > 0
                            ? ` (${(reminderMessages || []).length}/20)`
                            : ""}
                        </button>
                      </div>

                      <div style={{
                        border: "1px solid rgba(var(--border-rgb),0.18)", borderRadius: 10,
                        padding: "10px 12px", background: "var(--paper)",
                      }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>
                          {T( "Preview (next up)", "معاينة (الجاية)")}
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 3, lineHeight: 1.3 }} dir="auto">
                          {(reminderTitle && reminderTitle.trim()) || T( "Time to review!", "وقت المراجعة!")}
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.4 }} dir="auto">
                          {((reminderMessages && reminderMessages[0]) || reminderMessage || "").trim() || tr(
                            isAr,
                            "It's been a while since you studied — time for a quick review.",
                            "عدّى وقت من غير ما تراجع — يلا نراجع شوية."
                          )}
                        </div>
                      </div>

                      {onTestReminder && (
                        <button
                          type="button"
                          onClick={onTestReminder}
                          className="touch-target"
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            width: "100%", padding: "10px 12px", minHeight: 44, borderRadius: 10, cursor: "pointer",
                            border: "none", fontSize: 13, fontWeight: 700, color: "#fff",
                            background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                          }}
                        >
                          <BellIcon size={14} />
                          {T( "Send test notification", "ابعت إشعار تجريبي")}
                        </button>
                      )}

                      {onClearReminderSlots && (
                        <button
                          type="button"
                          disabled={remindersBusy}
                          onClick={() => onClearReminderSlots && onClearReminderSlots()}
                          className="touch-target"
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            width: "100%", padding: "10px 12px", minHeight: 44, borderRadius: 10,
                            cursor: remindersBusy ? "default" : "pointer",
                            border: "1px solid rgba(var(--border-rgb),0.22)",
                            background: "var(--input-bg)",
                            fontSize: 13, fontWeight: 700, color: "var(--ink)",
                            opacity: remindersBusy ? 0.6 : 1,
                          }}
                        >
                          {T(
                            "Clear schedule (start fresh)",
                            "مسح الجدولة (ابدأ من نضافة)"
                          )}
                        </button>
                      )}
                      {onClearReminderSlots && (
                        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4, padding: "0 2px", marginTop: -4 }}>
                          {T(
                            "Wipes the last-sent slot and message rotation so the next reminder can fire cleanly. Does not turn notifications off.",
                            "بيمسح آخر موعد اتبعت والعدّاد بتاع الرسائل عشان التذكير الجاي يشتغل من أول وجديد. مش بيطفي الإشعارات."
                          )}
                        </div>
                      )}

                      {/* Admin: broadcast push to every subscribed user */}
                      {isAdmin && myAccountCode && (
                        <div style={{
                          marginTop: 4, paddingTop: 12,
                          borderTop: "1px dashed rgba(var(--border-rgb),0.22)",
                          display: "flex", flexDirection: "column", gap: 10,
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted)" }}>
                            {T( "Notify everyone", "إشعار للجميع")}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
                            {T(
                              "Sends a real push to every user who turned reminders on.",
                              "بيبعت إشعار حقيقي لكل مستخدم فعّل التذكيرات.")}
                          </div>
                          <div>
                            <label style={fieldLabel}>{T( "Title", "العنوان")}</label>
                            <input
                              type="text"
                              value={pushTitle}
                              onChange={(e) => setPushTitle(e.target.value)}
                              placeholder={T( "e.g. New words added", "مثال: كلمات جديدة اتضافت")}
                              maxLength={120}
                              style={fieldInput}
                              dir="auto"
                            />
                          </div>
                          <div>
                            <label style={fieldLabel}>{T( "Message", "الرسالة")}</label>
                            <textarea
                              value={pushBody}
                              onChange={(e) => setPushBody(e.target.value)}
                              placeholder={T( "Optional body text…", "نص اختياري…")}
                              maxLength={300}
                              rows={2}
                              style={{ ...fieldInput, resize: "vertical", minHeight: 52, lineHeight: 1.4 }}
                              dir="auto"
                            />
                          </div>
                          {pushResult && (
                            <div style={{
                              fontSize: 12, lineHeight: 1.4,
                              color: /fail|فشل|error|خطأ|authorized|Unauthorized/i.test(pushResult) ? "var(--danger)" : "var(--success)",
                            }}>
                              {pushResult}
                            </div>
                          )}
                          <button
                            type="button"
                            disabled={pushSending || (!pushTitle.trim() && !pushBody.trim())}
                            className="touch-target"
                            onClick={sendBroadcast}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                              width: "100%", padding: "10px 12px", minHeight: 44, borderRadius: 10,
                              cursor: pushSending || (!pushTitle.trim() && !pushBody.trim()) ? "default" : "pointer",
                              border: "none", fontSize: 13, fontWeight: 700, color: "#fff",
                              background: "linear-gradient(135deg, #af52de, #5b8def)",
                              opacity: pushSending || (!pushTitle.trim() && !pushBody.trim()) ? 0.6 : 1,
                            }}
                          >
                            {pushSending ? <LoaderIcon size={14} /> : <BellIcon size={14} />}
                            {T( "Send to everyone", "إرسال للجميع")}
                          </button>
                        </div>
                      )}
                    </div>
            </div>
          </div>
        </div>
    ,
    document.body
  );
}
