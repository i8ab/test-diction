/**
 * hook مستقل لقائمة الحسابات + السجلات
 * يُستخدم فقط داخل واجهات الأدمن (عزل صارم — لا يُستدعى لمستخدم عادي)
 */
import { useState, useEffect, useCallback } from "react";
import { fetchAccountsOnly, fetchLogsOnly } from "../state/cloudApi";

/**
 * @param {{ enabled?: boolean }} options
 *   enabled=false → لا يجلب شيئاً (للمكونات اللي ممكن تترender بدون صلاحية)
 */
export function useAdminAccounts({ enabled = true } = {}) {
  const [accounts, setAccounts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    setLoading(true);
    setError(null);
    try {
      const [accs, lgs] = await Promise.all([
        fetchAccountsOnly().catch(() => []),
        fetchLogsOnly().catch(() => []),
      ]);
      setAccounts(Array.isArray(accs) ? accs : []);
      setLogs(Array.isArray(lgs) ? lgs : []);
      setLoadedOnce(true);
      return { accounts: accs, logs: lgs };
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  /** تحديث محلي بعد إضافة/تعديل/حذف بدون إعادة جلب كاملة */
  const updateAccountsLocal = useCallback((next) => {
    setAccounts(typeof next === "function" ? next(accounts) : next || []);
  }, [accounts]);

  const updateLogsLocal = useCallback((next) => {
    setLogs(typeof next === "function" ? next(logs) : next || []);
  }, [logs]);

  useEffect(() => {
    if (!enabled) {
      setAccounts([]);
      setLogs([]);
      setLoadedOnce(false);
      return;
    }
    refresh();
  }, [enabled, refresh]);

  return {
    accounts,
    logs,
    loading,
    error,
    loadedOnce,
    refresh,
    updateAccountsLocal,
    updateLogsLocal,
    setAccounts,
    setLogs,
  };
}
