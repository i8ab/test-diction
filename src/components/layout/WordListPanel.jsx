import { useRef, useCallback, useEffect } from "react";
import { tr } from "../../lib/config/i18n";
import { firstLetterKey } from "../../lib/utils/searchUtils";
import { LoaderIcon } from "../common/Icons";
import EntryCard from "../common/EntryCard";
import EmptyState from "./EmptyState";

/**
 * Letter rail + paginated word list for the dictionary main view.
 */
export default function WordListPanel({
  cfg,
  section,
  isAr,
  appIsAr,
  entriesLoaded,
  filtered,
  query,
  studyFilter,
  onOpenAdd,
  flatSorted,
  visibleCount,
  grouped,
  hasMore,
  loadMoreRef,
  loadMore,
  availableLetters,
  jumpTo,
  isAdmin,
  accountCode,
  deviceMode,
  studiedIds,
  favoriteIds,
  accountNameByCode,
  onDelete,
  onEdit,
  onOpenZoom,
  onToggleStudied,
  onToggleFavorite,
}) {
  const letterRefs = useRef({});
  const railRef = useRef(null);
  const railAdjustingRef = useRef(false);
  // Circular (infinite) scroll only on tablet/desktop vertical rail
  const enableCircularRail = deviceMode === "tablet" || deviceMode === "desktop";
  const baseLetters = cfg.letters || [];
  // Render letters twice so the rail can loop seamlessly
  const railLetters = enableCircularRail
    ? [...baseLetters, ...baseLetters]
    : baseLetters;

  function handleJump(letter) {
    if (typeof jumpTo === "function") {
      jumpTo(letter, letterRefs);
      return;
    }
    const el = letterRefs.current[letter];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Seamless loop in both directions (duplicate list technique)
  const handleRailScroll = useCallback(() => {
    if (!enableCircularRail || railAdjustingRef.current) return;
    const el = railRef.current;
    if (!el) return;
    const half = el.scrollHeight / 2;
    if (half <= 0) return;
    if (el.scrollTop >= half) {
      railAdjustingRef.current = true;
      el.scrollTop -= half;
      railAdjustingRef.current = false;
    } else if (el.scrollTop <= 0) {
      railAdjustingRef.current = true;
      el.scrollTop += half;
      railAdjustingRef.current = false;
    }
  }, [enableCircularRail]);

  // Start at the top of the first copy (natural A→Z order)
  useEffect(() => {
    if (!enableCircularRail) return;
    const el = railRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      railAdjustingRef.current = true;
      el.scrollTop = 0;
      railAdjustingRef.current = false;
    });
    return () => cancelAnimationFrame(id);
  }, [enableCircularRail, section, baseLetters.length]);

  return (
    <div className="app-container app-main-row">
      <aside
        ref={railRef}
        className={"letter-rail" + (enableCircularRail ? " letter-rail--circular" : "")}
        aria-label="Alphabet"
        data-section={section}
        style={{ "--letter-accent": cfg.accent }}
        onScroll={enableCircularRail ? handleRailScroll : undefined}
      >
        {railLetters.map((l, i) => {
          const hasWords = availableLetters.has(l);
          // unique key across duplicated sets
          const key = enableCircularRail ? `${l}-${i}` : l;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (hasWords) handleJump(l);
              }}
              disabled={!hasWords}
              className={"letter-rail-btn" + (hasWords ? " has-words" : " no-words")}
              title={
                hasWords
                  ? undefined
                  : isAr
                    ? "لا توجد كلمات بهذا الحرف"
                    : "No words for this letter"
              }
            >
              {l}
            </button>
          );
        })}
      </aside>

      <div className="word-list-main">
        {!entriesLoaded ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "var(--muted-strong)",
              padding: "30px 0",
            }}
          >
            <LoaderIcon size={18} />
            <span>{tr(isAr, "Loading entries…", "جارٍ تحميل الكلمات…")}</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            hasQuery={!!query.trim() || studyFilter !== "all"}
            onAdd={onOpenAdd}
            accent={cfg.accent}
            isAr={appIsAr}
          />
        ) : (
          <>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--entry-gap, 10px)",
              }}
            >
              {flatSorted.slice(0, visibleCount).map((e, idx) => {
                const letterKey = firstLetterKey(e.word, section);
                const prevLetter =
                  idx > 0
                    ? firstLetterKey(flatSorted[idx - 1].word, section)
                    : null;
                const isFirstOfLetter = letterKey && letterKey !== prevLetter;
                const letterCount =
                  (grouped[letterKey] && grouped[letterKey].length) || 0;
                return (
                  <div
                    key={e.id}
                    className={isFirstOfLetter ? "letter-section-anchor" : undefined}
                    ref={
                      isFirstOfLetter
                        ? (el) => {
                            letterRefs.current[letterKey] = el;
                          }
                        : undefined
                    }
                  >
                    {isFirstOfLetter && (
                      <div
                        className="letter-divider"
                        aria-label={letterKey}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginTop: idx === 0 ? 0 : 8,
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontFamily:
                              section === "ar-ar"
                                ? "'Amiri', serif"
                                : "'Fraunces', serif",
                            fontSize: 15,
                            fontWeight: 700,
                            color: cfg.accent,
                            lineHeight: 1,
                            minWidth: 22,
                            textAlign: "center",
                          }}
                        >
                          {letterKey}
                        </span>
                        <div
                          style={{
                            flex: 1,
                            height: 1,
                            background: `linear-gradient(${
                              cfg.dir === "rtl" ? "270deg" : "90deg"
                            }, ${cfg.accent}55, rgba(var(--border-rgb),0.12) 70%)`,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--muted)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {letterCount}
                        </span>
                      </div>
                    )}
                    <EntryCard
                      entry={e}
                      cfg={cfg}
                      isAdmin={isAdmin}
                      isAr={appIsAr}
                      mobileLayout={deviceMode === "mobile"}
                      tabletLayout={deviceMode === "tablet"}
                      canEdit={isAdmin || e.addedBy === accountCode}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onOpenZoom={onOpenZoom}
                      isStudied={studiedIds.has(e.id)}
                      onToggleStudied={onToggleStudied}
                      isFavorite={favoriteIds.has(e.id)}
                      onToggleFavorite={onToggleFavorite}
                      addedByLabel={accountNameByCode[e.addedBy] || e.addedBy}
                      editedByLabel={
                        accountNameByCode[e.editedBy] || e.editedBy
                      }
                    />
                  </div>
                );
              })}
            </div>
            {hasMore && (
              <div
                ref={loadMoreRef}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "10px 0 24px",
                }}
              >
                <button
                  type="button"
                  onClick={() => loadMore()}
                  style={{
                    padding: "9px 18px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: cfg.accent,
                    background: "var(--input-bg)",
                    border: "1px solid rgba(var(--border-rgb),0.2)",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  {tr(
                    isAr,
                    `Load more (${flatSorted.length - visibleCount} left)`,
                    `تحميل المزيد (${flatSorted.length - visibleCount} متبقي)`
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
