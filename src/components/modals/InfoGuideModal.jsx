import { useEffect } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD } from "../../lib/config/theme";
import { XIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

/**
 * Each block is a full explanation: what the feature is + how to use it on the site.
 * Not a short list — detailed guides one after another.
 */
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
      "Word type: pick noun, verb, adjective… or enable “More than one type” and enter each meaning with its type.",
      "For English words, Auto-fill loads definition + examples only (not synonyms).",
      "Save. Everyone in the group can see the new entry; your studied progress stays personal.",
    ],
    stepsAr: [
      "دوس + / إضافة (أو حرف N وانت مش جوه خانة كتابة).",
      "اكتب الكلمة والمعنى (مطلوبين). التعريف والأمثلة اختياري.",
      "نوع الكلمة: اسم، فعل، صفة… أو فعّل «أكتر من نوع» وسجّل كل معنى بنوعه.",
      "للكلمات الإنجليزية: «تعبئة تلقائية» بتجيب التعريف والأمثلة فقط (مش المرادفات).",
      "احفظ. المجموعة كلها تشوف الكلمة؛ تقدّم مذاكرتك يفضل شخصي.",
    ],
  },
  {
    id: "pron",
    titleEn: "Pronunciation (Cambridge)",
    titleAr: "النطق (كامبريدج)",
    whatEn: "Hear English words with American or British Cambridge audio.",
    whatAr: "اسمع الكلمات الإنجليزية بنطق كامبريدج أمريكي أو بريطاني.",
    stepsEn: [
      "Settings (☰ → Settings) → English accent (Cambridge): choose American or British as the default.",
      "Tap any speaker icon on a card to play the preferred accent.",
      "Open Zoom on a word: use the US and UK buttons separately.",
      "In Zoom, use the mic to practice saying the word and get a score.",
      "Arabic speech uses the browser voice and the dialect you pick in Zoom.",
    ],
    stepsAr: [
      "الإعدادات (☰ → إعدادات) → لهجة الإنجليزية (كامبريدج): أمريكي أو بريطاني كافتراضي.",
      "اضغط أي سماعة على الكرت لتشغيل اللهجة المختارة.",
      "افتح التكبير على كلمة: أزرار US و UK كل واحد لوحده.",
      "في التكبير استخدم الميكروفون لتمرين نطق الكلمة مع درجة.",
      "نطق العربي من المتصفح حسب اللهجة اللي تختارها في التكبير.",
    ],
  },
  {
    id: "quiz",
    titleEn: "Quiz, flashcards & review",
    titleAr: "اختبار وبطاقات ومراجعة",
    whatEn: "Practice what you studied with quizzes, cards, quick review, random word, and dictation.",
    whatAr: "تمرّن على اللي ذاكرته باختبارات وبطاقات ومراجعة سريعة وكلمة عشوائية وإملاء.",
    stepsEn: [
      "Open More ⋯ → Quiz. Choose time range, MCQ or typing, optionally “due only”.",
      "If a word has several types (noun vs verb), the question tells you which type is required.",
      "Flashcards: flip through studied words. Quick review: recall then reveal.",
      "Random word: one word at a time, no repeats until the set is done; Knew it / Forgot updates SRS and can mark studied.",
      "Dictation: hear → type meaning, or see meaning → type the word.",
    ],
    stepsAr: [
      "المزيد ⋯ → اختبار. اختار المدى الزمني، اختيار أو كتابة، واختياري «مستحقة فقط».",
      "لو الكلمة ليها أكتر من نوع (اسم/فعل)، السؤال بيوضّح النوع المطلوب.",
      "البطاقات: تقليب الكلمات المدروسة. مراجعة سريعة: افتكر بعدين اكشف.",
      "كلمة عشوائية: كلمة بكلمة من غير تكرار لحد ما تخلص المجموعة؛ عرفتها/نسيتها بتحدّث SRS وممكن تعلّم كمُذاكرة.",
      "إملاء: اسمع → اكتب المعنى، أو شوف المعنى → اكتب الكلمة.",
    ],
  },
  {
    id: "todo",
    titleEn: "To-do list & work timer",
    titleAr: "المهام ومؤقت الشغل",
    whatEn: "Personal tasks with a live timer while you work on one of them.",
    whatAr: "مهام شخصية مع مؤقت حيّ وانت شغال على واحدة منها.",
    stepsEn: [
      "Green floating button (bottom) or More ⋯ → To-do.",
      "Add a task, then press Start beside it — a live timer shows how long you’ve been working.",
      "Only one task runs at a time. Stop or mark done to save the elapsed time.",
      "Pin minimizes to a floating bubble that shows the active task and timer.",
      "Export / Import JSON to back up your list.",
    ],
    stepsAr: [
      "الزرار الأخضر العائم (تحت) أو المزيد ⋯ → مهام.",
      "ضيف مهمة، بعدين دوس «ابدأ» جنبها — مؤقت حيّ بيحسب وقت شغلك.",
      "مهمة واحدة بس شغّالة في نفس الوقت. إيقاف أو تعليم كمنتهية بيحفظ الوقت.",
      "تثبيت = فقاعة عائمة فيها المهمة الحالية والوقت.",
      "تصدير / استيراد JSON للنسخ الاحتياطي.",
    ],
  },
  {
    id: "goals",
    titleEn: "Goals, timer & calendar",
    titleAr: "أهداف ومؤقّت وتقويم",
    whatEn: "Track daily study targets, focus time, and which days you studied.",
    whatAr: "تتبّع أهداف المذاكرة اليومية ووقت التركيز وأيام المذاكرة.",
    stepsEn: [
      "Orange Goals button (or More ⋯ → Goals): set daily words and minutes; weekly challenge rotates automatically.",
      "Timer page: countdown or stopwatch. Finished minutes count toward goals and achievements. Pin for a floating bubble.",
      "Calendar: map of days you marked words studied — tap a day to see the words.",
      "Word of the day appears on the main list as a daily highlight from your dictionary.",
    ],
    stepsAr: [
      "زرار الأهداف البرتقالي (أو المزيد ⋯ → أهداف): كلمات ودقائق يومية؛ تحدي الأسبوع بيتغيّر لوحده.",
      "صفحة المؤقّت: عدّ تنازلي أو ساعة. الدقائق بتتحسب في الأهداف والإنجازات. تثبيت = فقاعة.",
      "التقويم: أيام اللي علّمت فيها كلمات — اضغط يوم عشان تشوف الكلمات.",
      "كلمة اليوم تظهر في القائمة الرئيسية كتمييز يومي من قاموسك.",
    ],
  },
  {
    id: "achievements",
    titleEn: "Achievements",
    titleAr: "الإنجازات",
    whatEn: "Progress tracks with ten levels each and a clear percentage.",
    whatAr: "مسارات تقدّم كل واحد فيها عشر مستويات ونسبة واضحة.",
    stepsEn: [
      "Open ☰ → Achievements (or More ⋯).",
      "You’ll see categories: studying, streak, quizzes, perfect scores, SRS, focus time, dictation, favorites.",
      "Each category shows overall %. Tap it to open the ten levels and see exact progress (e.g. 12 / 20 toward the next badge).",
      "Badges unlock automatically when you cross each threshold — no manual claim.",
    ],
    stepsAr: [
      "افتح ☰ → الإنجازات (أو المزيد ⋯).",
      "هتشوف أقسام: مذاكرة، سلسلة أيام، اختبارات، نتائج كاملة، SRS، وقت تركيز، إملاء، مفضلة.",
      "كل قسم فيه نسبة عامة %. اضغطه عشان تفتح العشر مستويات وتشوف التقدّم بالظبط (مثلاً ١٢ / ٢٠ للمستوى الجاي).",
      "الشارات بتتفتح لوحدها لما تعدّي كل هدف — مفيش مطالبة يدوي.",
    ],
  },
  {
    id: "focus",
    titleEn: "Focus mode",
    titleAr: "وضع التركيز",
    whatEn: "Hide banners and extras so only search and words remain.",
    whatAr: "إخفاء البنرات والإضافات عشان يفضل البحث والكلمات بس.",
    stepsEn: [
      "☰ → Focus mode, or press F when not typing in a field.",
      "Site banner and floating extras hide; dictionary stays usable.",
      "Exit with the chip at the top or press F again.",
    ],
    stepsAr: [
      "☰ → وضع التركيز، أو حرف F وانت مش بتكتب في خانة.",
      "بانر الموقع والإضافات العائمة بتختفي؛ القاموس يفضل شغّال.",
      "اخرج من الشريحة فوق أو دوس F تاني.",
    ],
  },
  {
    id: "settings",
    titleEn: "Settings & account",
    titleAr: "الإعدادات والحساب",
    whatEn: "Language, theme, accent, notifications, and your password.",
    whatAr: "اللغة والمظهر واللهجة والإشعارات وكلمة المرور.",
    stepsEn: [
      "☰ → Settings: light/dark, site language (menus only), English Cambridge accent, color theme.",
      "Notifications: enable study reminders if the browser allows.",
      "☰ → My account: change display name. Password shows as •••••••• with a Change button beside it (the real password is never stored in plain text).",
      "Admins also see Admin panel and Site banner under the menu.",
    ],
    stepsAr: [
      "☰ → إعدادات: فاتح/داكن، لغة الموقع (للقوائم)، لهجة كامبريدج، لون الواجهة.",
      "الإشعارات: تذكيرات مذاكرة لو المتصفح يسمح.",
      "☰ → حسابي: غيّر الاسم الظاهر. كلمة المرور تظهر •••••••• وزرار «تغيير» جنبها (الباسورد الحقيقي مش متخزّن نص صريح).",
      "الأدمن كمان يشوف لوحة التحكم وبانر الموقع من القائمة.",
    ],
  },
  {
    id: "group",
    titleEn: "Shared group & offline",
    titleAr: "المجموعة والأوفلاين",
    whatEn: "One dictionary for the group; progress is personal; cache helps offline.",
    whatAr: "قاموس واحد للمجموعة؛ التقدّم شخصي؛ والكاش بيساعد من غير نت.",
    stepsEn: [
      "Everyone shares the same word list. Studied flags, favorites, and achievements are per account.",
      "Leaderboard (More ⋯) compares progress inside the group.",
      "If the network drops, a cached copy of the dictionary may still open for browsing.",
      "Admins can download a full backup (words + accounts + log) from the Admin panel → Tools.",
    ],
    stepsAr: [
      "الكل بيشارك نفس قائمة الكلمات. المُذاكرة والمفضلة والإنجازات لكل حساب لوحده.",
      "لوحة الصدارة (المزيد ⋯) بتقارن التقدّم جوه المجموعة.",
      "لو النت وقع، نسخة مخزّنة من القاموس ممكن تفضل تفتح للتصفح.",
      "الأدمن ينزّل نسخة احتياطية كاملة من لوحة التحكم → أدوات.",
    ],
  },
];

