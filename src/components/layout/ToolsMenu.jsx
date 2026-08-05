import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { tr } from "../../lib/config/i18n";
import {
  ChevronIcon, MoreIcon, TrophyIcon, StatsIcon, QuizIcon, LayersIcon,
  DownloadIcon, UploadIcon, LoaderIcon, XIcon, CheckIcon,
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

  // Items no longer close the menu on click — the menu only closes when the
  // user explicitly wants it to: the X button, an outside click, or Escape.
  // A quick "done" pulse on the icon gives feedback that the tap registered.
  const [pulse, setPulse] = useState(null);
  function itemClick(key, fn) {
    fn();
    setPulse(key);
    window.clearTimeout(itemClick._t);
    itemClick._t = window.setTimeout(() => setPulse((p) => (p === key ? null : p)), 900);
  }

  const itemStyle = { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", fontSize: 13.5, fontWeight: 600, color: "var(--ink)", background: "none", border: "none", borderRadius: 9, textAlign: "start", cursor: "pointer" };
  const iconWrapStyle = (bg) => ({ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 8, background: bg, flexShrink: 0, transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)" });

  function MenuItem({ menuKey, icon, label, onClick, disabled, loading, tint }) {
    const done = pulse === menuKey;
    return (
      <button
        role="menuitem"
        disabled={disabled}
        className="tools-menu-item"
        style={{ ...itemStyle, opacity: disabled ? 0.45 : 1, cursor: disabled ? "default" : "pointer" }}
        onClick={() => { if (!disabled) itemClick(menuKey, onClick); }}
      >
        <span style={iconWrapStyle(done ? "rgba(52,199,89,0.16)" : `${tint}1c`)}>
          {done ? <CheckIcon size={14} style={{ color: "#34c759" }} /> : loading ? <LoaderIcon size={14} style={{ color: tint }} /> : (
            <span style={{ color: tint, display: "flex" }}>{icon}</span>
          )}
        </span>
        <span style={{ flex: 1 }}>{label}</span>
      </button>
    );
  }

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
        minWidth: TOOLS_MENU_ITEMS_META.minWidth + 20,
        maxHeight: "min(340px, calc(100vh - 16px))",
        display: "flex",
        flexDirection: "column",
        background: "var(--card)",
        border: "1px solid rgba(var(--border-rgb),0.14)",
        borderRadius: 16,
        boxShadow: "0 20px 44px -16px rgba(0,0,0,0.4), 0 2px 8px -2px rgba(0,0,0,0.15)",
        zIndex: 1000,
        overflow: "hidden",
        animation: `${coords?.openUpward ? "scaleInUp" : "scaleIn"} 0.18s cubic-bezier(0.22,1,0.36,1) both`,
        transformOrigin: coords?.openUpward ? "bottom" : "top",
        backdropFilter: "blur(20px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px 8px", flexShrink: 0 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted)" }}>
          {tr(isAr, "More", "المزيد")}
        </span>
        <button
          type="button"
          aria-label={tr(isAr, "Close", "إغلاق")}
          onClick={() => setOpen(false)}
          className="lift-hover"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", color: "var(--icon-muted)", background: "var(--input-bg)", border: "none", cursor: "pointer" }}
        >
          <XIcon size={12} />
        </button>
      </div>
      <div style={{ overflowY: "auto", overscrollBehavior: "contain", padding: "0 6px 6px", display: "flex", flexDirection: "column", gap: 1 }}>
        <MenuItem menuKey="leaderboard" icon={<TrophyIcon size={14} />} tint="#d4a017" label={tr(isAr, "Leaderboard", "الترتيب")} onClick={onLeaderboard} />
        <MenuItem menuKey="stats" icon={<StatsIcon size={14} />} tint="#5b8def" label={tr(isAr, "Stats", "إحصائياتي")} onClick={onStats} />
        <MenuItem menuKey="quiz" icon={<QuizIcon size={14} />} tint="#af52de" label={tr(isAr, "Quiz", "اختبار")} onClick={onQuiz} />
        <MenuItem menuKey="flashcards" icon={<LayersIcon size={14} />} tint="#ff9f0a" label={tr(isAr, "Flashcards", "بطاقات تعليمية")} onClick={onFlashcards} />
        <div style={{ height: 1, background: "rgba(var(--border-rgb),0.12)", margin: "5px 6px" }} />
        <MenuItem menuKey="export" icon={<DownloadIcon size={14} />} tint="#34c759" label={tr(isAr, "Export CSV", "تصدير CSV")} onClick={onExport} disabled={exportDisabled} />
        <MenuItem menuKey="import" icon={<UploadIcon size={14} />} tint="#34c759" label={tr(isAr, "Import CSV", "استيراد CSV")} onClick={onImport} disabled={importing} loading={importing} />
      </div>
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
