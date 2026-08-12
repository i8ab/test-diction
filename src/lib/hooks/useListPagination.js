import { useState, useEffect, useMemo, useRef, useCallback } from "react";

const DEFAULT_PAGE_SIZE = 60;

/**
 * Infinite-scroll style pagination over a letter-grouped word list.
 */
export function useListPagination({
  flatSorted,
  sortedLetters,
  grouped,
  resetDeps = [],
  pageSize = DEFAULT_PAGE_SIZE,
}) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const loadMoreRef = useRef(null);

  useEffect(() => {
    setVisibleCount(pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  const visibleGrouped = useMemo(() => {
    const map = {};
    let remaining = visibleCount;
    for (const l of sortedLetters) {
      if (remaining <= 0) break;
      const slice = grouped[l].slice(0, remaining);
      if (slice.length) map[l] = slice;
      remaining -= slice.length;
    }
    return map;
  }, [sortedLetters, grouped, visibleCount]);

  const hasMore = visibleCount < flatSorted.length;

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0] && entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + pageSize, flatSorted.length));
        }
      },
      { rootMargin: "600px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, flatSorted.length, pageSize]);

  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + pageSize, flatSorted.length));
  }, [pageSize, flatSorted.length]);

  return {
    visibleCount,
    setVisibleCount,
    visibleGrouped,
    hasMore,
    loadMoreRef,
    loadMore,
    pageSize,
  };
}
