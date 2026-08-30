/**
 * Per-account progress mutations (studied, favorites, SRS, quiz, dictation).
 * Extracted from App.jsx — same behavior, less duplication around achievements.
 */
import { unlockAchievements } from "./achievements";
import {
  grantStudyWord,
  grantQuizCorrect,
  grantQuizSession,
  grantSrsPromote,
  grantFavorite,
  grantStreakBonus,
} from "./xp";
import { getTodayTimerMinutes } from "./goals";
import {
  srsLevelFromStats,
  computeStreak,
  applySm2,
  correctToQuality,
  getCardState,
  loadSrsPrefs,
} from "../utils/quizHelpers";

/** Read local dictation round counter for an account. */
export function loadDictationRounds(accountCode) {
  try {
    return Number(localStorage.getItem("twoTongues.dictationRounds." + accountCode) || 0);
  } catch (_) {
    return 0;
  }
}

/** Bump and persist dictation rounds; returns the new count. */
export function bumpDictationRounds(accountCode) {
  const k = "twoTongues.dictationRounds." + (accountCode || "guest");
  let n = 0;
  try {
    n = Number(localStorage.getItem(k) || 0) + 1;
    localStorage.setItem(k, String(n));
  } catch (_) {}
  return n;
}

/**
 * Attach achievement unlocks based on current account progress.
 * Safe no-op on failure so progress saves never break.
 */
export function applyProgressAchievements(account, accountCode, dictationRounds) {
  try {
    const rounds =
      dictationRounds != null ? dictationRounds : loadDictationRounds(accountCode);
    const box = {};
    for (const id of Object.keys(account.srsStats || {})) {
      box[id] = srsLevelFromStats(account.srsStats[id]);
    }
    return unlockAchievements(account, {
      streak: computeStreak(account.studiedAt || {}),
      srsBox: box,
      timerMinutesTotal: getTodayTimerMinutes(),
      dictationRounds: rounds,
    });
  } catch (_) {
    return account;
  }
}

/** Guest-mode studied toggle (localStorage only). */
export function toggleGuestStudied(entryId, setAccounts) {
  try {
    const raw = localStorage.getItem("twoTongues.guestStudied");
    const data = raw ? JSON.parse(raw) : { studied: [], studiedAt: {} };
    const current = data.studied || [];
    const currentAt = data.studiedAt || {};
    const nowStudying = !current.includes(entryId);
    const nextStudied = nowStudying
      ? [...current, entryId]
      : current.filter((id) => id !== entryId);
    const nextStudiedAt = { ...currentAt };
    if (nowStudying) {
      nextStudiedAt[entryId] = Date.now();
      try {
        grantStudyWord("guest", entryId);
      } catch (_) {}
    } else delete nextStudiedAt[entryId];
    localStorage.setItem(
      "twoTongues.guestStudied",
      JSON.stringify({ studied: nextStudied, studiedAt: nextStudiedAt })
    );
    setAccounts((prev) => {
      const others = prev.filter((a) => a.code !== "guest");
      return [
        ...others,
        {
          code: "guest",
          name: "Guest",
          studied: nextStudied,
          studiedAt: nextStudiedAt,
          favorites: [],
        },
      ];
    });
  } catch (_) {}
}

/**
 * Toggle studied for a signed-in account via persistAccounts.
 * Uses absolute desired state so conflict retries don't double-flip.
 */
