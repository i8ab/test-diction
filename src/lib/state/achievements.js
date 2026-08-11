// Achievement sections — each track has 10 levels. Unlock ids stay stable
// so existing account.achievements[] data still matches.

export const ACHIEVEMENT_SECTIONS = [
  {
    id: "study",
    icon: "📚",
    en: "Studying words",
    ar: "مذاكرة الكلمات",
    descEn: "Mark words as studied",
    descAr: "علّم كلمات كمُذاكرة",
    metric: "studied",
    levels: [
      { id: "first_word", n: 1, threshold: 1, en: "First word", ar: "أول كلمة" },
      { id: "study_2", n: 2, threshold: 5, en: "5 words", ar: "٥ كلمات" },
      { id: "study_3", n: 3, threshold: 15, en: "15 words", ar: "١٥ كلمة" },
      { id: "study_4", n: 4, threshold: 30, en: "30 words", ar: "٣٠ كلمة" },
      { id: "words_50", n: 5, threshold: 50, en: "50 words", ar: "٥٠ كلمة" },
      { id: "study_6", n: 6, threshold: 75, en: "75 words", ar: "٧٥ كلمة" },
      { id: "study_7", n: 7, threshold: 100, en: "100 words", ar: "١٠٠ كلمة" },
      { id: "study_8", n: 8, threshold: 150, en: "150 words", ar: "١٥٠ كلمة" },
      { id: "words_200", n: 9, threshold: 200, en: "200 words", ar: "٢٠٠ كلمة" },
      { id: "study_10", n: 10, threshold: 300, en: "300 words", ar: "٣٠٠ كلمة" },
    ],
  },
  {
    id: "streak",
    icon: "🔥",
    en: "Daily streak",
    ar: "سلسلة الأيام",
    descEn: "Study on consecutive days",
    descAr: "ذاكر أيام ورا بعض",
    metric: "streak",
    levels: [
      { id: "streak_1", n: 1, threshold: 1, en: "1 day", ar: "يوم واحد" },
      { id: "streak_2", n: 2, threshold: 2, en: "2 days", ar: "يومين" },
      { id: "streak_3", n: 3, threshold: 3, en: "3 days", ar: "٣ أيام" },
      { id: "streak_5", n: 5, threshold: 5, en: "5 days", ar: "٥ أيام" },
      { id: "streak_7", n: 5, threshold: 7, en: "7 days", ar: "٧ أيام" },
      { id: "streak_6", n: 6, threshold: 10, en: "10 days", ar: "١٠ أيام" },
      { id: "streak_14", n: 7, threshold: 14, en: "14 days", ar: "١٤ يوم" },
      { id: "streak_21", n: 8, threshold: 21, en: "21 days", ar: "٢١ يوم" },
      { id: "streak_30", n: 9, threshold: 30, en: "30 days", ar: "٣٠ يوم" },
      { id: "streak_10", n: 10, threshold: 60, en: "60 days", ar: "٦٠ يوم" },
    ],
  },
  {
    id: "quiz",
    icon: "🎯",
    en: "Quizzes",
    ar: "الاختبارات",
    descEn: "Finish quizzes",
    descAr: "خلّص اختبارات",
    metric: "quizzes",
    levels: [
      { id: "quiz_1", n: 1, threshold: 1, en: "1 quiz", ar: "اختبار واحد" },
      { id: "quiz_2", n: 2, threshold: 2, en: "2 quizzes", ar: "اختبارين" },
      { id: "quiz_3", n: 3, threshold: 3, en: "3 quizzes", ar: "٣ اختبارات" },
      { id: "quiz_5", n: 4, threshold: 5, en: "5 quizzes", ar: "٥ اختبارات" },
      { id: "quiz_10", n: 5, threshold: 10, en: "10 quizzes", ar: "١٠ اختبارات" },
      { id: "quiz_6", n: 6, threshold: 15, en: "15 quizzes", ar: "١٥ اختبار" },
      { id: "quiz_7", n: 7, threshold: 25, en: "25 quizzes", ar: "٢٥ اختبار" },
      { id: "quiz_8", n: 8, threshold: 40, en: "40 quizzes", ar: "٤٠ اختبار" },
      { id: "quiz_9", n: 9, threshold: 60, en: "60 quizzes", ar: "٦٠ اختبار" },
      { id: "quiz_10_max", n: 10, threshold: 100, en: "100 quizzes", ar: "١٠٠ اختبار" },
    ],
  },
  {
    id: "perfect",
    icon: "🌟",
    en: "Perfect scores",
    ar: "نتائج كاملة",
    descEn: "100% quizzes (5+ questions)",
    descAr: "اختبارات ١٠٠٪ (٥ أسئلة فأكثر)",
    metric: "perfectQuizzes",
    levels: [
      { id: "perfect_quiz", n: 1, threshold: 1, en: "1 perfect", ar: "واحد كامل" },
      { id: "perfect_2", n: 2, threshold: 2, en: "2 perfect", ar: "اتنين كامل" },
      { id: "perfect_3", n: 3, threshold: 3, en: "3 perfect", ar: "٣ كامل" },
      { id: "perfect_4", n: 4, threshold: 5, en: "5 perfect", ar: "٥ كامل" },
      { id: "perfect_5", n: 5, threshold: 8, en: "8 perfect", ar: "٨ كامل" },
      { id: "perfect_6", n: 6, threshold: 12, en: "12 perfect", ar: "١٢ كامل" },
      { id: "perfect_7", n: 7, threshold: 18, en: "18 perfect", ar: "١٨ كامل" },
      { id: "perfect_8", n: 8, threshold: 25, en: "25 perfect", ar: "٢٥ كامل" },
      { id: "perfect_9", n: 9, threshold: 40, en: "40 perfect", ar: "٤٠ كامل" },
      { id: "perfect_10", n: 10, threshold: 60, en: "60 perfect", ar: "٦٠ كامل" },
    ],
  },
  {
    id: "srs",
    icon: "🧠",
    en: "Memory (SRS)",
    ar: "الذاكرة (SRS)",
    descEn: "Words at mastered SRS level",
    descAr: "كلمات وصلت مستوى الإتقان",
    metric: "mastered",
    levels: [
      { id: "srs_1", n: 1, threshold: 1, en: "1 mastered", ar: "كلمة متقنة" },
      { id: "srs_2", n: 2, threshold: 3, en: "3 mastered", ar: "٣ متقنة" },
      { id: "srs_3", n: 3, threshold: 5, en: "5 mastered", ar: "٥ متقنة" },
      { id: "srs_master_10", n: 4, threshold: 10, en: "10 mastered", ar: "١٠ متقنة" },
      { id: "srs_5", n: 5, threshold: 15, en: "15 mastered", ar: "١٥ متقنة" },
      { id: "srs_6", n: 6, threshold: 25, en: "25 mastered", ar: "٢٥ متقنة" },
      { id: "srs_7", n: 7, threshold: 40, en: "40 mastered", ar: "٤٠ متقنة" },
      { id: "srs_8", n: 8, threshold: 60, en: "60 mastered", ar: "٦٠ متقنة" },
      { id: "srs_9", n: 9, threshold: 80, en: "80 mastered", ar: "٨٠ متقنة" },
      { id: "srs_10", n: 10, threshold: 100, en: "100 mastered", ar: "١٠٠ متقنة" },
    ],
  },
  {
    id: "timer",
    icon: "⏱️",
    en: "Focus time",
    ar: "وقت التركيز",
    descEn: "Accumulated study minutes",
    descAr: "دقائق مذاكرة مجمّعة",
    metric: "timerMinutes",
    levels: [
      { id: "timer_1", n: 1, threshold: 10, en: "10 min", ar: "١٠ دقائق" },
      { id: "timer_2", n: 2, threshold: 30, en: "30 min", ar: "٣٠ دقيقة" },
      { id: "timer_60", n: 3, threshold: 60, en: "1 hour", ar: "ساعة" },
      { id: "timer_4", n: 4, threshold: 120, en: "2 hours", ar: "ساعتين" },
      { id: "timer_5", n: 5, threshold: 180, en: "3 hours", ar: "٣ ساعات" },
      { id: "timer_6", n: 6, threshold: 300, en: "5 hours", ar: "٥ ساعات" },
      { id: "timer_7", n: 7, threshold: 600, en: "10 hours", ar: "١٠ ساعات" },
      { id: "timer_8", n: 8, threshold: 900, en: "15 hours", ar: "١٥ ساعة" },
      { id: "timer_9", n: 9, threshold: 1500, en: "25 hours", ar: "٢٥ ساعة" },
      { id: "timer_10", n: 10, threshold: 3000, en: "50 hours", ar: "٥٠ ساعة" },
    ],
  },
  {
    id: "dictation",
    icon: "🎧",
    en: "Dictation",
    ar: "الإملاء",
    descEn: "Completed dictation rounds",
    descAr: "جولات إملاء مكتملة",
    metric: "dictation",
    levels: [
      { id: "dictation_1", n: 1, threshold: 1, en: "1 round", ar: "جولة واحدة" },
      { id: "dictation_2", n: 2, threshold: 2, en: "2 rounds", ar: "جولتين" },
      { id: "dictation_3", n: 3, threshold: 3, en: "3 rounds", ar: "٣ جولات" },
      { id: "dictation_5", n: 4, threshold: 5, en: "5 rounds", ar: "٥ جولات" },
      { id: "dictation_5b", n: 5, threshold: 8, en: "8 rounds", ar: "٨ جولات" },
      { id: "dictation_6", n: 6, threshold: 12, en: "12 rounds", ar: "١٢ جولة" },
      { id: "dictation_7", n: 7, threshold: 20, en: "20 rounds", ar: "٢٠ جولة" },
      { id: "dictation_8", n: 8, threshold: 30, en: "30 rounds", ar: "٣٠ جولة" },
      { id: "dictation_9", n: 9, threshold: 50, en: "50 rounds", ar: "٥٠ جولة" },
      { id: "dictation_10", n: 10, threshold: 80, en: "80 rounds", ar: "٨٠ جولة" },
    ],
  },
  {
    id: "favorites",
    icon: "⭐",
    en: "Favorites",
    ar: "المفضلة",
    descEn: "Bookmarked words",
    descAr: "كلمات مثبّتة",
    metric: "favorites",
    levels: [
      { id: "fav_1", n: 1, threshold: 1, en: "1 favorite", ar: "مفضلة واحدة" },
      { id: "fav_2", n: 2, threshold: 3, en: "3 favorites", ar: "٣ مفضلة" },
      { id: "fav_3", n: 3, threshold: 5, en: "5 favorites", ar: "٥ مفضلة" },
      { id: "fav_4", n: 4, threshold: 10, en: "10 favorites", ar: "١٠ مفضلة" },
      { id: "favorites_20", n: 5, threshold: 20, en: "20 favorites", ar: "٢٠ مفضلة" },
      { id: "fav_6", n: 6, threshold: 30, en: "30 favorites", ar: "٣٠ مفضلة" },
      { id: "fav_7", n: 7, threshold: 40, en: "40 favorites", ar: "٤٠ مفضلة" },
      { id: "fav_8", n: 8, threshold: 50, en: "50 favorites", ar: "٥٠ مفضلة" },
      { id: "fav_9", n: 9, threshold: 75, en: "75 favorites", ar: "٧٥ مفضلة" },
      { id: "fav_10", n: 10, threshold: 100, en: "100 favorites", ar: "١٠٠ مفضلة" },
    ],
  },
];

