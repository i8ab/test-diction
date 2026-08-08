// Shared layout for every unauthenticated screen: a centered card (Shell)
// with drifting background "orbs", plus the language picker shown on the
// intro page and the login card.
import { tr, UI_LANGS } from "../../lib/config/i18n";
import { PAPER } from "../../lib/config/theme";
import { GlobeIcon } from "../common/Icons";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

function LanguageToggle({ lang = "en", onChangeLang, isAr, onToggle, floating = true }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const current = UI_LANGS.find((l) => l.id === (lang || (isAr ? "ar" : "en"))) || UI_LANGS[0];

  // Position the dropdown with fixed coords so overflow on parents never clips it
  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    function place() {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const menuWidth = 168;
      // Prefer aligning to the end (right in LTR, left in RTL) of the button
      let left = r.right - menuWidth;
      if (left < 8) left = 8;
      if (left + menuWidth > window.innerWidth - 8) left = Math.max(8, window.innerWidth - menuWidth - 8);
      let top = r.bottom + 6;
      // If not enough space below, open upward
      if (top + 200 > window.innerHeight && r.top > 200) {
        top = Math.max(8, r.top - 6 - 180);
      }
      setMenuPos({ top, left, width: menuWidth });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (ref.current && ref.current.contains(e.target)) return;
      // also ignore clicks inside the portaled menu
      const menu = document.getElementById("lang-toggle-menu");
      if (menu && menu.contains(e.target)) return;
      setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    // use click (not pointerdown) so option onClick always fires first
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pickLang(id) {
    if (typeof onChangeLang === "function") {
      onChangeLang(id);
    } else if (typeof onToggle === "function") {
      onToggle();
    }
    setOpen(false);
  }

  // Prefer multi-lang picker when onChangeLang is provided
  if (typeof onChangeLang === "function") {
    const menu = open && menuPos && createPortal(
      <div
        id="lang-toggle-menu"
        role="listbox"
        style={{
          position: "fixed",
          top: menuPos.top,
          left: menuPos.left,
          width: menuPos.width,
          minWidth: 160,
          background: "var(--card)",
          border: "1px solid rgba(var(--border-rgb),0.16)",
          borderRadius: 12,
          boxShadow: "0 12px 28px -10px rgba(0,0,0,0.35)",
          padding: 6,
          zIndex: 99999,
        }}
      >
        {UI_LANGS.map((l) => {
          const active = l.id === current.id;
          return (
            <button
              key={l.id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                pickLang(l.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                display: "block",
                width: "100%",
                textAlign: "start",
                padding: "9px 12px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: active ? 700 : 600,
                background: active ? "var(--input-bg)" : "transparent",
                color: "var(--ink)",
              }}
            >
              {l.native}
            </button>
          );
        })}
      </div>,
      document.body
    );

    return (
      <div
        ref={ref}
        style={{
          ...(floating ? { position: "absolute", top: 14, insetInlineEnd: 14 } : {}),
          zIndex: 50,
          position: floating ? "absolute" : "relative",
        }}
      >
        <button
          ref={btnRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          aria-label={tr(lang, "Language", "اللغة", "Sprache", "Langue")}
          aria-expanded={open}
          className="lift-hover"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--icon-muted)",
            background: "var(--input-bg)",
            border: "1px solid rgba(var(--border-rgb),0.2)",
            borderRadius: 20,
            cursor: "pointer",
            fontFamily: "'Source Sans 3', sans-serif",
          }}
        >
          <GlobeIcon size={13} />
          {current.native}
        </button>
        {menu}
      </div>
    );
  }

  // Legacy en/ar toggle
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={tr(!!isAr, "Switch to Arabic", "التبديل إلى الإنجليزية")}
      className="lift-hover"
      style={{
        ...(floating ? { position: "absolute", top: 14, insetInlineEnd: 14 } : {}),
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--icon-muted)",
        background: "var(--input-bg)",
        border: "1px solid rgba(var(--border-rgb),0.2)",
        borderRadius: 20,
        cursor: "pointer",
        fontFamily: "'Source Sans 3', sans-serif",
      }}
    >
      <GlobeIcon size={13} />
      {isAr ? "English" : "العربية"}
    </button>
  );
}

function Shell({ children }) {
  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: PAPER, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(var(--border-rgb),0.05) 1px, transparent 0)", backgroundSize: "20px 20px", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(12px, 3vw, 28px)", overflowX: "clip", overflowY: "auto" }}>
      {/* Static soft washes — no continuous animation (avoids jank on login) */}
      <div className="auth-orb" style={{ width: 300, height: 300, top: "-8%", insetInlineStart: "-6%", background: "radial-gradient(circle, color-mix(in srgb, var(--accent-1) 50%, transparent) 0%, transparent 70%)", animation: "none", opacity: 0.4, willChange: "auto" }} />
      <div className="auth-orb" style={{ width: 240, height: 240, bottom: "-8%", insetInlineEnd: "-4%", background: "radial-gradient(circle, color-mix(in srgb, var(--accent-2) 40%, transparent) 0%, transparent 70%)", animation: "none", opacity: 0.35, willChange: "auto" }} />
      <div style={{ position: "relative", zIndex: 1, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

export { Shell, LanguageToggle };
