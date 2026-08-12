/**
 * Persist open/bubble state for study tools (timer, calendar, todo, goals).
 * Used by MainView so these views survive refresh.
 */

const KEYS = {
  timer: "twoTongues.timerView",
  calendar: "twoTongues.calendarView",
  todo: "twoTongues.todoView",
  goals: "twoTongues.goalsView",
};

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

export function loadTimerView() {
  return loadView(KEYS.timer);
}
export function saveTimerView(open, bubble) {
  saveView(KEYS.timer, open, bubble);
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
