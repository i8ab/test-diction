import { tr } from "../../lib/config/i18n";
import { WORD_TYPES } from "../../lib/utils/wordTypes";

/**
 * Study status chips + POS / date / sort controls for the dictionary list.
 */
export default function EntryFiltersBar({
  cfg,
  isAr,
  studyFilter,
  setStudyFilter,
  posFilter,
  setPosFilter,
  dateFilter,
  setDateFilter,
  sortKey,
  setSortKey,
  mobileFiltersOpen,
  setMobileFiltersOpen,
}) {
  const filters = [
    { key: "all", label: tr(isAr, "All", "الكل") },
    { key: "studied", label: tr(isAr, "Studied", "تمت دراستها") },
    { key: "not-studied", label: tr(isAr, "Not Studied", "لم تُدرس بعد") },
    { key: "favorites", label: tr(isAr, "Favorites", "المفضلة") },
    { key: "due", label: tr(isAr, "Due today", "مستحقة") },
    { key: "weak", label: tr(isAr, "Weak", "ضعيفة") },
  ];

  const hasActiveExtra =
    studyFilter !== "all" ||
    posFilter !== "all" ||
    dateFilter !== "all" ||
    sortKey !== "alpha";

  return (
    <>
      <div className="mobile-filters-toggle-wrap" style={{ marginTop: 10 }}>
        <button
          type="button"
          className="mobile-filters-toggle"
          onClick={() => setMobileFiltersOpen((v) => !v)}
          aria-expanded={mobileFiltersOpen}
          style={{ display: "none" }}
        >
          {tr(isAr, "Filters & sort", "فلاتر وترتيب")}
          {hasActiveExtra ? " · ●" : ""}
          <span style={{ marginInlineStart: 6, opacity: 0.7 }}>
            {mobileFiltersOpen ? "▴" : "▾"}
          </span>
        </button>
      </div>
      <div
        className={`study-filter-row mobile-filters-panel${mobileFiltersOpen ? " is-open" : ""}`}
        style={{ display: "flex", gap: 10, marginTop: 10 }}
      >
        {filters.map((f) => {
          const active = studyFilter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setStudyFilter(f.key)}
              className={active ? "btn-shine" : ""}
              style={{
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 600,
                color: active ? "#fff" : "var(--icon-muted)",
                background: active ? cfg.accent : "none",
                border: `1px solid ${active ? cfg.accent : "rgba(var(--border-rgb),0.25)"}`,
                borderRadius: 20,
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      <div
        className={`filter-chip-row mobile-filters-panel${mobileFiltersOpen ? " is-open" : ""}`}
        style={{
          display: "flex",
          gap: 10,
          marginTop: 10,
          flexWrap: "nowrap",
          alignItems: "center",
          maxWidth: "100%",
        }}
      >
        <select
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value)}
          aria-label={tr(isAr, "Part of speech", "نوع الكلمة")}
          style={{
            fontSize: 12,
            padding: "5px 10px",
            borderRadius: 16,
            border: "1px solid rgba(var(--border-rgb),0.25)",
            background: "var(--card)",
            color: "var(--ink)",
            fontWeight: 600,
          }}
        >
          <option value="all">{tr(isAr, "All types", "كل الأنواع")}</option>
          {WORD_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {isAr ? t.ar : t.en}
            </option>
          ))}
        </select>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          aria-label={tr(isAr, "Added date", "تاريخ الإضافة")}
          style={{
            fontSize: 12,
            padding: "5px 10px",
            borderRadius: 16,
            border: "1px solid rgba(var(--border-rgb),0.25)",
            background: "var(--card)",
            color: "var(--ink)",
            fontWeight: 600,
          }}
        >
          <option value="all">{tr(isAr, "Any time", "أي وقت")}</option>
          <option value="today">{tr(isAr, "Added today", "أُضيفت اليوم")}</option>
          <option value="week">{tr(isAr, "Last 7 days", "آخر ٧ أيام")}</option>
          <option value="month">{tr(isAr, "Last 30 days", "آخر ٣٠ يوم")}</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          aria-label={tr(isAr, "Sort", "ترتيب")}
          style={{
            fontSize: 12,
            padding: "5px 10px",
            borderRadius: 16,
            border: "1px solid rgba(var(--border-rgb),0.25)",
            background: "var(--card)",
            color: "var(--ink)",
            fontWeight: 600,
          }}
        >
          <option value="alpha">{tr(isAr, "A–Z", "أ–ي")}</option>
          <option value="newest">{tr(isAr, "Newest", "الأحدث")}</option>
          <option value="oldest">{tr(isAr, "Oldest", "الأقدم")}</option>
          <option value="weak">{tr(isAr, "Weakest first", "الأضعف أولاً")}</option>
        </select>
      </div>
    </>
  );
}
