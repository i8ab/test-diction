/**
 * hook مستقل لهيكل السكاشن/الدروس (Section / Lesson) جوا كل Unit
 * - كاش محلي فوري
 * - جلب من السحابة عند الحاجة فقط
 * (نفس نمط useAcademicUnits.js تمامًا)
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  loadUnitStructureCache,
  saveUnitStructureCache,
  normalizeUnitStructure,
  defaultUnitStructure,
  addSection,
  renameSection,
  deleteSection,
  addLesson,
  renameLesson,
  deleteLesson,
} from "../state/unitStructure";
import { fetchSettings, patchSettings } from "../state/cloudApi";

/**
 * @param {{ autoFetch?: boolean }} options
 */
export function useUnitStructure({ autoFetch = false } = {}) {
  const [structure, setStructureState] = useState(() =>
    normalizeUnitStructure(loadUnitStructureCache())
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const versionHintRef = useRef(0);

  const setStructure = useCallback((next) => {
    setStructureState((prev) => {
      const normalized = normalizeUnitStructure(
        typeof next === "function" ? next(prev) : next
      );
      saveUnitStructureCache(normalized);
      return normalized;
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSettings("unit_structure,version");
      if (data && data.unitStructure) {
        const normalized = normalizeUnitStructure(data.unitStructure);
        setStructureState(normalized);
        saveUnitStructureCache(normalized);
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
  }, []);

  const persist = useCallback(async (nextStructure) => {
    const normalized = normalizeUnitStructure(nextStructure);
    setStructureState(normalized);
    saveUnitStructureCache(normalized);
    try {
      const result = await patchSettings(
        "unit_structure",
        normalized,
        versionHintRef.current
      );
      if (typeof result === "number") versionHintRef.current = result;
      return { ok: true, version: result };
    } catch (e) {
      return { ok: false, error: e?.message || "save failed" };
    }
  }, []);

  const addStructureSection = useCallback(
    (customName) => {
      let next;
      setStructure((cur) => {
        next = addSection(cur, customName);
        return next;
      });
      return next;
    },
    [setStructure]
  );

  const renameStructureSection = useCallback(
    (sectionId, customName) => {
      let next;
      setStructure((cur) => {
        next = renameSection(cur, sectionId, customName);
        return next;
      });
      return next;
    },
    [setStructure]
  );

  const removeStructureSection = useCallback(
    (sectionId) => {
      let next;
      setStructure((cur) => {
        next = deleteSection(cur, sectionId);
        return next;
      });
      return next;
    },
    [setStructure]
  );

  const addStructureLesson = useCallback(
    (sectionId, customName) => {
      let next;
      setStructure((cur) => {
        next = addLesson(cur, sectionId, customName);
        return next;
      });
      return next;
    },
    [setStructure]
  );

  const renameStructureLesson = useCallback(
    (lessonId, customName) => {
      let next;
      setStructure((cur) => {
        next = renameLesson(cur, lessonId, customName);
        return next;
      });
      return next;
    },
    [setStructure]
  );

  const removeStructureLesson = useCallback(
    (sectionId, lessonId) => {
      let next;
      setStructure((cur) => {
        next = deleteLesson(cur, sectionId, lessonId);
        return next;
      });
      return next;
    },
    [setStructure]
  );

  useEffect(() => {
    if (!autoFetch) return;
    refresh();
  }, [autoFetch, refresh]);

  return {
    structure,
    setStructure,
    loading,
    error,
    refresh,
    persist,
    addSection: addStructureSection,
    renameSection: renameStructureSection,
    removeSection: removeStructureSection,
    addLesson: addStructureLesson,
    renameLesson: renameStructureLesson,
    removeLesson: removeStructureLesson,
    defaults: defaultUnitStructure,
  };
}
