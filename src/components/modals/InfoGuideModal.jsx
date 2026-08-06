import { useState, useEffect } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS } from "../../lib/config/theme";
import { XIcon, BookIcon, QuizIcon, ClockIcon, CalendarIcon, CheckIcon, StatsIcon, FlameIcon, SearchIcon, MicIcon, LayersIcon, StarIcon, WandIcon, TrophyIcon, UsersIcon, GlobeIcon, DownloadIcon, WifiOffIcon, SpeakerIcon } from "../common/Icons";
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
      "When adding a word: pick a type (noun/verb/…) or enable “More than one type” for multiple meanings.",
      "Auto-fill (English words) fills definition + examples only — not synonyms.",
    ],
    bodyAr: [
      "بدّل EN→AR / AR→AR من تبويبات القسم.",
      "ابحث بالكلمة أو المعنى. الميكروفون للبحث الصوتي لو متاح.",
      "اضغط الكرت لفتح التعريف والأمثلة والمرادفات.",
      "نجمة = مفضلة · عين = علّم كمدروسة · تكبير = عرض كبير + تمرين نطق.",
      "عند الإضافة: اختار نوع الكلمة (اسم/فعل/…) أو «أكتر من نوع» لمعاني متعددة.",
      "التعبئة التلقائية (للكلمات الإنجليزية) بتجيب التعريف والأمثلة فقط — مش المرادفات.",
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
      "Quiz builds questions from your studied words (multiple choice or typing).",
      "If a word has more than one type (noun/verb…), the quiz tells you which type it is asking for.",
      "Flashcards flip through cards for passive review.",
      "Answers update spaced-repetition levels automatically.",
    ],
    bodyAr: [
      "الاختبار بيبني أسئلة من كلماتك المدروسة (اختيار أو كتابة).",
      "لو الكلمة ليها أكتر من نوع (اسم/فعل…)، السؤال بيوضّح النوع المطلوب.",
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
      "Finished countdown minutes count toward daily goals and achievements.",
    ],
    bodyAr: [
      "عدّ تنازلي أو ساعة توقيت لجلسات المذاكرة.",
      "تثبيت = فقاعة عائمة وتقدر تكمل تصفح القاموس.",
      "دقائق العدّ التنازلي بتتحسب في أهداف اليوم والإنجازات.",
    ],
  },
  {
    id: "calendar",
    icon: CalendarIcon,
    titleEn: "Calendar & Word of the day",
    titleAr: "التقويم وكلمة اليوم",
    bodyEn: [
      "Monthly map of days you marked words as studied. Tap a day to see which words.",
      "Pin for a mini calendar widget.",
      "Word of the day highlights a fresh entry from your dictionary each day.",
    ],
    bodyAr: [
      "خريطة شهرية للأيام اللي علّمت فيها كلمات كمدروسة. اضغط يوم عشان تشوف الكلمات.",
      "تثبيت = ودجت تقويم صغير.",
      "كلمة اليوم بتبرز مدخل جديد من قاموسك كل يوم.",
    ],
  },
  {
    id: "goals",
    icon: FlameIcon,
    titleEn: "Goals & challenges",
    titleAr: "أهداف وتحديات",
    bodyEn: [
      "Orange floating button (or More ⋯ → Goals): daily words, timer minutes, weekly targets.",
      "Weekly challenge rotates automatically.",
      "Pin keeps a small progress bubble on screen.",
    ],
    bodyAr: [
      "الزرار البرتقالي العائم (أو المزيد ⋯ → أهداف): كلمات يومية، دقائق مؤقّت، هدف أسبوعي.",
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
      "Green floating button (bottom) opens to-dos anywhere. Also under More ⋯.",
      "Press Start on a task to run a live timer beside it (how long you’ve been working).",
      "Only one task runs at a time. Stop or complete to bank the time.",
      "Export/Import JSON for backup. Pin for a floating mini list.",
    ],
    bodyAr: [
      "الزرار الأخضر العائم (تحت) بيفتح المهام من أي مكان. كمان من المزيد ⋯.",
      "دوس «ابدأ» جنب مهمة عشان مؤقت حيّ يعدّ وقت الشغل عليها.",
      "مهمة واحدة بس شغّالة في نفس الوقت. إيقاف أو إنهاء بيحفظ الوقت.",
      "تصدير/استيراد JSON للنسخ الاحتياطي. تثبيت = قائمة مصغّرة عائمة.",
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
    icon: SpeakerIcon,
    titleEn: "Pronunciation (Cambridge)",
    titleAr: "النطق (كامبريدج)",
    bodyEn: [
      "Speaker icons play Cambridge Dictionary audio for English words (US or UK).",
      "Settings → English accent (Cambridge): choose American or British as default.",
      "Zoom view: separate US / UK buttons, plus mic practice with a score.",
      "Arabic uses browser speech with your chosen dialect. Browser TTS is the fallback if Cambridge is unavailable.",
    ],
    bodyAr: [
      "أيقونات السماعة بتشغّل نطق قاموس كامبريدج للكلمات الإنجليزية (أمريكي أو بريطاني).",
      "الإعدادات → لهجة الإنجليزية (كامبريدج): اختار أمريكي أو بريطاني كافتراضي.",
      "العرض الكبير: أزرار US / UK منفصلة + ميكروفون لتمرين النطق مع درجة.",
      "العربي بيستخدم نطق المتصفح حسب اللهجة. لو كامبريدج مش متاح، في احتياطي من المتصفح.",
    ],
  },
  {
    id: "dictation",
    icon: MicIcon,
    titleEn: "Listening & Dictation",
    titleAr: "استماع وإملاء",
    bodyEn: [
      "Open from More ⋯ → Dictation.",
      "Mode 1: Hear the word → type its meaning.",
      "Mode 2: See the meaning → type the word.",
      "Each answer updates spaced-repetition (SRS) for that word.",
    ],
    bodyAr: [
      "من المزيد ⋯ → استماع وإملاء.",
      "وضع ١: اسمع الكلمة → اكتب معناها.",
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
      "No repeats until every word in the set is shown. Prefers unstudied / due words.",
      "“Knew it” / “Forgot” marks studied and updates SRS. You can also “Mark as studied” alone.",
      "Keyboard: Space/Enter = reveal · 1 = knew · 2 = forgot.",
    ],
    bodyAr: [
      "المزيد ⋯ → كلمة عشوائية لممارسة سريعة كلمة بكلمة.",
      "من غير تكرار لحد ما تخلص كل كلمات المجموعة. يفضّل غير المُذاكرة والمستحقة.",
      "«عرفتها» / «نسيتها» بعلّموا كمُذاكرة ويحدّثوا SRS. وفي زر «علّم كمُذاكرة» لوحده.",
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
      "Split into categories (studying, streak, quizzes, SRS, timer, dictation, favorites…).",
      "Each category has 10 levels. Tap one to see % progress toward the next level.",
      "Badges unlock automatically as you hit each threshold.",
    ],
    bodyAr: [
      "قائمة الهيدر (☰) → الإنجازات، أو المزيد ⋯ → الإنجازات.",
      "متقسمة لأقسام (مذاكرة، سلسلة أيام، اختبارات، SRS، مؤقّت، إملاء، مفضلة…).",
      "كل قسم فيه ١٠ مستويات. اضغط قسم عشان تشوف نسبة قربك من المستوى الجاي.",
      "الشارات بتتفتح لوحدها لما توصل لكل هدف.",
    ],
  },
  {
    id: "leaderboard",
    icon: TrophyIcon,
    titleEn: "Leaderboard",
    titleAr: "لوحة الصدارة",
    bodyEn: [
      "Compare progress with others in your group (studied words, streaks, quizzes).",
      "Open from More ⋯ or tools menu when available.",
    ],
    bodyAr: [
      "قارن تقدّمك مع باقي أفراد مجموعتك (كلمات، سلاسل، اختبارات).",
      "من المزيد ⋯ أو قائمة الأدوات لما تكون متاحة.",
    ],
  },
  {
    id: "group",
    icon: UsersIcon,
    titleEn: "Shared dictionary",
    titleAr: "قاموس مشترك",
    bodyEn: [
      "One shared dictionary for your group; each person’s studied words and progress stay personal.",
      "Admins can manage accounts, requests, and the site-wide banner.",
    ],
    bodyAr: [
      "قاموس واحد مشترك لمجموعتك؛ كلمات كل شخص المدروسة وتقدّمه شخصيين.",
      "الأدمن يدير الحسابات والطلبات وبانر الموقع.",
    ],
  },
  {
    id: "lang",
    icon: GlobeIcon,
    titleEn: "Language & appearance",
    titleAr: "اللغة والمظهر",
    bodyEn: [
      "Settings → Site language: English / Arabic / … for menus (not dictionary content).",
      "Light/Dark mode and color theme accents.",
      "English accent (Cambridge) US or UK for speaker buttons.",
    ],
    bodyAr: [
      "الإعدادات → لغة الموقع: إنجليزي / عربي / … للقوائم (مش محتوى القاموس).",
      "وضع فاتح/داكن وألوان الواجهة.",
      "لهجة الإنجليزية (كامبريدج) أمريكي أو بريطاني لأزرار السماعة.",
    ],
  },
  {
    id: "offline",
    icon: WifiOffIcon,
    titleEn: "Offline & backup",
    titleAr: "بدون إنترنت والنسخ",
    bodyEn: [
      "Cached dictionary data stays available if the connection drops.",
      "Export/import CSV (and to-do JSON) so your data remains yours.",
    ],
    bodyAr: [
      "نسخة مخزّنة من القاموس تفضل متاحة لو الاتصال وقع.",
      "تصدير/استيراد CSV (وJSON للمهام) عشان بياناتك تفضل معاك.",
    ],
  },
  {
    id: "reminders",
    icon: StatsIcon,
    titleEn: "Smart reminders",
    titleAr: "تذكيرات ذكية",
    bodyEn: [
      "Settings → Notifications: enable study reminders (where the browser allows).",
      "SRS brings due words back before you forget them — use Due filter + Quick review.",
    ],
    bodyAr: [
      "الإعدادات → الإشعارات: فعّل تذكيرات المذاكرة (حسب دعم المتصفح).",
      "نظام SRS بيرجّع الكلمات المستحقة قبل ما تنساها — فلتر مستحقة + مراجعة سريعة.",
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
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "12px 12px max(12px, env(safe-area-inset-bottom))",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <BodyScrollLock />
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "92dvh",
          overflow: "hidden",
          background: CARD,
          borderRadius: 16,
          padding: "18px 16px 20px",
          boxShadow: "0 20px 50px -12px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: INK }}>
              {tr(isAr, "Information", "معلومات")}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
              {tr(isAr, "Guides for every main feature", "دليل لكل ميزة أساسية")}
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

        <div style={{ display: "flex", gap: 10, minHeight: 0, flex: 1, marginTop: 10 }}>
          <div
            style={{
              width: 128,
              flexShrink: 0,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              paddingInlineEnd: 4,
            }}
          >
            {SECTIONS.map((s) => {
              const on = s.id === active;
              const SIcon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(s.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 8px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    textAlign: "start",
                    font: "inherit",
                    fontSize: 11.5,
                    fontWeight: on ? 700 : 600,
                    background: on ? "var(--accent-1-soft)" : "transparent",
                    color: on ? "var(--accent-1)" : "var(--muted-strong)",
                  }}
                >
                  <SIcon size={13} />
                  <span style={{ lineHeight: 1.25 }}>{isAr ? s.titleAr : s.titleEn}</span>
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingInlineStart: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{
                width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                background: "color-mix(in srgb, var(--accent-1) 16%, transparent)", color: "var(--accent-1)",
              }}>
                <Icon size={16} />
              </span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: INK }}>{title}</h3>
            </div>
            <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              {body.map((line, i) => (
                <li key={i} style={{ fontSize: 13.5, color: "var(--muted-strong)", lineHeight: 1.5 }}>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
