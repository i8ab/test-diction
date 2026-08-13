import { useEffect, useState } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD } from "../../lib/config/theme";
import { XIcon, CheckIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

const STEPS = [
  {
    id: "welcome",
    icon: "👋",
    enTitle: "Welcome to Bacaloria",
    arTitle: "أهلاً بك في Bacaloria",
    enBody:
      "Your bilingual study space for vocabulary, spaced repetition, quizzes, and daily practice — built for real learners.",
    arBody:
      "مساحتك للدراسة ثنائية اللغة: مفردات، تكرار متباعد، اختبارات، وممارسة يومية — مصممة للطلاب الجادين.",
  },
  {
    id: "what",
    icon: "📚",
    enTitle: "What you can do",
    arTitle: "إيه اللي تقدر تعمله",
    enBody:
      "Save words, review with SRS, run quizzes & dictation, track XP, set goals, and study offline as a PWA.",
    arBody:
      "احفظ كلماتك، راجع بنظام SRS، اختبر نفسك وإملاء، تابع الـ XP، حط أهداف، وادرس أوفلاين كتطبيق PWA.",
  },
  {
    id: "who",
    icon: "✨",
    enTitle: "Who we are",
    arTitle: "مين إحنا",
    enBody:
      "Bacaloria Community is an independent learning project focused on Arabic ⇄ English study tools that feel fast, clear, and mobile-first.",
    arBody:
      "Bacaloria Community مشروع تعليمي مستقل بيركّز على أدوات دراسة عربي ⇄ إنجليزي — سريعة، واضحة، ومناسبة للموبايل.",
  },
  {
    id: "dev",
    icon: "🛠️",
    enTitle: "Built by",
    arTitle: "تطوير",
    enBody: "Developed by mickoly-aboawad",
    arBody: "تم التطوير بواسطة ميكول-ابوعوض",
    enSub: "mickoly-aboawad",
    arSub: "ميكول-ابوعوض",
  },
];

/**
 * First-login onboarding — modern stepped intro.
 * Shown once per account (localStorage flag).
 */
export default function WelcomeOnboardingModal({ isAr, userName = "", onClose }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const s = STEPS[step];
  const isLast = step >= STEPS.length - 1;

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") finish();
      if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        if (isLast) finish();
        else setStep((x) => x + 1);
      }
      if (e.key === "ArrowLeft" && step > 0) setStep((x) => x - 1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  function finish() {
    setVisible(false);
    setTimeout(() => onClose && onClose(), 220);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr(isAr, "Welcome", "مرحباً")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 8000,
        background: visible ? "rgba(0,0,0,0.58)" : "rgba(0,0,0,0)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        transition: "background 0.28s ease",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) finish();
      }}
    >
      <BodyScrollLock />
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: CARD,
          borderRadius: 22,
          border: "1px solid rgba(var(--border-rgb),0.14)",
          boxShadow: "0 28px 64px -18px rgba(0,0,0,0.5)",
          overflow: "hidden",
          transform: visible ? "translateY(0) scale(1)" : "translateY(18px) scale(0.96)",
          opacity: visible ? 1 : 0,
          transition: "transform 0.32s cubic-bezier(.22,1,.36,1), opacity 0.28s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* gradient header */}
        <div
          style={{
            padding: "22px 20px 18px",
            background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
            color: "#fff",
            position: "relative",
          }}
        >
          <button
            type="button"
            onClick={finish}
            aria-label={tr(isAr, "Skip", "تخطي")}
            style={{
              position: "absolute",
              top: 12,
              insetInlineEnd: 12,
              width: 36,
              height: 36,
              borderRadius: 12,
              border: "none",
              background: "rgba(255,255,255,0.18)",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <XIcon size={16} />
          </button>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{s.icon}</div>
          <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.9, marginBottom: 4 }}>
            {userName
              ? tr(isAr, `Hi, ${userName}`, `مرحباً، ${userName}`)
              : tr(isAr, "Bacaloria Community", "Bacaloria Community")}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.25 }}>
            {tr(isAr, s.enTitle, s.arTitle)}
          </div>
        </div>

        <div style={{ padding: "20px 20px 8px" }}>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.65,
              color: "var(--muted-strong)",
              minHeight: 72,
            }}
          >
            {tr(isAr, s.enBody, s.arBody)}
          </p>
          {(s.enSub || s.arSub) && (
            <div
              style={{
                marginTop: 14,
                padding: "12px 14px",
                borderRadius: 14,
                background: "rgba(var(--border-rgb),0.06)",
                border: "1px solid rgba(var(--border-rgb),0.12)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                {tr(isAr, "Developer", "المطوّر")}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: INK, letterSpacing: "0.02em" }}>
                {tr(isAr, s.enSub, s.arSub)}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                mickoly-aboawad · ميكول-ابوعوض
              </div>
            </div>
          )}

          {/* dots */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              marginTop: 20,
              marginBottom: 8,
            }}
          >
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                aria-label={`Step ${i + 1}`}
                style={{
                  width: i === step ? 22 : 8,
                  height: 8,
                  borderRadius: 999,
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  background:
                    i === step
                      ? "linear-gradient(135deg, var(--accent-1), var(--accent-2))"
                      : "rgba(var(--border-rgb),0.35)",
                  transition: "width 0.2s ease, background 0.2s ease",
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ padding: "8px 20px 20px", display: "flex", gap: 10 }}>
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((x) => x - 1)}
              style={{
                flex: 1,
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(var(--border-rgb),0.22)",
                background: "transparent",
                color: INK,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {tr(isAr, "Back", "رجوع")}
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              style={{
                flex: 1,
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(var(--border-rgb),0.22)",
                background: "transparent",
                color: "var(--muted-strong)",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {tr(isAr, "Skip", "تخطي")}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (isLast) finish();
              else setStep((x) => x + 1);
            }}
            style={{
              flex: 1.4,
              padding: "12px 14px",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              boxShadow: "0 10px 24px -12px rgba(var(--focus-rgb),0.55)",
            }}
          >
            {isLast ? (
              <>
                <CheckIcon size={16} />
                {tr(isAr, "Let's go", "يلا نبدأ")}
              </>
            ) : (
              tr(isAr, "Next", "التالي")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function hasSeenWelcome(accountCode) {
  if (!accountCode || accountCode === "guest") return true;
  try {
    return localStorage.getItem("twoTongues.welcomeSeen." + accountCode) === "1";
  } catch (_) {
    return true;
  }
}

export function markWelcomeSeen(accountCode) {
  if (!accountCode || accountCode === "guest") return;
  try {
    localStorage.setItem("twoTongues.welcomeSeen." + accountCode, "1");
  } catch (_) {}
}
