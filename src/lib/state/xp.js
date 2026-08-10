// Visual XP + level system (local cache + optional cloud via account.xp).
// Design: reward real learning once per unique claim — not grinding repeats.
// Expanded to ~55 levels to support 20–50 days of steady study.

const XP_KEY = "twoTongues.xp.";

/** Cosmetics that actually appear in the UI (avatar frame/badge + timer themes). */
export const COSMETICS = {
  badges: {
    bronze:   { id: "bronze",   en: "Bronze badge",   ar: "شارة برونزية",   color: "#cd7f32", emoji: "🥉" },
    silver:   { id: "silver",   en: "Silver badge",   ar: "شارة فضية",     color: "#c0c0c0", emoji: "🥈" },
    gold:     { id: "gold",     en: "Gold badge",     ar: "شارة ذهبية",    color: "#f5c542", emoji: "🥇" },
    diamond:  { id: "diamond",  en: "Diamond badge",  ar: "شارة ماسية",    color: "#7dd3fc", emoji: "💎" },
    legendary:{ id: "legendary",en: "Legendary badge",ar: "شارة أسطورية",  color: "#c084fc", emoji: "👑" },
  },
  frames: {
    bronze:   { id: "bronze",   en: "Bronze frame",   ar: "إطار برونزي",   border: "2px solid #cd7f32", glow: "0 0 0 3px rgba(205,127,50,0.35)" },
    silver:   { id: "silver",   en: "Silver frame",   ar: "إطار فضي",     border: "2px solid #c0c0c0", glow: "0 0 0 3px rgba(192,192,192,0.35)" },
    gold:     { id: "gold",     en: "Gold frame",     ar: "إطار ذهبي",    border: "2.5px solid #f5c542", glow: "0 0 0 3px rgba(245,197,66,0.4)" },
    diamond:  { id: "diamond",  en: "Diamond frame",  ar: "إطار ماسي",    border: "2.5px solid #7dd3fc", glow: "0 0 8px 2px rgba(125,211,252,0.5)" },
    legendary:{ id: "legendary",en: "Legendary frame",ar: "إطار أسطوري",  border: "3px solid #c084fc", glow: "0 0 10px 3px rgba(192,132,252,0.55)" },
  },
  /** Timer background ids that require a level (others stay free). */
  themes: {
    meadow:   { unlockLevel: 5,  en: "Meadow",        ar: "مروج" },
    mountain: { unlockLevel: 8,  en: "Mountains",     ar: "جبال" },
    desert:   { unlockLevel: 12, en: "Desert",        ar: "صحراء" },
    aurora:   { unlockLevel: 16, en: "Aurora",        ar: "شفق" },
    lake:     { unlockLevel: 20, en: "Lake",          ar: "بحيرة" },
    sky:      { unlockLevel: 24, en: "Open sky",      ar: "سماء" },
    night:    { unlockLevel: 28, en: "Starry night",  ar: "ليلة نجوم" },
    mist:     { unlockLevel: 32, en: "Morning mist",  ar: "ضباب الصباح" },
    plum:     { unlockLevel: 36, en: "Plum",          ar: "برقوق" },
    rose:     { unlockLevel: 40, en: "Rose",          ar: "وردي" },
  },
};

/**
 * ~55 levels. XP curve starts gentle then rises.
 * rewardKey drives real unlocks (badge / frame / theme).
 */
