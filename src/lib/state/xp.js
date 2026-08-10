// Visual XP + level system (local cache + optional cloud via account.xp).
// Design: reward real learning once per unique claim — not grinding repeats.

const XP_KEY = "twoTongues.xp.";

export const LEVELS = [
  { level: 1, xp: 0, titleEn: "Beginner", titleAr: "مبتدئ", rewardEn: null, rewardAr: null },
  { level: 2, xp: 50, titleEn: "Learner", titleAr: "متعلّم", rewardEn: "Bronze badge", rewardAr: "شارة برونزية" },
  { level: 3, xp: 120, titleEn: "Student", titleAr: "طالب", rewardEn: "Silver badge", rewardAr: "شارة فضية" },
  { level: 4, xp: 220, titleEn: "Scholar", titleAr: "دارس", rewardEn: "Gold badge", rewardAr: "شارة ذهبية" },
  { level: 5, xp: 350, titleEn: "Adept", titleAr: "ماهر", rewardEn: "Timer theme: Ember", rewardAr: "ثيم المؤقّت: جمر" },
  { level: 6, xp: 520, titleEn: "Expert", titleAr: "خبير", rewardEn: "Night study unlock", rewardAr: "فتح وضع الليل" },
  { level: 7, xp: 750, titleEn: "Master", titleAr: "أستاذ", rewardEn: "Custom accent slot", rewardAr: "لون مخصص إضافي" },
  { level: 8, xp: 1050, titleEn: "Grandmaster", titleAr: "أستاذ كبير", rewardEn: "Diamond badge", rewardAr: "شارة ماسية" },
  { level: 9, xp: 1400, titleEn: "Legend", titleAr: "أسطورة", rewardEn: "Legendary frame", rewardAr: "إطار أسطوري" },
  { level: 10, xp: 1850, titleEn: "Polyglot", titleAr: "متعدد اللغات", rewardEn: "All cosmetics", rewardAr: "كل الزخارف" },
];

export const XP_REWARDS = {
  studyWordFirst: 5,
  quizCorrectFirst: 3,
  srsPromote: 4,
  srsMaster: 12,
  smartCardFirst: 3,
  dictationWordFirst: 4,
  quizSessionComplete: 8,
  quizPerfect: 20,
  conversationScenario: 15,
  extractBatch: 2,
  extractBatchBonus: 6,
  dailyOpen: 5,
  dailyStreakBonus: 10,
  timerFocusBlock: 6,
  goalReached: 15,
  challengeComplete: 18,
  favoriteFirst: 1,
  wordNoteFirst: 2,
  clozeFirst: 3,
};

const DAILY_CAPS = {
  total: 120,
  quizCorrectFirst: 40,
  smartCardFirst: 30,
  dictationWordFirst: 24,
  extractBatch: 20,
};

function key(accountCode) {
  return XP_KEY + (accountCode || "anon");
}

