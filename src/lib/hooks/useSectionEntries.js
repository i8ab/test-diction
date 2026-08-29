import { useMemo, useEffect } from "react";

/**
 * Section + academic unit filtering for the dictionary list.
 * Extracted from MainView to keep list logic testable and thin.
 */
export function useSectionEntries({
  entries,
  section,
  academicUnits = [],
  activeUnitId = null,
  onChangeActiveUnitId,
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
    if (!resolvedUnitId) return base;
    return base.filter((e) => {
      const uid = e.unitId || null;
      return !uid || uid === resolvedUnitId;
    });
  }, [entries, section, isAcademic, resolvedUnitId]);

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