export const LEVELS = [
  { level: 1,  xp: 0,     titleEn: "Beginner",       titleAr: "مبتدئ",         rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 2,  xp: 40,    titleEn: "Starter",        titleAr: "بداية",         rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 3,  xp: 90,    titleEn: "Learner",        titleAr: "متعلّم",        rewardKey: "badge:bronze", rewardEn: "Bronze badge",           rewardAr: "شارة برونزية" },
  { level: 4,  xp: 150,   titleEn: "Student",        titleAr: "طالب",          rewardKey: "frame:bronze", rewardEn: "Bronze frame",           rewardAr: "إطار برونزي" },
  { level: 5,  xp: 230,   titleEn: "Apprentice",     titleAr: "مبتدئ متقدم",   rewardKey: "theme:meadow", rewardEn: "Timer: Meadow",          rewardAr: "ثيم: مروج" },
  { level: 6,  xp: 330,   titleEn: "Explorer",       titleAr: "مستكشف",        rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 7,  xp: 450,   titleEn: "Scholar",        titleAr: "دارس",          rewardKey: "badge:silver", rewardEn: "Silver badge",           rewardAr: "شارة فضية" },
  { level: 8,  xp: 590,   titleEn: "Adept",          titleAr: "ماهر",          rewardKey: "theme:mountain",rewardEn: "Timer: Mountains",      rewardAr: "ثيم: جبال" },
  { level: 9,  xp: 750,   titleEn: "Practitioner",   titleAr: "ممارس",         rewardKey: "frame:silver", rewardEn: "Silver frame",           rewardAr: "إطار فضي" },
  { level: 10, xp: 930,   titleEn: "Skilled",        titleAr: "بارع",          rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 11, xp: 1140,  titleEn: "Advanced",       titleAr: "متقدم",         rewardKey: "badge:gold",   rewardEn: "Gold badge",             rewardAr: "شارة ذهبية" },
  { level: 12, xp: 1380,  titleEn: "Proficient",     titleAr: "متمكن",         rewardKey: "theme:desert", rewardEn: "Timer: Desert",          rewardAr: "ثيم: صحراء" },
  { level: 13, xp: 1650,  titleEn: "Expert",         titleAr: "خبير",          rewardKey: "frame:gold",   rewardEn: "Gold frame",             rewardAr: "إطار ذهبي" },
  { level: 14, xp: 1960,  titleEn: "Veteran",        titleAr: "محنّك",         rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 15, xp: 2310,  titleEn: "Specialist",     titleAr: "متخصص",         rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 16, xp: 2700,  titleEn: "Master",         titleAr: "أستاذ",         rewardKey: "theme:aurora", rewardEn: "Timer: Aurora",          rewardAr: "ثيم: شفق" },
  { level: 17, xp: 3140,  titleEn: "Elite",          titleAr: "نخبة",          rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 18, xp: 3630,  titleEn: "Champion",       titleAr: "بطل",           rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 19, xp: 4170,  titleEn: "Virtuoso",       titleAr: "عبقري",         rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 20, xp: 4770,  titleEn: "Grandmaster",    titleAr: "أستاذ كبير",    rewardKey: "theme:lake",   rewardEn: "Timer: Lake",            rewardAr: "ثيم: بحيرة" },
  { level: 21, xp: 5430,  titleEn: "Sage",           titleAr: "حكيم",          rewardKey: "badge:diamond",rewardEn: "Diamond badge",          rewardAr: "شارة ماسية" },
  { level: 22, xp: 6160,  titleEn: "Oracle",         titleAr: "عارف",          rewardKey: "frame:diamond",rewardEn: "Diamond frame",          rewardAr: "إطار ماسي" },
  { level: 23, xp: 6960,  titleEn: "Luminary",       titleAr: "منير",          rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 24, xp: 7840,  titleEn: "Apex",           titleAr: "قمة",           rewardKey: "theme:sky",    rewardEn: "Timer: Open sky",        rewardAr: "ثيم: سماء" },
  { level: 25, xp: 8800,  titleEn: "Paragon",        titleAr: "نموذج",         rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 26, xp: 9850,  titleEn: "Titan",          titleAr: "عملاق",         rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 27, xp: 11000, titleEn: "Mythic",         titleAr: "أسطوري",        rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 28, xp: 12250, titleEn: "Legend",         titleAr: "أسطورة",        rewardKey: "theme:night",  rewardEn: "Timer: Starry night",    rewardAr: "ثيم: ليلة نجوم" },
  { level: 29, xp: 13600, titleEn: "Epic",           titleAr: "ملحمي",         rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 30, xp: 15050, titleEn: "Immortal",       titleAr: "خالد",          rewardKey: "badge:legendary", rewardEn: "Legendary badge",     rewardAr: "شارة أسطورية" },
  { level: 31, xp: 16600, titleEn: "Transcendent",   titleAr: "متعالٍ",        rewardKey: "frame:legendary", rewardEn: "Legendary frame",    rewardAr: "إطار أسطوري" },
  { level: 32, xp: 18250, titleEn: "Celestial",      titleAr: "سماوي",         rewardKey: "theme:mist",   rewardEn: "Timer: Morning mist",   rewardAr: "ثيم: ضباب الصباح" },
  { level: 33, xp: 20000, titleEn: "Divine",         titleAr: "إلهي",          rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 34, xp: 21850, titleEn: "Eternal",        titleAr: "أبدي",          rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 35, xp: 23800, titleEn: "Infinite",       titleAr: "لا نهائي",      rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 36, xp: 25850, titleEn: "Omniscient",     titleAr: "عالم بكل شيء",  rewardKey: "theme:plum",   rewardEn: "Timer: Plum",            rewardAr: "ثيم: برقوق" },
  { level: 37, xp: 28000, titleEn: "Polyglot I",     titleAr: "متعدد اللغات ١", rewardKey: null,         rewardEn: null,                    rewardAr: null },
  { level: 38, xp: 30250, titleEn: "Polyglot II",    titleAr: "متعدد اللغات ٢", rewardKey: null,         rewardEn: null,                    rewardAr: null },
  { level: 39, xp: 32600, titleEn: "Polyglot III",   titleAr: "متعدد اللغات ٣", rewardKey: null,         rewardEn: null,                    rewardAr: null },
  { level: 40, xp: 35050, titleEn: "Language Lord",  titleAr: "سيد اللغة",     rewardKey: "theme:rose",   rewardEn: "Timer: Rose",            rewardAr: "ثيم: وردي" },
  { level: 41, xp: 37600, titleEn: "Word Weaver",    titleAr: "نسّاج الكلمات", rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 42, xp: 40250, titleEn: "Fluent Force",   titleAr: "قوة الطلاقة",   rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 43, xp: 43000, titleEn: "Master Tongue",  titleAr: "لسان ماهر",     rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 44, xp: 45850, titleEn: "Lexicon King",   titleAr: "ملك المعجم",    rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 45, xp: 48800, titleEn: "Babel Breaker",  titleAr: "كاسر بابل",     rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 46, xp: 51850, titleEn: "Ultimate I",     titleAr: "نهائي ١",       rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 47, xp: 55000, titleEn: "Ultimate II",    titleAr: "نهائي ٢",       rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 48, xp: 58250, titleEn: "Ultimate III",   titleAr: "نهائي ٣",       rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 49, xp: 61600, titleEn: "Ascended",       titleAr: "صاعد",          rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 50, xp: 65050, titleEn: "Supreme",        titleAr: "أعلى",          rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 51, xp: 68600, titleEn: "Absolute",       titleAr: "مطلق",          rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 52, xp: 72250, titleEn: "Zenith",         titleAr: "ذروة",          rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 53, xp: 76000, titleEn: "Apex Legend",    titleAr: "أسطورة القمة",  rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 54, xp: 79850, titleEn: "Final Form",     titleAr: "الشكل النهائي", rewardKey: null,          rewardEn: null,                    rewardAr: null },
  { level: 55, xp: 83800, titleEn: "Beyond",         titleAr: "ما وراء",       rewardKey: null,          rewardEn: "Max level cosmetics",    rewardAr: "كل الزخارف" },
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
    equippedBadge: null, // id string or null = none
    equippedFrame: null,
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
      equippedBadge: data.equippedBadge || null,
      equippedFrame: data.equippedFrame || null,
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
        equippedBadge: data.equippedBadge || null,
        equippedFrame: data.equippedFrame || null,
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

/** All badge ids unlocked by this XP total (in unlock order). */
export function listUnlockedBadges(totalXp) {
  const info = levelFromXp(Number(totalXp) || 0);
  const out = [];
  const seen = new Set();
  for (const lv of LEVELS) {
    if (lv.level > info.level) break;
    if (lv.rewardKey && lv.rewardKey.startsWith("badge:")) {
      const id = lv.rewardKey.slice(6);
      if (COSMETICS.badges[id] && !seen.has(id)) {
        seen.add(id);
        out.push(COSMETICS.badges[id]);
      }
    }
  }
  return out;
}

/** All frame ids unlocked by this XP total (in unlock order). */
export function listUnlockedFrames(totalXp) {
  const info = levelFromXp(Number(totalXp) || 0);
  const out = [];
  const seen = new Set();
  for (const lv of LEVELS) {
    if (lv.level > info.level) break;
    if (lv.rewardKey && lv.rewardKey.startsWith("frame:")) {
      const id = lv.rewardKey.slice(6);
      if (COSMETICS.frames[id] && !seen.has(id)) {
        seen.add(id);
        out.push(COSMETICS.frames[id]);
      }
    }
  }
  return out;
}

/** Highest badge unlocked by current total XP (or null). */
export function getUnlockedBadge(totalOrLevel) {
  const list = listUnlockedBadges(typeof totalOrLevel === "number" ? totalOrLevel : (totalOrLevel?.total ?? 0));
  return list.length ? list[list.length - 1] : null;
}

/** Highest frame unlocked by current total XP (or null). */
export function getUnlockedFrame(totalOrLevel) {
  const list = listUnlockedFrames(typeof totalOrLevel === "number" ? totalOrLevel : (totalOrLevel?.total ?? 0));
  return list.length ? list[list.length - 1] : null;
}

/**
 * Badge currently shown on avatar.
 * Prefer user's equipped choice if still unlocked; else highest; else null.
 */
export function getEquippedBadge(accountCode) {
  const data = loadXp(accountCode);
  const unlocked = listUnlockedBadges(data.total);
  if (!unlocked.length) return null;
  if (data.equippedBadge === "") return null; // explicit none
  if (data.equippedBadge) {
    const found = unlocked.find((b) => b.id === data.equippedBadge);
    if (found) return found;
  }
  return unlocked[unlocked.length - 1];
}

/**
 * Frame currently shown on avatar.
 * Prefer user's equipped choice if still unlocked; else highest; else null.
 */
export function getEquippedFrame(accountCode) {
  const data = loadXp(accountCode);
  const unlocked = listUnlockedFrames(data.total);
  if (!unlocked.length) return null;
  if (data.equippedFrame === "") return null;
  if (data.equippedFrame) {
    const found = unlocked.find((f) => f.id === data.equippedFrame);
    if (found) return found;
  }
  return unlocked[unlocked.length - 1];
}

function notifyCosmeticsChanged() {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("twotongues:cosmetics"));
    }
  } catch (_) {}
}

