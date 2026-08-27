import { useState, useEffect, useCallback } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD } from "../../lib/config/theme";
import { XIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { getRandomQuote, MOODS } from "../../lib/config/motivationalQuotes";

/** لون مميز لكل حالة */
const MOOD_COLORS = {
  happy:   { bg: "rgba(234, 179, 8, 0.16)",   fg: "#b45309", ring: "rgba(234, 179, 8, 0.45)" },   // فرحان — ذهبي
  sad:     { bg: "rgba(59, 130, 246, 0.14)",  fg: "#1d4ed8", ring: "rgba(59, 130, 246, 0.4)" },  // زعلان — أزرق
  anxious: { bg: "rgba(168, 85, 247, 0.14)",  fg: "#7e22ce", ring: "rgba(168, 85, 247, 0.4)" },  // قلق — بنفسجي
  despair: { bg: "rgba(100, 116, 139, 0.18)", fg: "#334155", ring: "rgba(100, 116, 139, 0.45)" },// يائس — رمادي
  tired:   { bg: "rgba(20, 184, 166, 0.14)",  fg: "#0f766e", ring: "rgba(20, 184, 166, 0.4)" },  // تعبان — تركواز
  nofire:  { bg: "rgba(249, 115, 22, 0.14)",  fg: "#c2410c", ring: "rgba(249, 115, 22, 0.4)" },  // فاقد الشغف — برتقالي
  hope:    { bg: "rgba(34, 197, 94, 0.14)",   fg: "#15803d", ring: "rgba(34, 197, 94, 0.4)" },   // أمل — أخضر
  angry:   { bg: "rgba(239, 68, 68, 0.14)",   fg: "#b91c1c", ring: "rgba(239, 68, 68, 0.4)" },   // غضب — أحمر
  lonely:  { bg: "rgba(99, 102, 241, 0.14)",  fg: "#4338ca", ring: "rgba(99, 102, 241, 0.4)" },  // وحيد — نيلي
  study:   { bg: "rgba(14, 165, 233, 0.14)",  fg: "#0369a1", ring: "rgba(14, 165, 233, 0.4)" },  // مذاكرة — سماوي
};

/**
 * بطاقة آية / حديث — المستخدم يختار حالته
 * في الوضع العربي: نص عربي + عظة عربية فقط (من غير ترجمة إنجليزي)
 */
export default function MotivationalQuoteModal({ isAr, onClose }) {
  const [mood, setMood] = useState(null); // null = لسه مختارش
  const [quote, setQuote] = useState(null);
  const [fade, setFade] = useState(true);

  const loadQuote = useCallback((moodId, exclude = -1) => {
    setFade(false);
    setTimeout(() => {
      setQuote(getRandomQuote(exclude, moodId));
      setFade(true);
    }, 160);
  }, []);

  const onPickMood = (moodId) => {
    setMood(moodId);
    loadQuote(moodId, -1);
  };

  const pickNew = useCallback(() => {
    if (!mood) return;
    loadQuote(mood, quote?.index ?? -1);
  }, [mood, quote, loadQuote]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if ((e.key === " " || e.key === "Enter") && mood && quote) {
        e.preventDefault();
        pickNew();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, pickNew, mood, quote]);

  const colors = mood ? MOOD_COLORS[mood] || MOOD_COLORS.hope : null;
  const isQuran = quote?.type === "quran";
  const typeLabel = isQuran
    ? tr(isAr, "Quran", "قرآن")
    : tr(isAr, "Hadith", "حديث");
  const moodMeta = MOODS.find((m) => m.id === mood);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr(isAr, "A word for your heart", "كلمة لقلبك")}
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
            {tr(isAr, "How are you feeling?", "حاسس بإيه دلوقتي؟")}
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

        {/* Mood picker */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            direction: isAr ? "rtl" : "ltr",
          }}
        >
          {MOODS.map((m) => {
            const c = MOOD_COLORS[m.id] || MOOD_COLORS.hope;
            const active = mood === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onPickMood(m.id)}
                style={{
                  padding: "8px 12px",
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
                {isAr ? m.ar : m.en}
              </button>
            );
          })}
        </div>

        {/* Quote card — only after mood chosen */}
        {mood && quote && (
          <div
            style={{
              borderRadius: 16,
              padding: "18px 16px",
              background: colors
                ? `linear-gradient(145deg, ${colors.bg}, rgba(var(--border-rgb),0.06))`
                : "linear-gradient(145deg, rgba(var(--accent-1-rgb, 176, 141, 87), 0.12), rgba(var(--border-rgb),0.06))",
              border: colors
                ? `1px solid ${colors.ring}`
                : "1px solid rgba(var(--border-rgb),0.12)",
              minHeight: 160,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 12,
              opacity: fade ? 1 : 0,
              transition: "opacity 0.2s ease",
            }}
          >
            {/* badges */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                justifyContent: "center",
                direction: isAr ? "rtl" : "ltr",
              }}
            >
              {moodMeta && (
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
                  {isAr ? moodMeta.ar : moodMeta.en}
                </span>
              )}
              <span
                style={{
                  padding: "2px 10px",
                  borderRadius: 999,
                  background: isQuran
                    ? "rgba(34, 197, 94, 0.16)"
                    : "rgba(14, 165, 233, 0.16)",
                  color: isQuran ? "#15803d" : "#0369a1",
                  fontWeight: 800,
                  fontSize: 11,
                }}
              >
                {typeLabel}
              </span>
            </div>

            {/* Arabic text — always primary */}
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
                  color: colors?.fg || "var(--accent-1)",
                  textAlign: "center",
                  direction: "rtl",
                }}
              >
                {isQuran ? `سورة ${quote.ref}` : quote.ref}
              </div>
            )}
{/* العظة — عربي دائمًا */}
            {quote.explainAr && (
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
                    marginBottom: 6,
                    textAlign: "right",
                    direction: "rtl",
                  }}
                >
                  العظة
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
                  {quote.explainAr}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Placeholder before mood */}
        {!mood && (
          <div
            style={{
              borderRadius: 16,
              padding: "28px 16px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 14,
              fontWeight: 600,
              border: "1px dashed rgba(var(--border-rgb),0.25)",
              direction: isAr ? "rtl" : "ltr",
            }}
          >
            {tr(
              isAr,
              "Pick how you feel to get a fitting verse or hadith.",
              "اختار إحساسك عشان توصلك آية أو حديث يناسبك."
            )}
          </div>
        )}

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
          {mood && (
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
                color: "var(--on-accent, #fff)",
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
