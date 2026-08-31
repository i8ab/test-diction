/**
 * Server-side merge for learning progress fields.
 * Prevents a shorter/empty client snapshot from wiping studied/favorites/etc.
 */

function asIdList(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  const seen = new Set();
  for (const id of v) {
    const s = String(id);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function unionIdLists(a, b) {
  return asIdList([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]);
}

function mergeStudiedAt(prev, incoming) {
  const P = prev && typeof prev === "object" && !Array.isArray(prev) ? prev : {};
  const I = incoming && typeof incoming === "object" && !Array.isArray(incoming) ? incoming : {};
  const out = { ...P };
  for (const [k, v] of Object.entries(I)) {
    const pv = Number(P[k]) || 0;
    const iv = Number(v) || 0;
    out[k] = Math.max(pv, iv) || v;
  }
  // Keep local-only timestamps from prev
  for (const [k, v] of Object.entries(P)) {
    if (out[k] === undefined) out[k] = v;
  }
  return out;
}

function mergeAchievements(prev, incoming) {
  if (Array.isArray(prev) || Array.isArray(incoming)) {
    return unionIdLists(prev, incoming);
  }
  if (
    prev &&
    typeof prev === "object" &&
    incoming &&
    typeof incoming === "object"
  ) {
    return { ...prev, ...incoming };
  }
  if (incoming !== undefined) return incoming;
  return prev;
}

function maxXp(prev, incoming) {
  const p = Number(prev);
  const i = Number(incoming);
  if (Number.isFinite(p) && Number.isFinite(i)) return Math.max(p, i);
  if (Number.isFinite(i)) return i;
  if (Number.isFinite(p)) return p;
  return incoming !== undefined ? incoming : prev;
}

/**
 * Merge progress from `incoming` onto `prev` (DB row).
 * - studied / favorites: UNION (unless studiedReplace / favoritesReplace)
 * - studiedAt: per-id max timestamp
 * - achievements: union or shallow object merge
 * - xp: max numeric
 * Other keys on incoming still overwrite (caller controls allowlist).
 */
export function mergeLearningProgress(prev, incoming) {
  const base = prev && typeof prev === "object" ? prev : {};
  const inc = incoming && typeof incoming === "object" ? incoming : {};
  const out = { ...base, ...inc };

  if (inc.studiedReplace === true && Array.isArray(inc.studied)) {
    out.studied = asIdList(inc.studied);
  } else if (inc.studied !== undefined || base.studied !== undefined) {
    out.studied = unionIdLists(base.studied, inc.studied);
  }

  if (inc.favoritesReplace === true && Array.isArray(inc.favorites)) {
    out.favorites = asIdList(inc.favorites);
  } else if (inc.favorites !== undefined || base.favorites !== undefined) {
    out.favorites = unionIdLists(base.favorites, inc.favorites);
  }

  if (inc.studiedAt !== undefined || base.studiedAt !== undefined) {
    out.studiedAt = mergeStudiedAt(base.studiedAt, inc.studiedAt);
  }

  if (inc.achievements !== undefined || base.achievements !== undefined) {
    out.achievements = mergeAchievements(base.achievements, inc.achievements);
  }

  if (inc.xp !== undefined || base.xp !== undefined) {
    out.xp = maxXp(base.xp, inc.xp);
  }

  // Optional: merge xpHistory arrays by union of stringified entries (cap later)
  if (Array.isArray(inc.xpHistory) || Array.isArray(base.xpHistory)) {
    const combined = [
      ...(Array.isArray(base.xpHistory) ? base.xpHistory : []),
      ...(Array.isArray(inc.xpHistory) ? inc.xpHistory : []),
    ];
    // keep last 200
    out.xpHistory = combined.slice(-200);
  }

  delete out.studiedReplace;
  delete out.favoritesReplace;
  return out;
}

/**
 * Apply mergeLearningProgress inside a full account row merge (prev DB, incoming client).
 */
export function mergeAccountProgressRow(prev, incoming) {
  if (!prev) return incoming;
  if (!incoming) return prev;
  const merged = mergeLearningProgress(prev, incoming);
  // Preserve identity / privilege from prev unless incoming explicitly managed elsewhere
  merged.code = prev.code;
  return merged;
}

export default {
  mergeLearningProgress,
  mergeAccountProgressRow,
};
