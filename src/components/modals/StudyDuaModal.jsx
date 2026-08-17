import { useState, useEffect, useCallback } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD } from "../../lib/config/theme";
import { XIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { DUA_PHASES, getRandomDua } from "../../lib/config/studyDuas";

const PHASE_COLORS = {
  before: { bg: "rgba(14, 165, 233, 0.14)", fg: "#0369a1", ring: "rgba(14, 165, 233, 0.4)" },
  during: { bg: "rgba(168, 85, 247, 0.14)", fg: "#7e22ce", ring: "rgba(168, 85, 247, 0.4)" },
  after:  { bg: "rgba(34, 197, 94, 0.14)",  fg: "#15803d", ring: "rgba(34, 197, 94, 0.4)" },
};

/**
 * قسم أدعية المذاكرة — منفصل عن آيات القرآن والأحاديث
 * المستخدم يختار: قبل / أثناء / بعد الجلسة
 */
export default function StudyDuaModal({ isAr, onClose }) {
  const [phase, setPhase] = useState(null);
  const [dua, setDua] = useState(null);
  const [fade, setFade] = useState(true);

  const loadDua = useCallback((phaseId, exclude = -1) => {
    setFade(false);
    setTimeout(() => {
      setDua(getRandomDua(phaseId, exclude));
      setFade(true);
    }, 100);
  }, []);

  const onPickPhase = (phaseId) => {
    setPhase(phaseId);
    loadDua(phaseId, -1);
  };

  const pickNew = useCallback(() => {
    if (!phase) return;
    loadDua(phase, dua?.index ?? -1);
  }, [phase, dua, loadDua]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if ((e.key === " " || e.key === "Enter") && phase && dua) {
        e.preventDefault();
        pickNew();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, pickNew, phase, dua]);

  const colors = phase ? PHASE_COLORS[phase] || PHASE_COLORS.before : null;
  const phaseMeta = DUA_PHASES.find((p) => p.id === phase);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr(isAr, "Study Du'as", "أدعية المذاكرة")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 6000,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <BodyScrollLock />
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: CARD,
          borderRadius: 20,
          padding: "22px 20px 18px",
          border: "1px solid rgba(var(--border-rgb),0.14)",
          boxShadow: "0 24px 56px -16px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxHeight: "92vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              fontFamily: "var(--font-latin), 'Source Sans 3', sans-serif",
              fontSize: 14,
              fontWeight: 800,
              color: "var(--muted-strong)",
            }}
          >
            {tr(isAr, "Study Du'as", "أدعية المذاكرة")}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{
              background: "transparent",
              border: "none",
              borderRadius: 10,
              width: 36,
              height: 36,
              cursor: "pointer",
              color: "var(--icon-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Phase picker — labels always Arabic as requested for mood-like choices */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            direction: "rtl",
          }}
        >
          {DUA_PHASES.map((p) => {
            const c = PHASE_COLORS[p.id] || PHASE_COLORS.before;
            const active = phase === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPickPhase(p.id)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: active ? `2px solid ${c.fg}` : "1px solid rgba(var(--border-rgb),0.2)",
                  background: active ? c.bg : "var(--input-bg)",
                  color: active ? c.fg : "var(--muted-strong)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  boxShadow: active ? `0 0 0 3px ${c.ring}` : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {p.ar}
              </button>
            );
          })}
        </div>

        {/* Dua card */}
        {phase && dua && (
          <div
            style={{
              borderRadius: 16,
              padding: "18px 16px",
              background: colors
                ? `linear-gradient(145deg, ${colors.bg}, rgba(var(--border-rgb),0.06))`
                : "linear-gradient(145deg, rgba(168, 85, 247, 0.12), rgba(var(--border-rgb),0.06))",
              border: colors
                ? `1px solid ${colors.ring}`
                : "1px solid rgba(var(--border-rgb),0.12)",
              minHeight: 160,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 12,
              opacity: fade ? 1 : 0,
              transition: "opacity 0.12s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                justifyContent: "center",
                direction: "rtl",
              }}
            >
              {phaseMeta && (
                <span
                  style={{
                    padding: "2px 10px",
                    borderRadius: 999,
                    background: colors?.bg,
                    color: colors?.fg,
                    fontWeight: 800,
                    fontSize: 11,
                  }}
                >
                  {phaseMeta.ar}
                </span>
              )}
              <span
                style={{
                  padding: "2px 10px",
                  borderRadius: 999,
                  background: "rgba(168, 85, 247, 0.16)",
                  color: "#7e22ce",
                  fontWeight: 800,
                  fontSize: 11,
                }}
              >
                {tr(isAr, "Du'a", "دعاء")}
              </span>
            </div>

            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                lineHeight: 1.9,
                color: INK,
                direction: "rtl",
                textAlign: "center",
                fontFamily: "var(--font-arabic), 'Amiri', 'Noto Naskh Arabic', serif",
              }}
            >
              {dua.ar}
            </div>

            {dua.ref && (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors?.fg || "var(--accent-1)",
                  textAlign: "center",
                  direction: "rtl",
                }}
              >
                {dua.ref}
              </div>
            )}

            {dua.explainAr && (
              <div
                style={{
                  marginTop: 2,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(var(--border-rgb),0.1)",
                  border: "1px solid rgba(var(--border-rgb),0.12)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: colors?.fg || "var(--accent-1)",
                    marginBottom: 4,
                    direction: "rtl",
                    textAlign: "right",
                  }}
                >
                  عظة
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    lineHeight: 1.75,
                    color: INK,
                    direction: "rtl",
                    textAlign: "right",
                    fontFamily: "var(--font-arabic), 'Amiri', serif",
                  }}
                >
                  {dua.explainAr}
                </div>
              </div>
            )}
          </div>
        )}

        {!phase && (
          <div
            style={{
              borderRadius: 16,
              padding: "28px 16px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 14,
              fontWeight: 600,
              border: "1px dashed rgba(var(--border-rgb),0.25)",
              direction: "rtl",
            }}
          >
            اختار وقت الدعاء: قبل المذاكرة، أثناءها، أو بعد ما تخلّص الجلسة.
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px 10px",
              borderRadius: 12,
              border: "1px solid rgba(var(--border-rgb),0.25)",
              background: "transparent",
              color: INK,
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {tr(isAr, "Close", "إغلاق")}
          </button>
          {phase && (
            <button
              type="button"
              onClick={pickNew}
              style={{
                flex: 2,
                padding: "12px 10px",
                borderRadius: 12,
                border: "none",
                background: colors
                  ? `linear-gradient(135deg, ${colors.fg}, ${colors.fg})`
                  : "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                opacity: 0.95,
              }}
            >
              {tr(isAr, "Another", "أخرى")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
