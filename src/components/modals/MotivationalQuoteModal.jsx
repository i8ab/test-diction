import { useState, useEffect, useCallback } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD } from "../../lib/config/theme";
import { XIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { getRandomQuote, getQuoteCount } from "../../lib/config/motivationalQuotes";

/**
 * Motivational quote box — bilingual EN + AR.
 * Opens with a random study motivation; "Another" picks a new one.
 */
export default function MotivationalQuoteModal({ isAr, onClose }) {
  const [quote, setQuote] = useState(() => getRandomQuote());
  const [fade, setFade] = useState(true);

  const pickNew = useCallback(() => {
    setFade(false);
    setTimeout(() => {
      setQuote((prev) => getRandomQuote(prev?.index ?? -1));
      setFade(true);
    }, 120);
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        pickNew();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, pickNew]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr(isAr, "Motivation", "تحفيز")}
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
          maxWidth: 420,
          background: CARD,
          borderRadius: 20,
          padding: "22px 20px 18px",
          border: "1px solid rgba(var(--border-rgb),0.14)",
          boxShadow: "0 24px 56px -16px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div
              style={{
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--muted-strong)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {tr(isAr, "Motivation", "تحفيز")}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              {tr(isAr, `${getQuoteCount()} study messages`, `${getQuoteCount()} رسالة دراسية`)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "none",
              background: "rgba(var(--border-rgb),0.1)",
              color: INK,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Quote card */}
        <div
          style={{
            padding: "20px 16px",
            borderRadius: 16,
            background: "linear-gradient(145deg, rgba(var(--accent-1-rgb, 176, 141, 87), 0.12), rgba(var(--border-rgb),0.06))",
            border: "1px solid rgba(var(--border-rgb),0.12)",
            minHeight: 140,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 14,
            opacity: fade ? 1 : 0,
            transition: "opacity 0.12s ease",
          }}
        >
          <div
            style={{
              fontSize: 17,
              fontWeight: 600,
              lineHeight: 1.55,
              color: INK,
              direction: "ltr",
              textAlign: "left",
              fontFamily: "'Source Sans 3', 'Inter', sans-serif",
            }}
          >
            {quote.en}
          </div>
          <div
            style={{
              height: 1,
              background: "rgba(var(--border-rgb),0.18)",
              margin: "2px 0",
            }}
          />
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1.7,
              color: "var(--muted-strong)",
              direction: "rtl",
              textAlign: "right",
              fontFamily: "'Cairo', 'Tajawal', 'Almarai', sans-serif",
            }}
          >
            {quote.ar}
          </div>
        </div>

        {/* Actions */}
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
          <button
            type="button"
            onClick={pickNew}
            style={{
              flex: 2,
              padding: "12px 10px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {tr(isAr, "Another message", "رسالة أخرى")}
          </button>
        </div>
      </div>
    </div>
  );
}
