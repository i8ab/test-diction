import { createPortal } from "react-dom";
import { XIcon, BellIcon, BellOffIcon, LoaderIcon } from "../common/Icons";
import { tr } from "../../lib/config/i18n";

const fieldLabel = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 4 };
const fieldInput = {
  width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 10,
  border: "1px solid rgba(var(--border-rgb),0.25)", background: "var(--input-bg)", color: "var(--ink)",
  fontSize: 14, fontFamily: "inherit",
};

export default function NotificationsModal({
  open,
  onClose,
  T,
  isAr,
  isAdmin,
  myAccountCode,
  remindersOn,
  remindersBusy,
  onEnableReminders,
  onDisableReminders,
  onTestReminder,
  reminderTitle,
  onChangeReminderTitle,
  reminderMessage,
  onChangeReminderMessage,
  pushTitle,
  setPushTitle,
  pushBody,
  setPushBody,
  pushSending,
  pushResult,
  onSendBroadcast,
}) {
  if (!open) return null;
  const node = (
        <div
          onClick={onClose}
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
              maxHeight: "min(90dvh, 820px)", overflowY: "auto",
              background: "var(--card)", color: "var(--ink)",
              border: "1px solid rgba(var(--border-rgb),0.14)",
              borderRadius: 16,
              padding: "clamp(14px, 3vw, 22px)",
              boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 id="notif-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>
                {T( "Notifications", "الإشعارات")}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={T( "Close", "إغلاق")}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <XIcon size={20} />
              </button>
            </div>
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
                        <span>{remindersOn ? T( "Reminders: On", "التذكيرات: مفعّلة") : T( "Reminders: Off", "التذكيرات: متوقفة")}</span>
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
                          "Daily reminder at 5:00 AM (Egypt time), even if you studied.",
                          "تذكير يومي الساعة 5:00 صباحًا (توقيت مصر)، حتى لو ذاكرت.")}
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
                        <label style={fieldLabel}>{T( "Notification message", "نص الإشعار")}</label>
                        <textarea
                          value={reminderMessage || ""}
                          onChange={(e) => onChangeReminderMessage && onChangeReminderMessage(e.target.value)}
                          placeholder={tr(
                            isAr,
                            "It's been a while since you studied — time for a quick review.",
                            "عدّى وقت من غير ما تراجع — يلا نراجع شوية."
                          )}
                          maxLength={300}
                          rows={3}
                          style={{ ...fieldInput, resize: "vertical", minHeight: 64, lineHeight: 1.4 }}
                          dir="auto"
                        />
                        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3, textAlign: "end" }}>
                          {(reminderMessage || "").length}/300
                        </div>
                      </div>

                      <div style={{
                        border: "1px solid rgba(var(--border-rgb),0.18)", borderRadius: 10,
                        padding: "10px 12px", background: "var(--paper)",
                      }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>
                          {T( "Preview", "معاينة")}
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 3, lineHeight: 1.3 }} dir="auto">
                          {(reminderTitle && reminderTitle.trim()) || T( "Time to review!", "وقت المراجعة!")}
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.4 }} dir="auto">
                          {(reminderMessage && reminderMessage.trim()) || tr(
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
                            onClick={onSendBroadcast}
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
  );
  return (typeof document !== "undefined" ? createPortal(node, document.body) : null);
}