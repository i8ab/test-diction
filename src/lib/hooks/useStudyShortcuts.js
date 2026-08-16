import { useEffect } from "react";

/**
 * Desktop keyboard shortcuts for the dictionary main view.
 * Ignored while focus is inside inputs / contentEditable.
 * Focus Mode removed — no "f" toggle / Escape exit.
 */
export function useStudyShortcuts({
  showQuickReview,
  setShowQuickReview,
  onOpenAdd,
  searchInputRef,
  setShowQuiz,
  setShowTodo,
  setTodoBubble,
}) {
  useEffect(() => {
    function onKey(e) {
      const tag = (e.target && e.target.tagName) || "";
      const typing =
        tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable;
      if (e.key === "Escape") {
        if (showQuickReview) {
          setShowQuickReview(false);
          return;
        }
      }
      if (typing) return;
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus?.();
      } else if (e.key === "n" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onOpenAdd?.();
      } else if (e.key === "q" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowQuiz(true);
      } else if (e.key === "r" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowQuickReview(true);
      } else if (e.key === "t" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setTodoBubble(false);
        setShowTodo(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    showQuickReview,
    setShowQuickReview,
    onOpenAdd,
    searchInputRef,
    setShowQuiz,
    setShowTodo,
    setTodoBubble,
  ]);
}
