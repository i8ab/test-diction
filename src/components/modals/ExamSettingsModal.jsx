import { useState } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, labelStyle, inputStyle, primaryBtnStyle, errorStyle } from "../../lib/config/theme";
import {
  normalizeExamConfig,
  defaultExamConfig,
  defaultExamItem,
  examItemTimestamp,
  getExamQueueInfo,
} from "../../lib/state/exam";
import { XIcon, FlameIcon, PlusIcon, TrashIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

const PRESET_COLORS = ["#e85d04", "#d62828", "#146C94", "#2a9d8f", "#6a4c93", "#b08d57", "#1d3557"];

/**
 * Admin-only: manage a queue of exams.
 * Countdowns run one after another — when the current exam passes,
 * the next one in the list becomes active automatically.
 */
export default function ExamSettingsModal({ examConfig, onPersist, isAr, onClose }) {
  const initial = normalizeExamConfig(examConfig || defaultExamConfig());
  const [enabled, setEnabled] = useState(!!initial.enabled);
  const [exams, setExams] = useState(
    initial.exams.length
      ? initial.exams.map((e) => ({ ...e }))
      : []
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  function updateExam(id, patch) {
    setExams((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function removeExam(id) {
    setExams((list) => list.filter((e) => e.id !== id));
  }

  function addExam() {
    const last = exams[exams.length - 1];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    const iso = tomorrow.toISOString().slice(0, 10);
    setExams((list) => [
      ...list,
      defaultExamItem({
        date: iso,
        time: last?.time || "09:00",
        color: last?.color || "#e85d04",
        labelEn: "",
        labelAr: "",
      }),
    ]);
  }

  async function save() {
    setError("");
    setOkMsg("");
    const valid = exams.filter((e) => e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date));
    if (enabled && valid.length === 0) {
      setError(tr(isAr, "Add at least one exam with a date.", "ضيف امتحان واحد على الأقل بتاريخ."));
      return;
    }
    setBusy(true);
    try {
      const next = normalizeExamConfig({
        enabled,
        exams: valid,
      });
      const result = await onPersist(next);
      if (result && result.ok === false) {
        setError(result.error || tr(isAr, "Save failed", "فشل الحفظ"));
      } else {
        setOkMsg(
          tr(
            isAr,
            `Saved — ${valid.length} exam(s). Students see the next one automatically.`,
            `اتحفظ — ${valid.length} امتحان. الطلبة هيشوفوا الجاي تلقائي.`
          )
        );
        setExams(next.exams.map((e) => ({ ...e })));
      }
    } catch (_) {
      setError(tr(isAr, "Save failed", "فشل الحفظ"));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError("");
    try {
      const next = normalizeExamConfig({ enabled: false, exams });
      await onPersist(next);
      setEnabled(false);
      setOkMsg(tr(isAr, "Countdown turned off for everyone.", "العدّاد اتقفل لكل الطلبة."));
    } catch (_) {
      setError(tr(isAr, "Save failed", "فشل الحفظ"));
    } finally {
      setBusy(false);
    }
  }

  const preview = getExamQueueInfo({ enabled: true, exams }, Date.now());

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
          width: "100%", maxWidth: 460, maxHeight: "92dvh", overflow: "hidden",
          display: "flex", flexDirection: "column",
          background: CARD, borderRadius: 14, padding: "20px 18px",
          boxShadow: "0 24px 60px -12px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600, color: INK, display: "flex", alignItems: "center", gap: 8 }}>
            <FlameIcon size={18} color="#e85d04" />
            {tr(isAr, "Exam countdown", "عدّاد الامتحان")}
          </h2>
          <button type="button" onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")}
            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", width: 36, height: 36 }}>
            <XIcon size={20} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
          <p style={{ fontSize: 13, color: "var(--muted-strong)", margin: "0 0 12px", lineHeight: 1.5 }}>
            {tr(
              isAr,
              "Add several exams in order. When one finishes, the next countdown starts automatically.",
              "ضيف أكتر من امتحان بالترتيب. لما واحد يخلص، العدّاد الجاي يشتغل لوحده."
            )}
          </p>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: INK, cursor: "pointer", marginBottom: 14 }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            {tr(isAr, "Show countdown to all students", "إظهار العدّاد لكل الطلبة")}
          </label>

          {/* Queue list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {exams.length === 0 && (
              <div style={{
                padding: "18px 12px", textAlign: "center", borderRadius: 10,
                border: "1px dashed rgba(var(--border-rgb),0.3)", color: "var(--muted)", fontSize: 13, fontWeight: 600,
              }}>
                {tr(isAr, "No exams yet — add the first one.", "مفيش امتحانات — ضيف أول واحد.")}
              </div>
            )}

            {exams.map((ex, idx) => {
              const ts = examItemTimestamp(ex);
              const past = ts != null && ts <= Date.now();
              const isActive = preview.active && preview.active.id === ex.id && !past;
              return (
                <div
                  key={ex.id}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: isActive
                      ? `2px solid ${ex.color || "#e85d04"}`
                      : "1px solid rgba(var(--border-rgb),0.18)",
                    background: isActive ? `${ex.color || "#e85d04"}12` : "var(--input-bg)",
                    opacity: past ? 0.65 : 1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: 8, background: ex.color || "#e85d04",
                      color: "#fff", fontSize: 12, fontWeight: 800, display: "inline-flex",
                      alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: INK }}>
                      {isAr
                        ? (ex.labelAr || ex.labelEn || `امتحان ${idx + 1}`)
                        : (ex.labelEn || ex.labelAr || `Exam ${idx + 1}`)}
                      {isActive && (
                        <span style={{ marginInlineStart: 6, fontSize: 11, fontWeight: 700, color: ex.color || "#e85d04" }}>
                          {tr(isAr, "· active", "· الحالي")}
                        </span>
                      )}
                      {past && (
                        <span style={{ marginInlineStart: 6, fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>
                          {tr(isAr, "· passed", "· عدّى")}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeExam(ex.id)}
                      aria-label={tr(isAr, "Remove", "حذف")}
                      style={{
                        border: "none", background: "var(--danger-bg, rgba(239,68,68,0.12))",
                        color: "var(--danger, #b91c1c)", borderRadius: 8, width: 32, height: 32,
                        cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>

                  <label style={{ ...labelStyle, marginTop: 0 }}>{tr(isAr, "Date", "التاريخ")}</label>
                  <input
                    type="date"
                    value={ex.date || ""}
                    onChange={(e) => updateExam(ex.id, { date: e.target.value })}
                    style={inputStyle}
                  />

                  <label style={labelStyle}>{tr(isAr, "Time", "الوقت")}</label>
                  <input
                    type="time"
                    value={ex.time || "09:00"}
                    onChange={(e) => updateExam(ex.id, { time: e.target.value })}
                    style={inputStyle}
                  />

                  <label style={labelStyle}>{tr(isAr, "Color", "اللون")}</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, alignItems: "center" }}>
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => updateExam(ex.id, { color: c })}
                        aria-label={c}
                        style={{
                          width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer",
                          border: (ex.color || "#e85d04") === c ? "3px solid var(--ink)" : "2px solid transparent",
                        }}
                      />
                    ))}
                    <input
                      type="color"
                      value={ex.color || "#e85d04"}
                      onChange={(e) => updateExam(ex.id, { color: e.target.value })}
                      style={{ width: 34, height: 26, border: "none", background: "none", cursor: "pointer" }}
                    />
                  </div>

                  <label style={labelStyle}>{tr(isAr, "Label (English)", "العنوان (إنجليزي)")}</label>
                  <input
                    type="text"
                    value={ex.labelEn || ""}
                    onChange={(e) => updateExam(ex.id, { labelEn: e.target.value })}
                    placeholder={`Exam ${idx + 1}`}
                    style={inputStyle}
                  />

                  <label style={labelStyle}>{tr(isAr, "Label (Arabic)", "العنوان (عربي)")}</label>
                  <input
                    type="text"
                    value={ex.labelAr || ""}
                    onChange={(e) => updateExam(ex.id, { labelAr: e.target.value })}
                    placeholder={`امتحان ${idx + 1}`}
                    style={inputStyle}
                    dir="rtl"
                  />
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addExam}
            style={{
              marginTop: 12, width: "100%", padding: "11px 14px", borderRadius: 12,
              border: "1px dashed rgba(var(--border-rgb),0.35)", background: "transparent",
              color: INK, fontWeight: 700, fontSize: 14, cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <PlusIcon size={16} />
            {tr(isAr, "Add another exam", "إضافة امتحان آخر")}
          </button>

          {exams.length > 1 && (
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "10px 0 0", lineHeight: 1.45 }}>
              {tr(
                isAr,
                `Queue: ${exams.length} exams · ${preview.remaining} still upcoming. They run in date order.`,
                `الطابور: ${exams.length} امتحان · ${preview.remaining} لسه جايين. بيمشوا حسب التاريخ.`
              )}
            </p>
          )}

          {error && <div style={errorStyle}>{error}</div>}
          {okMsg && (
            <div style={{ marginTop: 12, padding: "8px 10px", borderRadius: 6, background: "var(--success-bg)", color: "var(--success)", fontSize: 13 }}>
              {okMsg}
            </div>
          )}

          <button type="button" onClick={save} disabled={busy} style={{ ...primaryBtnStyle, opacity: busy ? 0.6 : 1, marginTop: 14 }}>
            {busy ? tr(isAr, "Saving…", "جاري الحفظ…") : tr(isAr, "Save for everyone", "حفظ للجميع")}
          </button>

          {enabled && (
            <button
              type="button"
              onClick={turnOff}
              disabled={busy}
              style={{
                marginTop: 10, width: "100%", padding: "11px 14px", borderRadius: 12,
                border: "1px solid var(--danger-border)", background: "var(--danger-bg)",
                color: "var(--danger)", fontWeight: 700, fontSize: 14, cursor: "pointer",
              }}
            >
              {tr(isAr, "Turn off countdown", "إيقاف العدّاد")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
