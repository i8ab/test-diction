// Friend challenges among accounts in the shared dictionary (local + account fields).

import { uid, dateKey } from "../utils/quizHelpers";

const CHALLENGES_KEY = "twoTongues.challenges";

export function loadChallenges() {
  try {
    const raw = localStorage.getItem(CHALLENGES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

export function saveChallenges(list) {
  try {
    localStorage.setItem(CHALLENGES_KEY, JSON.stringify(list || []));
  } catch (_) {}
}

/**
 * Create a challenge.
 * type: "words" | "quizzes" | "minutes" | "streak"
 * target: number
 * durationDays: how many days the challenge lasts
 */
export function createChallenge({
  fromCode,
  fromName,
  toCode,
  toName,
  type,
  target,
  durationDays,
}) {
  const now = Date.now();
  const days = Math.max(1, Number(durationDays) || 7);
  const challenge = {
    id: uid(),
    fromCode,
    fromName,
    toCode,
    toName,
    type: type || "words",
    target: Math.max(1, Number(target) || 10),
    createdAt: now,
    endsAt: now + days * 24 * 60 * 60 * 1000,
    status: "pending", // pending | active | completed | declined
    fromProgress: 0,
    toProgress: 0,
    winner: null,
  };
  const all = loadChallenges();
  all.unshift(challenge);
  saveChallenges(all.slice(0, 100));
  return challenge;
}

export function updateChallenge(id, patch) {
  const all = loadChallenges().map((c) => (c.id === id ? { ...c, ...patch } : c));
  saveChallenges(all);
  return all.find((c) => c.id === id);
}

export function acceptChallenge(id) {
  return updateChallenge(id, { status: "active" });
}

export function declineChallenge(id) {
  return updateChallenge(id, { status: "declined" });
}

export function challengesForUser(accountCode) {
  return loadChallenges().filter(
    (c) => c.fromCode === accountCode || c.toCode === accountCode
  );
}

/** Recompute progress from account activity maps. */
export function computeChallengeProgress(challenge, account) {
  if (!challenge || !account) return 0;
  const since = challenge.createdAt || 0;
  const type = challenge.type;
  if (type === "words") {
    let n = 0;
    for (const t of Object.values(account.studiedAt || {})) {
      if (typeof t === "number" && t >= since) n += 1;
    }
    return n;
  }
  if (type === "quizzes") {
    return (account.quizHistory || []).filter((q) => q && q.at >= since).length;
  }
  if (type === "streak") {
    // current streak value is passed externally; store as progress when updating
    return 0;
  }
  if (type === "minutes") {
    // timer minutes not on account — progress updated externally
    return challenge.fromCode === account.code ? challenge.fromProgress : challenge.toProgress;
  }
  return 0;
}

export function refreshChallengeProgress(challenge, fromAccount, toAccount, streakFrom, streakTo, minsFrom, minsTo) {
  if (!challenge || challenge.status !== "active") return challenge;
  let fromP = 0;
  let toP = 0;
  if (challenge.type === "words" || challenge.type === "quizzes") {
    fromP = computeChallengeProgress(challenge, fromAccount);
    toP = computeChallengeProgress(challenge, toAccount);
  } else if (challenge.type === "streak") {
    fromP = streakFrom || 0;
    toP = streakTo || 0;
  } else if (challenge.type === "minutes") {
    fromP = minsFrom || 0;
    toP = minsTo || 0;
  }
  let status = challenge.status;
  let winner = challenge.winner;
  const now = Date.now();
  const fromDone = fromP >= challenge.target;
  const toDone = toP >= challenge.target;
  if (fromDone || toDone) {
    status = "completed";
    if (fromDone && toDone) winner = fromP >= toP ? challenge.fromCode : challenge.toCode;
    else if (fromDone) winner = challenge.fromCode;
    else winner = challenge.toCode;
  } else if (now > challenge.endsAt) {
    status = "completed";
    if (fromP === toP) winner = null;
    else winner = fromP > toP ? challenge.fromCode : challenge.toCode;
  }
  return updateChallenge(challenge.id, {
    fromProgress: fromP,
    toProgress: toP,
    status,
    winner,
  });
}
