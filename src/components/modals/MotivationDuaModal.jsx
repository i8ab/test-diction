import { useState, useEffect, useCallback } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD } from "../../lib/config/theme";
import { XIcon, QuranIcon, DuaIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { getRandomQuote, MOODS } from "../../lib/config/motivationalQuotes";
import { DUA_PHASES, getRandomDua } from "../../lib/config/studyDuas";

/** لون مميز لكل حالة */
const MOOD_COLORS = {
  happy:   { bg: "rgba(234, 179, 8, 0.16)",   fg: "#b45309", ring: "rgba(234, 179, 8, 0.45)" },
  sad:     { bg: "rgba(59, 130, 246, 0.14)",  fg: "#1d4ed8", ring: "rgba(59, 130, 246, 0.4)" },
  anxious: { bg: "rgba(168, 85, 247, 0.14)",  fg: "#7e22ce", ring: "rgba(168, 85, 247, 0.4)" },
  despair: { bg: "rgba(100, 116, 139, 0.18)", fg: "#334155", ring: "rgba(100, 116, 139, 0.45)" },
  tired:   { bg: "rgba(20, 184, 166, 0.14)",  fg: "#0f766e", ring: "rgba(20, 184, 166, 0.4)" },
  nofire:  { bg: "rgba(249, 115, 22, 0.14)",  fg: "#c2410c", ring: "rgba(249, 115, 22, 0.4)" },
  hope:    { bg: "rgba(34, 197, 94, 0.14)",   fg: "#15803d", ring: "rgba(34, 197, 94, 0.4)" },
  angry:   { bg: "rgba(239, 68, 68, 0.14)",   fg: "#b91c1c", ring: "rgba(239, 68, 68, 0.4)" },
  lonely:  { bg: "rgba(99, 102, 241, 0.14)",  fg: "#4338ca", ring: "rgba(99, 102, 241, 0.4)" },
  study:   { bg: "rgba(14, 165, 233, 0.14)",  fg: "#0369a1", ring: "rgba(14, 165, 233, 0.4)" },
};

const MOOD_EMOJI = {
  happy: "😊", sad: "😢", anxious: "😰", despair: "😔", tired: "😴",
  nofire: "😮‍💨", hope: "🌱", angry: "😠", lonely: "🤍", study: "📚",
};

const PHASE_EMOJI = { before: "🌅", during: "⏳", after: "✅" };

const PHASE_COLORS = {
  before: { bg: "rgba(14, 165, 233, 0.14)", fg: "#0369a1", ring: "rgba(14, 165, 233, 0.4)" },
  during: { bg: "rgba(168, 85, 247, 0.14)", fg: "#7e22ce", ring: "rgba(168, 85, 247, 0.4)" },
  after:  { bg: "rgba(34, 197, 94, 0.14)",  fg: "#15803d", ring: "rgba(34, 197, 94, 0.4)" },
};

/**
 * مودال موحّد: تحفيز (آية/حديث) + أدعية المذاكرة
 * قسمين داخل نفس النافذة — فتح أسرع وواجهة أوضح
 */
export default function MotivationDuaModal({ isAr, onClose, initialTab = "motivation" }) {
  const [tab, setTab] = useState(initialTab === "dua" ? "dua" : "motivation");

  // ── Motivation state ──
  const [mood, setMood] = useState(null);
  const [quote, setQuote] = useState(null);
  const [fadeQ, setFadeQ] = useState(true);

  // ── Dua state ──
  const [phase, setPhase] = useState(null);
  const [dua, setDua] = useState(null);
  const [fadeD, setFadeD] = useState(true);

  const loadQuote = useCallback((moodId, exclude = -1) => {
    setFadeQ(false);
    setTimeout(() => {
      setQuote(getRandomQuote(exclude, moodId));
      setFadeQ(true);
    }, 120);
  }, []);

  const loadDua = useCallback((phaseId, exclude = -1) => {
    setFadeD(false);
    setTimeout(() => {
      setDua(getRandomDua(phaseId, exclude));
      setFadeD(true);
    }, 120);
  }, []);

  const onPickMood = (moodId) => {
    setMood(moodId);
    loadQuote(moodId, -1);
  };

  const onPickPhase = (phaseId) => {
    setPhase(phaseId);
    loadDua(phaseId, -1);
  };

  const pickNewQuote = useCallback(() => {
    if (!mood) return;
    loadQuote(mood, quote?.index ?? -1);
  }, [mood, quote, loadQuote]);

  const pickNewDua = useCallback(() => {
    if (!phase) return;
    loadDua(phase, dua?.index ?? -1);
  }, [phase, dua, loadDua]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if ((e.key === " " || e.key === "Enter")) {
        if (tab === "motivation" && mood && quote) {
          e.preventDefault();
          pickNewQuote();
        } else if (tab === "dua" && phase && dua) {
          e.preventDefault();
          pickNewDua();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, tab, mood, quote, phase, dua, pickNewQuote, pickNewDua]);

  const colors = mood ? MOOD_COLORS[mood] || MOOD_COLORS.hope : null;
  const phaseColors = phase ? PHASE_COLORS[phase] || PHASE_COLORS.before : null;
  const isQuran = quote?.type === "quran";
  const typeLabel = isQuran ? tr(isAr, "Quran", "قرآن") : tr(isAr, "Hadith", "حديث");
  const moodMeta = MOODS.find((m) => m.id === mood);
  const phaseMeta = DUA_PHASES.find((p) => p.id === phase);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr(isAr, "Motivation & Du'as", "تحفيز ودعاء")}
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
          padding: "18px 18px 16px",
          border: "1px solid rgba(var(--border-rgb),0.14)",
          boxShadow: "0 24px 56px -16px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
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
            {tr(isAr, "Motivation & Du'as", "تحفيز ودعاء")}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{
              background: "var(--input-bg)",
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

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: 4,
            borderRadius: 12,
            background: "var(--input-bg)",
            direction: isAr ? "rtl" : "ltr",
          }}
        >
          <button
            type="button"
            onClick={() => setTab("motivation")}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 8px",
              borderRadius: 10,
              border: "none",
              background: tab === "motivation" ? "var(--card)" : "transparent",
              color: tab === "motivation" ? "#b45309" : "var(--muted-strong)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: tab === "motivation" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <QuranIcon size={16} />
            {tr(isAr, "Motivation", "تحفيز")}
          </button>
          <button
            type="button"
            onClick={() => setTab("dua")}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 8px",
              borderRadius: 10,
              border: "none",
              background: tab === "dua" ? "var(--card)" : "transparent",
              color: tab === "dua" ? "#7e22ce" : "var(--muted-strong)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: tab === "dua" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <DuaIcon size={16} />
            {tr(isAr, "Study Du'as", "أدعية")}
          </button>
        </div>

        {/* ══════ MOTIVATION TAB ══════ */}
        {tab === "motivation" && (
          <>
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
                    <span aria-hidden style={{ marginInlineEnd: 4 }}>{MOOD_EMOJI[m.id] || ""}</span>
                    {isAr ? m.ar : m.en}
                  </button>
                );
              })}
            </div>

            {mood && quote && (
              <div
                style={{
                  borderRadius: 16,
                  padding: "18px 16px",
                  background: colors
                    ? `linear-gradient(145deg, ${colors.bg}, rgba(var(--border-rgb),0.06))`
                    : "linear-gradient(145deg, rgba(var(--accent-1-rgb, 176, 141, 87), 0.12), rgba(var(--border-rgb),0.06))",
                  border: colors ? `1px solid ${colors.ring}` : "1px solid rgba(var(--border-rgb),0.12)",
                  minHeight: 150,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 12,
                  opacity: fadeQ ? 1 : 0,
                  transition: "opacity 0.18s ease",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", direction: isAr ? "rtl" : "ltr" }}>
                  {moodMeta && (
                    <span style={{ padding: "2px 10px", borderRadius: 999, background: colors?.bg, color: colors?.fg, fontWeight: 800, fontSize: 11 }}>
                      {isAr ? moodMeta.ar : moodMeta.en}
                    </span>
                  )}
                  <span
                    style={{
                      padding: "2px 10px",
                      borderRadius: 999,
                      background: isQuran ? "rgba(34, 197, 94, 0.16)" : "rgba(14, 165, 233, 0.16)",
                      color: isQuran ? "#15803d" : "#0369a1",
                      fontWeight: 800,
                      fontSize: 11,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {typeLabel}
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
                  {quote.ar}
                </div>

                {quote.ref && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: colors?.fg || "var(--accent-1)", textAlign: "center", direction: "rtl" }}>
                    {isQuran ? `سورة ${quote.ref}` : quote.ref}
                  </div>
                )}

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
                    <div style={{ fontSize: 11, fontWeight: 800, color: colors?.fg || "var(--accent-1)", marginBottom: 6, textAlign: "right", direction: "rtl" }}>
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
                {tr(isAr, "Pick how you feel to get a fitting verse or hadith.", "اختار إحساسك عشان توصلك آية أو حديث يناسبك.")}
              </div>
            )}
          </>
        )}

        {/* ══════ DUA TAB ══════ */}
        {tab === "dua" && (
          <>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                direction: isAr ? "rtl" : "ltr",
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
                    <span aria-hidden style={{ marginInlineEnd: 4 }}>{PHASE_EMOJI[p.id] || ""}</span>
                    {isAr ? p.ar : p.en}
                  </button>
                );
              })}
            </div>

            {phase && dua && (
              <div
                style={{
                  borderRadius: 16,
                  padding: "18px 16px",
                  background: phaseColors
                    ? `linear-gradient(145deg, ${phaseColors.bg}, rgba(var(--border-rgb),0.06))`
                    : "linear-gradient(145deg, rgba(168, 85, 247, 0.12), rgba(var(--border-rgb),0.06))",
                  border: phaseColors ? `1px solid ${phaseColors.ring}` : "1px solid rgba(var(--border-rgb),0.12)",
                  minHeight: 150,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 12,
                  opacity: fadeD ? 1 : 0,
                  transition: "opacity 0.18s ease",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", direction: "rtl" }}>
                  {phaseMeta && (
                    <span style={{ padding: "2px 10px", borderRadius: 999, background: phaseColors?.bg, color: phaseColors?.fg, fontWeight: 800, fontSize: 11 }}>
                      {isAr ? phaseMeta.ar : phaseMeta.en}
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
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: phaseColors?.fg || "var(--accent-1)", textAlign: "center", direction: "rtl" }}>
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
                    <div style={{ fontSize: 11, fontWeight: 800, color: phaseColors?.fg || "var(--accent-1)", marginBottom: 4, direction: "rtl", textAlign: "right" }}>
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
                  direction: isAr ? "rtl" : "ltr",
                }}
              >
                {tr(
                  isAr,
                  "Choose when: before study, during, or after you finish.",
                  "اختار وقت الدعاء: قبل المذاكرة، أثناءها، أو بعد ما تخلّص."
                )}
              </div>
            )}
          </>
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
          {((tab === "motivation" && mood) || (tab === "dua" && phase)) && (
            <button
              type="button"
              onClick={tab === "motivation" ? pickNewQuote : pickNewDua}
              style={{
                flex: 2,
                padding: "12px 10px",
                borderRadius: 12,
                border: "none",
                background:
                  tab === "motivation"
                    ? colors
                      ? `linear-gradient(135deg, ${colors.fg}, ${colors.fg})`
                      : "linear-gradient(135deg, var(--accent-1), var(--accent-2))"
                    : phaseColors
                      ? `linear-gradient(135deg, ${phaseColors.fg}, ${phaseColors.fg})`
                      : "linear-gradient(135deg, #7e22ce, #7e22ce)",
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
