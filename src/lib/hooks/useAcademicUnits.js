/**
 * hook مستقل للوحدات الأكاديمية
 * - كاش محلي فوري
 * - جلب من السحابة عند الحاجة فقط
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  loadAcademicUnitsCache,
  saveAcademicUnitsCache,
  loadActiveAcademicUnitId,
  saveActiveAcademicUnitId,
  normalizeAcademicUnits,
  defaultAcademicUnits,
  createAcademicUnit,
  renameAcademicUnit,
  deleteAcademicUnit,
} from "../state/academicUnits";
import { fetchSettings, patchSettings } from "../state/cloudApi";

/**
 * @param {{ autoFetch?: boolean }} options
 */
export function useAcademicUnits({ autoFetch = false } = {}) {
  const [units, setUnitsState] = useState(() =>
    normalizeAcademicUnits(loadAcademicUnitsCache())
  );
  const [activeUnitId, setActiveUnitIdState] = useState(() =>
    loadActiveAcademicUnitId(normalizeAcademicUnits(loadAcademicUnitsCache()))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const versionHintRef = useRef(0);

  const setUnits = useCallback((next) => {
    const normalized = normalizeAcademicUnits(
      typeof next === "function" ? next(units) : next
    );
    setUnitsState(normalized);
    saveAcademicUnitsCache(normalized);
    // تأكد أن الوحدة النشطة ما زالت موجودة
    if (!normalized.some((u) => u.id === activeUnitId)) {
      const fallback = normalized[0]?.id || null;
      setActiveUnitIdState(fallback);
      saveActiveAcademicUnitId(fallback);
    }
  }, [units, activeUnitId]);

  const setActiveUnitId = useCallback((id) => {
    setActiveUnitIdState(id);
    saveActiveAcademicUnitId(id);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSettings("academic_units,version");
      if (data && data.academicUnits) {
        const normalized = normalizeAcademicUnits(data.academicUnits);
        setUnitsState(normalized);
        saveAcademicUnitsCache(normalized);
        if (!normalized.some((u) => u.id === activeUnitId)) {
          const fallback = normalized[0]?.id || null;
          setActiveUnitIdState(fallback);
          saveActiveAcademicUnitId(fallback);
        }
      }
      if (typeof data?.version === "number") {
        versionHintRef.current = data.version;
      }
      return data;
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [activeUnitId]);

  const persist = useCallback(async (nextUnits) => {
    const normalized = normalizeAcademicUnits(nextUnits);
    setUnitsState(normalized);
    saveAcademicUnitsCache(normalized);
    try {
      const result = await patchSettings(
        "academic_units",
        normalized,
        versionHintRef.current
      );
      if (typeof result === "number") versionHintRef.current = result;
      return { ok: true, version: result };
    } catch (e) {
      return { ok: false, error: e?.message || "save failed" };
    }
  }, []);

  const addUnit = useCallback(
    (name) => {
      const next = createAcademicUnit(units, name);
      setUnits(next);
      return next;
    },
    [units, setUnits]
  );

  const renameUnit = useCallback(
    (id, name) => {
      const next = renameAcademicUnit(units, id, name);
      setUnits(next);
      return next;
    },
    [units, setUnits]
  );

  const removeUnit = useCallback(
    (id) => {
      const next = deleteAcademicUnit(units, id);
      setUnits(next);
      return next;
    },
    [units, setUnits]
  );

  useEffect(() => {
    if (!autoFetch) return;
    refresh();
  }, [autoFetch, refresh]);

  return {
    units,
    setUnits,
    activeUnitId,
    setActiveUnitId,
    loading,
    error,
    refresh,
    persist,
    addUnit,
    renameUnit,
    removeUnit,
    defaults: defaultAcademicUnits,
  };
}
