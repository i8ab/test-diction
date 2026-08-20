/**
 * hook مستقل لكلمات القاموس
 * يُستخدم عندما يحتاج مكون لجلب/تحديث الـ entries بمعزل عن App
 */
import { useState, useEffect, useCallback } from "react";
import { fetchEntriesOnly } from "../state/cloudApi";

/**
 * @param {{ autoFetch?: boolean, initial?: array }} options
 */
export function useCloudEntries({ autoFetch = false, initial = [] } = {}) {
  const [entries, setEntries] = useState(() =>
    Array.isArray(initial) ? initial : []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchEntriesOnly();
      const safe = Array.isArray(list) ? list : [];
      setEntries(safe);
      return safe;
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoFetch) return;
    refresh();
  }, [autoFetch, refresh]);

  return {
    entries,
    setEntries,
    loading,
    error,
    refresh,
  };
}
