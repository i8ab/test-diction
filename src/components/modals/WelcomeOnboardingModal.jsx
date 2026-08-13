import { useEffect, useState, useRef } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD } from "../../lib/config/theme";
import { XIcon, CheckIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

/**
 * Premium first-login onboarding — cinematic steps, rich copy, smooth motion.
 */

const STEPS = [
  {
    id: "welcome",
    icon: "✦",
    enTitle: "Welcome to Bacaloria",
    arTitle: "أهلاً بك في Bacaloria",
    enLead: "Your personal language lab",
    arLead: "مختبرك الشخصي للغة",
    enBody:
      "Bacaloria Community is a bilingual study app built for serious learners. Arabic ⇄ English vocabulary, smart review, and tools that stay with you — even offline.",
    arBody:
      "Bacaloria Community تطبيق دراسة ثنائي اللغة للطلاب الجادين. مفردات عربي ⇄ إنجليزي، مراجعة ذكية، وأدوات تفضل معاك — حتى بدون إنترنت.",
    bullets: [
      { en: "Dictionary with search, lists & notes", ar: "قاموس مع بحث وقوائم وملاحظات" },
      { en: "Works as a PWA on phone & desktop", ar: "يعمل كتطبيق PWA على الموبايل والكومبيوتر" },
      { en: "Cloud sync across your devices", ar: "مزامنة سحابية بين أجهزتك" },
    ],
  },
  {
    id: "study",
    icon: "◎",
    enTitle: "Study that sticks",
    arTitle: "مذاكرة تثبت",
    enLead: "Spaced repetition & practice modes",
    arLead: "تكرار متباعد وأوضاع تدريب",
    enBody:
      "Every word you mark as studied enters a smart schedule. Review due cards, crush weak ones, and practice the way your brain actually remembers.",
    arBody:
      "كل كلمة تعلّمها تدخل جدول ذكي. راجع المستحق، ركّز على الضعيف، واتدرّب بالطريقة اللي المخ بيتذكر بيها فعلاً.",
    bullets: [
      { en: "SRS boxes — from relearn to mastered", ar: "مستويات SRS — من إعادة التعلم للإتقان" },
      { en: "Quick review, weakness focus, smart cards", ar: "مراجعة سريعة، تركيز على الضعف، بطاقات ذكية" },
      { en: "Dictation, listening loop, sentence writing", ar: "إملاء، حلقة استماع، كتابة جمل" },
      { en: "Quiz & full exam mode with settings", ar: "اختبار ووضع امتحان كامل بالإعدادات" },
    ],
  },
  {
    id: "progress",
    icon: "◈",
    enTitle: "See your growth",
    arTitle: "شوف تقدّمك",
    enLead: "XP, goals, streaks & reports",
    arLead: "نقاط، أهداف، سلاسل وتقارير",
    enBody:
      "Stay motivated with levels, achievements, weekly challenges, a study calendar, and a weekly report you can export as image or PDF.",
    arBody:
      "حفّز نفسك بالمستويات والإنجازات وتحديات الأسبوع وتقويم الدراسة وتقرير أسبوعي تصدّره صورة أو PDF.",
    bullets: [
      { en: "Priority flags on important words", ar: "أولوية للكلمات المهمة" },
      { en: "Due badges — know what to review next", ar: "شارات الاستحقاق — اعرف تراجع إيه" },
      { en: "Timer, to-do, goals & leaderboard", ar: "مؤقت، مهام، أهداف وترتيب" },
      { en: "Morning & night review shortcuts", ar: "اختصارات مراجعة الصباح وقبل النوم" },
    ],
  },
  {
    id: "who",
    icon: "◇",
    enTitle: "Who we are",
    arTitle: "مين إحنا",
    enLead: "An independent learning community",
    arLead: "مجتمع تعلّم مستقل",
    enBody:
      "We design study tools that feel fast, clear, and mobile-first — no clutter, no noise. Just vocabulary, practice, and progress you can trust.",
    arBody:
      "بنصمّم أدوات دراسة سريعة وواضحة ومناسبة للموبايل — من غير زحمة ولا تشتيت. مفردات، تدريب، وتقدّم تعتمد عليه.",
    bullets: [
      { en: "Arabic ⇄ English at the core", ar: "عربي ⇄ إنجليزي في الصميم" },
      { en: "UI in Arabic, English & more", ar: "واجهة بالعربي والإنجليزي والمزيد" },
      { en: "Built for students preparing for real exams", ar: "مصمم لطلاب بيحضّروا لامتحانات حقيقية" },
    ],
  },
  {
    id: "dev",
    icon: "⬡",
    enTitle: "Crafted with care",
    arTitle: "صُنع بعناية",
    enLead: "Development",
    arLead: "التطوير",
    enBody:
      "Bacaloria is developed by mickoly-aboawad — focused on polish, performance, and a study experience you’ll actually enjoy opening every day.",
    arBody:
      "Bacaloria من تطوير ميكول-ابوعوض — مع اهتمام بالتفاصيل والأداء وتجربة دراسة نفسك تحب تفتحها كل يوم.",
    bullets: [
      { en: "Developer: mickoly-aboawad", ar: "المطوّر: ميكول-ابوعوض" },
      { en: "English name: mickoly-aboawad", ar: "بالإنجليزي: mickoly-aboawad" },
      { en: "Thank you for joining the community", ar: "شكراً لانضمامك للمجتمع" },
    ],
    isDev: true,
  },
];

export default function WelcomeOnboardingModal({ isAr, userName = "", onClose }) {
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState("enter");
  const [dir, setDir] = useState(1);
  const bodyRef = useRef(null);
  const s = STEPS[step];
  const isLast = step >= STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  useEffect(() => {
    const t = requestAnimationFrame(() => setPhase("idle"));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") finish();
      if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  function finish() {
    setPhase("exit");
    setTimeout(() => onClose && onClose(), 380);
  }

  function go(delta) {
    if (delta > 0 && isLast) {
      finish();
      return;
    }
    if (delta < 0 && step === 0) return;
    setDir(delta);
    setPhase("stepOut");
    setTimeout(() => {
      setStep((x) => x + delta);
      setPhase("stepIn");
      setTimeout(() => setPhase("idle"), 40);
      try {
        if (bodyRef.current) bodyRef.current.scrollTop = 0;
      } catch (_) {}
    }, 220);
  }

  const sheetVisible = phase !== "enter" && phase !== "exit";
  const contentAnim =
    phase === "stepOut"
      ? { opacity: 0, transform: `translateX(${dir > 0 ? -18 : 18}px)` }
      : phase === "stepIn" || phase === "idle"
        ? { opacity: 1, transform: "translateX(0)" }
        : { opacity: 0, transform: "translateY(12px)" };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr(isAr, "Welcome", "مرحباً")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 8000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "max(12px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))",
        background: phase === "exit" || phase === "enter" ? "rgba(0,0,0,0)" : "rgba(4, 8, 16, 0.72)",
        backdropFilter: phase === "idle" || phase === "stepIn" || phase === "stepOut" ? "blur(12px)" : "blur(0px)",
        WebkitBackdropFilter: phase === "idle" || phase === "stepIn" || phase === "stepOut" ? "blur(12px)" : "none",
        transition: "background 0.4s ease, backdrop-filter 0.4s ease",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) finish();
      }}
    >
      <BodyScrollLock />
      <style>{`
        @keyframes welPulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.06); }
        }
        @keyframes welFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes welShimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 440,
          maxHeight: "min(92dvh, 720px)",
          borderRadius: 28,
          overflow: "hidden",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          background: "var(--card, #12161e)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.04), 0 32px 80px -20px rgba(0,0,0,0.65), 0 0 60px -20px rgba(var(--focus-rgb, 90,140,255), 0.35)",
          transform: sheetVisible ? "translateY(0) scale(1)" : "translateY(28px) scale(0.94)",
          opacity: sheetVisible ? 1 : 0,
          transition: "transform 0.45s cubic-bezier(.22,1,.36,1), opacity 0.35s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -80,
            left: "50%",
            width: 280,
            height: 180,
            transform: "translateX(-50%)",
            background: "radial-gradient(ellipse, rgba(var(--focus-rgb, 90,140,255),0.35), transparent 70%)",
            pointerEvents: "none",
            animation: "welPulse 5s ease-in-out infinite",
          }}
        />

        <div style={{ height: 3, background: "rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "linear-gradient(90deg, var(--accent-1), var(--accent-2), var(--accent-1))",
              backgroundSize: "200% 100%",
              animation: "welShimmer 2.5s linear infinite",
              transition: "width 0.35s cubic-bezier(.22,1,.36,1)",
              borderRadius: "0 2px 2px 0",
            }}
          />
        </div>

        <div style={{ padding: "22px 22px 12px", position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={finish}
            aria-label={tr(isAr, "Skip", "تخطي")}
            style={{
              position: "absolute",
              top: 16,
              insetInlineEnd: 16,
              width: 36,
              height: 36,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
            }}
          >
            <XIcon size={15} />
          </button>

          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--accent-1)",
              marginBottom: 10,
            }}
          >
            {userName
              ? tr(isAr, `Hello, ${userName}`, `أهلاً، ${userName}`)
              : tr(isAr, "Bacaloria Community", "Bacaloria Community")}
          </div>

          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              marginBottom: 14,
              background: "linear-gradient(145deg, rgba(var(--focus-rgb,90,140,255),0.25), rgba(124,58,237,0.2))",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 12px 28px -12px rgba(var(--focus-rgb,90,140,255),0.5)",
              animation: "welFloat 4s ease-in-out infinite",
              color: "#fff",
            }}
          >
            {s.icon}
          </div>

          <div
            style={{
              ...contentAnim,
              transition: "opacity 0.22s ease, transform 0.28s cubic-bezier(.22,1,.36,1)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>
              {tr(isAr, s.enLead, s.arLead)}
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                color: INK,
              }}
            >
              {tr(isAr, s.enTitle, s.arTitle)}
            </h2>
          </div>
        </div>

        <div
          ref={bodyRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "4px 22px 8px",
            WebkitOverflowScrolling: "touch",
            ...contentAnim,
            transition: "opacity 0.22s ease, transform 0.28s cubic-bezier(.22,1,.36,1)",
          }}
        >
          <p style={{ margin: "0 0 16px", fontSize: 14.5, lineHeight: 1.7, color: "var(--muted-strong)" }}>
            {tr(isAr, s.enBody, s.arBody)}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(s.bullets || []).map((b, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "11px 13px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 8,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#fff",
                    background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                    marginTop: 1,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: 13.5, lineHeight: 1.45, color: INK, fontWeight: 560 }}>
                  {tr(isAr, b.en, b.ar)}
                </span>
              </div>
            ))}
          </div>

          {s.isDev && (
            <div
              style={{
                marginTop: 16,
                padding: "16px 16px 14px",
                borderRadius: 18,
                textAlign: "center",
                background:
                  "linear-gradient(145deg, rgba(var(--focus-rgb,90,140,255),0.12), rgba(124,58,237,0.1))",
                border: "1px solid rgba(var(--focus-rgb,90,140,255),0.22)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginBottom: 8,
                }}
              >
                {tr(isAr, "Lead developer", "المطوّر الرئيسي")}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.03em", color: INK, marginBottom: 4 }}>
                mickoly-aboawad
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent-1)" }}>ميكول-ابوعوض</div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: "14px 22px 20px",
            flexShrink: 0,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.15))",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", gap: 7, marginBottom: 14 }}>
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (i === step) return;
                  setDir(i > step ? 1 : -1);
                  setPhase("stepOut");
                  setTimeout(() => {
                    setStep(i);
                    setPhase("stepIn");
                    setTimeout(() => setPhase("idle"), 40);
                  }, 200);
                }}
                aria-label={`Step ${i + 1}`}
                style={{
                  width: i === step ? 24 : 7,
                  height: 7,
                  borderRadius: 999,
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  background:
                    i === step
                      ? "linear-gradient(90deg, var(--accent-1), var(--accent-2))"
                      : i < step
                        ? "rgba(var(--focus-rgb,90,140,255),0.45)"
                        : "rgba(255,255,255,0.15)",
                  transition: "width 0.3s cubic-bezier(.22,1,.36,1), background 0.25s ease",
                }}
              />
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => (step === 0 ? finish() : go(-1))}
              style={{
                flex: 1,
                padding: "13px 12px",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: step === 0 ? "var(--muted)" : INK,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {step === 0 ? tr(isAr, "Skip", "تخطي") : tr(isAr, "Back", "رجوع")}
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              style={{
                flex: 1.55,
                padding: "13px 14px",
                borderRadius: 16,
                border: "none",
                background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 12px 28px -10px rgba(var(--focus-rgb),0.65)",
                letterSpacing: "0.01em",
              }}
            >
              {isLast ? (
                <>
                  <CheckIcon size={16} />
                  {tr(isAr, "Start studying", "ابدأ المذاكرة")}
                </>
              ) : (
                tr(isAr, "Continue", "متابعة")
              )}
            </button>
          </div>
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
