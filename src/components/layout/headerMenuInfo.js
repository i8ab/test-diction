/**
 * In-app help content for HeaderMenu info panel (EN / AR).
 * Icons are resolved in HeaderMenu from the shared Icons module.
 */
export const INFO_SECTION_DEFS = [
  {
    id: "basics",
    icon: "BookIcon",
    titleEn: "Dictionary basics",
    titleAr: "أساسيات القاموس",
    bodyEn: [
      "Switch EN→AR / AR→AR from the section tabs.",
      "Search by word, meaning, definition, or example. Mic = voice search when available.",
      "Filters: All · Studied · Not studied · Favorites · Due · Weak + POS, date added, and sort.",
      "Star = favorite · Eye = studied · Zoom = big view + practice & recording.",
      "Add word: choose type (noun/verb/…) or “More than one type”.",
    ],
    bodyAr: [
      "بدّل EN→AR / AR→AR من تبويبات القسم.",
      "ابحث بالكلمة أو المعنى أو التعريف أو المثال. الميكروفون = بحث صوتي لو متاح.",
      "الفلاتر: الكل · درست · لسه · مفضلة · مستحقة · ضعيفة + نوع الكلمة وتاريخ الإضافة والترتيب.",
      "نجمة = مفضلة · عين = مُذاكرة · تكبير = عرض كبير + تمرين وتسجيل.",
      "إضافة كلمة: اختار النوع (اسم/فعل/…) أو «أكتر من نوع».",
    ],
  },
  {
    id: "practice",
    icon: "QuizIcon",
    titleEn: "Practice & SRS",
    titleAr: "التدريب وSRS",
    bodyEn: [
      "Quiz, flashcards, quick review, random word, dictation — under More ⋯.",
      "SRS uses SM-2: hard words return sooner; customize intervals on the Dashboard.",
      "Due filter and Due-only quiz show words ready for review.",
      "Dashboard: streak, due, weak words, today’s progress, shortcuts.",
    ],
    bodyAr: [
      "اختبار، بطاقات، مراجعة سريعة، كلمة عشوائية، إملاء — من المزيد ⋯.",
      "SRS بنظام SM-2: الكلمات الصعبة ترجع أسرع؛ خصّص الفترات من لوحة القيادة.",
      "فلتر المستحقة واختبار المستحقة فقط يعرضوا الكلمات الجاهزة.",
      "لوحة القيادة: سلسلة، مستحقة، ضعيفة، تقدّم اليوم، واختصارات.",
    ],
  },
  {
    id: "pron",
    icon: "MicIcon",
    titleEn: "Pronunciation & recording",
    titleAr: "النطق والتسجيل",
    bodyEn: [
      "Speakers play Cambridge US/UK audio for English words.",
      "Settings → English accent (Cambridge): American or British default.",
      "Zoom: US/UK buttons, mic practice score, and Record & compare your voice.",
    ],
    bodyAr: [
      "السماعة بتشغّل نطق كامبريدج أمريكي/بريطاني للإنجليزي.",
      "الإعدادات → لهجة الإنجليزية (كامبريدج): أمريكي أو بريطاني.",
      "العرض الكبير: أزرار US/UK، تمرين ميكروفون مع درجة، وتسجيل صوتك للمقارنة.",
    ],
  },
  {
    id: "lists",
    icon: "LayersIcon",
    titleEn: "Lists, challenges, export",
    titleAr: "قوائم وتحديات وتصدير",
    bodyEn: [
      "Word lists: create lists and share with a code (More ⋯ → Word lists).",
      "Friend challenges: compete on words, quizzes, streak, or minutes (More ⋯ → Challenges).",
      "Export CSV or Anki TSV; Import CSV from More ⋯.",
    ],
    bodyAr: [
      "قوائم الكلمات: أنشئ قوائم وشاركها بكود (المزيد ⋯ → قوائم الكلمات).",
      "تحديات الأصدقاء: تنافس على كلمات أو اختبارات أو سلسلة أو دقائق (المزيد ⋯ → تحديات).",
      "تصدير CSV أو Anki؛ استيراد CSV من المزيد ⋯.",
    ],
  },
  {
    id: "todo",
    icon: "CheckIcon",
    titleEn: "To-do list",
    titleAr: "قائمة المهام",
    bodyEn: [
      "Green floating button or More ⋯ (shortcut T).",
      "Start on a task → live timer next to it. One active task at a time.",
      "Pin = floating mini list. Export/Import JSON.",
    ],
    bodyAr: [
      "الزرار الأخضر العائم أو المزيد ⋯ (اختصار T).",
      "ابدأ على مهمة → مؤقت حيّ جنبها. مهمة واحدة شغّالة في نفس الوقت.",
      "تثبيت = قائمة مصغّرة. تصدير/استيراد JSON.",
    ],
  },
  {
    id: "goals",
    icon: "FlameIcon",
    titleEn: "Goals, timer, calendar",
    titleAr: "أهداف ومؤقّت وتقويم",
    bodyEn: [
      "Goals: daily words / minutes / weekly challenge (orange button).",
      "Timer: countdown or stopwatch; minutes count toward goals.",
      "Calendar: study map by day. Word of the day on the home list.",
    ],
    bodyAr: [
      "الأهداف: كلمات/دقائق يومية + تحدي أسبوعي (الزرار البرتقالي).",
      "المؤقّت: عدّ تنازلي أو ساعة؛ الدقائق بتتحسب في الأهداف.",
      "التقويم: خريطة المذاكرة باليوم. كلمة اليوم على الصفحة الرئيسية.",
    ],
  },
  {
    id: "achievements",
    icon: "StarIcon",
    titleEn: "Achievements",
    titleAr: "الإنجازات",
    bodyEn: [
      "More ⋯ → Achievements: categories with 10 levels each.",
      "Tap a category to see % progress toward the next level.",
    ],
    bodyAr: [
      "المزيد ⋯ → الإنجازات: أقسام وكل قسم ١٠ مستويات.",
      "اضغط قسم عشان تشوف نسبة التقدّم للمستوى الجاي.",
    ],
  },
  {
    id: "more",
    icon: "LayersIcon",
    titleEn: "More",
    titleAr: "المزيد",
    bodyEn: [
      "More ⋯ → Focus mode (or F): hides banners for distraction-free study.",
      "Shortcuts: / search · N add · Q quiz · R review · T to-do · F focus.",
      "Gear (⚙) opens Settings: Appearance, language, device layout, accent, reminders.",
      "More ⋯ holds study tools: Quiz, Flashcards, Random word, Leaderboard, CSV/Anki export, etc.",
      "Notifications: optional study reminders when the browser allows (inside Settings).",
    ],
    bodyAr: [
      "المزيد ⋯ → وضع التركيز (أو F): يخفي البنرات للمذاكرة من غير تشتيت.",
      "اختصارات: / بحث · N إضافة · Q اختبار · R مراجعة · T مهام · F تركيز.",
      "الترس (⚙) بيفتح الإعدادات: المظهر، اللغة، واجهة الجهاز، اللهجة، التذكيرات.",
      "المزيد ⋯ فيه أدوات المذاكرة: اختبار، بطاقات، كلمة عشوائية، ترتيب، تصدير CSV/Anki، إلخ.",
      "الإشعارات: تذكيرات مذاكرة اختيارية حسب دعم المتصفح (جوه الإعدادات).",
    ],
  },
];