/** Flat list for backwards-compatible lookups. */
export const ACHIEVEMENTS = ACHIEVEMENT_SECTIONS.flatMap((sec) =>
  sec.levels.map((lv) => ({
    id: lv.id,
    icon: sec.icon,
    en: lv.en,
    ar: lv.ar,
    descEn: `${sec.en}: ${lv.en}`,
    descAr: `${sec.ar}: ${lv.ar}`,
    sectionId: sec.id,
    threshold: lv.threshold,
    n: lv.n,
  }))
);

export function achievementById(id) {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function buildAchievementStats(account, extra = {}) {
  const studied = (account && account.studied ? account.studied : []).length;
  const quizzes = (account && account.quizHistory ? account.quizHistory : []).length;
  const perfectQuizzes = (account && account.quizHistory ? account.quizHistory : []).filter(
    (q) => q && q.total >= 5 && q.correct === q.total
  ).length;
  const favorites = (account && account.favorites ? account.favorites : []).length;
  const srsBox = extra.srsBox || {};
  let mastered = 0;
  for (const id of Object.keys(srsBox)) {
    if (srsBox[id] >= 5) mastered += 1;
  }
  return {
    studied,
    streak: Number(extra.streak) || 0,
    quizzes,
    perfectQuizzes,
    mastered,
    timerMinutes: Number(extra.timerMinutesTotal) || 0,
    dictation: Number(extra.dictationRounds) || 0,
    favorites,
  };
}

/**
 * Progress for one section: level 0–10, percent toward next level, etc.
 */
export function sectionProgress(section, stats) {
  const value = Number(stats[section.metric]) || 0;
  const levels = section.levels;
  let currentLevel = 0;
  for (let i = 0; i < levels.length; i++) {
    if (value >= levels[i].threshold) currentLevel = i + 1;
  }
  const maxLevel = levels.length;
  if (currentLevel >= maxLevel) {
    return {
      currentLevel: maxLevel,
      maxLevel,
      value,
      nextThreshold: levels[maxLevel - 1].threshold,
      prevThreshold: levels[maxLevel - 1].threshold,
      pctToNext: 100,
      overallPct: 100,
      done: true,
    };
  }
  const next = levels[currentLevel];
  const prevThreshold = currentLevel === 0 ? 0 : levels[currentLevel - 1].threshold;
  const span = Math.max(1, next.threshold - prevThreshold);
  const pctToNext = Math.max(0, Math.min(100, Math.round(((value - prevThreshold) / span) * 100)));
  const overallPct = Math.max(0, Math.min(100, Math.round((currentLevel / maxLevel) * 100 + pctToNext / maxLevel)));
  return {
    currentLevel,
    maxLevel,
    value,
    nextThreshold: next.threshold,
    prevThreshold,
    pctToNext,
    overallPct,
    done: false,
  };
}

/**
 * Evaluate which achievement level ids should unlock.
 * Returns newly unlocked ids (not already in account.achievements).
 */
export function evaluateAchievements(account, extra = {}) {
  if (!account) return [];
  const have = new Set(account.achievements || []);
  const stats = buildAchievementStats(account, extra);
  const newly = [];
  for (const sec of ACHIEVEMENT_SECTIONS) {
    const value = Number(stats[sec.metric]) || 0;
    for (const lv of sec.levels) {
      if (value >= lv.threshold && !have.has(lv.id)) newly.push(lv.id);
    }
  }
  return newly;
}

/**
 * Fire UI toast(s) for newly unlocked achievement ids.
 * Uses the same CustomEvent pattern as level-up (twotongues:levelup).
 */
export function notifyAchievementUnlocks(ids) {
  if (!ids || !ids.length || typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("twotongues:achievement", {
        detail: { ids: ids.map(String) },
      })
    );
  } catch (_) {}
}

/**
 * Evaluate unlocks, merge into account.achievements, and notify the UI.
 * Returns the (possibly updated) account object.
 */
export function unlockAchievements(account, extra = {}) {
  if (!account) return account;
  const newly = evaluateAchievements(account, extra);
  if (!newly.length) return account;
  notifyAchievementUnlocks(newly);
  return {
    ...account,
    achievements: [...new Set([...(account.achievements || []), ...newly])],
  };
}
