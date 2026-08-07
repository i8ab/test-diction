import { useEffect, useState } from "react";
import { tr } from "../../lib/config/i18n";
import { XIcon, ChevronIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

/** One guide entry = one feature. Never merge features in a single item. */
const GUIDES = [
  {
    id: "search",
    titleEn: "Search & filters",
    titleAr: "البحث والفلاتر",
    whatEn: "Find words quickly and narrow the list.",
    whatAr: "تلاقي الكلمات بسرعة وتضيّق القائمة.",
    stepsEn: [
      "Use the search box at the top of the list (word or meaning).",
      "Mic icon = voice search when the browser supports it.",
      "Filters: All · Studied · Not studied · Favorites · Due today.",
    ],
    stepsAr: [
      "خانة البحث فوق القائمة (كلمة أو معنى).",
      "أيقونة الميكروفون = بحث صوتي لو المتصفح يدعم.",
      "الفلاتر: الكل · درست · لسه · مفضلة · مستحقة.",
    ],
  },
  {
    id: "cards",
    titleEn: "Word cards",
    titleAr: "كروت الكلمات",
    whatEn: "Each entry is a card with actions.",
    whatAr: "كل مدخل كرت عليه أزرار.",
    stepsEn: [
      "Tap a card to expand definition, examples, synonyms.",
      "Star = favorite · Eye = studied · Zoom = large practice view.",
      "Speaker = pronunciation. Personal note field is inside the expanded card.",
    ],
    stepsAr: [
      "اضغط الكرت لفتح التعريف والأمثلة والمرادفات.",
      "نجمة = مفضلة · عين = مُذاكرة · تكبير = عرض كبير.",
      "السماعة = نطق. الملاحظة الشخصية جوه الكرت المفتوح.",
    ],
  },
  {
    id: "add",
    titleEn: "Adding & editing words",
    titleAr: "إضافة وتعديل الكلمات",
    whatEn: "Grow the shared dictionary.",
    whatAr: "زوّد القاموس المشترك.",
    stepsEn: [
      "Tap + / Add (or press N when not typing).",
      "Word and meaning are required. Optional: type, multi-sense, definition, examples.",
      "Auto-fill (English) fills definition + examples only.",
    ],
    stepsAr: [
      "دوس + / إضافة (أو N وانت مش بتكتب).",
      "الكلمة والمعنى مطلوبين. اختياري: النوع، أكتر من معنى، تعريف، أمثلة.",
      "التعبئة التلقائية (إنجليزي) = تعريف + أمثلة فقط.",
    ],
  },
  {
    id: "pron",
    titleEn: "Pronunciation (Cambridge)",
    titleAr: "النطق (كامبريدج)",
    whatEn: "US and UK Cambridge audio for English words.",
    whatAr: "نطق كامبريدج أمريكي وبريطاني للإنجليزي.",
    stepsEn: [
      "Settings → Accent: choose American or British default.",
      "Speaker icons play that accent. Zoom view has separate US / UK buttons.",
    ],
    stepsAr: [
      "الإعدادات → اللهجة: أمريكي أو بريطاني كافتراضي.",
      "السماعة بتشغّل اللهجة دي. العرض الكبير فيه US و UK منفصلين.",
    ],
  },
  {
    id: "quiz",
    titleEn: "Quiz",
    titleAr: "الاختبار",
    whatEn: "Questions from your studied words.",
    whatAr: "أسئلة من كلماتك المدروسة.",
    stepsEn: [
      "More ⋯ → Quiz. Choose range, MCQ or typing, optional due-only.",
      "Multi-type words: the question labels the required type.",
      "Answers update spaced repetition (SRS).",
    ],
    stepsAr: [
      "المزيد ⋯ → اختبار. المدى، اختيار أو كتابة، ومستحقة فقط اختياري.",
      "الكلمات متعددة النوع: السؤال بيوضّح النوع المطلوب.",
      "الإجابات بتحدّث التكرار المتباعد (SRS).",
    ],
  },
  {
    id: "flashcards",
    titleEn: "Flashcards",
    titleAr: "البطاقات التعليمية",
    whatEn: "Flip cards for light review.",
    whatAr: "تقليب كروت لمراجعة خفيفة.",
    stepsEn: [
      "More ⋯ → Flashcards.",
      "See one side, flip to reveal the other — no score pressure.",
    ],
    stepsAr: [
      "المزيد ⋯ → بطاقات.",
      "شوف وجه، اقلب عشان الوجه التاني — من غير ضغط درجات.",
    ],
  },
  {
    id: "quick",
    titleEn: "Quick review",
    titleAr: "مراجعة سريعة",
    whatEn: "Short recall for due words.",
    whatAr: "تذكّر سريع للمستحقة.",
    stepsEn: [
      "More ⋯ → Quick review.",
      "Recall the meaning, reveal, then “Knew it” or “Still learning”.",
    ],
    stepsAr: [
      "المزيد ⋯ → مراجعة سريعة.",
      "افتكر المعنى، اكشف، بعدين «عرفتها» أو «لسه بتعلّم».",
    ],
  },
  {
    id: "random",
    titleEn: "Random word",
    titleAr: "كلمة عشوائية",
    whatEn: "One word at a time, no repeats until the set is done.",
    whatAr: "كلمة بكلمة من غير تكرار لحد ما تخلص المجموعة.",
    stepsEn: [
      "More ⋯ → Random word. Tap to reveal. Knew it / Forgot updates SRS.",
    ],
    stepsAr: [
      "المزيد ⋯ → كلمة عشوائية. اضغط للكشف. عرفتها/نسيتها بتحدّث SRS.",
    ],
  },
  {
    id: "dictation",
    titleEn: "Listening & dictation",
    titleAr: "استماع وإملاء",
    whatEn: "Hear → type meaning, or see meaning → type the word.",
    whatAr: "اسمع → اكتب المعنى، أو شوف المعنى → اكتب الكلمة.",
    stepsEn: ["More ⋯ → Dictation. Each answer updates SRS."],
    stepsAr: ["المزيد ⋯ → استماع وإملاء. كل إجابة بتحدّث SRS."],
  },
  {
    id: "todo",
    titleEn: "To-do list",
    titleAr: "قائمة المهام",
    whatEn: "Tasks with a live work timer.",
    whatAr: "مهام مع مؤقت شغل حيّ.",
    stepsEn: [
      "Green button or More ⋯ → To-do.",
      "Start on a task for a live timer. One active task at a time.",
    ],
    stepsAr: [
      "الزرار الأخضر أو المزيد ⋯ → مهام.",
      "ابدأ على مهمة لمؤقت حيّ. مهمة واحدة في نفس الوقت.",
    ],
  },
  {
    id: "goals",
    titleEn: "Goals & challenges",
    titleAr: "الأهداف والتحديات",
    whatEn: "Daily words/minutes and a weekly challenge.",
    whatAr: "كلمات/دقائق يومية وتحدي أسبوعي.",
    stepsEn: ["Orange Goals button or More ⋯ → Goals."],
    stepsAr: ["الزرار البرتقالي أو المزيد ⋯ → أهداف."],
  },
  {
    id: "timer",
    titleEn: "Study timer",
    titleAr: "مؤقّت المذاكرة",
    whatEn: "Countdown or stopwatch; minutes count toward goals.",
    whatAr: "عدّ تنازلي أو ساعة؛ الدقائق بتتحسب في الأهداف.",
    stepsEn: ["Open Timer from tools. Pin for a floating bubble."],
    stepsAr: ["افتح المؤقّت من الأدوات. تثبيت = فقاعة عائمة."],
  },
  {
    id: "calendar",
    titleEn: "Calendar",
    titleAr: "التقويم",
    whatEn: "Map of days you studied words.",
    whatAr: "خريطة أيام المذاكرة.",
    stepsEn: ["Open Calendar · tap a day to see words."],
    stepsAr: ["افتح التقويم · اضغط يوم عشان تشوف الكلمات."],
  },
  {
    id: "achievements",
    titleEn: "Achievements",
    titleAr: "الإنجازات",
    whatEn: "Categories with 10 levels and % progress.",
    whatAr: "أقسام بعشر مستويات ونسبة تقدّم.",
    stepsEn: ["☰ → Achievements. Tap a category for levels."],
    stepsAr: ["☰ → الإنجازات. اضغط قسم عشان المستويات."],
  },
  {
    id: "focus",
    titleEn: "Focus mode",
    titleAr: "وضع التركيز",
    whatEn: "Hide banners for distraction-free study.",
    whatAr: "إخفاء البنرات للمذاكرة من غير تشتيت.",
    stepsEn: ["☰ → Focus mode, or press F."],
    stepsAr: ["☰ → وضع التركيز، أو حرف F."],
  },
  {
    id: "settings",
    titleEn: "Settings & account",
    titleAr: "الإعدادات والحساب",
    whatEn: "Theme, language, accent, notifications, profile photo.",
    whatAr: "المظهر واللغة واللهجة والإشعارات وصورة الحساب.",
    stepsEn: [
      "☰ → Settings opens a hub. Language, Accent, and Appearance each open their own modal.",
      "Profile photo and name: header avatar button → My account.",
    ],
    stepsAr: [
      "☰ → إعدادات. اللغة واللهجة والمظهر كل واحد في نافذة لوحده.",
      "الصورة والاسم: زرار الأفاتار في الهيدر → حسابي.",
    ],
  },
  {
    id: "group",
    titleEn: "Shared group & offline",
    titleAr: "المجموعة والأوفلاين",
    whatEn: "Shared dictionary, personal progress, admin tools.",
    whatAr: "قاموس مشترك، تقدّم شخصي، أدوات أدمن.",
    stepsEn: [
      "Studied flags are per account. Admins can block users.",
      "Admin panel → Tools: invite link and full backup.",
    ],
    stepsAr: [
      "المُذاكرة لكل حساب. الأدمن يقدر يحظر مستخدمين.",
      "لوحة التحكم → أدوات: رابط الدعوة والنسخة الاحتياطية.",
    ],
  },
];

function GuideCard({ guide, isAr, open, onToggle, index }) {
  const title = isAr ? guide.titleAr : guide.titleEn;
  const what = isAr ? guide.whatAr : guide.whatEn;
  const steps = isAr ? guide.stepsAr : guide.stepsEn;

  return (
    <div
      style={{
        borderRadius: 14,
        background: "var(--card)",
        border: open
          ? "1px solid color-mix(in srgb, var(--accent-1) 45%, transparent)"
          : "1px solid rgba(var(--border-rgb),0.14)",
        boxShadow: open ? "0 8px 24px -12px rgba(0,0,0,0.35)" : "none",
        overflow: "hidden",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 14px",
          margin: 0,
          border: "none",
          background: open ? "color-mix(in srgb, var(--accent-1) 8%, var(--card))" : "transparent",
          cursor: "pointer",
          textAlign: "start",
          fontFamily: "inherit",
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 800,
            color: "#fff",
            background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
          }}
        >
          {index + 1}
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--ink)",
            lineHeight: 1.35,
          }}
        >
          {title}
        </span>
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--input-bg)",
            color: "var(--muted-strong)",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        >
          <ChevronIcon size={14} />
        </span>
      </button>

      {open ? (
        <div style={{ padding: "0 14px 16px", background: "var(--card)" }}>
          <div
            style={{
              height: 1,
              background: "rgba(var(--border-rgb),0.12)",
              marginBottom: 12,
            }}
          />
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "var(--muted-strong)",
            }}
          >
            {what}
          </p>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--accent-1)",
              marginBottom: 8,
            }}
          >
            {tr(isAr, "How to use it", "طريقة الاستخدام")}
          </div>
          <ol
            style={{
              margin: 0,
              paddingInlineStart: 18,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {steps.map((step, i) => (
              <li
                key={i}
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  color: "var(--ink)",
                }}
              >
                {step}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

export default function InfoGuideModal({ isAr, onClose }) {
  const [openIds, setOpenIds] = useState(() => new Set());

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(id) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(0,0,0,0.5)",
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
          maxWidth: 480,
          maxHeight: "min(88dvh, 720px)",
          display: "flex",
          flexDirection: "column",
          background: "var(--card)",
          color: "var(--ink)",
          borderRadius: 20,
          border: "1px solid rgba(var(--border-rgb),0.12)",
          boxShadow: "0 24px 60px -16px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            flexShrink: 0,
            padding: "18px 18px 14px",
            borderBottom: "1px solid rgba(var(--border-rgb),0.12)",
            background: "linear-gradient(180deg, color-mix(in srgb, var(--accent-1) 10%, var(--card)), var(--card))",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  fontFamily: "'Fraunces', serif",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--ink)",
                }}
              >
                {tr(isAr, "How to use the site", "إزاي تستخدم الموقع")}
              </h2>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted-strong)", lineHeight: 1.4 }}>
                {tr(isAr, "Each topic is separate — open only what you need", "كل موضوع لوحده — افتح اللي محتاجه بس")}
              </p>
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
                background: "var(--input-bg)",
                color: "var(--icon-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <XIcon size={18} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setOpenIds(new Set(GUIDES.map((g) => g.id)))}
              style={{
                flex: 1,
                minHeight: 38,
                borderRadius: 10,
                border: "1px solid rgba(var(--border-rgb),0.16)",
                background: "var(--input-bg)",
                color: "var(--ink)",
                fontWeight: 700,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              {tr(isAr, "Expand all", "فتح الكل")}
            </button>
            <button
              type="button"
              onClick={() => setOpenIds(new Set())}
              style={{
                flex: 1,
                minHeight: 38,
                borderRadius: 10,
                border: "1px solid rgba(var(--border-rgb),0.16)",
                background: "var(--input-bg)",
                color: "var(--ink)",
                fontWeight: 700,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              {tr(isAr, "Collapse all", "غلق الكل")}
            </button>
          </div>
        </header>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 14px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            background: "var(--paper)",
          }}
        >
          {GUIDES.map((g, index) => (
            <GuideCard
              key={g.id}
              guide={g}
              isAr={isAr}
              index={index}
              open={openIds.has(g.id)}
              onToggle={() => toggle(g.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
