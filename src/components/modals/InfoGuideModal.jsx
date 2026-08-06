import { useState, useEffect } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS } from "../../lib/config/theme";
import { XIcon, BookIcon, QuizIcon, ClockIcon, CalendarIcon, CheckIcon, StatsIcon, FlameIcon, SearchIcon, MicIcon, LayersIcon, StarIcon, WandIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

const SECTIONS = [
  {
    id: "basics",
    icon: BookIcon,
    titleEn: "Dictionary basics",
    titleAr: "أساسيات القاموس",
    bodyEn: [
      "Switch EN→AR / AR→AR from the section tabs.",
      "Search by word or meaning. Use the mic for voice search when available.",
      "Tap a card to expand definition, examples, synonyms.",
      "Star = favorite · Eye = mark as studied · Zoom = big view + pronunciation practice.",
    ],
    bodyAr: [
      "بدّل EN→AR / AR→AR من تبويبات القسم.",
      "ابحث بالكلمة أو المعنى. الميكروفون للبحث الصوتي لو متاح.",
      "اضغط الكرت لفتح التعريف والأمثلة والمرادفات.",
      "نجمة = مفضلة · عين = علّم كمدروسة · تكبير = عرض كبير + تمرين نطق.",
    ],
  },
  {
    id: "filters",
    icon: SearchIcon,
    titleEn: "Filters",
    titleAr: "الفلاتر",
    bodyEn: [
      "All / Studied / Not studied / Favorites / Due today.",
      "Due today = studied words scheduled for review by spaced repetition (SRS).",
    ],
    bodyAr: [
      "الكل / درست / لسه / مفضلة / مستحقة.",
      "مستحقة = كلمات مدروسة جاهزة للمراجعة حسب نظام التكرار المتباعد.",
    ],
  },
  {
    id: "quick",
    icon: LayersIcon,
    titleEn: "Quick review",
    titleAr: "مراجعة سريعة",
    bodyEn: [
      "Open from More ⋯ → Quick review.",
      "You see the word first — try to recall the meaning.",
      "Show meaning → then choose “I knew it” or “Still learning”.",
      "Best for a 2–5 minute refresh of due words.",
    ],
    bodyAr: [
      "من المزيد ⋯ → مراجعة سريعة.",
      "تشوف الكلمة الأول — حاول تفتكر المعنى.",
      "إظهار المعنى → بعدين «عرفتها» أو «لسه بتعلّم».",
      "مناسبة لمراجعة سريعة ٢–٥ دقايق للكلمات المستحقة.",
    ],
  },
  {
    id: "quiz",
    icon: QuizIcon,
    titleEn: "Quiz & flashcards",
    titleAr: "اختبار وبطاقات",
    bodyEn: [
      "Quiz builds questions from your studied words (meaning, synonyms, antonyms).",
      "Flashcards flip through cards for passive review.",
      "Answers update spaced-repetition levels automatically.",
    ],
    bodyAr: [
      "الاختبار بيبني أسئلة من كلماتك المدروسة (معنى، مرادفات، مضادات).",
      "البطاقات لتمرير سريع ومراجعة خفيفة.",
      "الإجابات بتحدّث مستوى التكرار المتباعد تلقائيًا.",
    ],
  },
  {
    id: "timer",
    icon: ClockIcon,
    titleEn: "Timer",
    titleAr: "المؤقّت",
    bodyEn: [
      "Countdown or stopwatch for study sessions.",
      "Pin shrinks it to a floating bubble so you can keep browsing the dictionary.",
      "Finished countdown minutes count toward daily goals.",
    ],
    bodyAr: [
      "عدّ تنازلي أو ساعة توقيت لجلسات المذاكرة.",
      "تثبيت = فقاعة عائمة وتقدر تكمل تصفح القاموس.",
      "دقائق العدّ التنازلي بتتحسب في أهداف اليوم.",
    ],
  },
  {
    id: "calendar",
    icon: CalendarIcon,
    titleEn: "Calendar",
    titleAr: "التقويم",
    bodyEn: [
      "Monthly map of days you marked words as studied.",
      "Tap a day to see which words. Pin for a mini widget.",
    ],
    bodyAr: [
      "خريطة شهرية للأيام اللي علّمت فيها كلمات كمدروسة.",
      "اضغط يوم عشان تشوف الكلمات. تثبيت = ودجت صغير.",
    ],
  },
  {
    id: "goals",
    icon: FlameIcon,
    titleEn: "Goals & challenges",
    titleAr: "أهداف وتحديات",
    bodyEn: [
      "More ⋯ → Goals: daily words, timer minutes, weekly targets.",
      "Weekly challenge rotates automatically.",
      "Pin keeps a small progress bubble on screen.",
    ],
    bodyAr: [
      "المزيد ⋯ → أهداف: كلمات يومية، دقائق مؤقّت، هدف أسبوعي.",
      "تحدي الأسبوع بيتغيّر لوحده.",
      "تثبيت = فقاعة تقدّم صغيرة على الشاشة.",
    ],
  },
  {
    id: "todo",
    icon: CheckIcon,
    titleEn: "To-do list",
    titleAr: "قائمة المهام",
    bodyEn: [
      "Green floating button (bottom corner) opens to-dos anywhere.",
      "Also under More ⋯. Export/Import JSON for backup.",
      "Pin for a floating mini list.",
    ],
    bodyAr: [
      "الزرار الأخضر العائم (تحت) بيفتح المهام من أي مكان.",
      "كمان من المزيد ⋯. تصدير/استيراد JSON للنسخ الاحتياطي.",
      "تثبيت = قائمة مصغّرة عائمة.",
    ],
  },
  {
    id: "focus",
    icon: StatsIcon,
    titleEn: "Focus mode",
    titleAr: "وضع التركيز",
    bodyEn: [
      "Header menu (☰) → Focus mode hides banners and extras.",
      "Keeps search + word list for distraction-free study.",
      "Shortcut: F · Exit chip at the top while active.",
    ],
    bodyAr: [
      "قائمة الهيدر (☰) → وضع التركيز يخفي البنرات والإضافات.",
      "يفضل البحث + قائمة الكلمات للمذاكرة من غير تشتيت.",
      "اختصار: F · شريحة خروج فوق وانت فيه.",
    ],
  },
  {
    id: "keys",
    icon: SearchIcon,
    titleEn: "Keyboard shortcuts",
    titleAr: "اختصارات الكيبورد",
    bodyEn: [
      "/ focus search · N add word · Q quiz · T to-do · R quick review · F focus.",
      "Ignored while typing in an input field.",
    ],
    bodyAr: [
      "/ تركيز البحث · N إضافة · Q اختبار · T مهام · R مراجعة سريعة · F تركيز.",
      "متشتغلش وانت بتكتب جوه خانة إدخال.",
    ],
  },
  {
    id: "notes",
    icon: BookIcon,
    titleEn: "Personal notes",
    titleAr: "ملاحظات شخصية",
    bodyEn: [
      "Expand any word card → “My note” field.",
      "Saved on this device for your account (local).",
    ],
    bodyAr: [
      "افتح أي كرت كلمة → حقل «ملاحظتي».",
      "بتتحفظ على الجهاز لحسابك (محلي).",
    ],
  },
  {
    id: "pron",
    icon: MicIcon,
    titleEn: "Pronunciation",
    titleAr: "النطق",
    bodyEn: [
      "Speaker icons play TTS.",
      "Zoom view: mic practices saying the word; you get a score.",
    ],
    bodyAr: [
      "أيقونات السماعة = نطق آلي (TTS).",
      "عرض التكبير: الميكروفون تمرين نطق الكلمة مع تقييم.",
    ],
  },
  {
    id: "dictation",
    icon: MicIcon,
    titleEn: "Listening & Dictation",
    titleAr: "استماع وإملاء",
    bodyEn: [
      "Open from More ⋯ → Dictation.",
      "Mode 1: Hear the word (TTS) → type its meaning.",
      "Mode 2: See the meaning → type the word.",
      "Each answer updates spaced-repetition (SRS) for that word.",
    ],
    bodyAr: [
      "من المزيد ⋯ → استماع وإملاء.",
      "وضع ١: اسمع الكلمة (TTS) → اكتب معناها.",
      "وضع ٢: شوف المعنى → اكتب الكلمة.",
      "كل إجابة بتحدّث التكرار المتباعد (SRS) للكلمة.",
    ],
  },
  {
    id: "random",
    icon: WandIcon,
    titleEn: "Random word",
    titleAr: "كلمة عشوائية",
    bodyEn: [
      "More ⋯ → Random word for fast one-by-one practice.",
      "Prefers due words when available. Tap the card to reveal the meaning.",
      "“Knew it” / “Forgot” updates SRS immediately.",
      "Keyboard: Space/Enter = reveal · 1 = knew · 2 = forgot.",
    ],
    bodyAr: [
      "المزيد ⋯ → كلمة عشوائية لممارسة سريعة كلمة بكلمة.",
      "يفضّل الكلمات المستحقة. اضغط الكرت لإظهار المعنى.",
      "«عرفتها» / «نسيتها» بيحدّثوا SRS فورًا.",
      "كيبورد: مسافة/Enter = إظهار · 1 = عرفتها · 2 = نسيتها.",
    ],
  },
  {
    id: "achievements",
    icon: StarIcon,
    titleEn: "Achievements",
    titleAr: "الإنجازات",
    bodyEn: [
      "Header menu (☰) → Achievements, or More ⋯ → Achievements.",
      "Badges unlock automatically as you study, quiz, keep streaks, and use the timer.",
      "Examples: first word, 50/200 words, 7/30-day streak, perfect quiz, mastered SRS words.",
    ],
    bodyAr: [
      "قائمة الهيدر (☰) → الإنجازات، أو المزيد ⋯ → الإنجازات.",
      "الشارات بتتفتح لوحدها مع المذاكرة والاختبارات والسلاسل والمؤقّت.",
      "أمثلة: أول كلمة، ٥٠/٢٠٠ كلمة، سلسلة ٧/٣٠ يوم، اختبار كامل، كلمات متقنة في SRS.",
    ],
  },
];

export default function InfoGuideModal({ isAr, onClose }) {
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sec = SECTIONS.find((s) => s.id === active) || SECTIONS[0];
  const Icon = sec.icon;
  const title = isAr ? sec.titleAr : sec.titleEn;
  const body = isAr ? sec.bodyAr : sec.bodyEn;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 12,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <BodyScrollLock />
      <div
        style={{
          width: "100%", maxWidth: 720, maxHeight: "min(88dvh, 720px)",
          background: CARD, borderRadius: 18, overflow: "hidden",
          display: "flex", flexDirection: "column",
          border: "1px solid rgba(var(--border-rgb),0.14)",
          boxShadow: "0 24px 60px -16px rgba(0,0,0,0.45)",
        }}
      >
        <header style={{
          display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
          borderBottom: "1px solid rgba(var(--border-rgb),0.12)",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center",
            justifyContent: "center", background: "color-mix(in srgb, var(--accent-1) 18%, transparent)", color: BRASS,
          }}>
            <BookIcon size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: INK }}>
              {tr(isAr, "How to use the site", "إزاي تستخدم الموقع")}
            </h2>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {tr(isAr, "Guides for every main feature", "دليل لكل ميزة أساسية")}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", padding: 6 }}>
            <XIcon size={18} />
          </button>
        </header>

        <div style={{
          display: "flex", flex: 1, minHeight: 0,
          flexDirection: "column",
        }}
          className="info-guide-body"
        >
          {/* Topic chips — scrollable on mobile */}
          <div style={{
            display: "flex", gap: 6, padding: "10px 12px", overflowX: "auto",
            borderBottom: "1px solid rgba(var(--border-rgb),0.1)",
            flexShrink: 0,
            WebkitOverflowScrolling: "touch",
          }}>
            {SECTIONS.map((s) => {
              const on = s.id === active;
              const I = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(s.id)}
                  style={{
                    flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "7px 12px", borderRadius: 20, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 700,
                    background: on ? BRASS : "rgba(var(--border-rgb),0.1)",
                    color: on ? "#fff" : "var(--muted-strong)",
                  }}
                >
                  <I size={13} />
                  {isAr ? s.titleAr : s.titleEn}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: "16px 18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{
                width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center",
                justifyContent: "center", background: "color-mix(in srgb, var(--accent-1) 14%, transparent)", color: BRASS,
              }}>
                <Icon size={20} />
              </span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: INK }}>{title}</h3>
            </div>

            {/* Simple visual “frame” instead of real screenshots */}
            <div style={{
              borderRadius: 12, border: "1px dashed rgba(var(--border-rgb),0.25)",
              padding: "14px 16px", marginBottom: 14,
              background: "rgba(var(--border-rgb),0.04)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {tr(isAr, "What you’ll see", "هتشوف إيه")}
              </div>
              <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 14, color: "var(--muted-strong)", lineHeight: 1.55 }}>
                {body.map((line, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>{line}</li>
                ))}
              </ul>
            </div>

            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
              {tr(isAr,
                "Tip: open this guide anytime from ☰ Menu → Settings → Information.",
                "نصيحة: افتح الدليل في أي وقت من ☰ القائمة → الإعدادات → معلومات.")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