export async function toggleStudied({
  entryId,
  accountCode,
  accounts,
  persistAccounts,
}) {
  if (accountCode === "guest") return; // caller should use toggleGuestStudied

  const acct = accounts.find((a) => a.code === accountCode);
  const current = (acct && acct.studied) || [];
  const wantStudied = !current.includes(entryId);
  const stampedAt = Date.now();
  if (wantStudied) {
    try {
      grantStudyWord(accountCode, entryId);
      try {
        grantStreakBonus(
          accountCode,
          computeStreak({ ...((acct && acct.studiedAt) || {}), [entryId]: stampedAt })
        );
      } catch (_) {}
    } catch (_) {}
  }
  await persistAccounts((curAccounts) =>
    curAccounts.map((a) => {
      if (a.code !== accountCode) return a;
      const studied = a.studied || [];
      const studiedAt = { ...(a.studiedAt || {}) };
      const revokedAt = { ...(a.studiedRevokedAt || {}) };
      const has = studied.map(String).includes(String(entryId));
      let next = a;
      if (wantStudied && !has) {
        // Mark studied; clear any prior revoke so merges keep the study
        const nextRevoked = { ...revokedAt };
        delete nextRevoked[entryId];
        delete nextRevoked[String(entryId)];
        next = {
          ...a,
          studied: [...studied, entryId],
          studiedAt: { ...studiedAt, [entryId]: stampedAt },
          studiedRevokedAt: nextRevoked,
        };
      } else if (!wantStudied && has) {
        // Un-study: drop from list + stamp revoke so softSync/merge cannot
        // resurrect it from a stale remote "still studied" snapshot.
        const nextAt = { ...studiedAt };
        delete nextAt[entryId];
        delete nextAt[String(entryId)];
        next = {
          ...a,
          studied: studied.filter((id) => String(id) !== String(entryId)),
          studiedAt: nextAt,
          studiedRevokedAt: { ...revokedAt, [entryId]: stampedAt },
        };
      } else if (!wantStudied && !has) {
        // Already not studied — still stamp revoke so concurrent remote adds lose
        next = {
          ...a,
          studiedRevokedAt: { ...revokedAt, [entryId]: stampedAt },
        };
      } else {
        return a;
      }
      return applyProgressAchievements(next, accountCode);
    })
  );
}

export async function toggleFavorite({ entryId, accountCode, accounts, persistAccounts }) {
  const acct = accounts.find((a) => a.code === accountCode);
  const current = (acct && acct.favorites) || [];
  const wantFavorite = !current.includes(entryId);
  if (wantFavorite) {
    try {
      grantFavorite(accountCode, entryId);
    } catch (_) {}
  }
  await persistAccounts((curAccounts) =>
    curAccounts.map((a) => {
      if (a.code !== accountCode) return a;
      const favorites = a.favorites || [];
      const has = favorites.includes(entryId);
      let next = a;
      if (wantFavorite && !has) next = { ...a, favorites: [...favorites, entryId] };
      else if (!wantFavorite && has)
        next = { ...a, favorites: favorites.filter((id) => id !== entryId) };
      else return a;
      return applyProgressAchievements(next, accountCode);
    })
  );
}

export async function recordSrsAnswer({
  entryId,
  correct,
  qualityOverride,
  accountCode,
  persistAccounts,
}) {
  try {
    let prevBox = 0;
    let nextBox = 0;
    await persistAccounts((curAccounts) =>
      curAccounts.map((a) => {
        if (a.code !== accountCode) return a;
        const prevStats = (a.srsStats && a.srsStats[entryId]) || { correct: 0, total: 0 };
        const isCorrect = qualityOverride != null ? qualityOverride > 0 : !!correct;
        const nextStats = {
          correct: prevStats.correct + (isCorrect ? 1 : 0),
          total: prevStats.total + 1,
        };
        const quality =
          qualityOverride != null ? qualityOverride : correctToQuality(!!correct);
        const prevCard = getCardState(entryId, a.srsCards, a.srsStats, a.srsDueAt);
        const { card, dueAt } = applySm2(prevCard, quality, loadSrsPrefs());
        prevBox = srsLevelFromStats(prevStats);
        nextBox = srsLevelFromStats(nextStats);
        let next = {
          ...a,
          srsStats: { ...(a.srsStats || {}), [entryId]: nextStats },
          srsDueAt: { ...(a.srsDueAt || {}), [entryId]: dueAt },
          srsCards: { ...(a.srsCards || {}), [entryId]: card },
        };
        return applyProgressAchievements(next, accountCode);
      })
    );
    try {
      const isCorrect = qualityOverride != null ? qualityOverride > 0 : !!correct;
      if (isCorrect) grantQuizCorrect(accountCode, entryId);
      if (nextBox > prevBox) grantSrsPromote(accountCode, entryId, nextBox);
    } catch (_) {}
  } catch (_) {
    /* best-effort, quiz keeps going */
  }
}

