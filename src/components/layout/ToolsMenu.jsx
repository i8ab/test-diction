import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { tr } from "../../lib/config/i18n";
import {
  MoreIcon, XIcon, TrophyIcon, StatsIcon, QuizIcon, LayersIcon,
  DownloadIcon, UploadIcon, LoaderIcon,
} from "../common/Icons";

// A radial (wheel) "more" menu: items fan out in an arc around the trigger
// button instead of dropping down as a list. Positioned in a fixed-position
// portal so it can escape any clipping ancestor, same approach the old
// dropdown used — just placed with polar coordinates instead of a rectangle.
const HUB_SIZE = 40;
const SATELLITE_SIZE = 46;
const RADIUS = 96;
const ARC_SPAN = 140; // degrees covered by the fan

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default function ToolsMenu({ accent, onLeaderboard, onStats, onQuiz, onFlashcards, onExport, exportDisabled, onImport, importing, isAr }) {
  const [open, setOpen] = useState(false);
  const [center, setCenter] = useState(null); // { x, y, openUpward } in viewport (fixed) coordinates
  const [hoverKey, setHoverKey] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const computeCenter = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < RADIUS + SATELLITE_SIZE;
    setCenter({ x: cx, y: cy, openUpward });
  }, []);

  useEffect(() => {
    if (!open) return;
    computeCenter();
    function onDocClick(e) {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onKeyDown(e) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("scroll", computeCenter, true);
    window.addEventListener("resize", computeCenter);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", computeCenter, true);
      window.removeEventListener("resize", computeCenter);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, computeCenter]);

  // Items no longer close the menu on click — the menu only closes when the
  // user explicitly wants it to: the hub button, an outside click, or Escape.
  function itemClick(fn) { fn(); }

  const items = [
    { key: "leaderboard", icon: <TrophyIcon size={18} />, tint: "#d4a017", label: tr(isAr, "Leaderboard", "الترتيب"), onClick: onLeaderboard },
    { key: "stats", icon: <StatsIcon size={18} />, tint: "#5b8def", label: tr(isAr, "Stats", "إحصائياتي"), onClick: onStats },
    { key: "quiz", icon: <QuizIcon size={18} />, tint: "#af52de", label: tr(isAr, "Quiz", "اختبار"), onClick: onQuiz },
    { key: "flashcards", icon: <LayersIcon size={18} />, tint: "#ff9f0a", label: tr(isAr, "Flashcards", "بطاقات تعليمية"), onClick: onFlashcards },
    { key: "export", icon: <DownloadIcon size={18} />, tint: "#34c759", label: tr(isAr, "Export CSV", "تصدير CSV"), onClick: onExport, disabled: exportDisabled },
    { key: "import", icon: importing ? <LoaderIcon size={18} /> : <UploadIcon size={18} />, tint: "#34c759", label: tr(isAr, "Import CSV", "استيراد CSV"), onClick: onImport, disabled: importing },
  ];

  const n = items.length;
  const startAngle = center?.openUpward ? 270 - ARC_SPAN / 2 : 90 - ARC_SPAN / 2;
  const step = n > 1 ? ARC_SPAN / (n - 1) : 0;

  const menu = open && center && (
    <div ref={menuRef} role="menu" style={{ position: "fixed", inset: 0, zIndex: 1000, pointerEvents: "none" }}>
      <style>{`
        @keyframes toolsWheelRing { from { transform: scale(0.2); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes toolsWheelPop { from { transform: scale(0.2) translate(var(--hx,0), var(--hy,0)); opacity: 0; } to { transform: scale(1) translate(0, 0); opacity: 1; } }
        .tools-wheel-hub { animation: toolsWheelRing 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }
        .tools-wheel-item { transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s ease, border-color 0.22s ease; }
        .tools-wheel-item:hover:not(:disabled) { transform: scale(1.22); box-shadow: 0 12px 26px -8px rgba(0,0,0,0.5); }
        .tools-wheel-item:active:not(:disabled) { transform: scale(1.05); }
        .tools-wheel-label { transition: opacity 0.15s ease, transform 0.15s ease; }
      `}</style>
      {/* Soft glow ring behind the hub, purely decorative, echoes the wheel look */}
      <div
        className="tools-wheel-hub"
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
        const hx = center.x - x, hy = center.y - y; // pop out from the hub's position
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
                animation: `toolsWheelPop 0.32s cubic-bezier(0.22,1,0.36,1) both`,
                animationDelay: `${i * 0.03}s`,
                "--hx": `${hx}px`,
                "--hy": `${hy}px`,
              }}
            >
              {it.icon}
            </button>
            <span
              className="tools-wheel-label"
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
      {/* Hub itself: a close button sitting where the trigger is, so tapping
          the center — same spot the user just tapped to open it — closes it. */}
      <button
        type="button"
        aria-label={tr(isAr, "Close", "إغلاق")}
        onClick={() => setOpen(false)}
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
        }}
      >
        <XIcon size={16} />
      </button>
    </div>
  );

  return (
    <div className="toolbar-anim" style={{ position: "relative", animationDelay: "0.06s" }}>
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
          transition: "background 0.2s ease, color 0.2s ease",
          opacity: open ? 0 : 1,
          pointerEvents: open ? "none" : "auto",
        }}
      >
        <MoreIcon size={18} />
      </button>
      {open && typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </div>
  );
}