function dayKey(ms = Date.now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function emptyData() {
  return {
    total: 0,
    history: [],
    unlockedRewards: [],
    claimed: {},
    dailyEarned: {},
  };
}

export function loadXp(accountCode) {
  try {
    const raw = localStorage.getItem(key(accountCode));
    if (!raw) return emptyData();
    const data = JSON.parse(raw);
    return {
      total: Number(data.total) || 0,
      history: Array.isArray(data.history) ? data.history.slice(0, 120) : [],
      unlockedRewards: Array.isArray(data.unlockedRewards) ? data.unlockedRewards : [],
      claimed: data.claimed && typeof data.claimed === "object" ? data.claimed : {},
      dailyEarned: data.dailyEarned && typeof data.dailyEarned === "object" ? data.dailyEarned : {},
    };
  } catch (_) {
    return emptyData();
  }
}

export function saveXp(accountCode, data) {
  try {
    const claimed = { ...(data.claimed || {}) };
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
    for (const k of Object.keys(claimed)) {
      if (k.startsWith("d:") && Number(claimed[k]) < cutoff) delete claimed[k];
    }
    const dailyEarned = { ...(data.dailyEarned || {}) };
    const days = Object.keys(dailyEarned).sort();
    if (days.length > 45) {
      for (const d of days.slice(0, days.length - 45)) delete dailyEarned[d];
    }
    localStorage.setItem(
      key(accountCode),
      JSON.stringify({
        total: Number(data.total) || 0,
        history: (data.history || []).slice(0, 120),
        unlockedRewards: data.unlockedRewards || [],
        claimed,
        dailyEarned,
      })
    );
  } catch (_) {}
}

export function levelFromXp(total) {
  let current = LEVELS[0];
  for (const lv of LEVELS) {
    if (total >= lv.xp) current = lv;
  }
  const idx = LEVELS.findIndex((l) => l.level === current.level);
  const next = LEVELS[idx + 1] || null;
  const prevXp = current.xp;
  const nextXp = next ? next.xp : current.xp;
  const span = Math.max(1, nextXp - prevXp);
  const pct = next ? Math.min(100, Math.round(((total - prevXp) / span) * 100)) : 100;
  return { ...current, next, pct, total };
}

export function claimKey(kind, id) {
  if (id == null || id === "") return kind;
  return `${kind}:${id}`;
}

export function dailyClaimKey(kind, id) {
  const d = dayKey();
  if (id == null || id === "") return `d:${d}:${kind}`;
  return `d:${d}:${kind}:${id}`;
}

export function tryGrantXp(accountCode, amount, reason, options = {}) {
  const { claim = null, dailyCategory = null } = options;
  const data = loadXp(accountCode);
  const amt = Math.max(0, Math.floor(Number(amount) || 0));
  if (amt <= 0) {
    return { granted: false, amount: 0, data, leveledUp: false, levelInfo: levelFromXp(data.total), reason };
  }
  if (claim && data.claimed[claim]) {
    return { granted: false, amount: 0, data, leveledUp: false, levelInfo: levelFromXp(data.total), reason };
  }

  const today = dayKey();
  const earnedToday = Number(data.dailyEarned[today]) || 0;
  if (earnedToday >= DAILY_CAPS.total) {
    return { granted: false, amount: 0, data, leveledUp: false, levelInfo: levelFromXp(data.total), reason: "daily_cap" };
  }

  let finalAmt = amt;
  if (dailyCategory && DAILY_CAPS[dailyCategory] != null) {
    const catEarned = (data.history || [])
      .filter((h) => h.day === today && h.category === dailyCategory)
      .reduce((s, h) => s + (Number(h.amount) || 0), 0);
    finalAmt = Math.min(finalAmt, Math.max(0, DAILY_CAPS[dailyCategory] - catEarned));
  }
  finalAmt = Math.min(finalAmt, DAILY_CAPS.total - earnedToday);
  if (finalAmt <= 0) {
    return { granted: false, amount: 0, data, leveledUp: false, levelInfo: levelFromXp(data.total), reason: "daily_cap" };
  }

  const before = levelFromXp(data.total);
  data.total += finalAmt;
  data.dailyEarned[today] = earnedToday + finalAmt;
  if (claim) data.claimed[claim] = Date.now();
  data.history.unshift({
    at: Date.now(),
    day: today,
    amount: finalAmt,
    reason: String(reason || "action"),
    category: dailyCategory || null,
    claim: claim || null,
  });

  const after = levelFromXp(data.total);
  for (const lv of LEVELS) {
    if (data.total >= lv.xp && lv.rewardEn && !data.unlockedRewards.includes(lv.level)) {
      data.unlockedRewards.push(lv.level);
    }
  }
  saveXp(accountCode, data);
  return {
    granted: true,
    amount: finalAmt,
    data,
    leveledUp: after.level > before.level,
    levelInfo: after,
    reason,
  };
}

export function addXp(accountCode, amount, reason) {
  const result = tryGrantXp(accountCode, amount, reason, {
    claim: dailyClaimKey("legacy", `${reason}:${Date.now()}`),
  });
  return {
    data: result.data,
    leveledUp: result.leveledUp,
    levelInfo: result.levelInfo,
    granted: result.granted,
    amount: result.amount,
  };
}

export function grantStudyWord(accountCode, entryId) {
  if (!entryId) return null;
  return tryGrantXp(accountCode, XP_REWARDS.studyWordFirst, "studyWordFirst", {
    claim: claimKey("study", entryId),
  });
}

export function grantQuizCorrect(accountCode, entryId) {
  if (!entryId) return null;
  return tryGrantXp(accountCode, XP_REWARDS.quizCorrectFirst, "quizCorrectFirst", {
    claim: claimKey("quizOk", entryId),
    dailyCategory: "quizCorrectFirst",
  });
}

export function grantQuizSession(accountCode, sessionId, { perfect = false, questionCount = 0 } = {}) {
  if (!sessionId) return null;
  const results = [];
  results.push(
    tryGrantXp(accountCode, XP_REWARDS.quizSessionComplete, "quizSessionComplete", {
      claim: claimKey("quizSession", sessionId),
    })
  );
  if (perfect && questionCount >= 5) {
    results.push(
      tryGrantXp(accountCode, XP_REWARDS.quizPerfect, "quizPerfect", {
        claim: claimKey("quizPerfect", sessionId),
      })
    );
  }
  return results;
}

export function grantSrsPromote(accountCode, entryId, newBox) {
  if (!entryId || newBox == null) return null;
  const results = [];
  results.push(
    tryGrantXp(accountCode, XP_REWARDS.srsPromote, "srsPromote", {
      claim: claimKey(`srsUp:${newBox}`, entryId),
    })
  );
  if (Number(newBox) >= 5) {
    results.push(
      tryGrantXp(accountCode, XP_REWARDS.srsMaster, "srsMaster", {
        claim: claimKey("srsMaster", entryId),
      })
    );
  }
  return results;
}

export function grantSmartCard(accountCode, entryId) {
  if (!entryId) return null;
  return tryGrantXp(accountCode, XP_REWARDS.smartCardFirst, "smartCardFirst", {
    claim: claimKey("smart", entryId),
    dailyCategory: "smartCardFirst",
  });
}

export function grantDictationWord(accountCode, entryId) {
  if (!entryId) return null;
  return tryGrantXp(accountCode, XP_REWARDS.dictationWordFirst, "dictationWordFirst", {
    claim: claimKey("dict", entryId),
    dailyCategory: "dictationWordFirst",
  });
}

export function grantConversation(accountCode, scenarioId) {
  return tryGrantXp(accountCode, XP_REWARDS.conversationScenario, "conversationScenario", {
    claim: dailyClaimKey("conv", scenarioId || "default"),
  });
}

export function grantExtract(accountCode, newWordCount) {
  const n = Math.max(0, Math.floor(Number(newWordCount) || 0));
  if (n <= 0) return [];
  const results = [];
  results.push(
    tryGrantXp(accountCode, XP_REWARDS.extractBatch * n, "extractBatch", {
      claim: dailyClaimKey("extract", `${Date.now()}`),
      dailyCategory: "extractBatch",
    })
  );
  if (n >= 5) {
    results.push(
      tryGrantXp(accountCode, XP_REWARDS.extractBatchBonus, "extractBatchBonus", {
        claim: dailyClaimKey("extractBonus"),
      })
    );
  }
  return results;
}

export function grantDailyOpen(accountCode) {
  return tryGrantXp(accountCode, XP_REWARDS.dailyOpen, "dailyOpen", {
    claim: dailyClaimKey("dailyOpen"),
  });
}

export function grantStreakBonus(accountCode, streakDays) {
  const s = Math.floor(Number(streakDays) || 0);
  if (s < 2) return null;
  return tryGrantXp(accountCode, XP_REWARDS.dailyStreakBonus, "dailyStreakBonus", {
    claim: claimKey("streak", s),
  });
}

export function grantTimerBlock(accountCode, blockId) {
  if (!blockId) return null;
  return tryGrantXp(accountCode, XP_REWARDS.timerFocusBlock, "timerFocusBlock", {
    claim: claimKey("timer", blockId),
  });
}

export function grantGoal(accountCode, goalId) {
  if (!goalId) return null;
  return tryGrantXp(accountCode, XP_REWARDS.goalReached, "goalReached", {
    claim: claimKey("goal", goalId),
  });
}

export function grantChallenge(accountCode, challengeId) {
  if (!challengeId) return null;
  return tryGrantXp(accountCode, XP_REWARDS.challengeComplete, "challengeComplete", {
    claim: claimKey("challenge", challengeId),
  });
}

export function grantFavorite(accountCode, entryId) {
  if (!entryId) return null;
  return tryGrantXp(accountCode, XP_REWARDS.favoriteFirst, "favoriteFirst", {
    claim: claimKey("fav", entryId),
  });
}

export function snapshotProgress(accountCode, stats) {
  const SNAP_KEY = "twoTongues.progressSnap." + (accountCode || "anon");
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(arr) ? arr : [];
    const today = dayKey();
    const filtered = list.filter((s) => s.dayKey !== today);
    filtered.push({
      dayKey: today,
      at: Date.now(),
      studied: Number(stats.studied) || 0,
      quizzes: Number(stats.quizzes) || 0,
      streak: Number(stats.streak) || 0,
      xp: Number(stats.xp) || 0,
      mastered: Number(stats.mastered) || 0,
    });
    localStorage.setItem(SNAP_KEY, JSON.stringify(filtered.slice(-90)));
  } catch (_) {}
}

