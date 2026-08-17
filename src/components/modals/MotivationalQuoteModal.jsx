import { useState, useEffect, useCallback } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD } from "../../lib/config/theme";
import { XIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { getRandomQuote, MOODS } from "../../lib/config/motivationalQuotes";

const MOOD_LABEL = Object.fromEntries(MOODS.map((m) => [m.id, m]));

/**
 * بطاقة آية / حديث حسب الحالة النفسية
 * العربية مُشكَّلة أولًا، مع المصدر والمزاج
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

  const moodMeta = quote?.mood ? MOOD_LABEL[quote.mood] : null;
  const isQuran = quote?.type === "quran";
  const typeLabel = isQuran
    ? tr(isAr, "Quran", "قرآن")
    : tr(isAr, "Hadith", "حديث");
  const moodLabel = moodMeta
    ? tr(isAr, moodMeta.en, moodMeta.ar)
    : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr(isAr, "A verse for your heart", "آية لقلبك")}
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
                fontFamily: "var(--font-latin), 'Source Sans 3', sans-serif",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--muted-strong)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {tr(isAr, "A word for your heart", "كلمة لقلبك")}
            </div>
            {(moodLabel || quote?.ref) && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--muted)",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                {moodLabel && (
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "color-mix(in srgb, var(--accent-1) 14%, transparent)",
                      color: "var(--accent-1)",
                      fontWeight: 700,
                      fontSize: 11,
                    }}
                  >
                    {moodLabel}
                  </span>
                )}
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: isQuran
                      ? "color-mix(in srgb, var(--success, #2ecc71) 16%, transparent)"
                      : "color-mix(in srgb, var(--accent-2, #19A7CE) 16%, transparent)",
                    color: isQuran ? "var(--success, #1a9b5c)" : "var(--accent-2, #19A7CE)",
                    fontWeight: 700,
                    fontSize: 11,
                  }}
                >
                  {typeLabel}
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{
              border: "none",
              background: "var(--input-bg)",
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

        {/* Card body — Arabic primary with tashkeel-friendly font */}
        <div
          style={{
            borderRadius: 16,
            padding: "18px 16px",
            background:
              "linear-gradient(145deg, rgba(var(--accent-1-rgb, 176, 141, 87), 0.12), rgba(var(--border-rgb),0.06))",
            border: "1px solid rgba(var(--border-rgb),0.12)",
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
              fontSize: 20,
              fontWeight: 600,
              lineHeight: 1.9,
              color: INK,
              direction: "rtl",
              textAlign: "center",
              fontFamily: "var(--font-arabic), 'Amiri', 'Noto Naskh Arabic', serif",
            }}
          >
            {quote.ar}
          </div>

          {quote.ref && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--accent-1)",
                textAlign: "center",
                direction: isAr ? "rtl" : "ltr",
              }}
            >
              {isQuran ? (isAr ? `سورة ${quote.ref}` : `Qur'an — ${quote.ref}`) : (isAr ? quote.ref : quote.ref)}
            </div>
          )}

          <div
            style={{
              height: 1,
              background: "rgba(var(--border-rgb),0.18)",
              margin: "2px 0",
            }}
          />

          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              lineHeight: 1.55,
              color: "var(--muted-strong)",
              direction: "ltr",
              textAlign: "center",
              fontFamily: "var(--font-latin), 'Source Sans 3', sans-serif",
            }}
          >
            {quote.en}
          </div>

          {(quote.explainAr || quote.explainEn) && (
            <div
              style={{
                marginTop: 4,
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(var(--border-rgb),0.08)",
                border: "1px solid rgba(var(--border-rgb),0.12)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "var(--accent-1)",
                  marginBottom: 6,
                  textAlign: isAr ? "right" : "left",
                }}
              >
                {tr(isAr, "Reflection", "العظة")}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: 1.7,
                  color: INK,
                  direction: isAr ? "rtl" : "ltr",
                  textAlign: isAr ? "right" : "left",
                  fontFamily: isAr
                    ? "var(--font-arabic), 'Amiri', serif"
                    : "var(--font-latin), 'Source Sans 3', sans-serif",
                }}
              >
                {isAr ? (quote.explainAr || quote.explainEn) : (quote.explainEn || quote.explainAr)}
              </div>
            </div>
          )}
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
            {tr(isAr, "Another", "أخرى")}
          </button>
        </div>
      </div>
    </div>
  );
}
