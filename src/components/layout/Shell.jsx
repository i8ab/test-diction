// Shared layout for every unauthenticated screen: a centered card (Shell)
// with drifting background "orbs", plus the language picker shown on the
// intro page and the login card.
import { tr, UI_LANGS } from "../../lib/config/i18n";
import { PAPER } from "../../lib/config/theme";
import { GlobeIcon } from "../common/Icons";
import { useState, useEffect, useRef } from "react";

function LanguageToggle({ lang = "en", onChangeLang, isAr, onToggle, floating = true }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = UI_LANGS.find((l) => l.id === (lang || (isAr ? "ar" : "en"))) || UI_LANGS[0];

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Prefer multi-lang picker when onChangeLang is provided
  if (typeof onChangeLang === "function") {
    return (
      <div ref={ref} style={{ ...(floating ? { position: "absolute", top: 14, insetInlineEnd: 14 } : {}), zIndex: 20 }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={tr(lang, "Language", "اللغة", "Sprache", "Langue")}
          aria-expanded={open}
          className="lift-hover"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 10px", fontSize: 12, fontWeight: 600,
            color: "var(--icon-muted)", background: "var(--input-bg)",
            border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 20,
            cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif",
          }}
        >
          <GlobeIcon size={13} />
          {current.native}
        </button>
        {open && (
          <div
            role="listbox"
            style={{
              position: "absolute", top: "calc(100% + 6px)", insetInlineEnd: 0,
              minWidth: 160, background: "var(--card)",
              border: "1px solid rgba(var(--border-rgb),0.16)", borderRadius: 12,
              boxShadow: "0 12px 28px -10px rgba(0,0,0,0.35)",
              padding: 6, zIndex: 30,
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
                  onClick={() => { onChangeLang(l.id); setOpen(false); }}
                  style={{
                    display: "block", width: "100%", textAlign: "start",
                    padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: active ? 700 : 600,
                    background: active ? "var(--input-bg)" : "transparent",
                    color: "var(--ink)",
                  }}
                >
                  {l.native}
                </button>
              );
            })}
          </div>
        )}
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
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 10px", fontSize: 12, fontWeight: 600,
        color: "var(--icon-muted)", background: "var(--input-bg)",
        border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 20,
        cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif",
      }}
    >
      <GlobeIcon size={13} />
      {isAr ? "English" : "العربية"}
    </button>
  );
}

function Shell({ children }) {
  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: PAPER, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(var(--border-rgb),0.06) 1px, transparent 0)", backgroundSize: "18px 18px", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(12px, 3vw, 28px)", overflow: "hidden" }}>
      <div className="auth-orb" style={{ width: 320, height: 320, top: "-8%", insetInlineStart: "-6%", background: "radial-gradient(circle, var(--accent-1) 0%, transparent 70%)", animationDuration: "12s" }} />
      <div className="auth-orb" style={{ width: 260, height: 260, bottom: "-8%", insetInlineEnd: "-4%", background: "radial-gradient(circle, var(--accent-2) 0%, transparent 70%)", animationDuration: "14s", animationDelay: "-4s" }} />
      <div className="auth-orb" style={{ width: 180, height: 180, top: "38%", insetInlineEnd: "8%", background: "radial-gradient(circle, var(--focus-rgb, 25,167,206), transparent 70%)", opacity: 0.28, animationDuration: "9s", animationDelay: "-2s" }} />
      <div style={{ position: "relative", zIndex: 1, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

export { Shell, LanguageToggle };
