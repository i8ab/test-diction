import { useEffect, useState } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD } from "../../lib/config/theme";
import { XIcon, ChevronIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

const GUIDES = [
  {
    id: "search",
    titleEn: "Search & filters",
    titleAr: "البحث والفلاتر",
    whatEn: "Find any word quickly and narrow the list to what you need right now.",
    whatAr: "تلاقي أي كلمة بسرعة وتضيّق القائمة على اللي محتاجه دلوقتي.",
    stepsEn: [
      "Use the search box at the top of the dictionary list. Type the English word or the Arabic meaning.",
      "If your browser supports it, tap the mic icon to search by voice.",
      "Filters under the search bar: All · Studied · Not studied · Favorites · Due today.",
      "“Due today” shows studied words the spaced-repetition system wants you to review now.",
    ],
    stepsAr: [
      "خانة البحث فوق قائمة الكلمات. اكتب الكلمة الإنجليزية أو المعنى بالعربي.",
      "لو المتصفح بيدعم، دوس أيقونة الميكروفون للبحث بالصوت.",
      "الفلاتر تحت البحث: الكل · درست · لسه · مفضلة · مستحقة.",
      "«مستحقة» = كلمات مدروسة نظام التكرار المتباعد عايزك تراجعها دلوقتي.",
    ],
  },
  {
    id: "cards",
    titleEn: "Word cards",
    titleAr: "كروت الكلمات",
    whatEn: "Each entry is a card: word, meaning, type badges, and actions.",
    whatAr: "كل مدخل كرت: الكلمة، المعنى، نوعها، والأزرار.",
    stepsEn: [
      "Tap a card to expand definition, examples, synonyms, and antonyms.",
      "Star = favorite · Eye = mark studied / unstudied · Zoom = large practice view.",
      "Speaker icons play pronunciation (Cambridge for English when available).",
      "In the expanded card you can write a personal note saved on this device.",
    ],
    stepsAr: [
      "اضغط الكرت لفتح التعريف والأمثلة والمرادفات والأضداد.",
      "نجمة = مفضلة · عين = علّم كمُذاكرة / إلغاء · تكبير = عرض كبير للتمرين.",
      "أيقونات السماعة بتشغّل النطق (كامبريدج للإنجليزي لما يكون متاح).",
      "جوه الكرت المفتوح تقدر تكتب ملاحظة شخصية بتتحفظ على الجهاز.",
    ],
  },
  {
    id: "add",
    titleEn: "Adding & editing words",
    titleAr: "إضافة وتعديل الكلمات",
    whatEn: "Grow the shared dictionary with clear meanings and optional structure.",
    whatAr: "زوّد القاموس المشترك بمعاني واضحة وهيكل اختياري.",
    stepsEn: [
      "Tap + / Add (or press N when not typing in a field).",
      "Fill Word and Meaning (required). Definition and examples are optional.",
      "Word type: pick noun, verb, adjective… or enable “More than one type”.",
      "For English words, Auto-fill loads definition + examples only.",
      "Save. Everyone sees the entry; your studied progress stays personal.",
    ],
    stepsAr: [
      "دوس + / إضافة (أو حرف N وانت مش جوه خانة كتابة).",
      "اكتب الكلمة والمعنى (مطلوبين). التعريف والأمثلة اختياري.",
      "نوع الكلمة: اسم، فعل، صفة… أو فعّل «أكتر من نوع».",
      "للكلمات الإنجليزية: «تعبئة تلقائية» = تعريف وأمثلة فقط.",
      "احفظ. المجموعة تشوف الكلمة؛ مذاكرتك تفضل شخصية.",
    ],
  },
  {
    id: "pron",
    titleEn: "Pronunciation (Cambridge)",
    titleAr: "النطق (كامبريدج)",
    whatEn: "Hear English words with American or British Cambridge audio.",
    whatAr: "اسمع الكلمات الإنجليزية بنطق كامبريدج أمريكي أو بريطاني.",
    stepsEn: [
      "Settings → English accent (Cambridge): American or British default.",
      "Tap any speaker icon to play the preferred accent.",
      "Zoom view: separate US and UK buttons + mic practice score.",
    ],
    stepsAr: [
      "الإعدادات → لهجة الإنجليزية (كامبريدج): أمريكي أو بريطاني.",
      "اضغط أي سماعة لتشغيل اللهجة المختارة.",
      "العرض الكبير: أزرار US و UK + تمرين ميكروفون مع درجة.",
    ],
  },
  {
    id: "quiz",
    titleEn: "Quiz, flashcards & review",
    titleAr: "اختبار وبطاقات ومراجعة",
    whatEn: "Practice studied words with quizzes, cards, random word, and dictation.",
    whatAr: "تمرّن على الكلمات المدروسة باختبارات وبطاقات وكلمة عشوائية وإملاء.",
    stepsEn: [
      "More ⋯ → Quiz: pick range, MCQ or typing, optional due-only.",
      "Multi-type words: the question labels the required type (noun/verb).",
      "Random word: no repeats until the set is done.",
      "Dictation: hear → type meaning, or see meaning → type the word.",
    ],
    stepsAr: [
      "المزيد ⋯ → اختبار: المدى، اختيار أو كتابة، ومستحقة فقط اختياري.",
      "الكلمات متعددة النوع: السؤال بيوضّح النوع المطلوب.",
      "كلمة عشوائية: من غير تكرار لحد ما تخلص المجموعة.",
      "إملاء: اسمع → اكتب المعنى، أو شوف المعنى → اكتب الكلمة.",
    ],
  },
  {
    id: "todo",
    titleEn: "To-do list & work timer",
    titleAr: "المهام ومؤقت الشغل",
    whatEn: "Personal tasks with a live timer on the active task.",
    whatAr: "مهام شخصية مع مؤقت حيّ على المهمة الشغّالة.",
    stepsEn: [
      "Green floating button or More ⋯ → To-do.",
      "Start beside a task → live timer. One active task at a time.",
      "Pin = floating bubble with active task + time.",
    ],
    stepsAr: [
      "الزرار الأخضر العائم أو المزيد ⋯ → مهام.",
      "ابدأ جنب مهمة → مؤقت حيّ. مهمة واحدة في نفس الوقت.",
      "تثبيت = فقاعة فيها المهمة والوقت.",
    ],
  },
  {
    id: "goals",
    titleEn: "Goals, timer & calendar",
    titleAr: "أهداف ومؤقّت وتقويم",
    whatEn: "Daily targets, focus minutes, and a study calendar.",
    whatAr: "أهداف يومية ودقائق تركيز وتقويم مذاكرة.",
    stepsEn: [
      "Orange Goals button: daily words/minutes and weekly challenge.",
      "Timer: countdown or stopwatch; minutes count toward goals.",
      "Calendar: days you marked words studied.",
    ],
    stepsAr: [
      "زرار الأهداف البرتقالي: كلمات/دقائق يومية وتحدي أسبوعي.",
      "المؤقّت: عدّ تنازلي أو ساعة؛ الدقائق بتتحسب في الأهداف.",
      "التقويم: أيام اللي علّمت فيها كلمات كمدروسة.",
    ],
  },
  {
    id: "achievements",
    titleEn: "Achievements",
    titleAr: "الإنجازات",
    whatEn: "Categories with ten levels each and live percent progress.",
    whatAr: "أقسام وكل قسم عشر مستويات مع نسبة تقدّم حية.",
    stepsEn: [
      "☰ → Achievements. Tap a category to expand levels.",
      "Each level shows current / target and % toward the next badge.",
    ],
    stepsAr: [
      "☰ → الإنجازات. اضغط قسم عشان تفتح المستويات.",
      "كل مستوى فيه الحالي / الهدف ونسبة للمستوى الجاي.",
    ],
  },
  {
    id: "focus",
    titleEn: "Focus mode",
    titleAr: "وضع التركيز",
    whatEn: "Hide banners and extras for distraction-free study.",
    whatAr: "إخفاء البنرات والإضافات للمذاكرة من غير تشتيت.",
    stepsEn: [
      "☰ → Focus mode, or press F (when not typing in a field).",
      "Exit with the top chip or F again.",
    ],
    stepsAr: [
      "☰ → وضع التركيز، أو حرف F (مش جوه خانة كتابة).",
      "اخرج من الشريحة فوق أو F تاني.",
    ],
  },
  {
    id: "settings",
    titleEn: "Settings & account",
    titleAr: "الإعدادات والحساب",
    whatEn: "Theme, language, Cambridge accent, notifications, profile photo and password.",
    whatAr: "المظهر واللغة ولهجة كامبريدج والإشعارات وصورة الحساب وكلمة المرور.",
    stepsEn: [
      "☰ → Settings for theme, site language, and English accent.",
      "Open account from the profile photo button in the header (not from the menu list).",
      "In My account: name, password (Change beside the mask), and profile photo upload.",
    ],
    stepsAr: [
      "☰ → إعدادات للمظهر ولغة الموقع ولهجة الإنجليزية.",
      "افتح الحساب من زرار صورة الملف في الهيدر (مش من قائمة المينيو).",
      "في حسابي: الاسم، كلمة المرور (تغيير جنب القناع)، ورفع صورة الملف.",
    ],
  },
  {
    id: "group",
    titleEn: "Shared group & offline",
    titleAr: "المجموعة والأوفلاين",
    whatEn: "Shared dictionary; personal progress; offline cache; admin tools.",
    whatAr: "قاموس مشترك؛ تقدّم شخصي؛ كاش أوفلاين؛ أدوات الأدمن.",
    stepsEn: [
      "Studied words and achievements are per account.",
      "Admins can block users so they cannot open the site.",
      "Admin panel → Tools for invite link and full backup.",
    ],
    stepsAr: [
      "المُذاكرة والإنجازات لكل حساب لوحده.",
      "الأدمن يقدر يحظر مستخدمين عشان ميفتحوش الموقع.",
      "لوحة التحكم → أدوات: رابط الدعوة والنسخة الاحتياطية.",
    ],
  },
];

function GuideSection({ guide, isAr, open, onToggle, index }) {
  const title = isAr ? guide.titleAr : guide.titleEn;
  const what = isAr ? guide.whatAr : guide.whatEn;
  const steps = isAr ? guide.stepsAr : guide.stepsEn;

  return (
    <article
      style={{
        borderRadius: 14,
        border: "1px solid rgba(var(--border-rgb),0.14)",
        background: open ? "color-mix(in srgb, var(--accent-1) 6%, var(--input-bg))" : "var(--input-bg)",
        overflow: "hidden",
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
          gap: 10,
          padding: "12px 14px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "start",
          font: "inherit",
          color: "inherit",
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 800,
            color: "#fff",
            background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
            flexShrink: 0,
          }}
        >
          {index + 1}
        </span>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 800, color: INK }}>{title}</span>
        <span
          style={{
            display: "inline-flex",
            color: "var(--muted)",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <ChevronIcon size={16} />
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 14px 14px", borderTop: "1px solid rgba(var(--border-rgb),0.1)" }}>
          <p style={{ margin: "12px 0 10px", fontSize: 13.5, color: "var(--muted-strong)", lineHeight: 1.55 }}>
            {what}
          </p>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--accent-1)",
              marginBottom: 6,
            }}
          >
            {tr(isAr, "How to use it", "طريقة الاستخدام")}
          </div>
          <ol style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 7 }}>
            {steps.map((step, i) => (
              <li key={i} style={{ fontSize: 13.5, color: INK, lineHeight: 1.5 }}>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}

export default function InfoGuideModal({ isAr, onClose }) {
  const [openIds, setOpenIds] = useState(() => new Set([GUIDES[0].id]));

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

  function expandAll() {
    setOpenIds(new Set(GUIDES.map((g) => g.id)));
  }

  function collapseAll() {
    setOpenIds(new Set());
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "12px 12px max(12px, env(safe-area-inset-bottom))",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <BodyScrollLock />
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "92dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: CARD,
          borderRadius: 16,
          boxShadow: "0 20px 50px -12px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            padding: "16px 16px 12px",
            borderBottom: "1px solid rgba(var(--border-rgb),0.12)",
            background: CARD,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: INK }}>
                {tr(isAr, "How to use the site", "إزاي تستخدم الموقع")}
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.4 }}>
                {tr(isAr, "Tap a section to open or close it", "اضغط على قسم لفتحه أو غلقه")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={tr(isAr, "Close", "إغلاق")}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--muted)", flexShrink: 0 }}
            >
              <XIcon size={22} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={expandAll}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(var(--border-rgb),0.18)",
                background: "var(--input-bg)",
                color: INK,
                cursor: "pointer",
              }}
            >
              {tr(isAr, "Expand all", "فتح الكل")}
            </button>
            <button
              type="button"
              onClick={collapseAll}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(var(--border-rgb),0.18)",
                background: "var(--input-bg)",
                color: INK,
                cursor: "pointer",
              }}
            >
              {tr(isAr, "Collapse all", "غلق الكل")}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
          {GUIDES.map((g, index) => (
            <GuideSection
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
