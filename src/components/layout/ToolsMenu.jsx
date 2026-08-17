import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { tr } from "../../lib/config/i18n";
import {
  ChevronIcon, XIcon, TrophyIcon, StatsIcon, QuizIcon, LayersIcon,
  DownloadIcon, UploadIcon, LoaderIcon, ClockIcon, CalendarIcon, CheckIcon, FlameIcon,
  MicIcon, StarIcon, WandIcon, MoreIcon, BookIcon,
} from "../common/Icons";
import { preloadMotivationDuaModal } from "../modals/lazyModals";

/** أيقونة صورة حقيقية من public/icons */
function PhotoIcon({ name, size = 28 }) {
  return (
    <img
      src={`/icons/${name}.png`}
      alt=""
      width={size}
      height={size}
      draggable={false}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        objectFit: "cover",
        display: "block",
        flexShrink: 0,
      }}
    />
  );
}


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
  onExamMode,
  onSmartCards = null,
  onConversation = null,
  onTutorChat = null,
  onLevels = null,
  onProgressCompare = null,
  onTextExtract = null,
  onWeeklyReport = null,
  onWeaknessReview = null,
  onListeningLoop = null,
  onSentencePractice = null,
  nightStudy = false,
  onToggleNightStudy = null,
  onMotivationDua = null,
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
    // Preload heavy full-page tools so opening them feels instant
    try {
      import("../timer/TimerPage");
      import("../calendar/CalendarPage");
      import("../todo/TodoPage");
      import("../goals/GoalsPage");
      import("../dashboard/DashboardPage");
      preloadMotivationDuaModal();
    } catch (_) {}
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

  // تجميع العناصر في فئات أوضح وأقل زحمة
  const categories = [
    {
      id: "practice",
      title: tr(isAr, "Practice", "التدريب"),
      items: [
        { key: "quick", icon: <PhotoIcon name="review" />, tint: "#af52de", label: tr(isAr, "Quick review", "مراجعة سريعة"), onClick: onQuickReview },
        ...(typeof onWeaknessReview === "function"
          ? [{ key: "weakness", icon: <PhotoIcon name="exam" />, tint: "#ff3b30", label: tr(isAr, "Weakness review", "مراجعة الضعف"), onClick: onWeaknessReview }]
          : []),
        ...(typeof onSmartCards === "function"
          ? [{ key: "smartCards", icon: <PhotoIcon name="cards" />, tint: "#ff9f0a", label: tr(isAr, "Smart cards", "بطاقات ذكية"), onClick: onSmartCards }]
          : []),
        { key: "dictation", icon: <PhotoIcon name="dictation" />, tint: "#e76f51", label: tr(isAr, "Listening & Dictation", "استماع وإملاء"), onClick: onDictation },
        ...(typeof onSentencePractice === "function"
          ? [{ key: "sentence", icon: <PhotoIcon name="review" />, tint: "#32ade6", label: tr(isAr, "Sentence practice", "تمرين الجمل"), onClick: onSentencePractice }]
          : []),
        { key: "quiz", icon: <PhotoIcon name="quiz" />, tint: "#af52de", label: tr(isAr, "Quiz", "اختبار"), onClick: onQuiz },
        { key: "exam", icon: <PhotoIcon name="exam" />, tint: "#e85d04", label: tr(isAr, "Exam Mode", "وضع الامتحان"), onClick: onExamMode },
        { key: "random", icon: <PhotoIcon name="random" />, tint: "#7b2cbf", label: tr(isAr, "Random word", "كلمة عشوائية"), onClick: onRandomWord },
      ],
    },
    {
      id: "mindset",
      title: tr(isAr, "Mindset", "تحفيز ودعاء"),
      items: [
        ...(typeof onMotivationDua === "function"
          ? [{
              key: "motivationDua",
              icon: <PhotoIcon name="motivation" />, tint: "#b45309",
              label: tr(isAr, "Motivation & Du'as", "تحفيز ودعاء"),
              onClick: onMotivationDua,
            }]
          : []),
      ].filter(Boolean),
    },
    {
      id: "progress",
      title: tr(isAr, "Progress", "التقدّم"),
      items: [
        { key: "dashboard", icon: <PhotoIcon name="stats" />, tint: "#5b8def", label: tr(isAr, "Dashboard", "لوحة القيادة"), onClick: onDashboard },
        { key: "stats", icon: <PhotoIcon name="stats" />, tint: "#5b8def", label: tr(isAr, "Stats", "إحصائياتي"), onClick: onStats },
        ...(typeof onWeeklyReport === "function"
          ? [{ key: "weekly", icon: <PhotoIcon name="stats" />, tint: "#30d158", label: tr(isAr, "Weekly report", "التقرير الأسبوعي"), onClick: onWeeklyReport }]
          : []),
        { key: "achievements", icon: <PhotoIcon name="trophy" />, tint: "#f4a261", label: tr(isAr, "Achievements", "الإنجازات"), onClick: onAchievements },
        { key: "goals", icon: <PhotoIcon name="goals" />, tint: "#ff9f0a", label: tr(isAr, "Goals", "الأهداف"), onClick: onGoals },
        { key: "leaderboard", icon: <PhotoIcon name="trophy" />, tint: "#d4a017", label: tr(isAr, "Leaderboard", "الترتيب"), onClick: onLeaderboard },
        ...(typeof onLevels === "function"
          ? [{ key: "levels", icon: <PhotoIcon name="star" />, tint: "#f5c542", label: tr(isAr, "Levels & XP", "المستويات والنقاط"), onClick: onLevels }]
          : []),
        ...(typeof onProgressCompare === "function"
          ? [{ key: "compare", icon: <PhotoIcon name="stats" />, tint: "#5b8def", label: tr(isAr, "You vs past you", "أنت ونفسك القديمة"), onClick: onProgressCompare }]
          : []),
      ],
    },
    {
      id: "tools",
      title: tr(isAr, "Tools", "الأدوات"),
      items: [
        { key: "timer", icon: <PhotoIcon name="timer" />, tint: "#19A7CE", label: tr(isAr, "Timer", "مؤقّت"), onClick: onTimer },
        { key: "calendar", icon: <PhotoIcon name="calendar" />, tint: "#e85d04", label: tr(isAr, "Calendar", "التقويم"), onClick: onCalendar },
        { key: "todo", icon: <PhotoIcon name="todo" />, tint: "#30d158", label: tr(isAr, "To-do list", "قائمة المهام"), onClick: onTodo },
        { key: "lists", icon: <PhotoIcon name="cards" />, tint: "#19A7CE", label: tr(isAr, "Word lists", "قوائم الكلمات"), onClick: onWordLists },
        { key: "challenges", icon: <PhotoIcon name="trophy" />, tint: "#d4a017", label: tr(isAr, "Challenges", "تحديات"), onClick: onChallenges },
        ...(typeof onConversation === "function"
          ? [{ key: "conversation", icon: <PhotoIcon name="chat" />, tint: "#5e5ce6", label: tr(isAr, "Conversation", "محادثة"), onClick: onConversation }]
          : []),
        ...(typeof onTutorChat === "function"
          ? [{ key: "tutorChat", icon: <PhotoIcon name="chat" />, tint: "#5b8def", label: tr(isAr, "Study Coach", "مساعد الدراسة"), onClick: onTutorChat }]
          : []),
        ...(typeof onTextExtract === "function"
          ? [{ key: "extract", icon: <PhotoIcon name="random" />, tint: "#ff2d55", label: tr(isAr, "Extract from text", "استخراج من نص"), onClick: onTextExtract }]
          : []),
        ...(typeof onToggleNightStudy === "function"
          ? [{
              key: "night",
              icon: <PhotoIcon name="night" />,
              tint: "#8e8e93",
              label: nightStudy
                ? tr(isAr, "Exit night study", "إغلاق وضع الليل")
                : tr(isAr, "Night study mode", "وضع المذاكرة الليلي"),
              onClick: onToggleNightStudy,
            }]
          : []),
      ],
    },
    {
      id: "data",
      title: tr(isAr, "Data", "البيانات"),
      items: [
        { key: "export", icon: <PhotoIcon name="data" />, tint: "#34c759", label: tr(isAr, "Export CSV", "تصدير CSV"), onClick: onExport, disabled: exportDisabled },
        { key: "exportAnki", icon: <PhotoIcon name="data" />, tint: "#30d158", label: tr(isAr, "Export Anki", "تصدير Anki"), onClick: onExportAnki, disabled: exportDisabled },
        { key: "import", icon: importing ? <LoaderIcon size={18} /> : <PhotoIcon name="data" />, tint: "#34c759", label: tr(isAr, "Import CSV", "استيراد CSV"), onClick: onImport, disabled: importing },
      ],
    },
  ].filter((cat) => cat.items.length > 0);

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
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          padding: 0,
        }}
      >
        {/* Header outside scroll area — prevents items showing above MORE */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 14px 12px",
            borderBottom: "1px solid rgba(var(--border-rgb),0.12)",
            background: "var(--card)",
            flexShrink: 0,
            borderRadius: "16px 16px 0 0",
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

        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            padding: "8px 12px 20px",
          }}
        >
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
                    className="tools-menu-item"
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
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "transparent",
                        color: it.tint,
                        flexShrink: 0,
                        overflow: "hidden",
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
      {/* زر المزيد — شكل حديث (pill + أيقونة نقاط) */}
      <button
        ref={btnRef}
        onClick={toggleOpen}
        title={tr(isAr, "Tools & more", "أدوات والمزيد")}
        aria-label={tr(isAr, "More actions", "المزيد")}
        aria-expanded={open}
        aria-haspopup="menu"
        className="lift-hover tools-more-btn"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minWidth: 44,
          height: 40,
          padding: "0 14px",
          borderRadius: 999,
          color: open ? "#fff" : "var(--ink)",
          background: open
            ? `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 70%, #7c3aed))`
            : "color-mix(in srgb, var(--card) 88%, transparent)",
          border: open
            ? "1px solid transparent"
            : "1px solid rgba(var(--border-rgb),0.22)",
          boxShadow: open
            ? `0 8px 22px -10px color-mix(in srgb, ${accent} 70%, transparent)`
            : "0 1px 2px rgba(0,0,0,0.06)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          cursor: "pointer",
          transition: "transform 0.18s ease, background 0.2s ease, box-shadow 0.2s ease, color 0.2s ease",
          fontWeight: 700,
          fontSize: 13,
          fontFamily: "inherit",
          letterSpacing: "0.01em",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: 8,
            background: open ? "rgba(255,255,255,0.18)" : `color-mix(in srgb, ${accent} 16%, transparent)`,
            color: open ? "#fff" : accent,
            transition: "background 0.2s ease, color 0.2s ease",
          }}
        >
          <MoreIcon size={16} />
        </span>
        <span className="tools-more-label" style={{ lineHeight: 1 }}>
          {tr(isAr, "More", "المزيد")}
        </span>
      </button>

      {open && typeof document !== "undefined" ? createPortal(menuPanel, document.body) : null}
    </div>
  );
}
