import { useMemo, useState, useEffect } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS } from "../../lib/config/theme";
import { isSrsDue } from "../../lib/utils/quizHelpers";
import { XIcon, CheckIcon, SpeakButton } from "../common/Icons";
import { SECTIONS } from "../../lib/config/sections";

/**
 * Quick review of a few due words — opened from reminder banner or shortcut "r".
 */
export default function QuickReviewModal({
  entries, studiedIds, srsDueAt, isAr, onClose, onToggleStudied, limit = 5,
}) {
  const due = useMemo(() => {
    const list = (entries || []).filter(
      (e) => studiedIds.has(e.id) && isSrsDue(e.id, srsDueAt)
    );
    // Prefer older due first if we had due timestamps; otherwise studied order
    return list.slice(0, limit);
  }, [entries, studiedIds, srsDueAt, limit]);

  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!revealed) setRevealed(true);
        else if (idx < due.length - 1) {
          setIdx((i) => i + 1);
          setRevealed(false);
        } else onClose();
      }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        setIdx((i) => Math.max(0, Math.min(due.length - 1, i + (e.key === "ArrowRight" ? 1 : -1))));
        setRevealed(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, revealed, idx, due.length]);

  const entry = due[idx];
  const cfg = entry ? SECTIONS[entry.section] || SECTIONS["en-ar"] : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 80,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%", maxWidth: 420, background: CARD,
          borderRadius: 16, padding: "20px 18px",
          border: "1px solid rgba(var(--border-rgb),0.14)",
          boxShadow: "0 20px 50px -16px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: INK }}>
            {tr(isAr, "Quick review", "مراجعة سريعة")}
            {due.length > 0 && (
              <span style={{ fontWeight: 500, color: "var(--muted)", marginInlineStart: 8, fontSize: 13 }}>
                {idx + 1}/{due.length}
              </span>
            )}
          </h2>
          <button type="button" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", padding: 4 }}>
            <XIcon size={18} />
          </button>
        </div>

        {due.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, textAlign: "center", padding: "24px 8px" }}>
            {tr(isAr, "Nothing due right now — nice work!", "مفيش كلمات مستحقة دلوقتي — تمام!")}
          </p>
        ) : (
          <>
            <div style={{ textAlign: "center", padding: "20px 8px" }}>
              <div dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 28, fontWeight: 700, color: INK }}>
                {entry.word}
              </div>
              <div style={{ marginTop: 8 }}>
                <SpeakButton text={entry.word} dir={cfg.wordDir} isAr={isAr} size={18} />
              </div>
              {revealed ? (
                <div dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: 18, color: "var(--meaning)", marginTop: 16 }}>
                  {entry.meaning}
                  {entry.definition ? (
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>{entry.definition}</div>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  style={{
                    marginTop: 20, padding: "10px 18px", borderRadius: 10, border: "none",
                    background: BRASS, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
                  }}
                >
                  {tr(isAr, "Reveal meaning", "إظهار المعنى")}
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {onToggleStudied && (
                <button
                  type="button"
                  onClick={() => onToggleStudied(entry.id)}
                  style={secondaryBtn}
                >
                  <CheckIcon size={14} /> {tr(isAr, "Studied", "اتعلمتها")}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (idx < due.length - 1) {
                    setIdx(idx + 1);
                    setRevealed(false);
                  } else onClose();
                }}
                style={{ ...secondaryBtn, flex: 1, justifyContent: "center", background: cfg.accent, color: "#fff", border: "none" }}
              >
                {idx < due.length - 1 ? tr(isAr, "Next", "التالي") : tr(isAr, "Done", "تم")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const secondaryBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(var(--border-rgb),0.2)",
  background: "var(--card)",
  color: INK,
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};
