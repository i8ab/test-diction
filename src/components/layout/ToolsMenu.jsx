import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { tr } from "../../lib/config/i18n";
import {
  ChevronIcon, XIcon, TrophyIcon, StatsIcon, QuizIcon, LayersIcon,
  DownloadIcon, UploadIcon, LoaderIcon, ClockIcon, CalendarIcon, CheckIcon, FlameIcon,
  MicIcon, StarIcon, WandIcon,
} from "../common/Icons";

/**
 * قائمة "المزيد" — منظمة في فئات واضحة مع عناوين فرعية.
 * تدعم العرض كـ bottom sheet على الشاشات الضيقة ولوحة مثبتة على سطح المكتب.
 */

function useIsCompact() {
  const [compact, setCompact] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = () => setCompact(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    mq.addListener?.(onChange);
    return () => {
      mq.removeEventListener?.("change", onChange);
      mq.removeListener?.(onChange);
    };
  }, []);
  return compact;
}

export default function ToolsMenu({
  accent,
  onLeaderboard,
  onStats,
  onQuiz,
  onFlashcards,
  onTimer,
  onCalendar,
  onTodo,
  onGoals,
  onQuickReview,
  onDictation,
  onAchievements,
  onRandomWord,
  onExport,
  exportDisabled,
  onImport,
  importing,
  isAr,
  onExportAnki,
  onDashboard,
  onWordLists,
  onChallenges,
  focusMode = false,
  onToggleFocus = null,
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const isCompact = useIsCompact();

  function closeMenu() {
    setOpen(false);
  }

  function openMenu() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setAnchor({
        top: r.bottom,
        bottom: r.top,
        left: r.left,
        right: r.right,
        width: r.width,
        centerX: r.left + r.width / 2,
      });
    }
    setOpen(true);
  }

  function toggleOpen() {
    if (open) closeMenu();
    else openMenu();
  }

  useEffect(() => {
    if (!open) return;
    // Only close via the X button (or Escape) — not on outside click or when opening items.
    function onKeyDown(e) {
      if (e.key === "Escape") closeMenu();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // قفل تمرير الخلفية لأي حجم شاشة طالما القائمة مفتوحة
  useBodyScrollLock(open);

  // تجميع العناصر في فئات منطقية
  const categories = [
    {
      id: "practice",
      title: tr(isAr, "Practice", "التدريب"),
      items: [
        { key: "quiz", icon: <QuizIcon size={18} />, tint: "#af52de", label: tr(isAr, "Quiz", "اختبار"), onClick: onQuiz },
        { key: "flashcards", icon: <LayersIcon size={18} />, tint: "#ff9f0a", label: tr(isAr, "Flashcards", "بطاقات تعليمية"), onClick: onFlashcards },
        { key: "dictation", icon: <MicIcon size={18} />, tint: "#e76f51", label: tr(isAr, "Dictation", "استماع وإملاء"), onClick: onDictation },
        { key: "quick", icon: <LayersIcon size={18} />, tint: "#af52de", label: tr(isAr, "Quick review", "مراجعة سريعة"), onClick: onQuickReview },
        { key: "random", icon: <WandIcon size={18} />, tint: "#7b2cbf", label: tr(isAr, "Random word", "كلمة عشوائية"), onClick: onRandomWord },
      ],
    },
    {
      id: "progress",
      title: tr(isAr, "Progress", "التقدّم"),
      items: [
        { key: "dashboard", icon: <StatsIcon size={18} />, tint: "#5b8def", label: tr(isAr, "Dashboard", "لوحة القيادة"), onClick: onDashboard },
        { key: "stats", icon: <StatsIcon size={18} />, tint: "#5b8def", label: tr(isAr, "Stats", "إحصائياتي"), onClick: onStats },
        { key: "achievements", icon: <StarIcon size={18} />, tint: "#f4a261", label: tr(isAr, "Achievements", "الإنجازات"), onClick: onAchievements },
        { key: "leaderboard", icon: <TrophyIcon size={18} />, tint: "#d4a017", label: tr(isAr, "Leaderboard", "الترتيب"), onClick: onLeaderboard },
        { key: "goals", icon: <FlameIcon size={18} />, tint: "#ff9f0a", label: tr(isAr, "Goals", "الأهداف"), onClick: onGoals },
      ],
    },
    {
      id: "tools",
      title: tr(isAr, "Tools", "الأدوات"),
      items: [
        { key: "timer", icon: <ClockIcon size={18} />, tint: "#19A7CE", label: tr(isAr, "Timer", "مؤقّت"), onClick: onTimer },
        { key: "calendar", icon: <CalendarIcon size={18} />, tint: "#e85d04", label: tr(isAr, "Calendar", "التقويم"), onClick: onCalendar },
        { key: "todo", icon: <CheckIcon size={18} />, tint: "#30d158", label: tr(isAr, "To-do list", "قائمة المهام"), onClick: onTodo },
        { key: "lists", icon: <LayersIcon size={18} />, tint: "#19A7CE", label: tr(isAr, "Word lists", "قوائم الكلمات"), onClick: onWordLists },
        { key: "challenges", icon: <TrophyIcon size={18} />, tint: "#d4a017", label: tr(isAr, "Challenges", "تحديات"), onClick: onChallenges },
        ...(typeof onToggleFocus === "function"
          ? [{
              key: "focus",
              icon: <LayersIcon size={18} />,
              tint: focusMode ? "#6366f1" : "#6366f1",
              label: focusMode
                ? tr(isAr, "Exit focus mode", "إغلاق وضع التركيز")
                : tr(isAr, "Focus mode", "وضع التركيز"),
              onClick: onToggleFocus,
            }]
          : []),
      ],
    },
    {
      id: "data",
      title: tr(isAr, "Data", "البيانات"),
      items: [
        { key: "export", icon: <DownloadIcon size={18} />, tint: "#34c759", label: tr(isAr, "Export CSV", "تصدير CSV"), onClick: onExport, disabled: exportDisabled },
        { key: "exportAnki", icon: <DownloadIcon size={18} />, tint: "#30d158", label: tr(isAr, "Export Anki", "تصدير Anki"), onClick: onExportAnki, disabled: exportDisabled },
        { key: "import", icon: importing ? <LoaderIcon size={18} /> : <UploadIcon size={18} />, tint: "#34c759", label: tr(isAr, "Import CSV", "استيراد CSV"), onClick: onImport, disabled: importing },
      ],
    },
  ];

  function handleItemClick(item) {
    if (item.disabled) return;
    // Keep the menu open underneath — opened content stacks above it.
    // Menu only closes via the X button (or backdrop / Escape).
    if (typeof item.onClick === "function") item.onClick();
  }

  // Always a full modal (all devices) so the whole list is reachable + scrollable
  const menuPanel = (
    <div
      ref={menuRef}
      role="dialog"
      aria-modal="true"
      aria-label={tr(isAr, "More actions", "المزيد")}
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3100,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "max(12px, env(safe-area-inset-top)) 16px max(12px, env(safe-area-inset-bottom))",
      }}
      onClick={() => { /* Menu stays open unless user presses the X */ }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-card"
        style={{
          background: "var(--card)",
          borderRadius: 16,
          border: "1px solid rgba(var(--border-rgb),0.15)",
          boxShadow: "0 24px 60px -12px rgba(0,0,0,0.4)",
          width: "100%",
          maxWidth: 420,
          maxHeight: "min(92dvh, 92vh)",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          padding: "14px 12px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 8px 10px",
            borderBottom: "1px solid rgba(var(--border-rgb),0.12)",
            marginBottom: 4,
            position: "sticky",
            top: 0,
            zIndex: 2,
            background: "color-mix(in srgb, var(--card) 94%, transparent)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--muted-strong)",
            }}
          >
            {tr(isAr, "More", "المزيد")}
          </span>
          <button
            type="button"
            onClick={closeMenu}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "none",
              background: "var(--input-bg)",
              color: "var(--icon-muted)",
              cursor: "pointer",
            }}
          >
            <XIcon size={14} />
          </button>
        </div>

        {categories.map((cat, catIdx) => (
          <div key={cat.id} style={{ marginBottom: catIdx < categories.length - 1 ? 4 : 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--muted-strong)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                padding: "10px 12px 2px",
                opacity: 0.9,
              }}
            >
              {cat.title}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "0 4px",
              }}
            >
              {cat.items.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  role="menuitem"
                  disabled={!!it.disabled}
                  onClick={() => handleItemClick(it)}
                  className="lift-hover tools-menu-item"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: 10,
                    border: "none",
                    background: "transparent",
                    color: "var(--ink)",
                    fontSize: 13.5,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: it.disabled ? "not-allowed" : "pointer",
                    opacity: it.disabled ? 0.5 : 1,
                    textAlign: "start",
                    transition: "background 0.12s ease",
                    minHeight: 42,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      background: `${it.tint}18`,
                      color: it.tint,
                      flexShrink: 0,
                    }}
                  >
                    {it.icon}
                  </span>
                  <span style={{ flex: 1, lineHeight: 1.3 }}>{it.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      ref={wrapRef}
      className="toolbar-anim"
      style={{
        position: "relative",
        animationDelay: "0.06s",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 8, // مسافة مريحة بين زر المزيد وزر الإغلاق
      }}
    >
      {/* زر المزيد */}
      <button
        ref={btnRef}
        onClick={toggleOpen}
        title={tr(isAr, "More", "المزيد")}
        aria-label={tr(isAr, "More actions", "المزيد")}
        aria-expanded={open}
        aria-haspopup="menu"
        className="lift-hover"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          minWidth: 40,
          height: 40,
          padding: "0 10px",
          borderRadius: 12,
          color: open ? "#fff" : accent,
          background: open ? accent : "var(--card)",
          border: `1px solid ${accent}40`,
          cursor: "pointer",
          transition: "transform 0.15s ease, background 0.15s ease",
          fontWeight: 700,
          fontSize: 13,
          fontFamily: "inherit",
        }}
      >
        <span style={{ display: "none" }} className="tools-more-label">
          {tr(isAr, "More", "المزيد")}
        </span>
        <span
          style={{
            display: "inline-flex",
            transform: open ? "rotate(-90deg)" : "rotate(90deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <ChevronIcon size={18} />
        </span>
      </button>

      {/* زر الإغلاق بجانب المزيد — يظهر فقط عند الفتح */}
      {open && (
        <button
          type="button"
          onClick={closeMenu}
          title={tr(isAr, "Close", "إغلاق")}
          aria-label={tr(isAr, "Close menu", "إغلاق القائمة")}
          className="lift-hover"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: "50%",
            color: "var(--ink)",
            background: "var(--card)",
            border: "1px solid rgba(var(--border-rgb),0.22)",
            cursor: "pointer",
            marginInlineStart: 4,
          }}
        >
          <XIcon size={16} />
        </button>
      )}

      {open && typeof document !== "undefined" ? createPortal(menuPanel, document.body) : null}
    </div>
  );
}
