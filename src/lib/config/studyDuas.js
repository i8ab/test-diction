/**
 * أدعية المذاكرة — قسم منفصل عن الآيات والأحاديث
 * phase: before | during | after
 */

export const DUA_PHASES = [
  { id: "before", ar: "قبل المذاكرة", en: "Before study" },
  { id: "during", ar: "أثناء المذاكرة", en: "During study" },
  { id: "after", ar: "بعد الجلسة", en: "After session" },
];

export const STUDY_DUAS = [
  // ── قبل المذاكرة (حد أقصى 2) ──
  {
    phase: "before",
    ref: "دعاء قبل المذاكرة",
    ar: "اللَّهُمَّ انْفَعْنِي بِمَا عَلَّمْتَنِي، وَعَلِّمْنِي مَا يَنْفَعُنِي، وَزِدْنِي عِلْمًا",
    en: "O Allah, benefit me with what You have taught me, teach me what benefits me, and increase me in knowledge.",
    explainAr: "قبل ما تبدأ: اطلب النفع والزيادة. العلم بلا نفع عبء، والنفع بلا علم ناقص.",
    explainEn: "Before you begin: ask for benefit and increase. Knowledge without benefit is a burden.",
  },
  {
    phase: "before",
    ref: "دعاء موسى عليه السلام",
    ar: "رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي وَاحْلُلْ عُقْدَةً مِّن لِّسَانِي يَفْقَهُوا قَوْلِي",
    en: "My Lord, expand for me my breast, ease my task, and untie the knot from my tongue so they may understand my speech.",
    explainAr: "اطلب شرح الصدر وتيسير الأمر قبل الجلسة.",
    explainEn: "Ask for an expanded chest and ease before the session.",
  },
  // ── أثناء المذاكرة (حد أقصى 2) ──
  {
    phase: "during",
    ref: "دعاء التيسير",
    ar: "اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا، وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا",
    en: "O Allah, nothing is easy except what You make easy, and You make the difficult easy if You will.",
    explainAr: "لما يتعقد عليك جزء: ذكّر نفسك أن التيسير بيد الله، واستمر.",
    explainEn: "When a part gets hard: remind yourself ease is from Allah, and keep going.",
  },
  {
    phase: "during",
    ref: "دعاء الفهم",
    ar: "يَا مُعَلِّمَ إِبْرَاهِيمَ عَلِّمْنِي، وَيَا مُفَهِّمَ سُلَيْمَانَ فَهِّمْنِي",
    en: "O Teacher of Ibrahim, teach me; O One who gave understanding to Sulayman, grant me understanding.",
    explainAr: "دعاء لطلب الفهم. كرّره لما يقفز المعنى منك أثناء الجلسة.",
    explainEn: "A dua for understanding. Repeat it when meaning slips during the session.",
  },
  // ── بعد الجلسة (حد أقصى 2) ──
  {
    phase: "after",
    ref: "دعاء بعد المذاكرة",
    ar: "اللَّهُمَّ إِنِّي أَسْتَوْدِعُكَ مَا قَرَأْتُ وَمَا حَفِظْتُ وَمَا تَعَلَّمْتُ، فَرُدَّهُ عَلَيَّ عِنْدَ حَاجَتِي إِلَيْهِ",
    en: "O Allah, I entrust to You what I have read, memorized, and learned; return it to me when I need it.",
    explainAr: "بعد ما تخلّص: استودع ما أخذت عند الله ليرده لك وقت الحاجة.",
    explainEn: "After you finish: entrust what you learned to Allah so He returns it when you need it.",
  },
  {
    phase: "after",
    ref: "الحمد بعد الجلسة",
    ar: "الْحَمْدُ لِلَّهِ الَّذِي بِنِعْمَتِهِ تَتِمُّ الصَّالِحَاتُ",
    en: "Praise be to Allah by whose favor good deeds are completed.",
    explainAr: "اختم بالحمد. الجلسة نعمة؛ الشكر يثبتها ويفتح لما بعدها.",
    explainEn: "End with praise. The session is a blessing; gratitude secures it and opens what follows.",
  },
];

const SEEN_KEY = "twoTongues.studyDuasSeen";

function loadSeen() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((n) => typeof n === "number") : [];
  } catch (_) {
    return [];
  }
}

function saveSeen(indices) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(indices));
  } catch (_) {}
}

export function getRandomDua(phase, excludeIndex = -1) {
  const filtered = STUDY_DUAS
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.phase === phase);
  if (!filtered.length) return null;

  let seen = loadSeen();
  let available = filtered.filter(({ i }) => !seen.includes(i) && i !== excludeIndex);
  if (available.length === 0) {
    available = filtered.filter(({ i }) => i !== excludeIndex);
    if (available.length === 0) available = filtered;
  }
  const pick = available[Math.floor(Math.random() * available.length)];
  const nextSeen = seen.includes(pick.i) ? seen : [...seen, pick.i];
  saveSeen(nextSeen);
  return { ...pick.d, index: pick.i };
}