export function loadProgressSnapshots(accountCode) {
  const SNAP_KEY = "twoTongues.progressSnap." + (accountCode || "anon");
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

export function exportXpForCloud(accountCode) {
  const data = loadXp(accountCode);
  return {
    total: Number(data.total) || 0,
    claimed: data.claimed || {},
    history: (data.history || []).slice(0, 80),
    unlockedRewards: data.unlockedRewards || [],
    dailyEarned: data.dailyEarned || {},
    updatedAt: Date.now(),
  };
}

export function mergeXpData(local, remote) {
  const a = local && typeof local === "object" ? local : emptyData();
  const b = remote && typeof remote === "object" ? remote : emptyData();
  const claimed = { ...(b.claimed || {}), ...(a.claimed || {}) };
  const total = Math.max(Number(a.total) || 0, Number(b.total) || 0);
  const historyMap = new Map();
  for (const h of [...(b.history || []), ...(a.history || [])]) {
    if (!h || !h.at) continue;
    const k = `${h.at}:${h.reason}:${h.amount}`;
    if (!historyMap.has(k)) historyMap.set(k, h);
  }
  const history = [...historyMap.values()].sort((x, y) => (y.at || 0) - (x.at || 0)).slice(0, 120);
  const unlocked = [...new Set([...(b.unlockedRewards || []), ...(a.unlockedRewards || [])])];
  const dailyEarned = { ...(b.dailyEarned || {}), ...(a.dailyEarned || {}) };
  for (const day of Object.keys(dailyEarned)) {
    dailyEarned[day] = Math.max(
      Number(b.dailyEarned && b.dailyEarned[day]) || 0,
      Number(a.dailyEarned && a.dailyEarned[day]) || 0
    );
  }
  return { total, claimed, history, unlockedRewards: unlocked, dailyEarned };
}

export function hydrateXpFromCloud(accountCode, remoteXp) {
  if (!accountCode || accountCode === "guest") return loadXp(accountCode);
  const local = loadXp(accountCode);
  if (!remoteXp || typeof remoteXp !== "object") return local;
  const merged = mergeXpData(local, remoteXp);
  saveXp(accountCode, merged);
  return merged;
}

export function attachXpToAccounts(accounts, accountCode) {
  if (!accountCode || accountCode === "guest" || !Array.isArray(accounts)) return accounts;
  const blob = exportXpForCloud(accountCode);
  return accounts.map((a) => {
    if (!a || a.code !== accountCode) return a;
    const merged = mergeXpData(blob, a.xp || null);
    saveXp(accountCode, merged);
    return {
      ...a,
      xp: {
        total: merged.total,
        claimed: merged.claimed,
        history: (merged.history || []).slice(0, 80),
        unlockedRewards: merged.unlockedRewards || [],
        dailyEarned: merged.dailyEarned || {},
        updatedAt: Date.now(),
      },
    };
  });
}

export const XP_RULES = {
  en: [
    "XP is granted once per unique achievement — not every time you repeat it.",
    "Studying the same word again does not give more XP.",
    "Correct quiz answers grant XP only the first time for each word.",
    "Conversation scenarios reward once per day each.",
    "A soft daily cap prevents grinding.",
  ],
  ar: [
    "النقاط بتتحسب مرة واحدة لكل إنجاز فريد — مش كل ما تكرّر نفس الفعل.",
    "مذاكرة نفس الكلمة تاني مش بتزود XP.",
    "إجابة الكويز الصح بتدي نقاط لأول مرة بس لكل كلمة.",
    "كل سيناريو محادثة بيُكافأ مرة واحدة في اليوم.",
    "فيه حد يومي ناعم عشان مفيش استغلال بالتكرار.",
  ],
};
