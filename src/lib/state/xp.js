// Visual XP + level system (local per account).
// Gains XP from study actions; unlocks cosmetic rewards at milestones.

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
  studyWord: 3,
  quizCorrect: 2,
  quizPerfect: 15,
  dictationRound: 5,
  flashcardKnew: 1,
  smartCardKnew: 2,
  conversationDone: 12,
  extractAdd: 1,
  dailyFirst: 10,
};

function key(accountCode) {
  return XP_KEY + (accountCode || "anon");
}

export function loadXp(accountCode) {
  try {
    const raw = localStorage.getItem(key(accountCode));
    if (!raw) return { total: 0, history: [], unlockedRewards: [] };
    const data = JSON.parse(raw);
    return {
      total: Number(data.total) || 0,
      history: Array.isArray(data.history) ? data.history.slice(0, 100) : [],
      unlockedRewards: Array.isArray(data.unlockedRewards) ? data.unlockedRewards : [],
    };
  } catch (_) {
    return { total: 0, history: [], unlockedRewards: [] };
  }
}

export function saveXp(accountCode, data) {
  try {
    localStorage.setItem(key(accountCode), JSON.stringify({
      total: Number(data.total) || 0,
      history: (data.history || []).slice(0, 100),
      unlockedRewards: data.unlockedRewards || [],
    }));
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

export function addXp(accountCode, amount, reason) {
  if (!amount || amount <= 0) return loadXp(accountCode);
  const data = loadXp(accountCode);
  const before = levelFromXp(data.total);
  data.total += amount;
  data.history.unshift({
    at: Date.now(),
    amount,
    reason: String(reason || "action"),
  });
  const after = levelFromXp(data.total);
  // Unlock rewards for any newly reached levels
  for (const lv of LEVELS) {
    if (data.total >= lv.xp && lv.rewardEn && !data.unlockedRewards.includes(lv.level)) {
      data.unlockedRewards.push(lv.level);
    }
  }
  saveXp(accountCode, data);
  return { data, leveledUp: after.level > before.level, levelInfo: after };
}

export function snapshotProgress(accountCode, stats) {
  // Store a daily snapshot for "compare with past self"
  const SNAP_KEY = "twoTongues.progressSnap." + (accountCode || "anon");
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(arr) ? arr : [];
    const today = new Date();
    const dayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const filtered = list.filter((s) => s.dayKey !== dayKey);
    filtered.push({
      dayKey,
      at: Date.now(),
      studied: Number(stats.studied) || 0,
      quizzes: Number(stats.quizzes) || 0,
      streak: Number(stats.streak) || 0,
      xp: Number(stats.xp) || 0,
      mastered: Number(stats.mastered) || 0,
    });
    // keep ~90 days
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


// ── Cloud sync (account.xp on shared record) ───────────────────────────────
// Local storage stays the fast cache; the account object on the server is the
// durable copy so clearing site data does not wipe progress after re-login.

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

/**
 * Merge local + cloud XP without losing claims from either side.
 * Prefer higher total; union claimed keys; keep newer history entries.
 */
export function mergeXpData(local, remote) {
  const a = local && typeof local === "object" ? local : emptyData();
  const b = remote && typeof remote === "object" ? remote : emptyData();
  const claimed = { ...(b.claimed || {}), ...(a.claimed || {}) };
  // If remote has keys local doesn't, keep them (already in spread order)
  const total = Math.max(Number(a.total) || 0, Number(b.total) || 0);
  // If totals differ, trust the side with more claimed keys as a tie-break is already max
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
    dailyEarned[day] = Math.max(Number(b.dailyEarned && b.dailyEarned[day]) || 0, Number(a.dailyEarned && a.dailyEarned[day]) || 0);
  }
  return {
    total,
    claimed,
    history,
    unlockedRewards: unlocked,
    dailyEarned,
  };
}

/** Pull cloud xp onto local cache (call after login / accounts load). */
export function hydrateXpFromCloud(accountCode, remoteXp) {
  if (!accountCode || accountCode === "guest") return loadXp(accountCode);
  const local = loadXp(accountCode);
  if (!remoteXp || typeof remoteXp !== "object") return local;
  const merged = mergeXpData(local, remoteXp);
  saveXp(accountCode, merged);
  return merged;
}

/** Stamp accounts array with the signed-in user's latest local XP before save. */
export function attachXpToAccounts(accounts, accountCode) {
  if (!accountCode || accountCode === "guest" || !Array.isArray(accounts)) return accounts;
  const blob = exportXpForCloud(accountCode);
  return accounts.map((a) => {
    if (!a || a.code !== accountCode) return a;
    const merged = mergeXpData(blob, a.xp || null);
    saveXp(accountCode, merged); // keep local aligned
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
