/**
 * رسائل أمل — آيات قرآنية مُشكَّلة + أحاديث صحيحة
 * مع شرح موجز (سبب نزول / سياق / عظة)
 * مقسّمة حسب الحالة النفسية
 *
 * { mood, type, ref, ar, en, explainAr, explainEn }
 */

export const MOODS = [
  { id: "happy", ar: "فرحان", en: "Happy" },
  { id: "sad", ar: "زعلان", en: "Sad" },
  { id: "anxious", ar: "قلق", en: "Anxious" },
  { id: "despair", ar: "يائس", en: "In despair" },
  { id: "tired", ar: "تعبان", en: "Tired" },
  { id: "nofire", ar: "فاقد الشغف", en: "Lost motivation" },
  { id: "hope", ar: "محتاج أمل", en: "Need hope" },
  { id: "angry", ar: "غضبان", en: "Angry" },
  { id: "lonely", ar: "وحيد", en: "Lonely" },
  { id: "study", ar: "مذاكرة", en: "Studying" },
];

export const MOTIVATIONAL_QUOTES = [
  // ══════════ فرحان ══════════
  {
    mood: "happy", type: "quran", ref: "إبراهيم: ٧",
    ar: "لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ ۖ وَلَئِن كَفَرْتُمْ إِنَّ عَذَابِي لَشَدِيدٌ",
    en: "If you are grateful, I will surely increase you [in favor]; but if you deny, indeed, My punishment is severe.",
    explainAr: "وعد إلهي: الشكر مفتاح الزيادة. كل نعمة تحمد عليها تُفتح لك أبواب أعظم.",
    explainEn: "A divine promise: gratitude unlocks increase. Every blessing you thank for opens greater doors.",
  },
  {
    mood: "happy", type: "quran", ref: "الضحا: ١١",
    ar: "وَأَمَّا بِنِعْمَةِ رَبِّكَ فَحَدِّثْ",
    en: "And as for the favor of your Lord, proclaim it.",
    explainAr: "نزلت في سياق امتنان النبي ﷺ بعد الضيق. العظة: الفرح الشرعي يُعبَّر عنه بذكر النعمة لا بالتكبّر.",
    explainEn: "In the context of the Prophet’s relief after hardship. Joy is expressed by mentioning the blessing — not arrogance.",
  },
  {
    mood: "happy", type: "quran", ref: "يونس: ٥٨",
    ar: "قُلْ بِفَضْلِ اللَّهِ وَبِرَحْمَتِهِ فَبِذَٰلِكَ فَلْيَفْرَحُوا هُوَ خَيْرٌ مِّمَّا يَجْمَعُونَ",
    en: "Say: In the bounty of Allah and in His mercy — in that let them rejoice; it is better than what they accumulate.",
    explainAr: "الفرح الحقيقي بفضل الله ورحمته (القرآن والإيمان) خير من فرح الدنيا الزائل.",
    explainEn: "True joy is in Allah’s bounty and mercy — better than worldly accumulation.",
  },
  {
    mood: "happy", type: "quran", ref: "آل عمران: ١٧٤",
    ar: "فَانقَلَبُوا بِنِعْمَةٍ مِّنَ اللَّهِ وَفَضْلٍ لَّمْ يَمْسَسْهُمْ سُوءٌ وَاتَّبَعُوا رِضْوَانَ اللَّهِ ۗ وَاللَّهُ ذُو فَضْلٍ عَظِيمٍ",
    en: "So they returned with favor from Allah and bounty, no harm having touched them. And they pursued the pleasure of Allah, and Allah is the possessor of great bounty.",
    explainAr: "بعد غزوة حمراء الأسد: رجع المؤمنون سالمين بنعمة. الفرح بعد الخوف يزيد الشكر لا الغفلة.",
    explainEn: "After a tense campaign, believers returned safe. Joy after fear should deepen gratitude, not heedlessness.",
  },
  {
    mood: "happy", type: "hadith", ref: "مسلم",
    ar: "انْظُرُوا إِلَى مَنْ أَسْفَلَ مِنْكُمْ، وَلَا تَنْظُرُوا إِلَى مَنْ هُوَ فَوْقَكُمْ، فَهُوَ أَجْدَرُ أَنْ لَا تَزْدَرُوا نِعْمَةَ اللَّهِ عَلَيْكُمْ",
    en: "Look at those below you and do not look at those above you, for it is more suitable so that you do not belittle the blessing of Allah upon you.",
    explainAr: "النظر لمن فوقك يقتل الفرح. انظر لمن دونك تحفظ النعمة وتزداد شكرًا.",
    explainEn: "Comparing upward kills joy. Looking at those with less protects gratitude.",
  },

  // ══════════ زعلان ══════════
  {
    mood: "sad", type: "quran", ref: "الشرح: ٥–٦",
    ar: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا",
    en: "For indeed, with hardship [will be] ease. Indeed, with hardship [will be] ease.",
    explainAr: "كُرّرت مرتين تأكيدًا: اليسر ملازم للعسر لا متأخر عنه فقط. بعد كل ضيق فرج.",
    explainEn: "Repeated twice for emphasis: ease accompanies hardship — relief is woven into the difficulty.",
  },
  {
    mood: "sad", type: "quran", ref: "البقرة: ٢٨٦",
    ar: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا",
    en: "Allah does not charge a soul except [with that within] its capacity.",
    explainAr: "من آخر البقرة. ما حمّلك الله فوق طاقتك. الحزن الثقيل أنت أقوى منه بإذن الله.",
    explainEn: "From the end of Al-Baqarah. Nothing placed on you is beyond what you can bear with Allah’s help.",
  },
  {
    mood: "sad", type: "quran", ref: "آل عمران: ١٣٩",
    ar: "وَلَا تَهِنُوا وَلَا تَحْزَنُوا وَأَنتُمُ الْأَعْلَوْنَ إِن كُنتُم مُّؤْمِنِينَ",
    en: "So do not weaken and do not grieve, and you will be superior if you are [true] believers.",
    explainAr: "بعد أحد، والمسلمون مجروحون. النهي عن الوهن والحزن مع تثبيت رفعة الإيمان.",
    explainEn: "After Uhud, while believers were wounded — a call not to weaken, with the honor of faith affirmed.",
  },
  {
    mood: "sad", type: "quran", ref: "الشرح: ١–٣",
    ar: "أَلَمْ نَشْرَحْ لَكَ صَدْرَكَ ۝ وَوَضَعْنَا عَنكَ وِزْرَكَ ۝ الَّذِي أَنقَضَ ظَهْرَكَ",
    en: "Did We not expand for you your breast, and remove from you your burden which had weighed upon your back?",
    explainAr: "تذكير للنبي ﷺ بنعم الله بعد الشدة. من ضاق صدره يسأل الله الشرح كما شُرح لرسوله.",
    explainEn: "Allah reminds the Prophet of relief after pressure. When the chest tightens, ask for the same expansion.",
  },
  {
    mood: "sad", type: "quran", ref: "يوسف: ٨٦",
    ar: "قَالَ إِنَّمَا أَشْكُو بَثِّي وَحُزْنِي إِلَى اللَّهِ",
    en: "He said: I only complain of my suffering and my grief to Allah.",
    explainAr: "قول يعقوب عليه السلام. الشكوى إلى الله ليست ضعفًا؛ هي أقرب طريق للتفريج.",
    explainEn: "Ya‘qub’s words. Pouring grief to Allah is not weakness — it is the nearest path to relief.",
  },
  {
    mood: "sad", type: "hadith", ref: "الترمذي",
    ar: "وَاعْلَمْ أَنَّ النَّصْرَ مَعَ الصَّبْرِ، وَأَنَّ الْفَرَجَ مَعَ الْكَرْبِ، وَأَنَّ مَعَ الْعُسْرِ يُسْرًا",
    en: "Know that victory comes with patience, relief with distress, and with hardship comes ease.",
    explainAr: "من حديث وصية النبي ﷺ لابن عباس. قاعدة ثابتة: بعد الكرب فرج.",
    explainEn: "From the Prophet’s counsel to Ibn Abbas. A fixed rule: after distress comes relief.",
  },

  // ══════════ قلق ══════════
  {
    mood: "anxious", type: "quran", ref: "الرعد: ٢٨",
    ar: "الَّذِينَ آمَنُوا وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ اللَّهِ ۗ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ",
    en: "Those who have believed and whose hearts are assured by the remembrance of Allah. Unquestionably, by the remembrance of Allah hearts are assured.",
    explainAr: "الطمأنينة ليست في السيطرة على كل شيء؛ هي في ذكر الله. القلق يذوب مع الذكر الصادق.",
    explainEn: "Calm is not control of everything — it is remembrance of Allah. Anxiety softens with sincere dhikr.",
  },
  {
    mood: "anxious", type: "quran", ref: "الطلاق: ٣",
    ar: "وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ ۚ إِنَّ اللَّهَ بَالِغُ أَمْرِهِ",
    en: "And whoever relies upon Allah — then He is sufficient for him. Indeed, Allah will accomplish His purpose.",
    explainAr: "التوكل ليس ترك العمل؛ هو العمل مع سكون القلب أن النتيجة عند الله.",
    explainEn: "Reliance is not quitting effort — it is effort with a calm heart that the outcome is with Allah.",
  },
  {
    mood: "anxious", type: "quran", ref: "البقرة: ١٥٣",
    ar: "يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ",
    en: "O you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.",
    explainAr: "وصفة قرآنية للقلق: صبر + صلاة. والمعية الإلهية للصابرين.",
    explainEn: "A Quranic prescription for anxiety: patience and prayer — and Allah is with the patient.",
  },
  {
    mood: "anxious", type: "quran", ref: "الأنفال: ٢",
    ar: "إِنَّمَا الْمُؤْمِنُونَ الَّذِينَ إِذَا ذُكِرَ اللَّهُ وَجِلَتْ قُلُوبُهُمْ",
    en: "The believers are only those who, when Allah is mentioned, their hearts become fearful.",
    explainAr: "وجل القلب عند الذكر ليس رعبًا مدمّرًا؛ هو خشوع يطرد القلق الفارغ.",
    explainEn: "A heart that trembles at remembrance is not ruined by fear — it is humbled, and empty anxiety fades.",
  },
  {
    mood: "anxious", type: "hadith", ref: "البخاري",
    ar: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْجُبْنِ وَالْبُخْلِ، وَضَلَعِ الدَّيْنِ وَغَلَبَةِ الرِّجَالِ",
    en: "O Allah, I seek refuge in You from anxiety and sorrow, weakness and laziness, miserliness and cowardice, the burden of debt and from being overpowered by men.",
    explainAr: "دعاء نبوي جامع. الهمّ والحزن يُعاذان بالله؛ هذا علاج عملي تكرره عند ضيق الصدر.",
    explainEn: "A comprehensive prophetic dua. Anxiety and grief are sought refuge from in Allah — a practical remedy to repeat.",
  },
  {
    mood: "anxious", type: "hadith", ref: "الترمذي",
    ar: "مَنْ قَالَ: حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ، سَبْعَ مَرَّاتٍ… كَفَاهُ اللَّهُ مَا أَهَمَّهُ",
    en: "Whoever says: Sufficient for me is Allah… seven times, Allah will suffice him against what concerns him.",
    explainAr: "من أذكار الصباح/المساء المشهورة. تكرار «حسبي الله» يسكّن القلب عند الهم.",
    explainEn: "A well-known morning/evening remembrance. Repeating “Hasbunallah” settles the heart under worry.",
  },

  // ══════════ يأس ══════════
  {
    mood: "despair", type: "quran", ref: "الزمر: ٥٣",
    ar: "قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَىٰ أَنفُسِهِمْ لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ ۚ إِنَّ اللَّهَ يَغْفِرُ الذُّنُوبَ جَمِيعًا ۚ إِنَّهُ هُوَ الْغَفُورُ الرَّحِيمُ",
    en: "Say: O My servants who have transgressed against themselves, do not despair of the mercy of Allah. Indeed, Allah forgives all sins. Indeed, it is He who is the Forgiving, the Merciful.",
    explainAr: "من أرجى آيات القرآن. نزلت تفتح باب التوبة لمن أسرف. اليأس من الرحمة أخطر من الذنب نفسه.",
    explainEn: "Among the most hopeful verses — opening the door of repentance. Despairing of mercy is graver than the sin itself.",
  },
  {
    mood: "despair", type: "quran", ref: "يوسف: ٨٧",
    ar: "يَا بَنِيَّ اذْهَبُوا فَتَحَسَّسُوا مِن يُوسُفَ وَأَخِيهِ وَلَا تَيْأَسُوا مِن رَّوْحِ اللَّهِ ۖ إِنَّهُ لَا يَيْأَسُ مِن رَّوْحِ اللَّهِ إِلَّا الْقَوْمُ الْكَافِرُونَ",
    en: "O my sons, go and find out about Joseph and his brother and do not despair of relief from Allah. Indeed, no one despairs of relief from Allah except the disbelieving people.",
    explainAr: "يعقوب بعد سنين فراق. حتى في أطول غياب يُنهى عن اليأس. روح الله قريب.",
    explainEn: "Ya‘qub after years of separation. Even in the longest absence, despair is forbidden. Allah’s relief is near.",
  },
  {
    mood: "despair", type: "quran", ref: "الحجر: ٥٦",
    ar: "قَالَ وَمَن يَقْنَطُ مِن رَّحْمَةِ رَبِّهِ إِلَّا الضَّالُّونَ",
    en: "He said: And who despairs of the mercy of his Lord except for those astray?",
    explainAr: "قول إبراهيم عليه السلام. القنوط علامة ضلال الطريق لا علامة صدق الألم.",
    explainEn: "Ibrahim’s words. Despair marks a lost path — not the honesty of pain.",
  },
  {
    mood: "despair", type: "quran", ref: "الطلاق: ٧",
    ar: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا مَا آتَاهَا ۚ سَيَجْعَلُ اللَّهُ بَعْدَ عُسْرٍ يُسْرًا",
    en: "Allah does not charge a soul except [according to] what He has given it. Allah will bring about, after hardship, ease.",
    explainAr: "وعد صريح: بعد العسر يسر. ليس تمنّيًا؛ إخبار من الله.",
    explainEn: "An explicit promise: after hardship, ease. Not a wish — a statement from Allah.",
  },
  {
    mood: "despair", type: "hadith", ref: "الترمذي",
    ar: "وَاعْلَمْ أَنَّ النَّصْرَ مَعَ الصَّبْرِ، وَأَنَّ الْفَرَجَ مَعَ الْكَرْبِ، وَأَنَّ مَعَ الْعُسْرِ يُسْرًا",
    en: "Know that victory comes with patience, relief with affliction, and ease with hardship.",
    explainAr: "ثلاثية نبوية تُقرأ عند اليأس: صبر → نصر، كرب → فرج، عسر → يسر.",
    explainEn: "A prophetic triad for despair: patience→victory, distress→relief, hardship→ease.",
  },

  // ══════════ تعبان ══════════
  {
    mood: "tired", type: "quran", ref: "البقرة: ٢٨٦",
    ar: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا اكْتَسَبَتْ",
    en: "Allah does not charge a soul except [with that within] its capacity. It will have what it has gained, and it will bear what it has earned.",
    explainAr: "التعب جزء من التكليف المحتمل. لا يُطلب منك المستحيل؛ يُطلب منك ما تطيق ثم تستعين.",
    explainEn: "Fatigue is within what can be borne. You are not asked the impossible — only what you can carry, with help from Allah.",
  },
  {
    mood: "tired", type: "quran", ref: "البقرة: ٤٥",
    ar: "وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ وَإِنَّهَا لَكَبِيرَةٌ إِلَّا عَلَى الْخَاشِعِينَ",
    en: "And seek help through patience and prayer, and indeed it is difficult except for the humbly submissive.",
    explainAr: "عند الإنهاك: صلاة قصيرة وصبر. حتى لو ثقيلة على النفس؛ الخشوع يخففها.",
    explainEn: "When drained: brief prayer and patience. Heavy on the self — humility lightens it.",
  },
  {
    mood: "tired", type: "quran", ref: "الشرح: ٧–٨",
    ar: "فَإِذَا فَرَغْتَ فَانصَبْ ۝ وَإِلَىٰ رَبِّكَ فَارْغَبْ",
    en: "So when you have finished [your duties], then stand up [for worship]. And to your Lord direct [your] longing.",
    explainAr: "بعد الفراغ من عمل؛ لا فراغ للفراغ. التعب يُحوَّل لرغبة إلى الله لا لليأس.",
    explainEn: "After finishing a task, turn longing to your Lord. Exhaustion becomes direction — not despair.",
  },
  {
    mood: "tired", type: "hadith", ref: "مسلم",
    ar: "الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ، وَفِي كُلٍّ خَيْرٌ ۚ احْرِصْ عَلَى مَا يَنْفَعُكَ، وَاسْتَعِنْ بِاللَّهِ وَلَا تَعْجَزْ",
    en: "The strong believer is better and more beloved to Allah than the weak believer, and there is good in both. Be eager for what benefits you, seek help from Allah, and do not give up.",
    explainAr: "القوة المحبوبة: حرص + استعانة + رفض العجز. التعب لا يبرر الاستسلام.",
    explainEn: "Beloved strength: eagerness, seeking help, refusing helplessness. Tiredness is not a license to quit.",
  },
  {
    mood: "tired", type: "hadith", ref: "البخاري",
    ar: "خُذُوا مِنَ الْعَمَلِ مَا تُطِيقُونَ، فَإِنَّ اللَّهَ لَا يَمَلُّ حَتَّى تَمَلُّوا",
    en: "Take on only as much work as you can bear, for Allah does not grow weary until you grow weary.",
    explainAr: "الاعتدال سنة. لا تُنهك نفسك ثم تنقطع؛ اعمل بقدر تطيق وتداوم.",
    explainEn: "Moderation is sunnah. Don’t burn out and stop — work at a pace you can sustain.",
  },

  // ══════════ فاقد الشغف ══════════
  {
    mood: "nofire", type: "quran", ref: "الزلزلة: ٧–٨",
    ar: "فَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُ ۝ وَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ شَرًّا يَرَهُ",
    en: "So whoever does an atom’s weight of good will see it, and whoever does an atom’s weight of evil will see it.",
    explainAr: "حتى الذرة محسوبة. الشغف قد يخفت؛ العمل الصغير لا يضيع.",
    explainEn: "Even an atom is counted. Passion may fade — small good work is never lost.",
  },
  {
    mood: "nofire", type: "quran", ref: "الكهف: ٣٠",
    ar: "إِنَّ الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ إِنَّا لَا نُضِيعُ أَجْرَ مَنْ أَحْسَنَ عَمَلًا",
    en: "Indeed, those who have believed and done righteous deeds — indeed, We will not allow to be lost the reward of any who did well in deeds.",
    explainAr: "الأجر محفوظ حتى لو لم تشعر بالحماس. الإحسان لا يُضيَّع.",
    explainEn: "Reward is kept even when you feel no fire. Excellence is never wasted.",
  },
  {
    mood: "nofire", type: "quran", ref: "النجم: ٣٩–٤١",
    ar: "وَأَن لَّيْسَ لِلْإِنسَانِ إِلَّا مَا سَعَىٰ ۝ وَأَنَّ سَعْيَهُ سَوْفَ يُرَىٰ ۝ ثُمَّ يُجْزَاهُ الْجَزَاءَ الْأَوْفَىٰ",
    en: "And that there is not for man except that for which he strives, and that his effort is going to be seen — then he will be recompensed for it with the fullest recompense.",
    explainAr: "السعي هو ملكك. النتيجة عند الله؛ أنت مسؤول عن الخطوة لا عن الشغف الدائم.",
    explainEn: "Effort is yours. Outcome is with Allah — you own the step, not permanent passion.",
  },
  {
    mood: "nofire", type: "hadith", ref: "البخاري",
    ar: "أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ",
    en: "The most beloved deeds to Allah are the most consistent, even if small.",
    explainAr: "الثبات أحب من الاندفاع المنقطع. قليل دائم خير من كثير منقطع.",
    explainEn: "Consistency is more beloved than a burst that dies. Little that lasts beats much that stops.",
  },
  {
    mood: "nofire", type: "hadith", ref: "مسلم",
    ar: "سَدِّدُوا وَقَارِبُوا وَأَبْشِرُوا",
    en: "Be upright, draw near, and receive glad tidings.",
    explainAr: "لا يُطلب الكمال كل يوم. سدد وقارب: اقترب من الصواب واستمر.",
    explainEn: "Perfection every day is not required. Aim right, draw near, keep going.",
  },

  // ══════════ أمل ══════════
  {
    mood: "hope", type: "quran", ref: "الطلاق: ٢–٣",
    ar: "وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا ۝ وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ ۚ وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ",
    en: "And whoever fears Allah — He will make for him a way out and provide for him from where he does not expect. And whoever relies upon Allah — then He is sufficient for him.",
    explainAr: "مخرج من حيث لا تحتسب. الأمل الشرعي مربوط بالتقوى والتوكل لا بالتمني الفارغ.",
    explainEn: "A way out from where you don’t expect. Hope is tied to taqwa and reliance — not empty wishing.",
  },
  {
    mood: "hope", type: "quran", ref: "البقرة: ٢١٦",
    ar: "وَعَسَىٰ أَن تَكْرَهُوا شَيْئًا وَهُوَ خَيْرٌ لَّكُمْ ۖ وَعَسَىٰ أَن تُحِبُّوا شَيْئًا وَهُوَ شَرٌّ لَّكُمْ ۗ وَاللَّهُ يَعْلَمُ وَأَنتُمْ لَا تَعْلَمُونَ",
    en: "But perhaps you hate a thing and it is good for you; and perhaps you love a thing and it is bad for you. And Allah knows, while you know not.",
    explainAr: "ما تكرهه قد يكون باب خير. الأمل أن تدبير الله أوسع من مزاجك اللحظي.",
    explainEn: "What you hate may be a door to good. Hope is that Allah’s plan is wider than your mood.",
  },
  {
    mood: "hope", type: "quran", ref: "غافر: ٦٠",
    ar: "وَقَالَ رَبُّكُمُ ادْعُونِي أَسْتَجِبْ لَكُمْ",
    en: "And your Lord says: Call upon Me; I will respond to you.",
    explainAr: "أمر ووعد: ادعُ → أستجب. الأمل حي ما دامت القنوات مفتوحة بالدعاء.",
    explainEn: "A command and a promise: call — I respond. Hope lives while the door of dua is open.",
  },
  {
    mood: "hope", type: "quran", ref: "الضحى: ٤–٥",
    ar: "وَلَلْآخِرَةُ خَيْرٌ لَّكَ مِنَ الْأُولَىٰ ۝ وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ",
    en: "And the Hereafter is better for you than the first [life]. And your Lord is going to give you, and you will be satisfied.",
    explainAr: "بعد فترة انقطاع الوحي وغمّ النبي ﷺ. وعد بالعطاء والرضا. الأمل بعد الانقطاع سنة كونية.",
    explainEn: "After a pause in revelation and the Prophet’s distress — a promise of giving and contentment. Hope after interruption is the pattern.",
  },
  {
    mood: "hope", type: "hadith", ref: "البخاري",
    ar: "أَنَا عِنْدَ ظَنِّ عَبْدِي بِي، وَأَنَا مَعَهُ إِذَا ذَكَرَنِي",
    en: "I am as My servant thinks I am, and I am with him when he remembers Me. (Hadith Qudsi)",
    explainAr: "حسن الظن بالله جزء من الأمل. ظنّ الخير يُقابَل بالعطاء.",
    explainEn: "Thinking well of Allah is part of hope. Good expectation is met with giving.",
  },

  // ══════════ غضب ══════════
  {
    mood: "angry", type: "quran", ref: "آل عمران: ١٣٤",
    ar: "الَّذِينَ يُنفِقُونَ فِي السَّرَّاءِ وَالضَّرَّاءِ وَالْكَاظِمِينَ الْغَيْظَ وَالْعَافِينَ عَنِ النَّاسِ ۗ وَاللَّهُ يُحِبُّ الْمُحْسِنِينَ",
    en: "Those who spend in ease and hardship, who restrain anger, and who pardon the people — and Allah loves the doers of good.",
    explainAr: "كظم الغيظ والعفو من صفات المحسنين. الغضب لا يُلغى؛ يُملَك.",
    explainEn: "Restraining rage and pardoning are marks of excellence. Anger isn’t erased — it is mastered.",
  },
  {
    mood: "angry", type: "quran", ref: "فصلت: ٣٤",
    ar: "وَلَا تَسْتَوِي الْحَسَنَةُ وَلَا السَّيِّئَةُ ۚ ادْفَعْ بِالَّتِي هِيَ أَحْسَنُ فَإِذَا الَّذِي بَيْنَكَ وَبَيْنَهُ عَدَاوَةٌ كَأَنَّهُ وَلِيٌّ حَمِيمٌ",
    en: "Not equal are the good deed and the bad. Repel [evil] by that which is better; and thereupon the one between whom and you was enmity will become as though he was a devoted friend.",
    explainAr: "ردّ السيئة بالحسنى يحوّل العدو. الغضب يُكسَر بالإحسان لا بمزيد غضب.",
    explainEn: "Repelling with better turns an enemy. Anger is broken by goodness — not more anger.",
  },
  {
    mood: "angry", type: "hadith", ref: "البخاري",
    ar: "لَيْسَ الشَّدِيدُ بِالصُّرَعَةِ، إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِنْدَ الْغَضَبِ",
    en: "The strong person is not the one who throws others down; the strong is the one who controls himself when angry.",
    explainAr: "تعريف النبوة للقوة: ملك النفس لا صرع الناس.",
    explainEn: "Prophetic definition of strength: self-mastery — not overpowering people.",
  },
  {
    mood: "angry", type: "hadith", ref: "أبي داود",
    ar: "إِذَا غَضِبَ أَحَدُكُمْ وَهُوَ قَائِمٌ فَلْيَجْلِسْ، فَإِنْ ذَهَبَ عَنْهُ الْغَضَبُ وَإِلَّا فَلْيَضْطَجِعْ",
    en: "If one of you becomes angry while standing, let him sit; if the anger leaves, fine — otherwise let him lie down.",
    explainAr: "علاج عملي نبوي: غيّر وضع جسدك ليهدأ قلبك.",
    explainEn: "A practical prophetic cure: change your posture so the heart can cool.",
  },

  // ══════════ وحدة ══════════
  {
    mood: "lonely", type: "quran", ref: "التوبة: ٤٠",
    ar: "إِذْ يَقُولُ لِصَاحِبِهِ لَا تَحْزَنْ إِنَّ اللَّهَ مَعَنَا",
    en: "When he said to his companion: Do not grieve; indeed Allah is with us.",
    explainAr: "في الغار مع أبي بكر. الوحدة الظاهرية لا تنفي المعية. الله أقرب من الوحشة.",
    explainEn: "In the cave with Abu Bakr. Apparent solitude does not cancel Allah’s company.",
  },
  {
    mood: "lonely", type: "quran", ref: "البقرة: ١٥٢",
    ar: "فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ",
    en: "So remember Me; I will remember you. And be grateful to Me and do not deny Me.",
    explainAr: "معادلة: تذكره فيذكرك. الوحدة تنكسر بذكر يفتح باب المعية.",
    explainEn: "A pact: remember Him, He remembers you. Loneliness breaks with remembrance that opens company.",
  },
  {
    mood: "lonely", type: "quran", ref: "ق: ١٦",
    ar: "وَلَقَدْ خَلَقْنَا الْإِنسَانَ وَنَعْلَمُ مَا تُوَسْوِسُ بِهِ نَفْسُهُ ۖ وَنَحْنُ أَقْرَبُ إِلَيْهِ مِنْ حَبْلِ الْوَرِيدِ",
    en: "And We have already created man and know what his soul whispers to him, and We are closer to him than [his] jugular vein.",
    explainAr: "أقرب من حبل الوريد. حتى وسوسة وحدتك معلومة عنده.",
    explainEn: "Closer than the jugular vein. Even the whisper of your loneliness is known to Him.",
  },
  {
    mood: "lonely", type: "hadith", ref: "البخاري",
    ar: "أَنَا مَعَ عَبْدِي إِذَا ذَكَرَنِي وَتَحَرَّكَتْ بِي شَفَتَاهُ",
    en: "I am with My servant when he remembers Me and his lips move with My mention. (Hadith Qudsi)",
    explainAr: "المعِيّة تُستحضَر بتحريك الشفتين بالذكر. لست وحدك وأنت تذكر.",
    explainEn: "Company is present when the lips move in remembrance. You are not alone while you remember.",
  },

  // ══════════ مذاكرة ══════════
  {
    mood: "study", type: "quran", ref: "طه: ١١٤",
    ar: "وَقُل رَّبِّ زِدْنِي عِلْمًا",
    en: "And say: My Lord, increase me in knowledge.",
    explainAr: "الدعاء الوحيد في القرآن بطلب الزيادة في العلم. اجعله ورد المذاكرة.",
    explainEn: "The only Quranic request for increase in knowledge. Make it your study litany.",
  },
  {
    mood: "study", type: "quran", ref: "المجادلة: ١١",
    ar: "يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ ۚ وَاللَّهُ بِمَا تَعْمَلُونَ خَبِيرٌ",
    en: "Allah will raise those who have believed among you and those who were given knowledge, by degrees. And Allah is Acquainted with what you do.",
    explainAr: "العلم يرفع درجات. كل جلسة مذاكرة استثمار في رفعة بإذن الله.",
    explainEn: "Knowledge raises ranks. Every study session is an investment in elevation, by Allah’s leave.",
  },
  {
    mood: "study", type: "quran", ref: "الزمر: ٩",
    ar: "قُلْ هَلْ يَسْتَوِي الَّذِينَ يَعْلَمُونَ وَالَّذِينَ لَا يَعْلَمُونَ ۗ إِنَّمَا يَتَذَكَّرُ أُولُو الْأَلْبَابِ",
    en: "Say: Are those who know equal to those who do not know? Only people of understanding will remember.",
    explainAr: "نفي المساواة يحرّك الهمّة. لست كمن لا يعلم إن صبرت على الطلب.",
    explainEn: "Denying equality stirs resolve. You are not like those who do not know — if you endure the path.",
  },
  {
    mood: "study", type: "quran", ref: "العلق: ١–٥",
    ar: "اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ ۝ خَلَقَ الْإِنسَانَ مِنْ عَلَقٍ ۝ اقْرَأْ وَرَبُّكَ الْأَكْرَمُ ۝ الَّذِي عَلَّمَ بِالْقَلَمِ ۝ عَلَّمَ الْإِنسَانَ مَا لَمْ يَعْلَمْ",
    en: "Recite in the name of your Lord who created… who taught by the pen — taught man that which he knew not.",
    explainAr: "أول ما نزل: اقرأ. العلم مرتبط باسم الله والقلم. ابدأ كل مذاكرة ببسم الله.",
    explainEn: "The first revelation: Read. Knowledge is tied to Allah’s name and the pen. Begin study with His name.",
  },
  {
    mood: "study", type: "quran", ref: "فاطر: ٢٨",
    ar: "إِنَّمَا يَخْشَى اللَّهَ مِنْ عِبَادِهِ الْعُلَمَاءُ",
    en: "Only those fear Allah, from among His servants, who have knowledge.",
    explainAr: "العلم الحقيقي يزيد الخشية لا الغرور. اطلب العلم ليقرّبك لا ليرفعك على الناس.",
    explainEn: "True knowledge increases awe, not arrogance. Seek it to draw near — not to stand over people.",
  },
  {
    mood: "study", type: "hadith", ref: "مسلم",
    ar: "مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا، سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ",
    en: "Whoever travels a path in search of knowledge, Allah will make easy for him a path to Paradise.",
    explainAr: "كل طريق تطلب فيه علمًا يُسهَّل لك به طريق الجنة. جلستك الآن من هذا الطريق.",
    explainEn: "Every path of seeking knowledge eases a path to Paradise. Your seat now is on that path.",
  },
  {
    mood: "study", type: "hadith", ref: "ابن ماجه",
    ar: "طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ",
    en: "Seeking knowledge is an obligation upon every Muslim.",
    explainAr: "فريضة لا نافلة. المذاكرة ليست ترفًا؛ هي من أداء ما عليك.",
    explainEn: "An obligation, not a luxury. Study is part of what is due upon you.",
  },
  {
    mood: "study", type: "hadith", ref: "مسلم",
    ar: "إِذَا مَاتَ الْإِنْسَانُ انْقَطَعَ عَمَلُهُ إِلَّا مِنْ ثَلَاثَةٍ: صَدَقَةٍ جَارِيَةٍ، أَوْ عِلْمٍ يُنْتَفَعُ بِهِ، أَوْ وَلَدٍ صَالِحٍ يَدْعُو لَهُ",
    en: "When a person dies, his deeds end except three: ongoing charity, knowledge benefited from, or a righteous child who prays for him.",
    explainAr: "علم يُنتفع به يبقى بعد الموت. ما تتعلمه اليوم قد يعيش بعدك.",
    explainEn: "Knowledge that benefits remains after death. What you learn today may outlive you.",
  },

  // ══════════ أدعية المذاكرة (قبل / أثناء / بعد) ══════════
  {
    mood: "study", type: "dua", phase: "before", ref: "دعاء قبل المذاكرة",
    ar: "اللَّهُمَّ انْفَعْنِي بِمَا عَلَّمْتَنِي، وَعَلِّمْنِي مَا يَنْفَعُنِي، وَزِدْنِي عِلْمًا",
    en: "O Allah, benefit me with what You have taught me, teach me what benefits me, and increase me in knowledge.",
    explainAr: "قبل ما تبدأ: اطلب النفع والزيادة. العلم بلا نفع عبء، والنفع بلا علم ناقص.",
    explainEn: "Before you begin: ask for benefit and increase. Knowledge without benefit is a burden.",
  },
  {
    mood: "study", type: "dua", phase: "before", ref: "دعاء قبل المذاكرة",
    ar: "رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي وَاحْلُلْ عُقْدَةً مِّن لِّسَانِي يَفْقَهُوا قَوْلِي",
    en: "My Lord, expand for me my breast, ease my task, and untie the knot from my tongue so they may understand my speech.",
    explainAr: "دعاء موسى عليه السلام. اطلب شرح الصدر وتيسير الأمر قبل الجلسة.",
    explainEn: "The prayer of Musa. Ask for an expanded chest and ease before the session.",
  },
  {
    mood: "study", type: "dua", phase: "during", ref: "دعاء أثناء المذاكرة",
    ar: "اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا، وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا",
    en: "O Allah, nothing is easy except what You make easy, and You make the difficult easy if You will.",
    explainAr: "لما يتعقد عليك جزء: ذكّر نفسك أن التيسير بيد الله، واستمر.",
    explainEn: "When a part gets hard: remind yourself ease is from Allah, and keep going.",
  },
  {
    mood: "study", type: "dua", phase: "during", ref: "دعاء أثناء المذاكرة",
    ar: "يَا مُعَلِّمَ إِبْرَاهِيمَ عَلِّمْنِي، وَيَا مُفَهِّمَ سُلَيْمَانَ فَهِّمْنِي",
    en: "O Teacher of Ibrahim, teach me; O One who gave understanding to Sulayman, grant me understanding.",
    explainAr: "دعاء مشهور لطلب الفهم. كرّره لما يقفز المعنى منك أثناء الجلسة.",
    explainEn: "A well-known dua for understanding. Repeat it when meaning slips during the session.",
  },
  {
    mood: "study", type: "dua", phase: "after", ref: "دعاء بعد المذاكرة",
    ar: "اللَّهُمَّ إِنِّي أَسْتَوْدِعُكَ مَا قَرَأْتُ وَمَا حَفِظْتُ وَمَا تَعَلَّمْتُ، فَرُدَّهُ عَلَيَّ عِنْدَ حَاجَتِي إِلَيْهِ",
    en: "O Allah, I entrust to You what I have read, memorized, and learned; return it to me when I need it.",
    explainAr: "بعد ما تخلّص: استودع ما أخذت عند الله ليرده لك وقت الحاجة (امتحان أو عمل).",
    explainEn: "After you finish: entrust what you learned to Allah so He returns it when you need it.",
  },
  {
    mood: "study", type: "dua", phase: "after", ref: "دعاء بعد المذاكرة",
    ar: "الْحَمْدُ لِلَّهِ الَّذِي بِنِعْمَتِهِ تَتِمُّ الصَّالِحَاتُ",
    en: "Praise be to Allah by whose favor good deeds are completed.",
    explainAr: "اختم بالحمد. الجلسة نعمة؛ الشكر يثبتها ويفتح لما بعدها.",
    explainEn: "End with praise. The session is a blessing; gratitude secures it and opens what follows.",
  },

];

