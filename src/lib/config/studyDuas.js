/**
 * أدعية المذاكرة — قسم منفصل عن الآيات والأحاديث
 * phase: before | during | after
 */

export const DUA_PHASES = [
  { id: "before", ar: "قبل المذاكرة", en: "Before study" },
  { id: "during", ar: "أثناء المذاكرة", en: "During study" },
  { id: "after", ar: "بعد المذاكرة", en: "After study" },
];

export const STUDY_DUAS = [
  // ── قبل المذاكرة ──
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
  {
    phase: "before",
    ref: "دعاء الاستفتاح",
    ar: "اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا",
    en: "O Allah, I ask You for beneficial knowledge, good provision, and accepted deeds.",
    explainAr: "ابدأ بطلب العلم النافع والرزق الطيب والعمل المقبول؛ هذا يجمع بين الدنيا والآخرة.",
    explainEn: "Start by asking for beneficial knowledge, pure provision, and accepted deeds.",
  },
  {
    phase: "before",
    ref: "دعاء التوفيق",
    ar: "رَبِّ زِدْنِي عِلْمًا، وَوَفِّقْنِي لِمَا تُحِبُّ وَتَرْضَى",
    en: "My Lord, increase me in knowledge, and grant me success in what You love and are pleased with.",
    explainAr: "اطلب الزيادة في العلم مع التوفيق لما يحبه الله؛ فالعلم بلا توفيق قد يضل.",
    explainEn: "Ask for increase in knowledge together with success in what Allah loves.",
  },
  // ── أثناء المذاكرة ──
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
  {
    phase: "during",
    ref: "دعاء التركيز",
    ar: "اللَّهُمَّ ثَبِّتْ قَلْبِي عَلَى دِينِكَ، وَثَبِّتْ لِسَانِي عَلَى ذِكْرِكَ، وَاجْعَلْنِي مِمَّنْ يَتَفَكَّرُ فِي خَلْقِكَ",
    en: "O Allah, keep my heart firm upon Your religion, my tongue firm upon Your remembrance, and make me among those who reflect on Your creation.",
    explainAr: "لما يتشتت الانتباه: اطلب تثبيت القلب واللسان، والتفكر بدل التشتت.",
    explainEn: "When attention wanders: ask for a firm heart and tongue, and reflection instead of distraction.",
  },
  {
    phase: "during",
    ref: "دعاء الحفظ",
    ar: "اللَّهُمَّ إِنِّي أَسْأَلُكَ فَهْمَ النَّبِيِّينَ، وَحِفْظَ الْمُرْسَلِينَ، وَإِلْهَامَ الْمَلَائِكَةِ الْمُقَرَّبِينَ",
    en: "O Allah, I ask You for the understanding of the prophets, the memorization of the messengers, and the inspiration of the near angels.",
    explainAr: "اطلب الفهم والحفظ والإلهام أثناء المذاكرة؛ خاصة لما تحفظ أو تراجع.",
    explainEn: "Ask for understanding, memorization, and inspiration while studying — especially when reviewing or memorizing.",
  },
  // ── بعد المذاكرة ──
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
  {
    phase: "after",
    ref: "دعاء البركة",
    ar: "اللَّهُمَّ بَارِكْ لِي فِيمَا عَلَّمْتَنِي، وَاجْعَلْهُ حُجَّةً لِي لَا عَلَيَّ، وَارْزُقْنِي الْعَمَلَ بِهِ",
    en: "O Allah, bless me in what You have taught me, make it a proof for me not against me, and grant me the ability to act upon it.",
    explainAr: "اطلب البركة في العلم، وأن يكون لك لا عليك، مع العمل به. العلم بلا عمل حجة.",
    explainEn: "Ask for blessing in the knowledge, that it be a proof for you not against you, and the ability to act on it.",
  },
  {
    phase: "after",
    ref: "دعاء الاستمرار",
    ar: "رَبِّ أَوْزِعْنِي أَنْ أَشْكُرَ نِعْمَتَكَ الَّتِي أَنْعَمْتَ عَلَيَّ، وَأَنْ أَعْمَلَ صَالِحًا تَرْضَاهُ، وَأَدْخِلْنِي بِرَحْمَتِكَ فِي عِبَادِكَ الصَّالِحِينَ",
    en: "My Lord, enable me to be grateful for Your favor which You have bestowed upon me, and to do righteousness that You approve, and admit me by Your mercy into the ranks of Your righteous servants.",
    explainAr: "بعد الجلسة: اشكر النعمة، واطلب الاستمرار على العمل الصالح والانتماء للصالحين.",
    explainEn: "After the session: thank for the blessing, and ask to continue in righteous deeds and join the righteous.",
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
