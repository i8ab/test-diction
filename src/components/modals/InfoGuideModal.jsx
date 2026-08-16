import { useEffect, useState } from "react";
import { tr } from "../../lib/config/i18n";
import { XIcon, ChevronIcon, BookIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

const GUIDES = [
  { id: "search", titleEn: "Search & filters", titleAr: "البحث والفلاتر",
    whatEn: "Find words quickly and narrow the list with advanced filters and sorting.", whatAr: "تلاقي الكلمات بسرعة وتضيّق القائمة بفلاتر وترتيب متقدم.",
    stepsEn: [
      "Search box at the top (word, meaning, definition, or example).",
      "Mic = voice search when available.",
      "Study filters: All · Studied · Not studied · Favorites · Due today · Weak.",
      "Extra filters: part of speech (POS), date added (today / 7 days / 30 days).",
      "Sort: A–Z · Newest · Oldest · Weakest first.",
    ],
    stepsAr: [
      "خانة البحث فوق (كلمة أو معنى أو تعريف أو مثال).",
      "الميكروفون = بحث صوتي لو متاح.",
      "فلاتر الدراسة: الكل · درست · لسه · مفضلة · مستحقة · ضعيفة.",
      "فلاتر إضافية: نوع الكلمة (اسم/فعل…)، تاريخ الإضافة (اليوم / ٧ أيام / ٣٠ يوم).",
      "الترتيب: أبجدي · الأحدث · الأقدم · الأضعف أولاً.",
    ] },
  { id: "cards", titleEn: "Word cards", titleAr: "كروت الكلمات",
    whatEn: "Each entry is a compact card: word, type, meaning, and actions.", whatAr: "كل مدخل كرت مختصر: الكلمة والنوع والمعنى والأزرار.",
    stepsEn: [
      "Word row: the word, part-of-speech chips (Noun / Verb…) beside it, then speaker and expand chevron.",
      "English words also show a small Cambridge shield icon next to the speaker — opens that word in Cambridge Dictionary.",
      "Meaning is always visible under the word row.",
      "Tap the card body to expand: synonyms/antonyms chips, admin labels if any, and a hint to open Zoom for full definition & examples.",
      "Personal note is written only inside Zoom (not on the list card), so cards stay short.",
      "Action bar: Fav · Zoom · Study · Edit · Del.",
      "A–Z letter rail on the side jumps to that letter’s group in the list.",
    ],
    stepsAr: [
      "سطر الكلمة: الكلمة، نوعها (اسم / فعل…) جنبها، بعدين السماعة وسهم التوسيع.",
      "للكلمات الإنجليزية درع كامبريدج صغير جنب السماعة — بيفتح الكلمة في قاموس كامبريدج.",
      "المعنى ظاهر دايمًا تحت سطر الكلمة.",
      "اضغط جسم الكرت للتوسيع: مرادفات/مضادات، وملصقات الأدمن لو فيه، وتلميح لفتح التكبير للتعريف والأمثلة الكاملة.",
      "الملاحظة الشخصية بتتكتب جوه التكبير فقط (مش على كرت القائمة) عشان الكروت تفضل قصيرة.",
      "شريط الأزرار: مفضلة · تكبير · مذاكرة · تعديل · حذف.",
      "شريط الحروف A–Z على الجنب بينقلك لمجموعة الحرف في القائمة.",
    ] },
  { id: "add", titleEn: "Adding & editing words", titleAr: "إضافة وتعديل الكلمات",
    whatEn: "Grow the shared dictionary.", whatAr: "زوّد القاموس المشترك.",
    stepsEn: ["+ / Add (or N).", "Word + meaning required. Optional type and multi-sense.", "Auto-fill: definition + examples only."],
    stepsAr: ["+ / إضافة (أو N).", "الكلمة والمعنى مطلوبين. نوع ومعاني متعددة اختياري.", "تعبئة تلقائية: تعريف + أمثلة فقط."] },
  { id: "pron", titleEn: "Pronunciation & recording", titleAr: "النطق والتسجيل",
    whatEn: "Cambridge US/UK audio, speech scoring, and record-your-voice comparison.", whatAr: "نطق كامبريدج أمريكي/بريطاني، تقييم النطق، وتسجيل صوتك للمقارنة.",
    stepsEn: [
      "List card: speaker plays Cambridge audio; the small shield opens the word on Cambridge Dictionary.",
      "Gear (⚙) → Settings → Accent for the default English pronunciation (US or UK).",
      "Zoom view: separate US and UK speaker buttons.",
      "In Zoom: practice with the mic — speech recognition scores your attempt.",
      "Record & compare: tap “Record my voice”, speak, Stop, then play your recording next to the model audio.",
      "Zoom also holds the personal note field for that word.",
    ],
    stepsAr: [
      "على الكرت: السماعة بتشغّل نطق كامبريدج؛ الدرع الصغير بيفتح الكلمة في قاموس كامبريدج.",
      "الترس (⚙) → الإعدادات → اللهجة للافتراضي الإنجليزي (أمريكي أو بريطاني).",
      "العرض الكبير فيه أزرار US و UK.",
      "في العرض الكبير: تمرين بالميكروفون — التعرف الصوتي يقيّم محاولتك.",
      "سجّل وقارن: اضغط «سجّل صوتي»، اتكلم، إيقاف، بعدين شغّل تسجيلك جنب النطق الأصلي.",
      "التكبير فيه كمان حقل الملاحظة الشخصية للكلمة.",
    ] },
  { id: "srs", titleEn: "Spaced repetition (SRS)", titleAr: "التكرار المتباعد (SRS)",
    whatEn: "SM-2 style scheduling so hard words come back sooner and easy ones later.", whatAr: "جدولة بأسلوب SM-2: الكلمات الصعبة ترجع أسرع والسهلة أبعد.",
    stepsEn: [
      "Quiz, review, and dictation answers update each word’s schedule.",
      "Due filter and “Due only” quiz show words ready for review.",
      "Dashboard → SRS intervals: customize relearn minutes, graduating days, easy bonus, hard factor.",
      "Weak words (low SRS box) appear under Weak filter and on the Dashboard.",
    ],
    stepsAr: [
      "إجابات الاختبار والمراجعة والإملاء بتحدّث جدول كل كلمة.",
      "فلتر المستحقة واختبار «المستحقة فقط» يعرضوا الكلمات الجاهزة للمراجعة.",
      "لوحة القيادة → فترات SRS: خصّص دقائق إعادة التعلّم، أيام التخرج، مكافأة السهل، معامل الصعب.",
      "الكلمات الضعيفة تظهر في فلتر «ضعيفة» وفي لوحة القيادة.",
    ] },
  { id: "quiz", titleEn: "Quiz", titleAr: "الاختبار",
    whatEn: "Questions from studied words; answers drive SRS.", whatAr: "أسئلة من الكلمات المدروسة؛ الإجابات بتحدّث SRS.",
    stepsEn: ["More ⋯ → Quiz.", "MCQ or typing. Multi-type words show the required type.", "Wrong answers reset the word to relearn soon (SM-2)."],
    stepsAr: ["المزيد ⋯ → اختبار.", "اختيار أو كتابة. النوع المتعدد يتوضّح في السؤال.", "الخطأ بيرجّع الكلمة لإعادة التعلّم قريباً (SM-2)."] },
  { id: "flashcards", titleEn: "Flashcards", titleAr: "البطاقات التعليمية",
    whatEn: "Flip cards for light review.", whatAr: "تقليب كروت لمراجعة خفيفة.",
    stepsEn: ["More ⋯ → Flashcards.", "Filter deck: All / Studied / Favorites.", "Flip to reveal — Knew / Still learning."],
    stepsAr: ["المزيد ⋯ → بطاقات.", "تصفية المجموعة: الكل / درست / مفضلة.", "اقلبها للكشف — عرفتها / لسه بتعلّم."] },
  { id: "quick", titleEn: "Quick review", titleAr: "مراجعة سريعة",
    whatEn: "Short recall for due words.", whatAr: "تذكّر سريع للمستحقة.",
    stepsEn: ["More ⋯ → Quick review (or press R).", "Fast pass over due or recent words."],
    stepsAr: ["المزيد ⋯ → مراجعة سريعة (أو R).", "مرور سريع على المستحقة أو الحديثة."] },
  { id: "dashboard", titleEn: "Dashboard", titleAr: "لوحة القيادة",
    whatEn: "One place for today’s progress, due words, and weak words.", whatAr: "مكان واحد لتقدّم اليوم والمستحقة والضعيفة.",
    stepsEn: [
      "More ⋯ → Dashboard.",
      "See streak, due count, studied total, today’s words, favorites, quizzes, timer minutes.",
      "Jump to Quiz, Flashcards, Stats, or Calendar.",
      "Customize SRS intervals at the bottom of the dashboard.",
    ],
    stepsAr: [
      "المزيد ⋯ → لوحة القيادة.",
      "شوف السلسلة، المستحقة، إجمالي المدروسة، كلمات اليوم، المفضلة، الاختبارات، دقائق المؤقت.",
      "انتقال سريع لاختبار أو بطاقات أو إحصائيات أو تقويم.",
      "خصّص فترات SRS من أسفل اللوحة.",
    ] },
  { id: "lists", titleEn: "Word lists & sharing", titleAr: "قوائم الكلمات والمشاركة",
    whatEn: "Create named lists and share them with a code.", whatAr: "اعمل قوائم بأسماء وشاركها بكود.",
    stepsEn: [
      "More ⋯ → Word lists.",
      "Create a list: name it and optionally pick words from the current section.",
      "Share: copies a code to the clipboard; others open Word lists → Import shared list → enter the code.",
      "Import adds the list’s words into the shared dictionary (skips duplicates).",
    ],
    stepsAr: [
      "المزيد ⋯ → قوائم الكلمات.",
      "قائمة جديدة: اسمها واختيار كلمات من القسم الحالي (اختياري).",
      "مشاركة: بينسخ كود؛ التاني يفتح قوائم الكلمات → استيراد قائمة مشاركة → يدخل الكود.",
      "الاستيراد بيضيف الكلمات للقاموس المشترك (بيتخطى المكرر).",
    ] },
  { id: "challenges", titleEn: "Friend challenges", titleAr: "تحديات الأصدقاء",
    whatEn: "Challenge another account in the same shared dictionary.", whatAr: "تحدّى حساب تاني في نفس القاموس المشترك.",
    stepsEn: [
      "More ⋯ → Challenges.",
      "Pick a friend, type (words / quizzes / streak / minutes), target, and duration.",
      "They Accept or Decline. Progress updates while the challenge is active.",
      "When time ends or someone hits the target, a winner is declared.",
    ],
    stepsAr: [
      "المزيد ⋯ → تحديات.",
      "اختار صديق، النوع (كلمات / اختبارات / سلسلة / دقائق)، الهدف، والمدة.",
      "يقبل أو يرفض. التقدّم بيتحدّث والتحدي شغال.",
      "لما المدة تخلص أو حد يوصل للهدف، بيتعلن الفائز.",
    ] },
  { id: "dictation", titleEn: "Dictation", titleAr: "استماع وإملاء",
    whatEn: "Listen and type, or see meaning and type the word.", whatAr: "اسمع واكتب، أو شوف المعنى واكتب الكلمة.",
    stepsEn: ["More ⋯ → Dictation.", "Results can update SRS like the quiz."],
    stepsAr: ["المزيد ⋯ → استماع وإملاء.", "النتائج ممكن تحدّث SRS زي الاختبار."] },
  { id: "stats", titleEn: "Stats & leaderboard", titleAr: "الإحصائيات والترتيب",
    whatEn: "Personal progress charts and group ranking.", whatAr: "رسوم تقدّمك وترتيب المجموعة.",
    stepsEn: ["More ⋯ → Stats for your history and SRS overview.", "More ⋯ → Leaderboard for the group."],
    stepsAr: ["المزيد ⋯ → إحصائياتي لتاريخك وملخص SRS.", "المزيد ⋯ → الترتيب للمجموعة."] },
  { id: "export", titleEn: "Export & import", titleAr: "تصدير واستيراد",
    whatEn: "CSV and Anki-compatible export; CSV import.", whatAr: "تصدير CSV وAnki؛ استيراد CSV.",
    stepsEn: [
      "More ⋯ → Export CSV — downloads current (or filtered) words.",
      "More ⋯ → Export Anki — tab-separated file for Anki (File → Import, Tab separator).",
      "More ⋯ → Import CSV — adds words from a spreadsheet (duplicates skipped).",
    ],
    stepsAr: [
      "المزيد ⋯ → تصدير CSV — ينزّل الكلمات الحالية (أو المفلترة).",
      "المزيد ⋯ → تصدير Anki — ملف بفواصل Tab لـ Anki (ملف → استيراد، فاصل Tab).",
      "المزيد ⋯ → استيراد CSV — يضيف كلمات من جدول (المكرر بيتخطى).",
    ] },
  { id: "todo", titleEn: "To-do list", titleAr: "قائمة المهام",
    whatEn: "Tasks with a live work timer.", whatAr: "مهام مع مؤقت شغل حيّ.",
    stepsEn: ["Green button or More ⋯ → To-do (or press T).", "Start on a task for a live timer."],
    stepsAr: ["الزرار الأخضر أو المزيد ⋯ → مهام (أو T).", "ابدأ على مهمة لمؤقت حيّ."] },
  { id: "goals", titleEn: "Goals & weekly challenge", titleAr: "الأهداف والتحدي الأسبوعي",
    whatEn: "Daily targets and an automatic weekly challenge.", whatAr: "أهداف يومية وتحدي أسبوعي تلقائي.",
    stepsEn: ["Orange Goals button or More ⋯ → Goals.", "Track words, quizzes, streak, or study minutes."],
    stepsAr: ["الزرار البرتقالي أو المزيد ⋯ → أهداف.", "تابع كلمات أو اختبارات أو سلسلة أو دقائق مذاكرة."] },
  { id: "timer", titleEn: "Study timer", titleAr: "مؤقّت المذاكرة",
    whatEn: "Countdown or stopwatch.", whatAr: "عدّ تنازلي أو ساعة.",
    stepsEn: ["More ⋯ → Timer. Pin for a floating bubble over the dictionary."],
    stepsAr: ["المزيد ⋯ → مؤقّت. تثبيت = فقاعة فوق القاموس."] },
  { id: "calendar", titleEn: "Calendar", titleAr: "التقويم",
    whatEn: "Map of study days and streak.", whatAr: "خريطة أيام المذاكرة والسلسلة.",
    stepsEn: ["More ⋯ → Calendar · tap a day for words studied that day.", "Pin to keep a floating widget."],
    stepsAr: ["المزيد ⋯ → التقويم · اضغط يوم للكلمات اللي اتذاكرت فيه.", "تثبيت = ودجت عائم."] },
  { id: "achievements", titleEn: "Achievements", titleAr: "الإنجازات",
    whatEn: "Levels and progress %.", whatAr: "مستويات ونسبة تقدّم.",
    stepsEn: ["More ⋯ → Achievements."],
    stepsAr: ["المزيد ⋯ → الإنجازات."] },
  { id: "shortcuts", titleEn: "Keyboard shortcuts", titleAr: "اختصارات لوحة المفاتيح",
    whatEn: "Desktop shortcuts (ignored while typing in a field).", whatAr: "اختصارات سطح المكتب (متتشتغلش وأنت بتكتب في خانة).",
    stepsEn: [
      "/ focus search · N add word · Q quiz · R quick review · T to-do.",
      "Escape closes overlays.",
    ],
    stepsAr: [
      "/ تركيز البحث · N إضافة · Q اختبار · R مراجعة سريعة · T مهام.",
      "Escape يقفل الطبقات.",
    ] },
  { id: "mobile", titleEn: "Mobile app layout", titleAr: "واجهة الموبايل",
    whatEn: "Phone mode is a separate layout you choose at sign-in (or later: gear ⚙ → Settings → Device layout). It does not change the computer UI.",
    whatAr: "وضع الموبايل واجهة منفصلة تختارها عند الدخول (أو لاحقًا: الترس ⚙ → الإعدادات → واجهة الجهاز). مش بيغيّر واجهة الكمبيوتر.",
    stepsEn: [
      "Choose Phone / Tablet / Computer on the welcome screen — saved per browser.",
      "Bottom navigation: Words · Quiz · Goals · To-do · Account. Long-press Quiz = due-only.",
      "Floating + adds a word. Filters stay collapsed until you open them.",
      "Cards stay compact (word + type + meaning). Open Zoom for definition, examples, practice, and personal note.",
      "System back closes modals; swipe down on Zoom also closes it.",
      "Open Settings via the gear icon (⚙) in the header → Appearance: System theme follows the phone; Text size S–XL. Device layout is also under Settings.",
      "Quiz tab shows a badge when SRS reviews are due.",
      "Use More ⋯ for study tools without leaving the list.",
      "Search bar stays sticky while you scroll the list.",
      "Add to Home Screen from the browser menu for an app-like icon (PWA).",
    ],
    stepsAr: [
      "اختار موبايل / تابلت / كمبيوتر من شاشة البداية — يتحفظ على المتصفح.",
      "شريط سفلي: كلمات · اختبار · أهداف · مهام · حسابي. ضغطة طويلة على اختبار = المستحق فقط.",
      "زر + العائم لإضافة كلمة. الفلاتر مطوية لحد ما تفتحها.",
      "الكروت مختصرة (كلمة + نوع + معنى). افتح التكبير للتعريف والأمثلة والتمرين والملاحظة الشخصية.",
      "زر الرجوع يقفل المودالات؛ السحب لتحت في التكبير بيقفل كمان.",
      "افتح الإعدادات من أيقونة الترس (⚙) في الهيدر → المظهر: ثيم النظام يتبع الهاتف؛ حجم الخط S–XL. واجهة الجهاز برضو جوه الإعدادات.",
      "شارة على الاختبار لما يكون فيه مراجعات مستحقة.",
      "استخدم المزيد ⋯ لأدوات المذاكرة من غير ما تسيب القائمة.",
      "شريط البحث يفضل ظاهر وأنت بتنزل في القائمة.",
      "من قائمة المتصفح: إضافة إلى الشاشة الرئيسية (تجربة زي التطبيق).",
    ] },
  { id: "tablet", titleEn: "Tablet layout", titleAr: "واجهة التابلت",
    whatEn: "Optimized for the most common study device: roomy touch targets, sticky A–Z rail, and a side action dock.",
    whatAr: "مُحسَّنة لجهاز المذاكرة الأكثر استخدامًا: أهداف لمس مريحة، قائمة حروف ثابتة، وشريط إجراءات جانبي.",
    stepsEn: [
      "Choose Tablet at sign-in or open the gear (⚙) → Settings → Device layout.",
      "Side dock: Add · Quiz · Goals · To-do (always in reach).",
      "Letter rail stays sticky with larger tap targets.",
      "Filters stay open (not collapsed like Phone mode).",
      "Word cards stay compact; expand shows synonyms/antonyms. Use Zoom for full definition, examples, practice, and personal note.",
      "Search and section tabs use larger touch areas.",
      "Search bar stays sticky while scrolling the list.",
      "Long-press Quiz = due-only · badge shows due reviews.",
      "Use More ⋯ for study tools.",
      "Text size & System theme: gear (⚙) → Settings → Appearance (same as phone).",
      "System back and swipe-down on Zoom close overlays.",
      "Account is on the side dock (avatar path still works on desktop header).",
    ],
    stepsAr: [
      "اختار تابلت عند الدخول أو من أيقونة الترس (⚙) → الإعدادات → واجهة الجهاز.",
      "الشريط الجانبي: إضافة · اختبار · أهداف · مهام (دائمًا في متناول الإيد).",
      "قائمة الحروف ثابتة بأزرار أكبر للمس.",
      "الفلاتر مفتوحة (مش مطوية زي وضع الموبايل).",
      "كروت الكلمات مختصرة؛ التوسيع يعرض المرادفات/المضادات. التكبير للتعريف والأمثلة والتمرين والملاحظة الشخصية.",
      "البحث وتبويبات الأقسام بمساحة لمس أكبر.",
      "شريط البحث يثبت وأنت بتنزل في القائمة.",
      "ضغطة طويلة على الاختبار = المستحق فقط · شارة للمستحقات.",
      "استخدم المزيد ⋯ لأدوات المذاكرة.",
      "حجم الخط وثيم النظام: الترس (⚙) → الإعدادات → المظهر (زي الموبايل).",
      "زر الرجوع والسحب في التكبير بيقفلوا المودالات.",
      "حسابي من الشريط الجانبي (وعلى الكمبيوتر من الأفاتار في الهيدر).",
    ] },
  { id: "settings", titleEn: "Settings & account", titleAr: "الإعدادات والحساب",
    whatEn: "Gear icon in the header opens Settings directly — there is no ☰ menu.", whatAr: "أيقونة الترس في الهيدر بتفتح الإعدادات مباشرة — مفيش قائمة ☰.",
    stepsEn: [
      "Header → gear (⚙) opens Settings. Tools/study features are under More ⋯ (not inside Settings).",
      "Inside Settings: Appearance (theme, density, colors), Language, Device layout (Phone / Tablet / Computer), English accent (Cambridge), Information, Notifications / reminders.",
      "Linked accounts and Sign out are also in Settings.",
      "Avatar (profile picture) in the header opens My account (name, photo, password) — separate from Settings.",
      "Admin panel (if you are admin) is listed inside Settings.",
    ],
    stepsAr: [
      "الهيدر → أيقونة الترس (⚙) بتفتح الإعدادات. أدوات المذاكرة من المزيد ⋯ (مش جوه الإعدادات).",
      "جوه الإعدادات: المظهر (ثيم، كثافة، ألوان)، اللغة، واجهة الجهاز (موبايل / تابلت / كمبيوتر)، لهجة الإنجليزية (كامبريدج)، معلومات، التذكيرات.",
      "الحسابات المرتبطة وتسجيل الخروج برضو جوه الإعدادات.",
      "الأفاتار (صورة الحساب) في الهيدر بيفتح حسابي (الاسم، الصورة، كلمة المرور) — منفصل عن الإعدادات.",
      "لوحة الأدمن (لو أنت أدمن) موجودة جوه الإعدادات.",
    ] },
  { id: "wotd", titleEn: "Word of the day", titleAr: "كلمة اليوم",
    whatEn: "One word from the current section, the same for everyone all day.", whatAr: "كلمة واحدة من القسم الحالي، ثابتة للكل طول اليوم.",
    stepsEn: [
      "Appears above the word list on the main dictionary screen (when the section has words).",
      "Picked from today’s date + section — changes once every 24 hours, not on every refresh.",
      "Tap the card to open Zoom for that word. Speaker plays pronunciation without leaving the list.",
    ],
    stepsAr: [
      "بتظهر فوق قائمة الكلمات في شاشة القاموس (لما يكون في كلمات في القسم).",
      "بتتختار من تاريخ اليوم + القسم — بتتغيّر مرة كل ٢٤ ساعة، مش مع كل تحديث.",
      "اضغط الكرت عشان تفتح التكبير للكلمة. السماعة بتشغّل النطق من غير ما تسيب القائمة.",
    ] },
  { id: "random", titleEn: "Random word", titleAr: "كلمة عشوائية",
    whatEn: "Fast practice: one word at a time with Knew / Forgot / Reveal.", whatAr: "تمرين سريع: كلمة واحدة كل مرة مع عرفتها / نسيتها / كشف.",
    stepsEn: [
      "More ⋯ → Random word.",
      "Pool prefers due studied words, then not-yet-studied, then the rest of the section.",
      "Reveal shows the meaning; Knew / Forgot updates SRS like other practice tools.",
      "Words do not repeat until the current cycle bag is empty.",
    ],
    stepsAr: [
      "المزيد ⋯ → كلمة عشوائية.",
      "المجموعة بتفضّل الكلمات المستحقة، بعدين اللي لسه متتذاكرتش، بعدين باقي القسم.",
      "كشف بيعرض المعنى؛ عرفتها / نسيتها بيحدّثوا SRS زي باقي أدوات التمرين.",
      "الكلمة متتكررش لحد ما تخلص دورة المجموعة الحالية.",
    ] },
  { id: "group", titleEn: "Shared group & offline", titleAr: "المجموعة والأوفلاين",
    whatEn: "One shared dictionary; personal progress; works offline as a PWA.", whatAr: "قاموس مشترك؛ تقدّم شخصي؛ يشتغل أوفلاين كـ PWA.",
    stepsEn: [
      "Everyone shares the word list; studied / favorites / SRS are per account.",
      "Offline: cached words stay readable; adding needs a connection.",
      "Admins: open Settings → Admin for block users and backup download.",
    ],
    stepsAr: [
      "الكل بيشوف نفس الكلمات؛ المذاكرة والمفضلة وSRS لكل حساب.",
      "أوفلاين: الكلمات المحفوظة تتقرا؛ الإضافة محتاجة نت.",
      "الأدمن: من الإعدادات → لوحة التحكم لحظر المستخدمين وتنزيل النسخة.",
    ] },
];

export default function InfoGuideModal({ isAr, onClose }) {
  const [activeId, setActiveId] = useState(null);
  const active = GUIDES.find((g) => g.id === activeId) || null;

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        if (activeId) setActiveId(null);
        else onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, activeId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <BodyScrollLock />
      <div
        className="modal-card"
        style={{
          width: "100%", maxWidth: 420,
          maxHeight: "min(86dvh, 640px)",
          display: "flex", flexDirection: "column",
          background: "var(--card)",
          borderRadius: "var(--modal-radius, 16px)",
          border: "1px solid rgba(var(--border-rgb),0.14)",
          boxShadow: "0 24px 60px -16px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px",
          borderBottom: "1px solid rgba(var(--border-rgb),0.12)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {active ? (
              <button
                type="button"
                onClick={() => setActiveId(null)}
                style={{
                  border: "none", background: "var(--input-bg)", borderRadius: 8,
                  width: 32, height: 32, cursor: "pointer", color: "var(--ink)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
                aria-label={tr(isAr, "Back", "رجوع")}
              >
                <ChevronIcon size={16} style={{ transform: isAr ? "none" : "rotate(180deg)" }} />
              </button>
            ) : (
              <span style={{
                width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                background: "color-mix(in srgb, var(--accent-1) 18%, transparent)", color: "var(--accent-1)", flexShrink: 0,
              }}>
                <BookIcon size={16} />
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>
                {active
                  ? (isAr ? active.titleAr : active.titleEn)
                  : tr(isAr, "How to use the site", "إزاي تستخدم الموقع")}
              </div>
              {!active && (
                <div style={{ fontSize: 12, color: "var(--muted-strong)", marginTop: 2 }}>
                  {tr(isAr, "Pick a topic", "اختار موضوع")}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{
              border: "none", background: "var(--input-bg)", borderRadius: 8,
              width: 32, height: 32, cursor: "pointer", color: "var(--icon-muted)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <XIcon size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {!active ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {GUIDES.map((g, i) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActiveId(g.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "11px 12px",
                    border: "none", borderRadius: 10,
                    background: "transparent",
                    cursor: "pointer", textAlign: "start",
                    fontFamily: "inherit", color: "var(--ink)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--input-bg)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{
                    width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800, color: "#fff",
                    background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                    {isAr ? g.titleAr : g.titleEn}
                  </span>
                  <span style={{ color: "var(--muted)", display: "inline-flex" }}>
                    <ChevronIcon size={14} style={{ transform: isAr ? "rotate(180deg)" : "none" }} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ padding: "8px 10px 16px" }}>
              <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.55, color: "var(--muted-strong)" }}>
                {isAr ? active.whatAr : active.whatEn}
              </p>
              <div style={{
                fontSize: 11, fontWeight: 800, letterSpacing: "0.04em",
                textTransform: "uppercase", color: "var(--accent-1)", marginBottom: 8,
              }}>
                {tr(isAr, "How to use it", "طريقة الاستخدام")}
              </div>
              <ol style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                {(isAr ? active.stepsAr : active.stepsEn).map((s, i) => (
                  <li key={i} style={{ fontSize: 14, lineHeight: 1.5, color: "var(--ink)" }}>{s}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
