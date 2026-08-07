import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { tr } from "../../lib/config/i18n";
import {
  ChevronIcon, XIcon, TrophyIcon, StatsIcon, QuizIcon, LayersIcon,
  DownloadIcon, UploadIcon, LoaderIcon, ClockIcon, CalendarIcon, CheckIcon, FlameIcon,
  MicIcon, StarIcon, WandIcon,
} from "../common/Icons";

// Always a readable list (bottom sheet on narrow screens, anchored panel on desktop).

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
  accent, onLeaderboard, onStats, onQuiz, onFlashcards, onTimer, onCalendar, onTodo,
  onGoals, onQuickReview, onDictation, onAchievements, onRandomWord,
  onExport, exportDisabled, onImport, importing, isAr,
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
    function onDocClick(e) {
      // Keep open when clicking the toolbar buttons (More / X) or inside the menu
      if (wrapRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      closeMenu();
    }
    function onKeyDown(e) { if (e.key === "Escape") closeMenu(); }
    document.addEventListener("pointerdown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    // NOTE: intentionally NO scroll listener — menu stays open while scrolling
    return () => {
      document.removeEventListener("pointerdown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function itemClick(fn) {
    if (typeof fn === "function") fn();
    closeMenu();
  }

  const items = [
    { key: "leaderboard", icon: <TrophyIcon size={18} />, tint: "#d4a017", label: tr(isAr, "Leaderboard", "الترتيب"), onClick: onLeaderboard },
    { key: "stats", icon: <StatsIcon size={18} />, tint: "#5b8def", label: tr(isAr, "Stats", "إحصائياتي"), onClick: onStats },
    { key: "achievements", icon: <StarIcon size={18} />, tint: "#f4a261", label: tr(isAr, "Achievements", "الإنجازات"), onClick: onAchievements },
    { key: "quiz", icon: <QuizIcon size={18} />, tint: "#af52de", label: tr(isAr, "Quiz", "اختبار"), onClick: onQuiz },
    { key: "flashcards", icon: <LayersIcon size={18} />, tint: "#ff9f0a", label: tr(isAr, "Flashcards", "بطاقات تعليمية"), onClick: onFlashcards },
    { key: "dictation", icon: <MicIcon size={18} />, tint: "#e76f51", label: tr(isAr, "Dictation", "استماع وإملاء"), onClick: onDictation },
    { key: "random", icon: <WandIcon size={18} />, tint: "#7b2cbf", label: tr(isAr, "Random word", "كلمة عشوائية"), onClick: onRandomWord },
    { key: "timer", icon: <ClockIcon size={18} />, tint: "#19A7CE", label: tr(isAr, "Timer", "مؤقّت"), onClick: onTimer },
    { key: "calendar", icon: <CalendarIcon size={18} />, tint: "#e85d04", label: tr(isAr, "Calendar", "التقويم"), onClick: onCalendar },
    { key: "goals", icon: <FlameIcon size={18} />, tint: "#ff9f0a", label: tr(isAr, "Goals", "الأهداف"), onClick: onGoals },
    { key: "quick", icon: <LayersIcon size={18} />, tint: "#af52de", label: tr(isAr, "Quick review", "مراجعة سريعة"), onClick: onQuickReview },
    { key: "todo", icon: <CheckIcon size={18} />, tint: "#30d158", label: tr(isAr, "To-do list", "قائمة المهام"), onClick: onTodo },
    { key: "export", icon: <DownloadIcon size={18} />, tint: "#34c759", label: tr(isAr, "Export CSV", "تصدير CSV"), onClick: onExport, disabled: exportDisabled },
    { key: "import", icon: importing ? <LoaderIcon size={18} /> : <UploadIcon size={18} />, tint: "#34c759", label: tr(isAr, "Import CSV", "استيراد CSV"), onClick: onImport, disabled: importing },
  ];

  const menuPanel = open && (
    <div style={{ position: "fixed", inset: 0, zIndex: 1200, pointerEvents: "auto" }}>
      {/* Backdrop: closes on click, does not block scroll of the page underneath on desktop */}
      <div
        onPointerDown={(e) => { e.preventDefault(); closeMenu(); }}
        style={{
          position: "absolute", inset: 0,
          background: isCompact ? "rgba(0,0,0,0.45)" : "transparent",
          backdropFilter: isCompact ? "blur(2px)" : undefined,
          WebkitBackdropFilter: isCompact ? "blur(2px)" : undefined,
        }}
      />
      <div
        ref={menuRef}
        role="menu"
        dir={isAr ? "rtl" : "ltr"}
        style={
          isCompact
            ? {
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                maxHeight: "min(72dvh, 560px)",
                background: "var(--card)",
                borderRadius: "18px 18px 0 0",
                boxShadow: "0 -8px 40px -12px rgba(0,0,0,0.35)",
                padding: "10px 12px calc(14px + env(safe-area-inset-bottom, 0px))",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }
            : {
                position: "absolute",
                top: (() => {
                  if (!anchor) return 60;
                  const spaceBelow = window.innerHeight - anchor.top;
                  const estimatedH = Math.min(items.length * 52 + 24, 420);
                  if (spaceBelow < estimatedH + 12 && anchor.bottom > estimatedH + 12) {
                    return Math.max(8, anchor.bottom - estimatedH - 8);
                  }
                  return Math.min(anchor.top + 8, window.innerHeight - estimatedH - 8);
                })(),
                left: (() => {
                  if (!anchor) return 16;
                  const panelW = 260;
                  let left = isAr ? anchor.right - panelW : anchor.left;
                  left = Math.max(8, Math.min(left, window.innerWidth - panelW - 8));
                  return left;
                })(),
                width: 260,
                maxHeight: "min(70vh, 420px)",
                background: "var(--card)",
                borderRadius: 14,
                border: "1px solid rgba(var(--border-rgb),0.16)",
                boxShadow: "0 16px 40px -12px rgba(0,0,0,0.35)",
                padding: "8px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }
        }
      >
        {isCompact && (
          <div style={{ padding: "6px 8px 10px" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
              {tr(isAr, "More", "المزيد")}
            </span>
          </div>
        )}
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            onClick={() => { if (!it.disabled) itemClick(it.onClick); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              minHeight: 48,
              padding: "10px 12px",
              border: "none",
              borderRadius: 12,
              background: "transparent",
              color: "var(--ink)",
              fontSize: 15,
              fontWeight: 600,
              textAlign: "start",
              cursor: it.disabled ? "default" : "pointer",
              opacity: it.disabled ? 0.45 : 1,
              fontFamily: "inherit",
            }}
          >
            <span
              style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: `${it.tint}1a`, color: it.tint,
              }}
            >
              {it.icon}
            </span>
            <span style={{ flex: 1 }}>{it.label}</span>
          </button>
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
        gap: 6,
      }}
    >
      {/* More dropdown — down arrow (not three dots) */}
      <button
        ref={btnRef}
        onClick={toggleOpen}
        title={tr(isAr, "More", "المزيد")}
        aria-label={tr(isAr, "More actions", "المزيد")}
        aria-expanded={open}
        aria-haspopup="menu"
        className="lift-hover"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          minWidth: 40, height: 40, padding: "0 10px", borderRadius: 12,
          color: open ? "#fff" : accent,
          background: open ? accent : "var(--card)",
          border: `1px solid ${accent}40`,
          cursor: "pointer",
          transition: "transform 0.15s ease, background 0.15s ease",
          fontWeight: 700, fontSize: 13, fontFamily: "inherit",
        }}
      >
        <span style={{ display: "none" }} className="tools-more-label">{tr(isAr, "More", "المزيد")}</span>
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

      {/* X sits next to the More button (only while open) — closes the menu */}
      {open && (
        <button
          type="button"
          onClick={closeMenu}
          title={tr(isAr, "Close", "إغلاق")}
          aria-label={tr(isAr, "Close menu", "إغلاق القائمة")}
          className="lift-hover"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 40, height: 40, borderRadius: "50%",
            color: "var(--ink)",
            background: "var(--card)",
            border: "1px solid rgba(var(--border-rgb),0.22)",
            cursor: "pointer",
            transition: "none",
          }}
        >
          <XIcon size={16} />
        </button>
      )}

      {open && typeof document !== "undefined" ? createPortal(menuPanel, document.body) : null}
    </div>
  );
}
