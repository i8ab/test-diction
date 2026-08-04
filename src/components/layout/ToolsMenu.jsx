import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { tr } from "../../lib/config/i18n";
import {
  ChevronIcon, MoreIcon, TrophyIcon, StatsIcon, QuizIcon, LayersIcon,
  DownloadIcon, UploadIcon, LoaderIcon,
} from "../common/Icons";

const TOOLS_MENU_ITEMS_META = { minWidth: 190, gap: 8 };

export default function ToolsMenu({ accent, onLeaderboard, onStats, onQuiz, onFlashcards, onExport, exportDisabled, onImport, importing, isAr }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null); // { left, top, openUpward } in viewport (fixed) coordinates
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const computeCoords = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuHeight = menuRef.current ? menuRef.current.offsetHeight : 260;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < menuHeight + TOOLS_MENU_ITEMS_META.gap && spaceAbove > spaceBelow;
    const top = openUpward
      ? Math.max(8, rect.top - menuHeight - TOOLS_MENU_ITEMS_META.gap)
      : rect.bottom + TOOLS_MENU_ITEMS_META.gap;
    const left = isAr
      ? rect.left
      : Math.min(rect.right - TOOLS_MENU_ITEMS_META.minWidth, window.innerWidth - TOOLS_MENU_ITEMS_META.minWidth - 8);
    setCoords({ left: Math.max(8, left), top, openUpward });
  }, [isAr]);

  // Recompute position the instant it opens, then keep it pinned to the
  // button while the page scrolls or the window resizes — since the menu
  // is rendered in a portal at document.body, it's positioned purely from
  // real screen coordinates and can't be clipped by any parent's overflow,
  // transform, or z-index stacking, wherever this button ends up on the page.
  useEffect(() => {
    if (!open) return;
    computeCoords();
    const raf = requestAnimationFrame(computeCoords); // one more pass once menu height is known
    function onDocClick(e) {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onKeyDown(e) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("scroll", computeCoords, true);
    window.addEventListener("resize", computeCoords);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", computeCoords, true);
      window.removeEventListener("resize", computeCoords);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, computeCoords]);

  function itemClick(fn) {
    setOpen(false);
    fn();
  }

  const itemStyle = { display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 14px", fontSize: 13.5, fontWeight: 600, color: "var(--ink)", background: "none", border: "none", textAlign: "start", cursor: "pointer" };

  const menu = open && (
    <div
      ref={menuRef}
      role="menu"
      dir={isAr ? "rtl" : "ltr"}
      style={{
        position: "fixed",
        top: coords ? coords.top : -9999,
        left: coords ? coords.left : -9999,
        visibility: coords ? "visible" : "hidden",
        minWidth: TOOLS_MENU_ITEMS_META.minWidth,
        maxHeight: "min(320px, calc(100vh - 16px))",
        overflowY: "auto",
        overscrollBehavior: "contain",
        background: "var(--card)",
        border: "1px solid rgba(var(--border-rgb),0.2)",
        borderRadius: 10,
        boxShadow: "0 14px 30px -12px rgba(0,0,0,0.35)",
        zIndex: 1000,
        animation: `${coords?.openUpward ? "scaleInUp" : "scaleIn"} 0.18s cubic-bezier(0.22,1,0.36,1) both`,
        transformOrigin: coords?.openUpward ? "bottom" : "top",
      }}
    >
      <button role="menuitem" style={itemStyle} onClick={() => itemClick(onLeaderboard)}>
        <TrophyIcon size={16} /> {tr(isAr, "Leaderboard", "الترتيب")}
      </button>
      <button role="menuitem" style={{ ...itemStyle, borderTop: "1px solid rgba(var(--border-rgb),0.12)" }} onClick={() => itemClick(onStats)}>
        <StatsIcon size={16} /> {tr(isAr, "Stats", "إحصائياتي")}
      </button>
      <button role="menuitem" style={{ ...itemStyle, borderTop: "1px solid rgba(var(--border-rgb),0.12)" }} onClick={() => itemClick(onQuiz)}>
        <QuizIcon size={16} /> {tr(isAr, "Quiz", "اختبار")}
      </button>
      <button role="menuitem" style={{ ...itemStyle, borderTop: "1px solid rgba(var(--border-rgb),0.12)" }} onClick={() => itemClick(onFlashcards)}>
        <LayersIcon size={16} /> {tr(isAr, "Flashcards", "بطاقات تعليمية")}
      </button>
      <button role="menuitem" disabled={exportDisabled}
        style={{ ...itemStyle, borderTop: "1px solid rgba(var(--border-rgb),0.12)", opacity: exportDisabled ? 0.5 : 1, cursor: exportDisabled ? "default" : "pointer" }}
        onClick={() => { if (!exportDisabled) itemClick(onExport); }}>
        <DownloadIcon size={16} /> {tr(isAr, "Export CSV", "تصدير CSV")}
      </button>
      <button role="menuitem" disabled={importing}
        style={{ ...itemStyle, borderTop: "1px solid rgba(var(--border-rgb),0.12)", opacity: importing ? 0.5 : 1, cursor: importing ? "default" : "pointer" }}
        onClick={() => { if (!importing) itemClick(onImport); }}>
        {importing ? <LoaderIcon size={16} /> : <UploadIcon size={16} />} {tr(isAr, "Import CSV", "استيراد CSV")}
      </button>
    </div>
  );

  return (
    <div className="toolbar-anim" style={{ position: "relative", animationDelay: "0.06s" }}>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        aria-label={tr(isAr, "More actions", "المزيد")}
        aria-expanded={open}
        aria-haspopup="menu"
        className="lift-hover"
        style={{ display: "flex", alignItems: "center", gap: 7, height: "100%", padding: "10px 16px", fontSize: 14, fontWeight: 600, color: accent, background: "var(--card)", border: `1px solid ${accent}40`, borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap" }}
      >
        <MoreIcon size={16} /> {tr(isAr, "More", "المزيد")}
        <ChevronIcon size={13} style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
      </button>
      {open && typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </div>
  );
}
