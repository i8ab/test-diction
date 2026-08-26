import { Suspense } from "react";
import { tr } from "../../lib/config/i18n";
import { computeStreak } from "../../lib/utils/quizHelpers";
import { TimerPage, CalendarPage, TodoPage, GoalsPage, LanguageNotesPage, DayAchievementsModal } from "../modals/lazyModals";
import { FlameIcon, CheckIcon } from "../common/Icons";

/**
 * Timer / Calendar / Todo / Goals full-screen pages + desktop FAB buttons.
 */
export default function ToolShell({
  isAr,
  appIsAr,
  accountCode,
  cfg,
  entries,
  studiedAt,
  quizHistory,
  deviceMode,
  showTimer, timerBubble, closeTimer, setTimerBubble,
  showCalendar, calendarBubble, closeCalendar, setCalendarBubble,
  showTodo, todoBubble, closeTodo, setTodoBubble, openTodo,
  showGoals, goalsBubble, closeGoals, setGoalsBubble, openGoals,
  showDayAchievements, closeDayAchievements,
  showLanguageNotes, languageNotesBubble, closeLanguageNotes, setLanguageNotesBubble,
}) {
  const paperFallback = (
    <div style={{ position: "fixed", inset: 0, zIndex: 6000, background: "var(--paper)" }} aria-hidden />
  );

  return (
    <>
      {showTimer && (
        <Suspense fallback={paperFallback}>
          <TimerPage
            isAr={appIsAr}
            accountCode={accountCode}
            initialBubble={timerBubble}
            onClose={closeTimer}
            onBubbleChange={setTimerBubble}
          />
        </Suspense>
      )}

      {showCalendar && (
        <Suspense fallback={paperFallback}>
          <CalendarPage
            isAr={appIsAr}
            studiedAt={studiedAt}
            entries={entries}
            initialBubble={calendarBubble}
            onClose={closeCalendar}
            onBubbleChange={setCalendarBubble}
          />
        </Suspense>
      )}

      {showTodo && (
        <Suspense fallback={paperFallback}>
          <TodoPage
            isAr={appIsAr}
            accountCode={accountCode || ""}
            initialBubble={todoBubble}
            onClose={closeTodo}
            onBubbleChange={setTodoBubble}
          />
        </Suspense>
      )}

      {showGoals && (
        <Suspense fallback={paperFallback}>
          <GoalsPage
            isAr={appIsAr}
            studiedAt={studiedAt}
            quizHistory={quizHistory}
            streak={computeStreak(studiedAt)}
            cfg={cfg}
            initialBubble={goalsBubble}
            onClose={closeGoals}
            onBubbleChange={setGoalsBubble}
          />
        </Suspense>
      )}

      {showDayAchievements && (
        <Suspense fallback={paperFallback}>
          <DayAchievementsModal
            isAr={appIsAr}
            accountCode={accountCode || ""}
            onClose={closeDayAchievements}
          />
        </Suspense>
      )}

      {showLanguageNotes && (
        <Suspense fallback={paperFallback}>
          <LanguageNotesPage
            isAr={appIsAr}
            accountCode={accountCode || ""}
            onClose={closeLanguageNotes}
            onMinimize={() => setLanguageNotesBubble && setLanguageNotesBubble(true)}
          />
        </Suspense>
      )}

{!showGoals && deviceMode !== "mobile" && deviceMode !== "tablet" && (
        <button
          type="button"
          className="fab-glow fab-glow--goals"
          onClick={openGoals}
          title={tr(isAr, "Goals", "الأهداف")}
          aria-label={tr(isAr, "Open goals", "فتح الأهداف")}
          style={{
            position: "fixed",
            bottom: "calc(88px + env(safe-area-inset-bottom, 0px))",
            insetInlineEnd: 16,
            zIndex: 45,
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: "none",
            background: "linear-gradient(145deg, #ffb340 0%, #ff9f0a 40%, #ff6b00 100%)",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        >
          <span className="fab-glow-shine" aria-hidden="true" />
          <FlameIcon size={24} style={{ position: "relative", zIndex: 1 }} />
        </button>
      )}

{!showTodo && deviceMode !== "mobile" && deviceMode !== "tablet" && (
        <button
          type="button"
          className="fab-glow fab-glow--todo"
          onClick={openTodo}
          title={tr(isAr, "To-do list", "قائمة المهام")}
          aria-label={tr(isAr, "Open to-do list", "فتح قائمة المهام")}
          style={{
            position: "fixed",
            bottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
            insetInlineEnd: 16,
            zIndex: 45,
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: "none",
            background: "linear-gradient(145deg, #5dff8a 0%, #30d158 45%, #28a745 100%)",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        >
          <span className="fab-glow-shine" aria-hidden="true" />
          <CheckIcon size={24} style={{ position: "relative", zIndex: 1 }} />
        </button>
      )}
    </>
  );
}
