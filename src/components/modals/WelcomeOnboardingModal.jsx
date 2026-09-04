import { useEffect, useState, useRef, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK } from "../../lib/config/theme";
import { XIcon, CheckIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

/**
 * Premium cinematic onboarding — long-form intro + layered motion.
 */

const STEPS = [
  {
    id: "welcome",
    icon: "✦",
    enKicker: "Chapter 01",
    arKicker: "الفصل ٠١",
    enTitle: "Welcome to Bacaloria",
    arTitle: "أهلاً بك في Bacaloria",
    enLead: "Where vocabulary becomes a daily craft",
    arLead: "المكان اللي المفردات فيه بتتحول لحرفة يومية",
    enBody:
      "Bacaloria Community is not just a word list. It is a full study environment designed for Arabic ⇄ English learners who want structure, speed, and results. You add words, train them with spaced repetition, test yourself under pressure, and watch your progress compound week after week — on phone or desktop, online or offline.",
    arBody:
      "Bacaloria Community مش مجرد قائمة كلمات. دي بيئة مذاكرة كاملة مصممة لمتعلمي عربي ⇄ إنجليزي اللي عايزين نظام وسرعة ونتيجة. بتضيف كلمات، بتدرّبها بتكرار متباعد، بتختبر نفسك تحت ضغط، وبتشوف تقدّمك بيتراكم أسبوع ورا أسبوع — على الموبايل أو الكمبيوتر، أونلاين أو أوفلاين.",
    points: [
      {
        en: "Bilingual dictionary with search, filters, favorites, notes, and word lists so every entry has a place and a purpose.",
        ar: "قاموس ثنائي اللغة مع بحث وفلاتر ومفضلة وملاحظات وقوائم كلمات — كل مدخل ليه مكان وهدف.",
      },
      {
        en: "Progressive Web App: install it, use it offline, and keep studying even when the network drops.",
        ar: "تطبيق ويب تقدمي (PWA): ثبّته، استخدمه أوفلاين، وكمل مذاكرة حتى لو النت فصل.",
      },
      {
        en: "Cloud sync keeps your studied words, SRS schedule, XP, and settings aligned across devices.",
        ar: "مزامنة سحابية بتخلي كلماتك المدروسة وجدول الـ SRS والـ XP والإعدادات متوحّدة بين الأجهزة.",
      },
    ],
  },
  {
    id: "study",
    icon: "◎",
    enKicker: "Chapter 02",
    arKicker: "الفصل ٠٢",
    enTitle: "How you actually learn",
    arTitle: "إزاي بتتعلم بجد",
    enLead: "Spaced repetition + focused practice modes",
    arLead: "تكرار متباعد + أوضاع تدريب مركّزة",
    enBody:
      "When you mark a word as studied, Bacaloria does not leave it to chance. The SRS engine schedules the next review — from a few minutes to weeks — based on how well you answer. Weak words rise to the surface. Strong words wait longer. You spend time where it matters.",
    arBody:
      "لما تعلّم كلمة كـ «مدروسة»، Bacaloria مش بسيبها للحظ. محرك الـ SRS بيحدد المراجعة الجاية — من دقايق لأسابيع — حسب إجابتك. الكلمات الضعيفة بتطلع لفوق. القوية بتستنى أكتر. وقتك بيروح للحتة اللي محتاجاها.",
    points: [
      {
        en: "Quick Review for due cards. Weakness Review for low accuracy. Smart Cards for flip, type, cloze, and audio drills.",
        ar: "مراجعة سريعة للمستحق. مراجعة الضعف للدقة المنخفضة. بطاقات ذكية للقلب والكتابة والفراغ والصوت.",
      },
      {
        en: "Dictation and Listening Loop train your ear; Sentence Practice pushes you to use the word in a real line.",
        ar: "الإملاء وحلقة الاستماع بتدرّب ودنك؛ تمرين الجمل بيجبرك تستخدم الكلمة في سطر حقيقي.",
      },
      {
        en: "Quiz for mixed checks. Exam Mode for timed, formal sessions with admin-configurable rules.",
        ar: "اختبار لفحص متنوّع. وضع امتحان لجلسات موقوتة ورسمية بقواعد يضبطها الأدمن.",
      },
      {
        en: "Priority flags, due badges, morning and night shortcuts — so important words never get buried.",
        ar: "شارات أولوية واستحقاق، واختصارات صباح وليل — عشان الكلمات المهمة ما تتدفنشي.",
      },
    ],
  },
  {
    id: "progress",
    icon: "◈",
    enKicker: "Chapter 03",
    arKicker: "الفصل ٠٣",
    enTitle: "Momentum you can measure",
    arTitle: "زخم تقدر تقيسه",
    enLead: "XP, streaks, goals, calendar, reports",
    arLead: "نقاط، سلاسل، أهداف، تقويم، تقارير",
    enBody:
      "Motivation fades when progress is invisible. Bacaloria makes growth obvious: levels and XP for consistency, achievements for milestones, a study calendar for habits, weekly challenges for focus, and a weekly report you can export as image, text, or print-to-PDF.",
    arBody:
      "الحماس بيخف لما التقدّم يبقى مش باين. Bacaloria بيخلّي النمو واضح: مستويات وXP للانتظام، إنجازات للمحطات، تقويم دراسة للعادات، تحديات أسبوعية للتركيز، وتقرير أسبوعي تصدّره صورة أو نص أو طباعة PDF.",
    points: [
      {
        en: "Dashboard, stats, leaderboard, and «you vs past you» so improvement is not a guess.",
        ar: "لوحة قيادة وإحصائيات وترتيب ومقارنة «أنت ونفسك القديمة» — التحسّن مش تخمين.",
      },
      {
        en: "Study timer, to-do list, and goals keep sessions intentional instead of endless scrolling.",
        ar: "مؤقت دراسة وقائمة مهام وأهداف بتخلي الجلسة هادفة مش سكرول بلا نهاية.",
      },
      {
        en: "Filters for due, weak, priority, and sort by weakness or next review time.",
        ar: "فلاتر للمستحق والضعيف والأولوية، وترتيب حسب الضعف أو أقرب مراجعة.",
      },
    ],
  },
  {
    id: "who",
    icon: "◇",
    enKicker: "Chapter 04",
    arKicker: "الفصل ٠٤",
    enTitle: "Who we are",
    arTitle: "مين إحنا",
    enLead: "An independent study community",
    arLead: "مجتمع دراسة مستقل",
    enBody:
      "Bacaloria Community is built for students who prepare for real exams and real conversations — not for passive content feeds. We care about clarity, mobile-first layout, offline resilience, and tools that respect your time. Arabic and English sit at the center; the interface speaks your language.",
    arBody:
      "Bacaloria Community معمولة لطلاب بيحضّروا لامتحانات حقيقية ومحادثات حقيقية — مش لفيد محتوى سلبي. بنهتم بالوضوح، وتصميم الموبايل أولاً، والشغل أوفلاين، وأدوات تحترم وقتك. العربي والإنجليزي في الصميم؛ والواجهة بتتكلم لغتك.",
    points: [
      {
        en: "Product focus: vocabulary mastery through deliberate practice, not random flashy gimmicks.",
        ar: "تركيز المنتج: إتقان المفردات بالممارسة الواعية، مش حيل عشوائية لامعة.",
      },
      {
        en: "Community-minded: shared lists, challenges, and progress that can inspire (not pressure) peers.",
        ar: "بروح مجتمع: قوائم وتحديات وتقدّم يقدر يلهم الزملاء من غير ما يضغطهم.",
      },
      {
        en: "Always evolving — new study modes and polish land continuously for people who show up daily.",
        ar: "بيتطور باستمرار — أوضاع مذاكرة وتحسينات بتنزل للي بيفتحوا التطبيق كل يوم.",
      },
    ],
  },
  {
    id: "dev",
    icon: "⬡",
    enKicker: "Chapter 05",
    arKicker: "الفصل ٠٥",
    enTitle: "Crafted by the builders",
    arTitle: "من صُنع المطوّرين",
    enLead: "Development credit",
    arLead: "نَسب التطوير",
    enBody:
      "Bacaloria is developed by aboawad and mickoly. The goal is simple and hard: a study app that feels premium in motion, honest in pedagogy, and worth opening every single day.",
    arBody:
      "Bacaloria من تطوير aboawad و mickoly. الهدف بسيط وصعب في نفس الوقت: تطبيق مذاكرة شكله premium في الحركة، أمين في أسلوب التعلّم، ويستاهل يتفتح كل يوم.",
    points: [
      {
        en: "aboawad — Backend & Frontend · strategist & decision executor",
        ar: "aboawad — Backend و Frontend · مفكر ومنفذ للقرارات",
      },
      {
        en: "mickoly — Backend & Frontend · idea designer",
        ar: "mickoly — Backend و Frontend · مصمم أفكار",
      },
      {
        en: "Thank you for trusting Bacaloria with your study time. Let’s build the habit together.",
        ar: "شكراً إنك وثقت في Bacaloria بوقت مذاكرتك. يلا نبني العادة سوا.",
      },
    ],
    isDev: true,
  },
];

function Particles() {
  const dots = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${(i * 17 + 7) % 100}%`,
        delay: `${(i % 7) * 0.35}s`,
        dur: `${6 + (i % 5)}s`,
        size: 2 + (i % 3),
        opacity: 0.15 + (i % 4) * 0.08,
      })),
    []
  );
  return (
    <div aria-hidden className="wel-particles">
      {dots.map((d) => (
        <span
          key={d.id}
          className="wel-particle"
          style={{
            left: d.left,
            width: d.size,
            height: d.size,
            animationDelay: d.delay,
            animationDuration: d.dur,
            opacity: d.opacity,
          }}
        />
      ))}
    </div>
  );
}

export default function WelcomeOnboardingModal({ isAr, userName = "", onClose }) {
  const [step, setStep] = useState(0);
  /** How many content blocks are visible inside the current chapter (0 = title only / lead+title, then body, then points…) */
  const [reveal, setReveal] = useState(0);
  const [phase, setPhase] = useState("enter");
  const [dir, setDir] = useState(1);
  const [tick, setTick] = useState(0);
  const bodyRef = useRef(null);
  const s = STEPS[step];
  const pointCount = (s.points || []).length;
  // reveal stages: 0 = title, 1 = body, 2.. = points, then dev cards one-by-one if isDev
  const maxReveal = 1 + pointCount + (s.isDev ? 2 : 0);
  const isLastStep = step >= STEPS.length - 1;
  const isChapterDone = reveal >= maxReveal;
  const isFullyDone = isLastStep && isChapterDone;
  const progress = ((step + Math.min(reveal, maxReveal) / Math.max(maxReveal, 1)) / STEPS.length) * 100;

  useEffect(() => {
    const t = requestAnimationFrame(() => setPhase("idle"));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    setTick((x) => x + 1);
  }, [step, reveal]);

  // Auto-scroll body to bottom after new content is revealed (waits for DOM paint)
  useEffect(() => {
    if (reveal === 0) return;
    const el = bodyRef.current;
    if (!el) return;
    const scrollToBottom = () => {
      try {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      } catch (_) {
        el.scrollTop = el.scrollHeight;
      }
    };
    // Double rAF + short timeout so layout/animation of new block is ready
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToBottom();
        setTimeout(scrollToBottom, 80);
        setTimeout(scrollToBottom, 220);
      });
    });
    return () => cancelAnimationFrame(id);
  }, [reveal, step]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") finish();
      if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  function finish() {
    setPhase("exit");
    setTimeout(() => onClose && onClose(), 420);
  }

  function goNext() {
    if (!isChapterDone) {
      setReveal((r) => r + 1);
      return;
    }
    if (isLastStep) {
      finish();
      return;
    }
    setDir(1);
    setPhase("stepOut");
    setTimeout(() => {
      setStep((x) => x + 1);
      setReveal(0);
      setPhase("stepIn");
      setTimeout(() => setPhase("idle"), 30);
      try {
        if (bodyRef.current) bodyRef.current.scrollTop = 0;
      } catch (_) {}
    }, 280);
  }

  function goBack() {
    if (reveal > 0) {
      setReveal((r) => r - 1);
      return;
    }
    if (step === 0) {
      finish();
      return;
    }
    setDir(-1);
    setPhase("stepOut");
    setTimeout(() => {
      const prev = step - 1;
      setStep(prev);
      const prevMax = 1 + (STEPS[prev].points || []).length + (STEPS[prev].isDev ? 1 : 0);
      setReveal(prevMax);
      setPhase("stepIn");
      setTimeout(() => setPhase("idle"), 30);
    }, 280);
  }

  function jumpToStep(i) {
    if (i === step) return;
    setDir(i > step ? 1 : -1);
    setPhase("stepOut");
    setTimeout(() => {
      setStep(i);
      setReveal(0);
      setPhase("stepIn");
      setTimeout(() => setPhase("idle"), 30);
    }, 260);
  }

  const sheetOn = phase !== "enter" && phase !== "exit";
  const slide =
    phase === "stepOut"
      ? dir > 0
        ? "wel-out-left"
        : "wel-out-right"
      : phase === "stepIn"
        ? dir > 0
          ? "wel-in-right"
          : "wel-in-left"
        : phase === "idle"
          ? "wel-idle"
          : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr(isAr, "Welcome", "مرحباً")}
      className={`wel-root ${phase === "exit" ? "wel-root-exit" : ""} ${phase === "enter" ? "wel-root-enter" : "wel-root-on"}`}

    >
      <BodyScrollLock />
      <style>{CSS}</style>
      <Particles />

      <div className={`wel-sheet ${sheetOn ? "wel-sheet-on" : "wel-sheet-off"}`} onClick={(e) => e.stopPropagation()}>
        <div className="wel-glow" />
        <div className="wel-glow wel-glow-2" />

        <div className="wel-progress-track">
          <div className="wel-progress-bar" style={{ width: `${progress}%` }} />
        </div>

        <div className="wel-head">
          <button type="button" className="wel-close" onClick={finish} aria-label={tr(isAr, "Skip", "تخطي")}>
            <XIcon size={15} />
          </button>

          <div className="wel-kicker">
            <span className="wel-kicker-dot" />
            {tr(isAr, s.enKicker, s.arKicker)}
            <span className="wel-kicker-sep">·</span>
            {userName
              ? tr(isAr, `Hello, ${userName}`, `أهلاً، ${userName}`)
              : tr(isAr, "Bacaloria Community", "Bacaloria Community")}
          </div>

          <div className={`wel-icon-wrap wel-icon-pulse`} key={`ico-${step}`}>
            <span className="wel-icon">{s.icon}</span>
            <span className="wel-icon-ring" />
            <span className="wel-icon-ring wel-icon-ring-2" />
          </div>

          <div className={`wel-title-block ${slide}`} key={`title-${step}`}>
            <div className="wel-lead">{tr(isAr, s.enLead, s.arLead)}</div>
            <h2 className="wel-title">{tr(isAr, s.enTitle, s.arTitle)}</h2>
          </div>
        </div>

        <div ref={bodyRef} className={`wel-body ${slide}`} key={`body-${step}`}>
          {reveal >= 1 && (
            <p className="wel-body-text wel-stagger" key={`p-${step}-body`} style={{ animationDelay: "0.04s" }}>
              {tr(isAr, s.enBody, s.arBody)}
            </p>
          )}

          <ul className="wel-points">
            {(s.points || []).map((p, i) =>
              reveal >= 2 + i ? (
                <li
                  key={`${step}-pt-${i}`}
                  className="wel-point wel-stagger"
                  style={{ animationDelay: "0.06s" }}
                >
                  <span className="wel-point-dot" aria-hidden />
                  <span className="wel-point-text">{tr(isAr, p.en, p.ar)}</span>
                </li>
              ) : null
            )}
          </ul>

          {s.isDev && reveal >= maxReveal - 1 && (
            <div className="wel-dev-list">
              {reveal >= maxReveal - 1 && (
                <div className="wel-dev-card wel-stagger" key="dev-aboawad" style={{ animationDelay: "0.06s" }}>
                  <div className="wel-dev-card-top">
                    <div className="wel-dev-avatar" aria-hidden>
                      <img src="/icons/dev-aboawad.jpg" alt="" loading="eager" decoding="async" />
                    </div>
                    <div className="wel-dev-id">
                      <div className="wel-dev-role">{tr(isAr, "Backend & Frontend", "Backend و Frontend")}</div>
                      <div className="wel-dev-name">aboawad</div>
                    </div>
                  </div>
                  <div className="wel-dev-divider" />
                  <div className="wel-dev-meta">
                    <div className="wel-dev-row">
                      <span className="wel-dev-k">{tr(isAr, "Project", "المشروع")}</span>
                      <span className="wel-dev-v">Bacaloria Community</span>
                    </div>
                    <div className="wel-dev-row">
                      <span className="wel-dev-k">{tr(isAr, "Role", "الدور")}</span>
                      <span className="wel-dev-v">{tr(isAr, "Backend & Frontend · thinker & decision executor", "Backend و Frontend · مفكر ومنفذ للقرارات")}</span>
                    </div>
                  </div>
                </div>
              )}
              {reveal >= maxReveal && (
                <div className="wel-dev-card wel-stagger" key="dev-mickoly" style={{ animationDelay: "0.06s" }}>
                  <div className="wel-dev-card-top">
                    <div className="wel-dev-avatar wel-dev-avatar-2" aria-hidden>
                      <img src="/icons/dev-mickoly.jpg" alt="" loading="eager" decoding="async" onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement.textContent = "M"; }} />
                    </div>
                    <div className="wel-dev-id">
                      <div className="wel-dev-role">{tr(isAr, "Backend & Frontend", "Backend و Frontend")}</div>
                      <div className="wel-dev-name">mickoly</div>
                    </div>
                  </div>
                  <div className="wel-dev-divider" />
                  <div className="wel-dev-meta">
                    <div className="wel-dev-row">
                      <span className="wel-dev-k">{tr(isAr, "Project", "المشروع")}</span>
                      <span className="wel-dev-v">Bacaloria Community</span>
                    </div>
                    <div className="wel-dev-row">
                      <span className="wel-dev-k">{tr(isAr, "Role", "الدور")}</span>
                      <span className="wel-dev-v">{tr(isAr, "Backend & Frontend · idea designer", "Backend و Frontend · مصمم أفكار")}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {reveal === 0 && (
            <p className="wel-hint wel-stagger" style={{ animationDelay: "0.1s" }}>
              {tr(
                isAr,
                "Tap Continue to reveal this chapter line by line.",
                "اضغط متابعة عشان الفصل يظهر سطر سطر."
              )}
            </p>
          )}
        </div>

        <div className="wel-foot">
          <div className="wel-chapter-meta">
            <nav className="wel-chapter-nav" aria-label={tr(isAr, "Chapters", "الفصول")}>
              {STEPS.map((ch, i) => (
                <button
                  key={ch.id}
                  type="button"
                  className={`wel-chapter-link ${i === step ? "is-on" : ""} ${i < step ? "is-done" : ""}`}
                  onClick={() => jumpToStep(i)}
                  aria-label={tr(isAr, ch.enTitle, ch.arTitle)}
                  title={tr(isAr, ch.enTitle, ch.arTitle)}
                >
                  {i + 1}
                </button>
              ))}
            </nav>
            <span className="wel-chapter-meta-sub">
              {reveal === 0
                ? tr(isAr, "Intro", "مقدمة")
                : isChapterDone
                  ? tr(isAr, "Complete", "مكتمل")
                  : tr(isAr, `${reveal} / ${maxReveal}`, `${reveal} / ${maxReveal}`)}
            </span>
          </div>
          <div className="wel-chapter-line" aria-hidden>
            <div
              className="wel-chapter-line-fill"
              style={{ width: `${((step + (isChapterDone ? 1 : Math.min(reveal, maxReveal) / Math.max(maxReveal, 1))) / STEPS.length) * 100}%` }}
            />
          </div>

          <div className="wel-actions">
            <button type="button" className="wel-btn wel-btn-ghost" onClick={goBack}>
              {step === 0 && reveal === 0
                ? tr(isAr, "Skip intro", "تخطي المقدمة")
                : tr(isAr, "Back", "رجوع")}
            </button>
            <button type="button" className="wel-btn wel-btn-primary" onClick={goNext}>
              {isFullyDone ? (
                <>
                  <CheckIcon size={16} />
                  {tr(isAr, "Start studying", "ابدأ المذاكرة")}
                </>
              ) : isChapterDone ? (
                <>
                  {tr(isAr, "Next chapter", "الفصل التالي")}
                  <span className="wel-btn-arrow">→</span>
                </>
              ) : (
                <>
                  {tr(isAr, "Continue", "متابعة")}
                  <span className="wel-btn-arrow">→</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


const CSS = `
.wel-root {
  position: fixed; inset: 0; z-index: 8000;
  touch-action: none; overscroll-behavior: none;
  display: flex; align-items: center; justify-content: center;
  padding: max(12px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
  transition: background 0.45s ease, backdrop-filter 0.45s ease;
}
.wel-root-enter { background: rgba(0,0,0,0); }
.wel-root-on {
  background: rgba(3, 6, 14, 0.78);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
.wel-root-exit {
  background: rgba(0,0,0,0);
  backdrop-filter: blur(0);
  pointer-events: none;
}

.wel-particles { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.wel-particle {
  position: absolute; bottom: -10px; border-radius: 50%;
  background: rgba(120, 180, 255, 0.9);
  box-shadow: 0 0 8px rgba(100,160,255,0.5);
  animation: welRise linear infinite;
}
@keyframes welRise {
  0% { transform: translateY(0) scale(1); opacity: 0; }
  10% { opacity: 1; }
  100% { transform: translateY(-110vh) scale(0.4); opacity: 0; }
}

.wel-sheet {
  width: 100%; max-width: 460px; max-height: min(92dvh, 760px);
  border-radius: 28px; overflow: hidden; position: relative;
  display: flex; flex-direction: column;
  background: linear-gradient(165deg, rgba(22,28,40,0.98) 0%, rgba(12,16,24,0.99) 100%);
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.04),
    0 40px 100px -24px rgba(0,0,0,0.75),
    0 0 80px -30px rgba(80,140,255,0.4);
  transition: transform 0.5s cubic-bezier(.22,1,.36,1), opacity 0.4s ease;
}
.wel-sheet-off { transform: translateY(36px) scale(0.92); opacity: 0; }
.wel-sheet-on { transform: translateY(0) scale(1); opacity: 1; }

.wel-glow {
  position: absolute; top: -100px; left: 50%; width: 320px; height: 200px;
  transform: translateX(-50%); pointer-events: none;
  background: radial-gradient(ellipse, rgba(90,140,255,0.35), transparent 70%);
  animation: welPulse 5s ease-in-out infinite;
}
.wel-glow-2 {
  top: auto; bottom: -80px; width: 260px; height: 140px;
  background: radial-gradient(ellipse, rgba(124,58,237,0.22), transparent 70%);
  animation-delay: 1.5s;
}
@keyframes welPulse {
  0%, 100% { opacity: 0.5; transform: translateX(-50%) scale(1); }
  50% { opacity: 0.9; transform: translateX(-50%) scale(1.08); }
}

.wel-progress-track {
  height: 3px; background: rgba(255,255,255,0.06); flex-shrink: 0;
}
.wel-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-1, #5b8def), var(--accent-2, #af52de), var(--accent-1, #5b8def));
  background-size: 200% 100%;
  animation: welShimmer 2.2s linear infinite;
  transition: width 0.4s cubic-bezier(.22,1,.36,1);
  border-radius: 0 2px 2px 0;
}
@keyframes welShimmer {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}

.wel-head { padding: 20px 22px 8px; position: relative; flex-shrink: 0; }
.wel-close {
  position: absolute; top: 14px; inset-inline-end: 14px;
  width: 36px; height: 36px; border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.65);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  z-index: 2; transition: background 0.2s, color 0.2s;
}
.wel-close:hover { background: rgba(255,255,255,0.12); color: var(--on-accent, #fff); }

.wel-kicker {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--accent-1, #5b8def);
  margin-bottom: 14px; padding-inline-end: 40px;
}
.wel-kicker-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent-1, #5b8def);
  box-shadow: 0 0 10px var(--accent-1, #5b8def);
  animation: welBlink 2s ease-in-out infinite;
}
.wel-kicker-sep { opacity: 0.4; }
@keyframes welBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.wel-icon-wrap {
  position: relative; width: 56px; height: 56px; margin-bottom: 14px;
  display: flex; align-items: center; justify-content: center;
}
.wel-icon {
  position: relative; z-index: 1;
  width: 52px; height: 52px; border-radius: 18px;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; color: #fff;
  background: linear-gradient(145deg, rgba(90,140,255,0.35), rgba(124,58,237,0.28));
  border: 1px solid rgba(255,255,255,0.14);
  box-shadow: 0 12px 32px -10px rgba(80,140,255,0.55);
  animation: welFloat 4s ease-in-out infinite;
}
.wel-icon-ring, .wel-icon-ring-2 {
  position: absolute; inset: -4px; border-radius: 22px;
  border: 1px solid rgba(90,140,255,0.35);
  animation: welRing 2.8s ease-out infinite;
}
.wel-icon-ring-2 { animation-delay: 1.2s; }
@keyframes welFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes welRing {
  0% { transform: scale(0.92); opacity: 0.7; }
  100% { transform: scale(1.35); opacity: 0; }
}
.wel-icon-pulse { animation: welPop 0.5s cubic-bezier(.22,1,.36,1); }
@keyframes welPop {
  0% { transform: scale(0.7); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.wel-lead {
  font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.45);
  margin-bottom: 6px;
}
.wel-title {
  margin: 0; font-size: 26px; font-weight: 800;
  letter-spacing: -0.03em; line-height: 1.2; color: #f2f5fa;
}

.wel-body {
  flex: 1; overflow-y: auto; padding: 6px 22px 10px;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y; overscroll-behavior: contain;
}
.wel-body-text {
  margin: 0 0 16px; font-size: 14.5px; line-height: 1.75;
  color: rgba(230,236,245,0.72);
}

.wel-points {
  display: flex; flex-direction: column; gap: 10px;
  list-style: none; margin: 0; padding: 0;
}
.wel-point {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 2px 0;
}
.wel-point-dot {
  flex-shrink: 0; width: 8px; height: 8px; margin-top: 7px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-1, #5b8def), var(--accent-2, #7c3aed));
  box-shadow: 0 0 10px rgba(90,140,255,0.55);
}
.wel-point-text {
  font-size: 13.5px; line-height: 1.6; color: rgba(242,245,250,0.88);
  font-weight: 500;
}

.wel-dev-list {
  margin-top: 14px;
  display: flex; flex-direction: column; gap: 10px;
}
.wel-dev-card {
  padding: 14px;
  border-radius: 16px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  position: relative;
}
.wel-dev-card-top {
  display: flex; align-items: center; gap: 14px;
}
.wel-dev-avatar {
  flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 800; color: #fff; letter-spacing: 0.04em;
  background: linear-gradient(145deg, #5b8def, #7c3aed);
  box-shadow: 0 8px 20px -8px rgba(80,140,255,0.7);
  overflow: hidden;
}
.wel-dev-avatar img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.wel-dev-avatar-2 {
  background: linear-gradient(145deg, #7c3aed, #c026d3);
  box-shadow: 0 8px 20px -8px rgba(124,58,237,0.7);
}
.wel-dev-id { min-width: 0; }
.wel-dev-role {
  font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--accent-1, #7eb6ff);
  margin-bottom: 2px;
}
.wel-dev-name {
  font-size: 16px; font-weight: 800; color: #f2f5fa;
  letter-spacing: -0.02em; line-height: 1.25;
}
.wel-dev-divider {
  height: 1px; margin: 12px 0 10px;
  background: rgba(255,255,255,0.08);
}
.wel-dev-meta {
  display: flex; flex-direction: column; gap: 6px;
}
.wel-dev-row {
  display: flex; justify-content: space-between; align-items: baseline;
  gap: 12px; font-size: 12.5px;
}
.wel-dev-k {
  color: rgba(255,255,255,0.4); font-weight: 600; flex-shrink: 0;
}
.wel-dev-v {
  color: rgba(242,245,250,0.9); font-weight: 600; text-align: end;
}

.wel-stagger { animation: welUp 0.55s cubic-bezier(.22,1,.36,1) both; }
@keyframes welUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

.wel-out-left { animation: welOutL 0.28s ease forwards; }
.wel-out-right { animation: welOutR 0.28s ease forwards; }
.wel-in-right { animation: welInR 0.4s cubic-bezier(.22,1,.36,1) both; }
.wel-in-left { animation: welInL 0.4s cubic-bezier(.22,1,.36,1) both; }
.wel-idle { opacity: 1; transform: none; }
@keyframes welOutL {
  to { opacity: 0; transform: translateX(-24px); }
}
@keyframes welOutR {
  to { opacity: 0; transform: translateX(24px); }
}
@keyframes welInR {
  from { opacity: 0; transform: translateX(28px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes welInL {
  from { opacity: 0; transform: translateX(-28px); }
  to { opacity: 1; transform: translateX(0); }
}

.wel-foot {
  padding: 12px 22px 18px; flex-shrink: 0;
  border-top: 1px solid rgba(255,255,255,0.06);
  background: linear-gradient(180deg, transparent, rgba(0,0,0,0.2));
}
.wel-chapter-meta {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.4);
  margin-bottom: 10px; letter-spacing: 0.02em;
}
.wel-chapter-nav {
  display: flex; align-items: center; gap: 2px;
}
.wel-chapter-link {
  border: none; background: transparent; cursor: pointer;
  width: 26px; height: 26px; padding: 0;
  font-size: 12px; font-weight: 700;
  color: rgba(255,255,255,0.28);
  display: flex; align-items: center; justify-content: center;
  transition: color 0.2s ease;
}
.wel-chapter-link:hover { color: rgba(255,255,255,0.7); }
.wel-chapter-link.is-done { color: rgba(126,182,255,0.65); }
.wel-chapter-link.is-on {
  color: var(--on-accent, #fff);
  text-shadow: 0 0 12px rgba(90,140,255,0.6);
}
.wel-chapter-meta-sub { color: var(--accent-1, #7eb6ff); font-size: 11px; }
.wel-chapter-line {
  height: 2px; border-radius: 1px;
  background: rgba(255,255,255,0.08);
  margin-bottom: 14px; overflow: hidden;
}
.wel-chapter-line-fill {
  height: 100%; border-radius: inherit;
  background: linear-gradient(90deg, var(--accent-1, #5b8def), var(--accent-2, #af52de));
  transition: width 0.45s cubic-bezier(.22,1,.36,1);
}
.wel-hint {
  margin: 8px 0 0; font-size: 13px; line-height: 1.5;
  color: rgba(255,255,255,0.4); font-style: italic; text-align: center;
}

.wel-actions { display: flex; gap: 10px; }
.wel-btn {
  padding: 13px 14px; border-radius: 16px; font-weight: 800; font-size: 14px;
  cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: transform 0.15s ease, box-shadow 0.2s;
}
.wel-btn:active { transform: scale(0.98); }
.wel-btn-ghost {
  flex: 1; border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.75);
}
.wel-btn-primary {
  flex: 1.6; border: none; color: var(--on-accent, #fff);
  background: linear-gradient(135deg, var(--accent-1, #5b8def), var(--accent-2, #7c3aed));
  box-shadow: 0 12px 28px -10px rgba(80,140,255,0.7);
}
.wel-btn-primary:hover {
  box-shadow: 0 14px 32px -8px rgba(80,140,255,0.85);
}
.wel-btn-arrow {
  display: inline-block;
  animation: welArrow 1.2s ease-in-out infinite;
}
@keyframes welArrow {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(4px); }
}
`;

// hasSeenWelcome / markWelcomeSeen moved to ../../lib/state/welcomeStatus.js
// (re-exported here for any existing external imports of this file).
export { hasSeenWelcome, markWelcomeSeen } from "../../lib/state/welcomeStatus";
