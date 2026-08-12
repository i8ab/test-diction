import { tr } from "../../lib/config/i18n";

/**
 * Mobile bottom navigation — phone layout only.
 * Quiz supports long-press for due-only mode.
 */
export default function MobileBottomNav({
  isAr,
  mobileNavTab,
  setMobileNavTab,
  showQuiz,
  showGoals,
  showTodo,
  dueCountMobile = 0,
  onOpenQuiz,
  onOpenDueQuiz,
  onOpenGoals,
  onOpenTodo,
  onOpenAccount,
}) {
  return (
    <nav
      className="mobile-bottom-nav"
      aria-label={tr(isAr, "Main navigation", "التنقل الرئيسي")}
    >
      <button
        type="button"
        className={
          "mobile-bottom-nav-item" + (mobileNavTab === "words" ? " is-active" : "")
        }
        onClick={() => {
          setMobileNavTab("words");
          try {
            window.scrollTo({ top: 0, behavior: "smooth" });
          } catch (_) {}
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        <span>{tr(isAr, "Words", "كلمات")}</span>
      </button>
      <button
        type="button"
        className={
          "mobile-bottom-nav-item" +
          (mobileNavTab === "quiz" || showQuiz ? " is-active" : "")
        }
        onClick={() => {
          setMobileNavTab("quiz");
          onOpenQuiz?.();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMobileNavTab("quiz");
          onOpenDueQuiz?.();
        }}
        title={tr(
          isAr,
          "Tap: quiz · Long-press: due only",
          "ضغط: اختبار · ضغطة طويلة: المستحق فقط"
        )}
      >
        <span className="mobile-nav-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          {dueCountMobile > 0 && (
            <span className="mobile-nav-badge">
              {dueCountMobile > 9 ? "9+" : dueCountMobile}
            </span>
          )}
        </span>
        <span>{tr(isAr, "Quiz", "اختبار")}</span>
      </button>
      <button
        type="button"
        className={
          "mobile-bottom-nav-item" +
          (mobileNavTab === "goals" || showGoals ? " is-active" : "")
        }
        onClick={() => {
          setMobileNavTab("goals");
          onOpenGoals?.();
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <span>{tr(isAr, "Goals", "أهداف")}</span>
      </button>
      <button
        type="button"
        className={
          "mobile-bottom-nav-item" +
          (mobileNavTab === "todo" || showTodo ? " is-active" : "")
        }
        onClick={() => {
          setMobileNavTab("todo");
          onOpenTodo?.();
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M9 11l3 3L22 4" />
          <path d="M3 12h6" />
          <path d="M3 6h6" />
          <path d="M3 18h6" />
        </svg>
        <span>{tr(isAr, "To-do", "مهام")}</span>
      </button>
      <button
        type="button"
        className={
          "mobile-bottom-nav-item" +
          (mobileNavTab === "account" ? " is-active" : "")
        }
        onClick={() => {
          setMobileNavTab("account");
          onOpenAccount?.();
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
        <span>{tr(isAr, "Account", "حسابي")}</span>
      </button>
    </nav>
  );
}
