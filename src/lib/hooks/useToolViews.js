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
} from "../state/toolViews";

/**
 * Open / bubble state for timer, calendar, todo, goals — persisted in localStorage.
 */
export function useToolViews() {
  const [showTimer, setShowTimer] = useState(() => loadTimerView().open);
  const [timerBubble, setTimerBubble] = useState(() => loadTimerView().bubble);
  const [showCalendar, setShowCalendar] = useState(() => loadCalendarView().open);
  const [calendarBubble, setCalendarBubble] = useState(() => loadCalendarView().bubble);
  const [showTodo, setShowTodo] = useState(() => loadTodoView().open);
  const [todoBubble, setTodoBubble] = useState(() => loadTodoView().bubble);
  const [showGoals, setShowGoals] = useState(() => loadGoalsView().open);
  const [goalsBubble, setGoalsBubble] = useState(() => loadGoalsView().bubble);

  useEffect(() => {
    saveTimerView(showTimer, timerBubble);
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

  /** True when a full-screen tool (not bubble) is covering the dictionary. */
  const toolFullscreen =
    (showTimer && !timerBubble) ||
    (showCalendar && !calendarBubble) ||
    (showTodo && !todoBubble) ||
    (showGoals && !goalsBubble);

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
    toolFullscreen,
  };
}
