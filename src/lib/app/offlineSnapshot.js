import { loadOfflineMeta, loadOfflineCache } from "../state/storage";
import { migrateAccounts } from "../utils/authUtils";
import { loadPersonalCode } from "../state/storage";

/**
 * Fast startup snapshot — lightweight metadata only.
 * Dictionary entries load lazily after first paint.
 */
export function readInitialOfflineSnapshot() {
  const savedPersonalCode = loadPersonalCode();
  let cached = loadOfflineMeta();
  if (!cached) {
    cached = loadOfflineCache();
    if (!cached) return null;
  }
  const hasData = Array.isArray(cached.accounts) && cached.accounts.length > 0;
  if (!hasData) return null;
  let accounts = cached.accounts || [];
  try {
    const migrated = migrateAccounts(accounts);
    accounts = migrated.accounts || accounts;
  } catch (_) {}
  const account =
    savedPersonalCode && accounts.length
      ? accounts.find((a) => a && a.code === savedPersonalCode)
      : null;
  const usableAccount =
    account &&
    account.status !== "pending" &&
    account.status !== "rejected" &&
    account.status !== "blocked"
      ? account
      : null;
  return {
    entries: [],
    accounts,
    logs: Array.isArray(cached.logs) ? cached.logs : [],
    siteBanner: cached.siteBanner || null,
    examConfig: cached.examConfig || null,
    academicUnits: cached.academicUnits || null,
    version: typeof cached.version === "number" ? cached.version : 0,
    cachedAt: cached.cachedAt || null,
    usableAccount,
  };
}
