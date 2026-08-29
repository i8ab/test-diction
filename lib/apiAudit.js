/**
 * Structured audit log for privileged API actions.
 * Writes to stdout (Vercel logs). Does not fail the request on log errors.
 *
 * @param {object} entry
 * @param {string} entry.action - e.g. accountStatus, accountDelete
 * @param {string} [entry.actorCode]
 * @param {string} [entry.targetCode]
 * @param {string} [entry.requestId]
 * @param {object} [entry.meta]
 */
export function auditPrivileged(entry = {}) {
  try {
    const line = {
      type: "bacaloria_audit",
      ts: new Date().toISOString(),
      action: String(entry.action || "unknown"),
      actorCode: entry.actorCode || null,
      targetCode: entry.targetCode || null,
      requestId: entry.requestId || null,
      meta: entry.meta && typeof entry.meta === "object" ? entry.meta : undefined,
    };
    console.info(JSON.stringify(line));
  } catch (_) {
    /* never throw from audit */
  }
}
