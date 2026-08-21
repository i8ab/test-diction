import { loadLiveState } from "./timerConstants";

/**
 * Read any in-progress timer from localStorage BEFORE the first paint.
 * This is the critical path for refresh: useState initializers must not
 * wait for a useEffect, or the UI flashes 25:00 / Start and feels "reset".
 */
export function readPersistedTimer() {
  const live = loadLiveState();
  const base = {
    remainingMs: 25 * 60 * 1000,
    elapsedMs: 0,
    running: false,
    endAt: null,
    startedAt: null,
    accumulated: 0,
    pomoPhase: "work",
    pomoCycle: 1,
    mode: null,
    hours: 0,
    mins: 25,
    secs: 0,
  };
  if (!live) return base;

  if (live.mode) base.mode = live.mode;
  if (typeof live.pomoPhase === "string") base.pomoPhase = live.pomoPhase;
  if (typeof live.pomoCycle === "number" && live.pomoCycle > 0) base.pomoCycle = live.pomoCycle;

  const isTimed = live.mode === "countdown" || live.mode === "pomodoro" || !live.mode;
  if (isTimed && live.endAt && Number(live.endAt) > Date.now()) {
    // Still running toward an absolute end time — resume automatically
    const left = Math.max(0, Number(live.endAt) - Date.now());
    base.remainingMs = left;
    base.running = true;
    base.endAt = Number(live.endAt);
  } else if (live.mode === "stopwatch" && live.running) {
    const acc = Number(live.accumulated) || 0;
    const started = Number(live.startedAt) || Date.now();
    base.accumulated = acc;
    base.startedAt = started;
    base.elapsedMs = acc + (Date.now() - started);
    base.running = true;
  } else if (typeof live.remainingMs === "number" && live.remainingMs > 0) {
    // Paused or stopped with time left — keep the value, user presses Start
    base.remainingMs = live.remainingMs;
    base.running = false;
    base.endAt = null;
  } else if (typeof live.elapsedMs === "number") {
    base.elapsedMs = live.elapsedMs;
    base.accumulated = Number(live.accumulated) || live.elapsedMs;
  }

  const totalSec = Math.floor(base.remainingMs / 1000);
  base.hours = Math.floor(totalSec / 3600);
  base.mins = Math.floor((totalSec % 3600) / 60);
  base.secs = totalSec % 60;
  return base;
}
