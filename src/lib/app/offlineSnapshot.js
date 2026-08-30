import { loadOfflineMeta, loadOfflineCache } from "../state/storage";
import { migrateAccounts } from "../utils/authUtils";
import { loadPersonalCode } from "../state/storage";

/**
 * Fast startup snapshot.
 * Accounts/settings from lightweight meta when possible; dictionary entries
 * from full offline cache so the UI is usable before any network round-trip.
 */
export function readInitialOfflineSnapshot() {
  const savedPersonalCode = loadPersonalCode();
  let meta = null;
  try {
    meta = loadOfflineMeta();
  } catch (_) {}
  let full = null;
  try {
    full = loadOfflineCache();
  } catch (_) {}

  const cached = meta || full;
  if (!cached) return null;

  const hasAccounts =
    Array.isArray(cached.accounts) && cached.accounts.length > 0;
  const hasEntries =
    Array.isArray(full && full.entries) && full.entries.length > 0;
  if (!hasAccounts && !hasEntries) return null;

  let accounts = Array.isArray(cached.accounts) ? cached.accounts : [];
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

  // Prefer full-cache entries so first paint is not an empty dictionary.
  const entries =
    full && Array.isArray(full.entries) ? full.entries : [];

  return {
    entries,
    accounts,
    logs: Array.isArray(cached.logs)
      ? cached.logs
      : Array.isArray(full && full.logs)
        ? full.logs
        : [],
    siteBanner:
      cached.siteBanner != null
        ? cached.siteBanner
        : full && full.siteBanner != null
          ? full.siteBanner
          : null,
    examConfig:
      cached.examConfig || (full && full.examConfig) || null,
    academicUnits:
      cached.academicUnits || (full && full.academicUnits) || null,
    version:
      typeof cached.version === "number"
        ? cached.version
        : typeof (full && full.version) === "number"
          ? full.version
          : 0,
    cachedAt: cached.cachedAt || (full && full.cachedAt) || null,
    usableAccount,
  };
}
