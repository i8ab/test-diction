import { useMemo, useEffect } from "react";

/**
 * Section + academic unit filtering for the dictionary list.
 * Extracted from MainView to keep list logic testable and thin.
 *
 * sectionId / lessonId (optional): when set, further narrow the Academic
 * unit's word list to one Section (A/B/...) or one Lesson inside it. Words
 * with no sectionId/lessonId of their own (older words, or words added at
 * the general unit level) are ONLY shown when no section/lesson is selected
 * — picking a Section/Lesson always shows just that scope, never the
 * unplaced words too, so it behaves like a real separate list you can quiz on.
 */
export function useSectionEntries({
  entries,
  section,
  academicUnits = [],
  activeUnitId = null,
  onChangeActiveUnitId,
  sectionId = null,
  lessonId = null,
}) {
  const isAr = section === "ar-ar";
  const isAcademic = section === "academic";

  const resolvedUnitId = useMemo(() => {
    if (!isAcademic) return null;
    const list = academicUnits || [];
    if (activeUnitId && list.some((u) => u.id === activeUnitId)) return activeUnitId;
    return list[0]?.id || null;
  }, [isAcademic, activeUnitId, academicUnits]);

  const sectionEntries = useMemo(() => {
    const base = (entries || []).filter((e) => e.section === section);
    if (!isAcademic) return base;
    const unitScoped = !resolvedUnitId
      ? base
      : base.filter((e) => {
          const uid = e.unitId || null;
          return !uid || uid === resolvedUnitId;
        });
    if (lessonId) return unitScoped.filter((e) => (e.lessonId || null) === lessonId);
    if (sectionId) return unitScoped.filter((e) => (e.sectionId || null) === sectionId);
    return unitScoped;
  }, [entries, section, isAcademic, resolvedUnitId, sectionId, lessonId]);

  const allAcademicEntries = useMemo(
    () => (isAcademic ? (entries || []).filter((e) => e.section === "academic") : []),
    [entries, isAcademic]
  );

  useEffect(() => {
    if (!isAcademic) return;
    if (!resolvedUnitId) return;
    if (activeUnitId !== resolvedUnitId && onChangeActiveUnitId) {
      onChangeActiveUnitId(resolvedUnitId);
    }
  }, [isAcademic, resolvedUnitId, activeUnitId, onChangeActiveUnitId]);

  return {
    isAr,
    isAcademic,
    resolvedUnitId,
    sectionEntries,
    allAcademicEntries,
  };
}