const SEEN_KEY = "twoTongues.motivQuotesSeen";

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

function normalizeQuote(q, index) {
  return {
    ...q,
    index,
    en: q.en,
    ar: q.ar,
    explainAr: q.explainAr || "",
    explainEn: q.explainEn || "",
  };
}

export function getRandomQuote(excludeIndex = -1, mood = null) {
  if (mood) {
    const filtered = MOTIVATIONAL_QUOTES
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => q.mood === mood);
    if (filtered.length) {
      const n = MOTIVATIONAL_QUOTES.length;
      let seen = loadSeen().filter((i) => i >= 0 && i < n);
      let available = filtered.filter(({ i }) => !seen.includes(i) && i !== excludeIndex);
      if (available.length === 0) {
        available = filtered.filter(({ i }) => i !== excludeIndex);
        if (available.length === 0) available = filtered;
      }
      const pick = available[Math.floor(Math.random() * available.length)];
      const nextSeen = seen.includes(pick.i) ? seen : [...seen, pick.i];
      saveSeen(nextSeen);
      return normalizeQuote(pick.q, pick.i);
    }
  }

  const n = MOTIVATIONAL_QUOTES.length;
  if (n === 0) return { en: "", ar: "", index: -1 };

  let seen = loadSeen().filter((i) => i >= 0 && i < n);
  let available = [];
  for (let i = 0; i < n; i++) {
    if (!seen.includes(i) && i !== excludeIndex) available.push(i);
  }
  if (available.length === 0) {
    seen = [];
    saveSeen(seen);
    for (let i = 0; i < n; i++) {
      if (i !== excludeIndex) available.push(i);
    }
    if (available.length === 0) available = [0];
  }

  const i = available[Math.floor(Math.random() * available.length)];
  saveSeen(seen.includes(i) ? seen : [...seen, i]);
  return normalizeQuote(MOTIVATIONAL_QUOTES[i], i);
}

export function getQuotesByMood(mood) {
  return MOTIVATIONAL_QUOTES
    .map((q, i) => normalizeQuote(q, i))
    .filter((q) => q.mood === mood);
}

export function getQuoteCount() {
  return MOTIVATIONAL_QUOTES.length;
}

export function getRemainingQuoteCount() {
  const n = MOTIVATIONAL_QUOTES.length;
  const seen = loadSeen().filter((i) => i >= 0 && i < n);
  return Math.max(0, n - seen.length);
}