export default function InfoGuideModal({ isAr, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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
          overflow: "auto",
          background: CARD,
          borderRadius: 16,
          padding: "18px 16px 28px",
          boxShadow: "0 20px 50px -12px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, position: "sticky", top: 0, background: CARD, zIndex: 1, paddingBottom: 8 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: INK }}>
              {tr(isAr, "How to use the site", "إزاي تستخدم الموقع")}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
              {tr(isAr, "Each section explains a feature and the steps on the site", "كل جزء بيشرح ميزة وخطوات استخدامها على الموقع")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--muted)" }}
          >
            <XIcon size={22} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {GUIDES.map((g, index) => (
            <article
              key={g.id}
              style={{
                padding: "14px 14px 16px",
                borderRadius: 14,
                border: "1px solid rgba(var(--border-rgb),0.12)",
                background: "var(--input-bg)",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    width: 26,
                    height: 26,
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
                <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: INK }}>
                  {tr(isAr, g.titleEn, g.titleAr)}
                </h3>
              </div>

              <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "var(--muted-strong)", lineHeight: 1.5 }}>
                {tr(isAr, g.whatEn, g.whatAr)}
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
                {(isAr ? g.stepsAr : g.stepsEn).map((step, i) => (
                  <li key={i} style={{ fontSize: 13.5, color: INK, lineHeight: 1.5 }}>
                    {step}
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
