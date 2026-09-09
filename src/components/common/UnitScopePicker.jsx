import { useMemo, useState, useCallback } from "react";
import { tr } from "../../lib/config/i18n";
import { BRASS, labelStyle } from "../../lib/config/theme";
import { sectionDisplayName, lessonDisplayName } from "../../lib/state/unitStructure";
import { WORD_CATEGORIES, categoryLabel } from "../../lib/state/wordCategories";

/**
 * Shared multi-unit scope for Baccalaureate Curriculum section practice / exam tools.
 * Returns filtered entries + UI for presets + per-unit toggles.
 *
 * `unitStructure` (optional, 4th arg): when provided, also exposes Section (A/B/...)
 * and Lesson (1/2/...) scoping on top of the unit filter — free choice of
 * Unit-only / Unit+Section / Unit+Section+Lesson, same as any other quiz scope.
 * Omitting it keeps the exact old unit-only behavior (fully backward compatible).
 */
export function useUnitScope(academicUnits, activeUnitId, entries, unitStructure = null) {
  const hasUnits = Array.isArray(academicUnits) && academicUnits.length > 0;
  const sortedUnits = useMemo(() => {
    if (!hasUnits) return [];
    return [...academicUnits].sort(
      (a, b) =>
        (a.order || 0) - (b.order || 0) ||
        String(a.name || "").localeCompare(String(b.name || ""))
    );
  }, [hasUnits, academicUnits]);

  const [selectedUnitIds, setSelectedUnitIds] = useState(() => {
    if (!Array.isArray(academicUnits) || !academicUnits.length) return null;
    const id = activeUnitId || academicUnits[0]?.id;
    return id ? new Set([id]) : new Set(academicUnits.map((u) => u.id));
  });

  // null = no Section/Lesson restriction (whole unit, old behavior).
  const [selectedSectionIds, setSelectedSectionIds] = useState(null);
  const [selectedLessonIds, setSelectedLessonIds] = useState(null);
  // null = no Category restriction (Key Vocabulary / Important Vocabulary /
  // Definitions / ...) — only meaningful once exactly one Lesson is picked,
  // same idea as Section/Lesson above.
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(null);

  const structureSections = unitStructure?.sections || [];
  const hasStructure = structureSections.length > 0;

  const unitFilteredEntries = useMemo(() => {
    let out = entries || [];
    if (hasUnits && selectedUnitIds) {
      out = out.filter(
        (e) => selectedUnitIds.has(e.unitId) || selectedUnitIds.has(e.unitId || null)
      );
    }
    if (hasStructure && selectedLessonIds && selectedLessonIds.size) {
      out = out.filter((e) => selectedLessonIds.has(e.lessonId));
      if (selectedCategoryIds && selectedCategoryIds.size) {
        out = out.filter((e) => selectedCategoryIds.has(e.categoryId));
      }
    } else if (hasStructure && selectedSectionIds && selectedSectionIds.size) {
      out = out.filter((e) => selectedSectionIds.has(e.sectionId));
    }
    return out;
  }, [entries, hasUnits, selectedUnitIds, hasStructure, selectedSectionIds, selectedLessonIds, selectedCategoryIds]);

  const setUnitPreset = useCallback(
    (count) => {
      if (!sortedUnits.length) return;
      setSelectedUnitIds(new Set(sortedUnits.slice(0, count).map((u) => u.id)));
    },
    [sortedUnits]
  );

  const toggleUnit = useCallback((id) => {
    setSelectedUnitIds((prev) => {
      const next = new Set(prev || []);
      if (next.has(id)) {
        if (next.size <= 1) return next;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllUnits = useCallback(() => {
    setSelectedUnitIds(new Set(sortedUnits.map((u) => u.id)));
  }, [sortedUnits]);

  const toggleSection = useCallback((id) => {
    setSelectedLessonIds(null); // picking a section resets the finer lesson filter
    setSelectedSectionIds((prev) => {
      const next = new Set(prev || []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size ? next : null;
    });
  }, []);

  const toggleLesson = useCallback((id) => {
    setSelectedCategoryIds(null); // picking a different lesson resets the finer category filter
    setSelectedLessonIds((prev) => {
      const next = new Set(prev || []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size ? next : null;
    });
  }, []);

  const toggleCategory = useCallback((id) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev || []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size ? next : null;
    });
  }, []);

  const clearSectionLessonScope = useCallback(() => {
    setSelectedSectionIds(null);
    setSelectedLessonIds(null);
    setSelectedCategoryIds(null);
  }, []);

  return {
    hasUnits,
    sortedUnits,
    selectedUnitIds,
    setSelectedUnitIds,
    unitFilteredEntries,
    setUnitPreset,
    toggleUnit,
    selectAllUnits,
    hasStructure,
    structureSections,
    selectedSectionIds,
    selectedLessonIds,
    selectedCategoryIds,
    toggleSection,
    toggleLesson,
    toggleCategory,
    clearSectionLessonScope,
  };
}

/**
 * Visual unit picker (presets + chips). Only renders when hasUnits is true.
 */
export default function UnitScopePicker({
  isAr,
  hasUnits,
  sortedUnits,
  selectedUnitIds,
  entries,
  setUnitPreset,
  toggleUnit,
  selectAllUnits,
  accent = BRASS,
  accentSoft = "rgba(184, 148, 58, 0.12)",
  onChange,
}) {
  if (!hasUnits || !sortedUnits.length) return null;

  const chipStyle = (active) => ({
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: active ? "var(--on-accent, #fff)" : "var(--icon-muted)",
    background: active ? accent : "none",
    border: `1px solid ${active ? accent : "rgba(var(--border-rgb),0.25)"}`,
    borderRadius: 20,
    cursor: "pointer",
  });

  const presets = [
    { n: 3, label: tr(isAr, "First 3", "أول 3") },
    { n: 6, label: tr(isAr, "First 6", "أول 6") },
    { n: 12, label: tr(isAr, "First 12", "أول 12") },
    { n: sortedUnits.length, label: tr(isAr, "All units", "كل الوحدات") },
  ].filter(
    (p, i, arr) =>
      p.n > 0 &&
      p.n <= sortedUnits.length &&
      arr.findIndex((x) => x.n === p.n) === i
  );

  function handlePreset(n) {
    if (n >= sortedUnits.length) selectAllUnits();
    else setUnitPreset(n);
    if (typeof onChange === "function") onChange();
  }

  function handleToggle(id) {
    toggleUnit(id);
    if (typeof onChange === "function") onChange();
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{tr(isAr, "Units", "الوحدات")}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, marginBottom: 6 }}>
        {presets.map((p) => {
          const active =
            selectedUnitIds &&
            selectedUnitIds.size === Math.min(p.n, sortedUnits.length) &&
            sortedUnits.slice(0, p.n).every((u) => selectedUnitIds.has(u.id));
          return (
            <button
              key={p.n}
              type="button"
              onClick={() => handlePreset(p.n)}
              style={chipStyle(!!active)}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {sortedUnits.map((u) => {
          const active = selectedUnitIds ? selectedUnitIds.has(u.id) : false;
          const count = (entries || []).filter((e) => (e.unitId || null) === u.id).length;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => handleToggle(u.id)}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 999,
                border: active ? `1.5px solid ${accent}` : "1px solid rgba(var(--border-rgb),0.25)",
                background: active ? accentSoft : "transparent",
                color: active ? accent : "var(--icon-muted)",
                cursor: "pointer",
              }}
            >
              {u.name}
              <span style={{ marginInlineStart: 5, opacity: 0.75, fontSize: 11 }}>{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Section (A/B/...) + Lesson (1/2/...) scope chips. Renders only when the
 * unit structure has at least one section AND exactly one unit is selected
 * (Section/Lesson scoping only makes sense within a single unit at a time,
 * since a "Section A" chosen across several different units would mix
 * unrelated lessons together).
 */
export function SectionLessonScopePicker({
  isAr,
  hasStructure,
  structureSections,
  selectedUnitIds,
  entries,
  selectedSectionIds,
  selectedLessonIds,
  selectedCategoryIds,
  toggleSection,
  toggleLesson,
  toggleCategory,
  clearSectionLessonScope,
  accent = BRASS,
  accentSoft = "rgba(184, 148, 58, 0.12)",
  onChange,
}) {
  if (!hasStructure || !structureSections?.length) return null;
  if (!selectedUnitIds || selectedUnitIds.size !== 1) return null;

  const chipStyle = (active) => ({
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 999,
    border: active ? `1.5px solid ${accent}` : "1px solid rgba(var(--border-rgb),0.25)",
    background: active ? accentSoft : "transparent",
    color: active ? accent : "var(--icon-muted)",
    cursor: "pointer",
  });

  const fire = (fn) => (...args) => {
    fn(...args);
    if (typeof onChange === "function") onChange();
  };

  const activeSectionId =
    selectedSectionIds && selectedSectionIds.size === 1
      ? [...selectedSectionIds][0]
      : null;
  const sectionsToShowLessons = activeSectionId
    ? structureSections.filter((s) => s.id === activeSectionId)
    : [];
  const activeLessonId =
    selectedLessonIds && selectedLessonIds.size === 1
      ? [...selectedLessonIds][0]
      : null;

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{tr(isAr, "Section", "السكشن")}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, marginBottom: 6 }}>
        <button
          type="button"
          onClick={fire(clearSectionLessonScope)}
          style={chipStyle(!selectedSectionIds && !selectedLessonIds)}
        >
          {tr(isAr, "Whole unit", "الوحدة كلها")}
        </button>
        {structureSections.map((s) => {
          const active = !!(selectedSectionIds && selectedSectionIds.has(s.id)) && !selectedLessonIds;
          const count = (entries || []).filter((e) => (e.sectionId || null) === s.id).length;
          return (
            <button
              key={s.id}
              type="button"
              onClick={fire(() => toggleSection(s.id))}
              style={chipStyle(active)}
            >
              {sectionDisplayName(s)}
              <span style={{ marginInlineStart: 5, opacity: 0.75, fontSize: 11 }}>{count}</span>
            </button>
          );
        })}
      </div>
      {sectionsToShowLessons.map((s) => (
        <div key={s.id} style={{ marginTop: 4 }}>
          <label style={labelStyle}>{tr(isAr, "Lesson", "الدرس")}</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {s.lessons.map((l) => {
              const active = !!(selectedLessonIds && selectedLessonIds.has(l.id));
              const count = (entries || []).filter((e) => (e.lessonId || null) === l.id).length;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={fire(() => toggleLesson(l.id))}
                  style={chipStyle(active)}
                >
                  {lessonDisplayName(l)}
                  <span style={{ marginInlineStart: 5, opacity: 0.75, fontSize: 11 }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {activeLessonId && (
        <div style={{ marginTop: 4 }}>
          <label style={labelStyle}>{tr(isAr, "Category", "التصنيف")}</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {WORD_CATEGORIES.map((c) => {
              const active = !!(selectedCategoryIds && selectedCategoryIds.has(c.id));
              const count = (entries || []).filter(
                (e) => (e.lessonId || null) === activeLessonId && e.categoryId === c.id
              ).length;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={fire(() => toggleCategory(c.id))}
                  style={chipStyle(active)}
                >
                  {categoryLabel(c.id, isAr)}
                  <span style={{ marginInlineStart: 5, opacity: 0.75, fontSize: 11 }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
