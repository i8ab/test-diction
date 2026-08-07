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
    titleEn: "Quiz",
    titleAr: "الاختبار",
    whatEn: "Build questions from your studied words to check recall.",
    whatAr: "يبني أسئلة من كلماتك المدروسة عشان تختبر تذكّرك.",
    stepsEn: [
      "Open More ⋯ → Quiz.",
      "Choose time range, multiple-choice or typing, and optionally “due only”.",
      "If a word has more than one type (noun/verb…), the question tells you which type is required.",
      "Correct and wrong answers update spaced-repetition (SRS) for that word.",
    ],
    stepsAr: [
      "افتح المزيد ⋯ → اختبار.",
      "اختار المدى الزمني، اختيار من متعدد أو كتابة، واختياري «مستحقة فقط».",
      "لو الكلمة ليها أكتر من نوع (اسم/فعل…)، السؤال بيوضّح النوع المطلوب.",
      "الإجابات الصح والغلط بتحدّث التكرار المتباعد (SRS) للكلمة.",
    ],
  },
  {
    id: "flashcards",
    titleEn: "Flashcards",
    titleAr: "البطاقات التعليمية",
    whatEn: "Flip through studied words for light, focused review.",
    whatAr: "تقليب الكلمات المدروسة لمراجعة خفيفة ومركّزة.",
    stepsEn: [
      "Open More ⋯ → Flashcards.",
      "See one side of the card, then flip to reveal the other.",
      "Use it for passive review without scoring pressure.",
    ],
    stepsAr: [
      "افتح المزيد ⋯ → بطاقات.",
      "شوف وجه الكرت، بعدين اقلبه عشان تظهر الوجه التاني.",
      "مناسب لمراجعة هادية من غير ضغط درجات.",
    ],
  },
  {
    id: "quick",
    titleEn: "Quick review",
    titleAr: "مراجعة سريعة",
    whatEn: "Short recall sessions for due words.",
    whatAr: "جلسات تذكّر قصيرة للكلمات المستحقة.",
    stepsEn: [
      "Open More ⋯ → Quick review.",
      "You see the word first — try to recall the meaning.",
      "Reveal, then choose “I knew it” or “Still learning”.",
      "Best for 2–5 minutes on due words.",
    ],
    stepsAr: [
      "افتح المزيد ⋯ → مراجعة سريعة.",
      "تشوف الكلمة الأول — حاول تفتكر المعنى.",
      "اكشف المعنى، بعدين اختار «عرفتها» أو «لسه بتعلّم».",
      "مناسبة لـ ٢–٥ دقايق على الكلمات المستحقة.",
    ],
  },
  {
    id: "random",
    titleEn: "Random word",
    titleAr: "كلمة عشوائية",
    whatEn: "Practice one word at a time without repeating until the set is done.",
    whatAr: "تمرين كلمة بكلمة من غير تكرار لحد ما تخلص المجموعة.",
    stepsEn: [
      "Open More ⋯ → Random word.",
      "Tap the card to reveal the meaning.",
      "“Knew it” / “Forgot” updates SRS and can mark the word studied.",
      "Keyboard: Space/Enter = reveal · 1 = knew · 2 = forgot.",
    ],
    stepsAr: [
      "افتح المزيد ⋯ → كلمة عشوائية.",
      "اضغط الكرت لإظهار المعنى.",
      "«عرفتها» / «نسيتها» بيحدّثوا SRS وممكن يعلّموا الكلمة كمُذاكرة.",
      "كيبورد: مسافة/Enter = إظهار · 1 = عرفتها · 2 = نسيتها.",
    ],
  },
  {
    id: "dictation",
    titleEn: "Listening & dictation",
    titleAr: "استماع وإملاء",
    whatEn: "Type what you hear, or type the word from its meaning.",
    whatAr: "اكتب اللي بتسمعه، أو اكتب الكلمة من معناها.",
    stepsEn: [
      "Open More ⋯ → Dictation.",
      "Mode 1: Hear the word → type its meaning.",
      "Mode 2: See the meaning → type the word.",
      "Each answer updates spaced-repetition for that word.",
    ],
    stepsAr: [
      "افتح المزيد ⋯ → استماع وإملاء.",
      "وضع ١: اسمع الكلمة → اكتب معناها.",
      "وضع ٢: شوف المعنى → اكتب الكلمة.",
      "كل إجابة بتحدّث التكرار المتباعد للكلمة.",
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
    titleEn: "Goals & challenges",
    titleAr: "الأهداف والتحديات",
    whatEn: "Daily word and minute targets, plus a rotating weekly challenge.",
    whatAr: "أهداف يومية للكلمات والدقائق، مع تحدي أسبوعي يتغيّر.",
    stepsEn: [
      "Open the orange Goals button, or More ⋯ → Goals.",
      "Set daily words and timer minutes.",
      "Weekly challenge rotates automatically. Pin keeps a small progress bubble.",
    ],
    stepsAr: [
      "افتح الزرار البرتقالي، أو المزيد ⋯ → أهداف.",
      "حدّد كلمات اليوم ودقائق المؤقّت.",
      "تحدي الأسبوع بيتغيّر لوحده. التثبيت = فقاعة تقدّم صغيرة.",
    ],
  },
  {
    id: "timer",
    titleEn: "Study timer",
    titleAr: "مؤقّت المذاكرة",
    whatEn: "Countdown or stopwatch for focused study sessions.",
    whatAr: "عدّ تنازلي أو ساعة توقيت لجلسات مذاكرة مركّزة.",
    stepsEn: [
      "Open Timer from the tools / More menu.",
      "Use countdown or stopwatch. Finished minutes count toward goals and achievements.",
      "Pin shrinks it to a floating bubble so you can keep using the dictionary.",
    ],
    stepsAr: [
      "افتح المؤقّت من الأدوات / المزيد.",
      "عدّ تنازلي أو ساعة. الدقائق بتتحسب في الأهداف والإنجازات.",
      "التثبيت يصغّره لفقاعة عائمة وتكمل استخدام القاموس.",
    ],
  },
  {
    id: "calendar",
    titleEn: "Calendar",
    titleAr: "التقويم",
    whatEn: "A monthly map of days you marked words as studied.",
    whatAr: "خريطة شهرية للأيام اللي علّمت فيها كلمات كمدروسة.",
    stepsEn: [
      "Open Calendar from tools / More.",
      "Tap a day to see which words you studied.",
      "Pin for a mini calendar widget on screen.",
    ],
    stepsAr: [
      "افتح التقويم من الأدوات / المزيد.",
      "اضغط يوم عشان تشوف الكلمات اللي ذاكرتها.",
      "تثبيت = ودجت تقويم صغير على الشاشة.",
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
          textDecoration: "none",
          WebkitAppearance: "none",
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
        <span
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: 800,
            color: INK,
            textDecoration: "none",
            opacity: 1,
            lineHeight: 1.35,
            letterSpacing: "0.01em",
          }}
        >
          {title}
        </span>
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