export async function dictationRoundFinished({ accountCode, persistAccounts }) {
  if (!accountCode || accountCode === "guest") {
    bumpDictationRounds(accountCode || "guest");
    return;
  }
  const rounds = bumpDictationRounds(accountCode);
  try {
    await persistAccounts((curAccounts) =>
      curAccounts.map((a) => {
        if (a.code !== accountCode) return a;
        return applyProgressAchievements(a, accountCode, rounds);
      })
    );
  } catch (_) {}
}

export async function saveQuizResult({ result, accountCode, persistAccounts }) {
  try {
    try {
      const sid = (result && (result.id || result.sessionId || result.at)) || Date.now();
      const perfect = result && result.total >= 5 && result.correct === result.total;
      grantQuizSession(accountCode, String(sid), {
        perfect,
        questionCount: result && result.total,
      });
    } catch (_) {}
    await persistAccounts((curAccounts) =>
      curAccounts.map((a) => {
        if (a.code !== accountCode) return a;
        const nextHistory = [...(a.quizHistory || []), result].slice(-50);
        const next = { ...a, quizHistory: nextHistory };
        return applyProgressAchievements(next, accountCode);
      })
    );
  } catch (_) {
    /* best-effort */
  }
}

/** Priority levels for a word: 3 = high, 2 = medium, 1 = low, 0 / missing = none */
export const PRIORITY_LEVELS = [
  { value: 0, en: "None", ar: "بدون", color: "var(--muted)" },
  { value: 1, en: "Low", ar: "منخفضة", color: "#34c759" },
  { value: 2, en: "Medium", ar: "متوسطة", color: "#ff9f0a" },
  { value: 3, en: "High", ar: "عالية", color: "#ff3b30" },
];

export function getWordPriority(account, entryId) {
  if (!account || !entryId) return 0;
  const map = account.wordPriorities || {};
  const v = Number(map[entryId]);
  return v >= 1 && v <= 3 ? v : 0;
}

/**
 * Cycle or set priority for a word on the current account.
 * If `nextValue` is provided, set it; otherwise cycle 0 → 3 → 2 → 1 → 0.
 */
export async function setWordPriority({
  entryId,
  nextValue,
  accountCode,
  persistAccounts,
}) {
  if (!entryId || !accountCode || accountCode === "guest") {
    // guest: localStorage only
    try {
      const key = "twoTongues.guestPriorities";
      const raw = localStorage.getItem(key);
      const map = raw ? JSON.parse(raw) : {};
      let v = nextValue;
      if (v == null) {
        const cur = Number(map[entryId]) || 0;
        v = cur === 0 ? 3 : cur === 3 ? 2 : cur === 2 ? 1 : 0;
      }
      if (v === 0) delete map[entryId];
      else map[entryId] = v;
      localStorage.setItem(key, JSON.stringify(map));
    } catch (_) {}
    return;
  }
  await persistAccounts((curAccounts) =>
    curAccounts.map((a) => {
      if (a.code !== accountCode) return a;
      const map = { ...(a.wordPriorities || {}) };
      let v = nextValue;
      if (v == null) {
        const cur = Number(map[entryId]) || 0;
        v = cur === 0 ? 3 : cur === 3 ? 2 : cur === 2 ? 1 : 0;
      }
      if (v === 0) delete map[entryId];
      else map[entryId] = v;
      return { ...a, wordPriorities: map };
    })
  );
}