/** Set equipped badge id (or null/"" for none). Tiny payload. */
export function setEquippedBadge(accountCode, badgeId) {
  const data = loadXp(accountCode);
  data.equippedBadge = badgeId == null || badgeId === "" ? "" : String(badgeId);
  saveXp(accountCode, data);
  notifyCosmeticsChanged();
  return data;
}

/** Set equipped frame id (or null/"" for none). */
export function setEquippedFrame(accountCode, frameId) {
  const data = loadXp(accountCode);
  data.equippedFrame = frameId == null || frameId === "" ? "" : String(frameId);
  saveXp(accountCode, data);
  notifyCosmeticsChanged();
  return data;
}

/** Whether a timer theme id is unlocked for this XP total. Free themes (not in COSMETICS.themes) are always unlocked. */
export function isThemeUnlocked(themeId, totalXp) {
  const req = COSMETICS.themes[themeId];
  if (!req) return true;
  const info = levelFromXp(Number(totalXp) || 0);
  return info.level >= req.unlockLevel;
}

/** Level required to unlock a theme (or null if free). */
export function themeUnlockLevel(themeId) {
  return COSMETICS.themes[themeId]?.unlockLevel ?? null;
}

/** All reward keys unlocked up to this level (for display). */
export function getUnlockedRewardKeys(totalXp) {
  const info = levelFromXp(Number(totalXp) || 0);
  const keys = [];
  for (const lv of LEVELS) {
    if (lv.level > info.level) break;
    if (lv.rewardKey) keys.push(lv.rewardKey);
  }
  return keys;
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
    if (data.total >= lv.xp && lv.rewardKey && !data.unlockedRewards.includes(lv.level)) {
      data.unlockedRewards.push(lv.level);
    }
  }
  saveXp(accountCode, data);
  const leveledUp = after.level > before.level;
  if (leveledUp && typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("twotongues:levelup", {
          detail: {
            fromLevel: before.level,
            toLevel: after.level,
            titleEn: after.titleEn,
            titleAr: after.titleAr,
            rewardKey: after.rewardKey || null,
            rewardEn: after.rewardEn || null,
            rewardAr: after.rewardAr || null,
            total: after.total,
          },
        })
      );
    } catch (_) {}
  }
  return {
    granted: true,
    amount: finalAmt,
    data,
    leveledUp,
    levelInfo: after,
    previousLevel: before.level,
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
    equippedBadge: data.equippedBadge || null,
    equippedFrame: data.equippedFrame || null,
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
  // Prefer local equipped choice (user just picked it); fall back to remote.
  const equippedBadge = a.equippedBadge != null ? a.equippedBadge : (b.equippedBadge != null ? b.equippedBadge : null);
  const equippedFrame = a.equippedFrame != null ? a.equippedFrame : (b.equippedFrame != null ? b.equippedFrame : null);
  return { total, claimed, history, unlockedRewards: unlocked, dailyEarned, equippedBadge, equippedFrame };
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
        equippedBadge: merged.equippedBadge || null,
        equippedFrame: merged.equippedFrame || null,
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
