import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { tr } from "../../lib/config/i18n";
import {
  MoreIcon, XIcon, TrophyIcon, StatsIcon, QuizIcon, LayersIcon,
  DownloadIcon, UploadIcon, LoaderIcon, ClockIcon, CalendarIcon,
} from "../common/Icons";

// Desktop: radial wheel around the trigger.
// Mobile / narrow screens: bottom sheet list — readable, tappable, no overlap.
const HUB_SIZE = 40;
const SATELLITE_SIZE = 46;
const RADIUS = 108;
const ARC_SPAN = 170;

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

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
    mq.addListener?.(onChange); // older Safari
    return () => {
      mq.removeEventListener?.("change", onChange);
      mq.removeListener?.(onChange);
    };
  }, []);
  return compact;
}

export default function ToolsMenu({
  accent, onLeaderboard, onStats, onQuiz, onFlashcards, onTimer, onCalendar,
  onExport, exportDisabled, onImport, importing, isAr,
}) {
  const [open, setOpen] = useState(false);
  const [center, setCenter] = useState(null);
  const [hoverKey, setHoverKey] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const isCompact = useIsCompact();

  const computeCenter = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < RADIUS + SATELLITE_SIZE;
    setCenter({ x: cx, y: cy, openUpward, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width });
  }, []);

  function closeMenu() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    computeCenter();
    function onDocClick(e) {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      closeMenu();
    }
    function onKeyDown(e) { if (e.key === "Escape") closeMenu(); }
    window.addEventListener("scroll", computeCenter, true);
    window.addEventListener("resize", computeCenter);
    document.addEventListener("pointerdown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", computeCenter, true);
      window.removeEventListener("resize", computeCenter);
      document.removeEventListener("pointerdown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, computeCenter]);

  // On mobile list: close after choosing an action. On desktop wheel: keep open
  // so power users can fire several tools without reopening.
  function itemClick(fn) {
    fn();
    if (isCompact) closeMenu();
  }

  const items = [
    { key: "leaderboard", icon: <TrophyIcon size={18} />, tint: "#d4a017", label: tr(isAr, "Leaderboard", "الترتيب"), onClick: onLeaderboard },
    { key: "stats", icon: <StatsIcon size={18} />, tint: "#5b8def", label: tr(isAr, "Stats", "إحصائياتي"), onClick: onStats },
    { key: "quiz", icon: <QuizIcon size={18} />, tint: "#af52de", label: tr(isAr, "Quiz", "اختبار"), onClick: onQuiz },
    { key: "flashcards", icon: <LayersIcon size={18} />, tint: "#ff9f0a", label: tr(isAr, "Flashcards", "بطاقات تعليمية"), onClick: onFlashcards },
    { key: "timer", icon: <ClockIcon size={18} />, tint: "#19A7CE", label: tr(isAr, "Timer", "مؤقّت"), onClick: onTimer },
    { key: "calendar", icon: <CalendarIcon size={18} />, tint: "#e85d04", label: tr(isAr, "Calendar", "التقويم"), onClick: onCalendar },
    { key: "export", icon: <DownloadIcon size={18} />, tint: "#34c759", label: tr(isAr, "Export CSV", "تصدير CSV"), onClick: onExport, disabled: exportDisabled },
    { key: "import", icon: importing ? <LoaderIcon size={18} /> : <UploadIcon size={18} />, tint: "#34c759", label: tr(isAr, "Import CSV", "استيراد CSV"), onClick: onImport, disabled: importing },
  ];

  const n = items.length;
  const startAngle = center?.openUpward ? 270 - ARC_SPAN / 2 : 90 - ARC_SPAN / 2;
  const step = n > 1 ? ARC_SPAN / (n - 1) : 0;

  // ---------- Mobile: bottom sheet list ----------
  const compactMenu = open && (
    <div style={{ position: "fixed", inset: 0, zIndex: 1200, pointerEvents: "auto" }}>
      {/* Dim backdrop */}
      <div
        onPointerDown={(e) => { e.preventDefault(); closeMenu(); }}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
        }}
      />
      <div
        ref={menuRef}
        role="menu"
        dir={isAr ? "rtl" : "ltr"}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "min(72dvh, 520px)",
          background: "var(--card)",
          borderRadius: "18px 18px 0 0",
          boxShadow: "0 -12px 40px -12px rgba(0,0,0,0.45)",
          padding: "10px 12px calc(12px + env(safe-area-inset-bottom, 0px))",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          overflowY: "auto",
          overscrollBehavior: "contain",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 4px 10px" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {tr(isAr, "More", "المزيد")}
          </span>
          <button
            type="button"
            aria-label={tr(isAr, "Close", "إغلاق")}
            onClick={closeMenu}
            style={{
              width: 36, height: 36, borderRadius: "50%", border: "none",
              background: "var(--input-bg)", color: "var(--icon-muted)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            <XIcon size={16} />
          </button>
        </div>
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

  // ---------- Desktop: radial wheel ----------
  const wheelMenu = open && center && (
    <div ref={menuRef} role="menu" style={{ position: "fixed", inset: 0, zIndex: 1000, pointerEvents: "none" }}>
      <style>{`
        .tools-wheel-item:hover:not(:disabled) { transform: scale(1.12); box-shadow: 0 12px 26px -8px rgba(0,0,0,0.5); }
        .tools-wheel-item:active:not(:disabled) { transform: scale(1.02); }
      `}</style>
      <div
        style={{
          position: "absolute",
          left: center.x - (RADIUS + SATELLITE_SIZE / 2),
          top: center.y - (RADIUS + SATELLITE_SIZE / 2),
          width: (RADIUS + SATELLITE_SIZE / 2) * 2,
          height: (RADIUS + SATELLITE_SIZE / 2) * 2,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}14 0%, transparent 70%)`,
          border: `1px solid ${accent}22`,
          pointerEvents: "none",
        }}
      />
      {items.map((it, i) => {
        const angle = startAngle + step * i;
        const { x, y } = polar(center.x, center.y, RADIUS, angle);
        const hovered = hoverKey === it.key;
        return (
          <div key={it.key} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", pointerEvents: "auto" }}>
            <button
              type="button"
              role="menuitem"
              aria-label={it.label}
              disabled={it.disabled}
              className="tools-wheel-item"
              onMouseEnter={() => setHoverKey(it.key)}
              onMouseLeave={() => setHoverKey((k) => (k === it.key ? null : k))}
              onFocus={() => setHoverKey(it.key)}
              onBlur={() => setHoverKey((k) => (k === it.key ? null : k))}
              onClick={() => { if (!it.disabled) itemClick(it.onClick); }}
              style={{
                width: SATELLITE_SIZE,
                height: SATELLITE_SIZE,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--card)",
                border: `1.5px solid ${hovered ? it.tint : "rgba(var(--border-rgb),0.22)"}`,
                color: it.tint,
                opacity: it.disabled ? 0.4 : 1,
                cursor: it.disabled ? "default" : "pointer",
                boxShadow: "0 10px 22px -10px rgba(0,0,0,0.45)",
                transition: "none",
              }}
            >
              {it.icon}
            </button>
            <span
              style={{
                position: "absolute",
                top: "50%",
                insetInlineStart: "calc(100% + 8px)",
                transform: "translateY(-50%)",
                whiteSpace: "nowrap",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ink)",
                background: "var(--card)",
                border: "1px solid rgba(var(--border-rgb),0.16)",
                borderRadius: 8,
                padding: "4px 9px",
                boxShadow: "0 8px 20px -10px rgba(0,0,0,0.4)",
                opacity: hovered ? 1 : 0,
                pointerEvents: "none",
              }}
            >
              {it.label}
            </span>
          </div>
        );
      })}
      <button
        type="button"
        aria-label={tr(isAr, "Close", "إغلاق")}
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); closeMenu(); }}
        style={{
          position: "absolute",
          left: center.x,
          top: center.y,
          transform: "translate(-50%, -50%)",
          width: HUB_SIZE,
          height: HUB_SIZE,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: accent,
          color: "#fff",
          border: "none",
          cursor: "pointer",
          boxShadow: `0 8px 20px -6px ${accent}88`,
          pointerEvents: "auto",
          transition: "none",
        }}
      >
        <XIcon size={16} />
      </button>
    </div>
  );

  const portalMenu = isCompact ? compactMenu : wheelMenu;

  return (
    <div className="toolbar-anim" style={{ position: "relative", animationDelay: "0.06s", flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        title={tr(isAr, "More", "المزيد")}
        aria-label={tr(isAr, "More actions", "المزيد")}
        aria-expanded={open}
        aria-haspopup="menu"
        className="lift-hover"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: HUB_SIZE, height: HUB_SIZE, borderRadius: "50%",
          color: open ? "#fff" : accent,
          background: open ? accent : "var(--card)",
          border: `1px solid ${accent}40`,
          cursor: "pointer",
          transition: "none",
          // On compact we keep the trigger visible (sheet opens from bottom).
          // On desktop the hub X replaces it while open.
          opacity: open && !isCompact ? 0 : 1,
          pointerEvents: open && !isCompact ? "none" : "auto",
        }}
      >
        {open && isCompact ? <XIcon size={16} /> : <MoreIcon size={18} />}
      </button>
      {open && typeof document !== "undefined" ? createPortal(portalMenu, document.body) : null}
    </div>
  );
}
