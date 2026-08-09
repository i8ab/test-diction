import { useState } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, labelStyle, inputStyle, primaryBtnStyle, errorStyle } from "../../lib/config/theme";
import { normalizeExamConfig, defaultExamConfig } from "../../lib/state/exam";
import { XIcon, FlameIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

const PRESET_COLORS = ["#e85d04", "#d62828", "#146C94", "#2a9d8f", "#6a4c93", "#b08d57", "#1d3557"];

/**
 * Admin-only: set exam date/time/color/labels and enable/disable the global countdown.
 */
export default function ExamSettingsModal({ examConfig, onPersist, isAr, onClose }) {
  const initial = normalizeExamConfig(examConfig || defaultExamConfig());
  const [enabled, setEnabled] = useState(!!initial.enabled);
  const [date, setDate] = useState(initial.date || "");
  const [time, setTime] = useState(initial.time || "09:00");
  const [color, setColor] = useState(initial.color || "#e85d04");
  const [labelEn, setLabelEn] = useState(initial.labelEn || "");
  const [labelAr, setLabelAr] = useState(initial.labelAr || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  async function save() {
    setError("");
    setOkMsg("");
    if (enabled && !date) {
      setError(tr(isAr, "Pick an exam date first.", "اختار تاريخ الامتحان الأول."));
      return;
    }
    setBusy(true);
    try {
      const next = normalizeExamConfig({
        enabled,
        date: date || null,
        time: time || "09:00",
        color,
        labelEn,
        labelAr,
      });
      const result = await onPersist(next);
      if (result && result.ok === false) {
        setError(result.error || tr(isAr, "Save failed", "فشل الحفظ"));
      } else {
        setOkMsg(tr(isAr, "Saved — all students will see the countdown.", "اتحفظ — كل الطلبة هيشوفوا العدّاد."));
      }
    } catch (e) {
      setError(tr(isAr, "Save failed", "فشل الحفظ"));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError("");
    try {
      const next = normalizeExamConfig({ ...initial, enabled: false });
      await onPersist(next);
      setEnabled(false);
      setOkMsg(tr(isAr, "Countdown turned off for everyone.", "العدّاد اتقفل لكل الطلبة."));
    } catch (_) {
      setError(tr(isAr, "Save failed", "فشل الحفظ"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="modal-backdrop"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, zIndex: 7000,
      }}
    >
      <BodyScrollLock />
      <div
        onClick={(e) => e.stopPropagation()}
        dir={isAr ? "rtl" : "ltr"}
        role="dialog"
        aria-modal="true"
        style={{
          width: "100%", maxWidth: 420, maxHeight: "90dvh", overflowY: "auto",
          background: CARD, borderRadius: 14, padding: "22px 20px",
          boxShadow: "0 24px 60px -12px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600, color: INK, display: "flex", alignItems: "center", gap: 8 }}>
            <FlameIcon size={18} color={color} />
            {tr(isAr, "Exam countdown", "عدّاد الامتحان")}
          </h2>
          <button type="button" onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")}
            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", width: 36, height: 36 }}>
            <XIcon size={20} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: "var(--muted-strong)", margin: "0 0 14px", lineHeight: 1.45 }}>
          {tr(isAr,
            "Only admins can change this. Students cannot dismiss the banner — it stays until you turn it off.",
            "الأدمن بس يقدر يغيّر ده. الطلبة مش يقدروا يخفوا البانر — بيفضل ظاهر لحد ما تقفله أنت.")}
        </p>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: INK, cursor: "pointer", marginBottom: 14 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {tr(isAr, "Show countdown to all students", "إظهار العدّاد لكل الطلبة")}
        </label>

        <label style={labelStyle}>{tr(isAr, "Exam date", "تاريخ الامتحان")}</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>{tr(isAr, "Exam time", "وقت الامتحان")}</label>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>{tr(isAr, "Banner color", "لون البانر")}</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, alignItems: "center" }}>
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              style={{
                width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer",
                border: color === c ? "3px solid var(--ink)" : "2px solid transparent",
              }}
            />
          ))}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
            style={{ width: 36, height: 28, border: "none", background: "none", cursor: "pointer" }} />
        </div>

        <label style={labelStyle}>{tr(isAr, "Label (English)", "العنوان (إنجليزي)")}</label>
        <input type="text" value={labelEn} onChange={(e) => setLabelEn(e.target.value)}
          placeholder="Exam" style={inputStyle} />

        <label style={labelStyle}>{tr(isAr, "Label (Arabic)", "العنوان (عربي)")}</label>
        <input type="text" value={labelAr} onChange={(e) => setLabelAr(e.target.value)}
          placeholder="الامتحان" style={inputStyle} dir="rtl" />

        {error && <div style={errorStyle}>{error}</div>}
        {okMsg && (
          <div style={{ marginTop: 12, padding: "8px 10px", borderRadius: 6, background: "var(--success-bg)", color: "var(--success)", fontSize: 13 }}>
            {okMsg}
          </div>
        )}

        <button type="button" onClick={save} disabled={busy} style={{ ...primaryBtnStyle, opacity: busy ? 0.6 : 1 }}>
          {busy ? tr(isAr, "Saving…", "جاري الحفظ…") : tr(isAr, "Save for everyone", "حفظ للجميع")}
        </button>

        {enabled && (
          <button type="button" onClick={turnOff} disabled={busy}
            style={{
              marginTop: 10, width: "100%", padding: "11px 14px", borderRadius: 12,
              border: "1px solid var(--danger-border)", background: "var(--danger-bg)",
              color: "var(--danger)", fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}>
            {tr(isAr, "Turn off countdown", "إيقاف العدّاد")}
          </button>
        )}
      </div>
    </div>
  );
}
