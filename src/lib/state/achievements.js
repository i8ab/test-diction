// Achievement definitions + unlock evaluation (per-account, stored in account.achievements[]).

export const ACHIEVEMENTS = [
  { id: "first_word", icon: "🌱", en: "First steps", ar: "أول خطوة", descEn: "Study your first word", descAr: "اتعلّم أول كلمة" },
  { id: "words_50", icon: "📚", en: "Collector", ar: "جامع كلمات", descEn: "Study 50 words", descAr: "اتعلّم ٥٠ كلمة" },
  { id: "words_200", icon: "🏛️", en: "Scholar", ar: "عالم", descEn: "Study 200 words", descAr: "اتعلّم ٢٠٠ كلمة" },
  { id: "streak_7", icon: "🔥", en: "Week warrior", ar: "محارب الأسبوع", descEn: "7-day streak", descAr: "سلسلة ٧ أيام" },
  { id: "streak_30", icon: "💎", en: "Unstoppable", ar: "لا يُوقف", descEn: "30-day streak", descAr: "سلسلة ٣٠ يوم" },
  { id: "quiz_1", icon: "✅", en: "Quiz starter", ar: "بداية الاختبارات", descEn: "Finish 1 quiz", descAr: "خلّص اختبار واحد" },
  { id: "quiz_10", icon: "🎯", en: "Quiz master", ar: "ملك الاختبارات", descEn: "Finish 10 quizzes", descAr: "خلّص ١٠ اختبارات" },
  { id: "perfect_quiz", icon: "🌟", en: "Flawless", ar: "بلا خطأ", descEn: "Score 100% on a quiz (5+ questions)", descAr: "نتيجة ١٠٠٪ في اختبار (٥ أسئلة فأكثر)" },
  { id: "srs_master_10", icon: "🧠", en: "Memory pro", ar: "ذاكرة قوية", descEn: "10 words at mastered SRS level", descAr: "١٠ كلمات في مستوى الإتقان" },
  { id: "timer_60", icon: "⏱️", en: "Focused hour", ar: "ساعة تركيز", descEn: "Accumulate 60 study minutes", descAr: "اجمع ٦٠ دقيقة مذاكرة" },
  { id: "dictation_5", icon: "🎧", en: "Good ear", ar: "أذن قوية", descEn: "Complete 5 dictation rounds", descAr: "خلّص ٥ جولات إملاء" },
  { id: "favorites_20", icon: "⭐", en: "Curator", ar: "منسّق", descEn: "Bookmark 20 favorites", descAr: "ثبّت ٢٠ كلمة مفضلة" },
];

/**
 * Evaluate which achievements should unlock given current account stats.
 * Returns array of newly unlocked achievement ids (not already in account.achievements).
 */
export function evaluateAchievements(account, { streak = 0, srsBox = {}, timerMinutesTotal = 0, dictationRounds = 0 } = {}) {
  if (!account) return [];
  const have = new Set(account.achievements || []);
  const studied = (account.studied || []).length;
  const quizzes = (account.quizHistory || []).length;
  const perfect = (account.quizHistory || []).some(
    (q) => q.total >= 5 && q.correct === q.total
  );
  const favorites = (account.favorites || []).length;
  let mastered = 0;
  for (const id of Object.keys(srsBox || {})) {
    if (srsBox[id] >= 5) mastered += 1;
  }

  const checks = [
    ["first_word", studied >= 1],
    ["words_50", studied >= 50],
    ["words_200", studied >= 200],
    ["streak_7", streak >= 7],
    ["streak_30", streak >= 30],
    ["quiz_1", quizzes >= 1],
    ["quiz_10", quizzes >= 10],
    ["perfect_quiz", perfect],
    ["srs_master_10", mastered >= 10],
    ["timer_60", timerMinutesTotal >= 60],
    ["dictation_5", dictationRounds >= 5],
    ["favorites_20", favorites >= 20],
  ];

  const newly = [];
  for (const [id, ok] of checks) {
    if (ok && !have.has(id)) newly.push(id);
  }
  return newly;
}

export function achievementById(id) {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
