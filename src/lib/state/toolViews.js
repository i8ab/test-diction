/**
 * Persist open/bubble state for study tools (timer, calendar, todo, goals).
 *
 * Timer UI open state uses sessionStorage for "reopen after refresh" so a
 * normal visit to the site does NOT force the timer fullscreen open.
 * Timer *time* (remaining/running) lives separately in twoTongues.timerState.
 */

const KEYS = {
  timer: "twoTongues.timerView",
  calendar: "twoTongues.calendarView",
  todo: "twoTongues.todoView",
  goals: "twoTongues.goalsView",
  languageNotes: "twoTongues.languageNotesView",
  schedule: "twoTongues.scheduleView",
};

/** session-only flag: timer UI was open when this tab refreshed */
const TIMER_SESSION_OPEN_KEY = "twoTongues.timerUiOpen";

function loadView(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { open: false, bubble: false };
    const p = JSON.parse(raw);
    return { open: !!p.open, bubble: !!p.bubble };
  } catch (_) {
    return { open: false, bubble: false };
  }
}

function saveView(key, open, bubble) {
  try {
    if (!open) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify({ open: true, bubble: !!bubble }));
  } catch (_) {}
}

/**
 * Reopen timer UI only after a same-tab refresh, not on a fresh site visit.
 * Time continuity is handled by TimerPage via twoTongues.timerState.
 */
export function loadTimerView() {
  try {
    const sessionOpen = sessionStorage.getItem(TIMER_SESSION_OPEN_KEY) === "1";
    if (!sessionOpen) return { open: false, bubble: false };
    // consume so a later full navigation doesn't keep forcing it
    sessionStorage.removeItem(TIMER_SESSION_OPEN_KEY);
    const stored = loadView(KEYS.timer);
    return { open: true, bubble: !!stored.bubble };
  } catch (_) {
    return { open: false, bubble: false };
  }
}

export function saveTimerView(open, bubble) {
  saveView(KEYS.timer, open, bubble);
  try {
    if (open) sessionStorage.setItem(TIMER_SESSION_OPEN_KEY, "1");
    else sessionStorage.removeItem(TIMER_SESSION_OPEN_KEY);
  } catch (_) {}
}

export function loadCalendarView() {
  return loadView(KEYS.calendar);
}
export function saveCalendarView(open, bubble) {
  saveView(KEYS.calendar, open, bubble);
}

export function loadTodoView() {
  return loadView(KEYS.todo);
}
export function saveTodoView(open, bubble) {
  saveView(KEYS.todo, open, bubble);
}

export function loadGoalsView() {
  return loadView(KEYS.goals);
}
export function saveGoalsView(open, bubble) {
  saveView(KEYS.goals, open, bubble);
}


export function loadLanguageNotesView() {
  return loadView(KEYS.languageNotes);
}
export function saveLanguageNotesView(open, bubble) {
  saveView(KEYS.languageNotes, open, bubble);
}

export function loadScheduleView() {
  return loadView(KEYS.schedule);
}
export function saveScheduleView(open, bubble) {
  saveView(KEYS.schedule, open, bubble);
}
