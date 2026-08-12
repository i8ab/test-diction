/**
 * Serialize cloud writes and compose functional ops for accounts/entries.
 */

export function createSaveQueue() {
  let chain = Promise.resolve();
  function enqueueSave(task) {
    const run = chain.then(task, task);
    // Swallow so the chain never permanently rejects.
    chain = run.catch(() => {});
    return run;
  }
  return { enqueueSave };
}

/**
 * Apply a list of ops onto base state.
 * Functional fns compose; plain values replace.
 */
export function applyOps(base, ops, kind) {
  let cur = base;
  const logsToAdd = [];
  for (const op of ops) {
    const fn = op.fn;
    cur = typeof fn === "function" ? fn(cur) : fn;
    if (op.logFn) {
      const logEntry = typeof op.logFn === "function" ? op.logFn(cur) : op.logFn;
      if (logEntry) logsToAdd.push(logEntry);
    }
  }
  return { next: cur, logsToAdd };
}

export const MAX_SAVE_RETRIES = 10;
