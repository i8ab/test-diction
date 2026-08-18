/**
 * =============================================================================
 * PARTIAL SAVE RULES — apply to every future cloud write
 * =============================================================================
 *
 * Principle: only touch what changed. Never rewrite the whole site for a
 * small edit.
 *
 * Scopes (PUT /api/jsonbin with `scope` + expectedVersion):
 *
 *   accountPatch   { code, patch: { field: value, ... } }
 *                  → one account, only listed fields
 *
 *   accounts       { accounts, removeAccountCodes?, approveAccountCodes? }
 *                  → accounts table only (approve / bulk / delete)
 *
 *   entryPatch     { entry: { id, ... } }
 *                  → one dictionary word (add or edit)
 *
 *   entryDelete    { id }
 *                  → remove one word
 *
 *   settingsPatch  { key, value }
 *                  → one settings key:
 *                    site_banner | exam_config | academic_units | …
 *
 *   (no scope)     full record — ONLY for rare bulk ops (CSV import of
 *                  many rows, disaster recovery). Prefer granular scopes.
 *
 * Client helpers (cloudApi.js):
 *   patchAccountFields, saveAccountsOnly, patchEntry, deleteEntryRemote,
 *   patchSettings, saveRecord (full, last resort)
 *
 * When adding a new feature that writes to the cloud:
 *   1. Identify the smallest unit (one field / one row / one settings key).
 *   2. Use the matching scope above.
 *   3. Do optimistic UI locally, then one scoped PUT.
 *   4. Do NOT call saveRecord with the full dictionary unless > ~30 entries
 *      change at once (see GRANULAR_ENTRY_LIMIT).
 * =============================================================================
 */

/** Prefer per-entry patches when fewer than this many rows change. */
export const GRANULAR_ENTRY_LIMIT = 30;

/**
 * Diff two entry lists by id.
 * @returns {{ added: object[], updated: object[], removed: string[] }}
 */
export function diffEntries(before, after) {
  const beforeMap = new Map();
  for (const e of before || []) {
    if (e && e.id != null) beforeMap.set(String(e.id), e);
  }
  const afterMap = new Map();
  for (const e of after || []) {
    if (e && e.id != null) afterMap.set(String(e.id), e);
  }
  const added = [];
  const updated = [];
  const removed = [];
  for (const [id, e] of afterMap) {
    if (!beforeMap.has(id)) added.push(e);
    else {
      // Cheap structural compare
      try {
        if (JSON.stringify(beforeMap.get(id)) !== JSON.stringify(e)) updated.push(e);
      } catch (_) {
        updated.push(e);
      }
    }
  }
  for (const id of beforeMap.keys()) {
    if (!afterMap.has(id)) removed.push(id);
  }
  return { added, updated, removed };
}
