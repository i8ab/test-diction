import { useState, useEffect, useCallback } from "react";
import {
  loadTimerView,
  saveTimerView,
  loadCalendarView,
  saveCalendarView,
  loadTodoView,
  saveTodoView,
  loadGoalsView,
  saveGoalsView,
  loadLanguageNotesView,
  saveLanguageNotesView,
} from "../state/toolViews";

/**
 * Open / bubble state for timer, calendar, todo, goals, language notes — persisted in localStorage.
 */
export function useToolViews() {
  const [showTimer, setShowTimer] = useState(() => {
    try {
      return !!loadTimerView().open;
    } catch (_) {
      return false;
    }
  });
  const [timerBubble, setTimerBubble] = useState(() => {
    try {
      return !!loadTimerView().bubble;
    } catch (_) {
      return false;
    }
  });
  const [showCalendar, setShowCalendar] = useState(() => loadCalendarView().open);
  const [calendarBubble, setCalendarBubble] = useState(() => loadCalendarView().bubble);
  const [showTodo, setShowTodo] = useState(() => loadTodoView().open);
  const [todoBubble, setTodoBubble] = useState(() => loadTodoView().bubble);
  const [showGoals, setShowGoals] = useState(() => loadGoalsView().open);
  const [goalsBubble, setGoalsBubble] = useState(() => loadGoalsView().bubble);
  const [showLanguageNotes, setShowLanguageNotes] = useState(() => {
    try {
      return !!loadLanguageNotesView().open;
    } catch (_) {
      return false;
    }
  });
  const [languageNotesBubble, setLanguageNotesBubble] = useState(() => {
    try {
      return !!loadLanguageNotesView().bubble;
    } catch (_) {
      return false;
    }
  });
  const [showDayAchievements, setShowDayAchievements] = useState(false);

  useEffect(() => {
    saveTimerView(showTimer, timerBubble);
  }, [showTimer, timerBubble]);

  useEffect(() => {
    function flush() {
      try {
        saveTimerView(showTimer, timerBubble);
      } catch (_) {}
    }
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [showTimer, timerBubble]);

  useEffect(() => {
    saveCalendarView(showCalendar, calendarBubble);
  }, [showCalendar, calendarBubble]);

  useEffect(() => {
    saveTodoView(showTodo, todoBubble);
  }, [showTodo, todoBubble]);

  useEffect(() => {
    saveGoalsView(showGoals, goalsBubble);
  }, [showGoals, goalsBubble]);

  useEffect(() => {
    saveLanguageNotesView(showLanguageNotes, languageNotesBubble);
  }, [showLanguageNotes, languageNotesBubble]);

  const openTimer = useCallback(() => {
    setTimerBubble(false);
    setShowTimer(true);
  }, []);

  const closeTimer = useCallback(() => {
    setShowTimer(false);
    setTimerBubble(false);
  }, []);

  const openCalendar = useCallback(() => {
    setCalendarBubble(false);
    setShowCalendar(true);
  }, []);

  const closeCalendar = useCallback(() => {
    setShowCalendar(false);
    setCalendarBubble(false);
  }, []);

  const openTodo = useCallback(() => {
    setTodoBubble(false);
    setShowTodo(true);
  }, []);

  const closeTodo = useCallback(() => {
    setShowTodo(false);
    setTodoBubble(false);
  }, []);

  const openGoals = useCallback(() => {
    setGoalsBubble(false);
    setShowGoals(true);
  }, []);

  const closeGoals = useCallback(() => {
    setShowGoals(false);
    setGoalsBubble(false);
  }, []);

  const openLanguageNotes = useCallback(() => {
    setLanguageNotesBubble(false);
    setShowLanguageNotes(true);
  }, []);

  const closeLanguageNotes = useCallback(() => {
    setShowLanguageNotes(false);
    setLanguageNotesBubble(false);
  }, []);

  const openDayAchievements = useCallback(() => {
    setShowDayAchievements(true);
  }, []);

  const closeDayAchievements = useCallback(() => {
    setShowDayAchievements(false);
  }, []);

  /** True when a full-screen tool (not bubble) is covering the dictionary. */
  const toolFullscreen =
    (showTimer && !timerBubble) ||
    (showCalendar && !calendarBubble) ||
    (showTodo && !todoBubble) ||
    (showGoals && !goalsBubble) ||
    (showLanguageNotes && !languageNotesBubble) ||
    showDayAchievements;

  return {
    showTimer,
    setShowTimer,
    timerBubble,
    setTimerBubble,
    openTimer,
    closeTimer,
    showCalendar,
    setShowCalendar,
    calendarBubble,
    setCalendarBubble,
    openCalendar,
    closeCalendar,
    showTodo,
    setShowTodo,
    todoBubble,
    setTodoBubble,
    openTodo,
    closeTodo,
    showGoals,
    setShowGoals,
    goalsBubble,
    setGoalsBubble,
    openGoals,
    closeGoals,
    showLanguageNotes,
    setShowLanguageNotes,
    languageNotesBubble,
    setLanguageNotesBubble,
    openLanguageNotes,
    closeLanguageNotes,
    showDayAchievements,
    setShowDayAchievements,
    openDayAchievements,
    closeDayAchievements,
    toolFullscreen,
  };
}
