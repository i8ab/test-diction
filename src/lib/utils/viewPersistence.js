/** Persist overlay open/bubble state across refresh */
export function loadTimerView() {
  try {
    const raw = localStorage.getItem(TIMER_VIEW_KEY);
    if (!raw) return { open: false, bubble: false };
    const p = JSON.parse(raw);
    return { open: !!p.open, bubble: !!p.bubble };
  } catch (e) {
    return { open: false, bubble: false };
  }
}

export function saveTimerView(open, bubble) {
  try {
    if (!open) localStorage.removeItem(TIMER_VIEW_KEY);
    else localStorage.setItem(TIMER_VIEW_KEY, JSON.stringify({ open: true, bubble: !!bubble }));
  } catch (e) {}
}

export function loadCalendarView() {
  try {
    const raw = localStorage.getItem(CALENDAR_VIEW_KEY);
    if (!raw) return { open: false, bubble: false };
    const p = JSON.parse(raw);
    return { open: !!p.open, bubble: !!p.bubble };
  } catch (e) {
    return { open: false, bubble: false };
  }
}

export function saveCalendarView(open, bubble) {
  try {
    if (!open) localStorage.removeItem(CALENDAR_VIEW_KEY);
    else localStorage.setItem(CALENDAR_VIEW_KEY, JSON.stringify({ open: true, bubble: !!bubble }));
  } catch (e) {}
}

export function loadTodoView() {
  try {
    const raw = localStorage.getItem(TODO_VIEW_KEY);
    if (!raw) return { open: false, bubble: false };
    const p = JSON.parse(raw);
    return { open: !!p.open, bubble: !!p.bubble };
  } catch (e) {
    return { open: false, bubble: false };
  }
}

export function saveTodoView(open, bubble) {
  try {
    if (!open) localStorage.removeItem(TODO_VIEW_KEY);
    else localStorage.setItem(TODO_VIEW_KEY, JSON.stringify({ open: true, bubble: !!bubble }));
  } catch (e) {}
}

export function loadGoalsView() {
  try {
    const raw = localStorage.getItem(GOALS_VIEW_KEY);
    if (!raw) return { open: false, bubble: false };
    const p = JSON.parse(raw);
    return { open: !!p.open, bubble: !!p.bubble };
  } catch (e) {
    return { open: false, bubble: false };
  }
}

export function saveGoalsView(open, bubble) {
  try {
    if (!open) localStorage.removeItem(GOALS_VIEW_KEY);
    else localStorage.setItem(GOALS_VIEW_KEY, JSON.stringify({ open: true, bubble: !!bubble }));
  } catch (e) {}
}
