import { useRef, useEffect, useState, useMemo } from "react";
import { tr } from "../../lib/config/i18n";

/**
 * ARC-style floating bottom nav (mobile + tablet):
 * pill bar + sliding ring light that follows the active tab.
 * Tabs map to existing app destinations — no extra features.
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
  const listRef = useRef(null);
  const itemRefs = useRef([]);
  const [light, setLight] = useState({ x: 0, w: 48, ready: false });

  const activeKey = useMemo(() => {
    if (showQuiz || mobileNavTab === "quiz") return "quiz";
    if (showGoals || mobileNavTab === "goals") return "goals";
    if (showTodo || mobileNavTab === "todo") return "todo";
    if (mobileNavTab === "account") return "account";
    return "words";
  }, [mobileNavTab, showQuiz, showGoals, showTodo]);

  const tabs = [
    {
      key: "words",
      label: tr(isAr, "Words", "كلمات"),
      onClick: () => {
        setMobileNavTab("words");
        try {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (_) {}
      },
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      ),
    },
    {
      key: "quiz",
      label: tr(isAr, "Quiz", "اختبار"),
      onClick: () => {
        setMobileNavTab("quiz");
        onOpenQuiz?.();
      },
      onContextMenu: (e) => {
        e.preventDefault();
        setMobileNavTab("quiz");
        onOpenDueQuiz?.();
      },
      icon: (
        <span className="mobile-nav-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          {dueCountMobile > 0 && (
            <span className="mobile-nav-badge">{dueCountMobile > 9 ? "9+" : dueCountMobile}</span>
          )}
        </span>
      ),
    },
    {
      key: "goals",
      label: tr(isAr, "Goals", "أهداف"),
      onClick: () => {
        setMobileNavTab("goals");
        onOpenGoals?.();
      },
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      ),
    },
    {
      key: "todo",
      label: tr(isAr, "To-do", "مهام"),
      onClick: () => {
        setMobileNavTab("todo");
        onOpenTodo?.();
      },
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M9 11l3 3L22 4" />
          <path d="M3 12h6" />
          <path d="M3 6h6" />
          <path d="M3 18h6" />
        </svg>
      ),
    },
    {
      key: "account",
      label: tr(isAr, "Account", "حسابي"),
      onClick: () => {
        setMobileNavTab("account");
        onOpenAccount?.();
      },
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      ),
    },
  ];

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.key === activeKey)
  );

  useEffect(() => {
    function measure() {
      const list = listRef.current;
      const el = itemRefs.current[activeIndex];
      if (!list || !el) return;
      const lr = list.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const size = 44;
      const x = er.left - lr.left + er.width / 2 - size / 2;
      setLight({ x, w: size, ready: true });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeIndex, isAr]);

  return (
    <nav
      className="mobile-bottom-nav arc-nav"
      aria-label={tr(isAr, "Main navigation", "التنقل الرئيسي")}
    >
      <div className="arc-nav-bar" ref={listRef} role="tablist">
        <span
          className={"arc-nav-light" + (light.ready ? " is-ready" : "")}
          style={{
            transform: `translate3d(${light.x}px, -50%, 0)`,
            width: light.w,
            height: light.w,
          }}
          aria-hidden
        />
        {tabs.map((t, i) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={activeKey === t.key}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className={
              "mobile-bottom-nav-item arc-nav-item" +
              (activeKey === t.key ? " is-active" : "")
            }
            onClick={t.onClick}
            onContextMenu={t.onContextMenu}
            title={
              t.key === "quiz"
                ? tr(isAr, "Tap: quiz · Long-press: due only", "ضغط: اختبار · ضغطة طويلة: المستحق فقط")
                : undefined
            }
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
