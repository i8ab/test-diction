/**
 * hook مستقل لإعدادات الامتحان
 * - يقرأ من الكاش المحلي فوراً
 * - يجلب من السحابة عند الحاجة فقط (عزل الإجراءات)
 * - لا يعتمد على App state
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  loadExamConfigCache,
  saveExamConfigCache,
  normalizeExamConfig,
  defaultExamConfig,
} from "../state/exam";
import { fetchSettings, patchSettings } from "../state/cloudApi";

/**
 * @param {{ autoFetch?: boolean }} options
 *   autoFetch=true → يجلب من السحابة عند الـ mount
 */
export function useExamConfig({ autoFetch = false } = {}) {
  const [examConfig, setExamConfigState] = useState(() =>
    normalizeExamConfig(loadExamConfigCache() || defaultExamConfig())
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const versionHintRef = useRef(0);

  const setExamConfig = useCallback((next) => {
    const normalized = normalizeExamConfig(
      typeof next === "function" ? next(examConfig) : next
    );
    setExamConfigState(normalized);
    saveExamConfigCache(normalized);
  }, [examConfig]);

  /** جلب من السحابة — يُستدعى عند فتح شاشة الامتحان أو عند الحاجة */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSettings("exam_config,version");
      if (data && data.examConfig) {
        const normalized = normalizeExamConfig(data.examConfig);
        setExamConfigState(normalized);
        saveExamConfigCache(normalized);
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

  /** حفظ إلى السحابة عبر scope settingsPatch */
  const persist = useCallback(async (nextConfig) => {
    const normalized = normalizeExamConfig(nextConfig);
    setExamConfigState(normalized);
    saveExamConfigCache(normalized);
    try {
      const result = await patchSettings(
        "exam_config",
        normalized,
        versionHintRef.current
      );
      if (typeof result === "number") versionHintRef.current = result;
      return { ok: true, version: result };
    } catch (e) {
      return { ok: false, error: e?.message || "save failed" };
    }
  }, []);

  useEffect(() => {
    if (!autoFetch) return;
    refresh();
  }, [autoFetch, refresh]);

  return {
    examConfig,
    setExamConfig,
    loading,
    error,
    refresh,
    persist,
  };
}
