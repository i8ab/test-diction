/**
 * Pure helpers for dictionary list: search suggestions, filter, sort, group.
 */
import { firstLetterKey, fuzzyIncludes, matchScore } from "./searchUtils";
import { entryPosList } from "./wordTypes";
import { isSrsDue } from "./quizHelpers";

/**
 * Ranked word suggestions for the search box (unique by word, top N).
 */
export function buildSearchSuggestions(sectionEntries, query, section, limit = 6) {
  const q = String(query || "").trim();
  if (!q) return [];
  const seen = new Set();
  const scored = [];
  for (const e of sectionEntries || []) {
    if (seen.has(e.word)) continue;
    const score = matchScore(e, q);
    if (!score) continue; // 0 = no match at all, skip it
    seen.add(e.word);
    scored.push({ entry: e, score });
  }
  const locale = section === "ar-ar" ? "ar" : "en";
  scored.sort(
    (a, b) => b.score - a.score || a.entry.word.localeCompare(b.entry.word, locale)
  );
  return scored.slice(0, limit).map((s) => s.entry);
}

/**
 * Filter + sort section entries by search query and UI filters.
 */
export function filterSectionEntries({
  sectionEntries,
  query,
  studyFilter,
  studiedIds,
  favoriteIds,
  srsDueAt,
  srsBox,
  posFilter,
  dateFilter,
  sortKey,
  wordPriorities = {},
}) {
  const q = String(query || "").trim();
  let base = q
    ? (sectionEntries || []).filter(
        (e) =>
          fuzzyIncludes(e.word, q) ||
          fuzzyIncludes(e.meaning, q) ||
          fuzzyIncludes(e.definition || "") ||
          fuzzyIncludes(e.example || "")
      )
    : (sectionEntries || []).slice();

  if (studyFilter === "studied") base = base.filter((e) => studiedIds.has(e.id));
  else if (studyFilter === "not-studied")
    base = base.filter((e) => !studiedIds.has(e.id));
  else if (studyFilter === "favorites")
    base = base.filter((e) => favoriteIds.has(e.id));
  else if (studyFilter === "due")
    base = base.filter((e) => studiedIds.has(e.id) && isSrsDue(e.id, srsDueAt));
  else if (studyFilter === "weak")
    base = base.filter(
      (e) => studiedIds.has(e.id) && ((srsBox && srsBox[e.id]) || 0) <= 1
    );
  else if (studyFilter === "priority")
    base = base.filter((e) => (Number(wordPriorities[e.id]) || 0) >= 1);
  else if (studyFilter === "priority-high")
    base = base.filter((e) => (Number(wordPriorities[e.id]) || 0) === 3);

  if (posFilter && posFilter !== "all") {
    base = base.filter(
      (e) => entryPosList(e).includes(posFilter) || e.pos === posFilter
    );
  }

  if (dateFilter && dateFilter !== "all") {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    let minT = 0;
    if (dateFilter === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      minT = d.getTime();
    } else if (dateFilter === "week") minT = now - 7 * day;
    else if (dateFilter === "month") minT = now - 30 * day;
    base = base.filter((e) => typeof e.addedAt === "number" && e.addedAt >= minT);
  }

  if (sortKey === "newest")
    base = [...base].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  else if (sortKey === "oldest")
    base = [...base].sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
  else if (sortKey === "weak")
    base = [...base].sort(
      (a, b) => ((srsBox && srsBox[a.id]) || 0) - ((srsBox && srsBox[b.id]) || 0)
    );
  else if (sortKey === "priority")
    base = [...base].sort(
      (a, b) => (Number(wordPriorities[b.id]) || 0) - (Number(wordPriorities[a.id]) || 0)
    );
  else if (sortKey === "due")
    base = [...base].sort((a, b) => {
      const da = srsDueAt && srsDueAt[a.id] != null ? Number(srsDueAt[a.id]) : 0;
      const db = srsDueAt && srsDueAt[b.id] != null ? Number(srsDueAt[b.id]) : 0;
      return da - db;
    });

  return base;
}

/** Group filtered entries by first letter for the A–Z sidebar. */
export function groupEntriesByLetter(entries, section) {
  const map = {};
  for (const e of entries || []) {
    const key = firstLetterKey(e.word, section);
    if (!map[key]) map[key] = [];
    map[key].push(e);
  }
  return map;
}
