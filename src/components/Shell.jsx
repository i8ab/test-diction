// Shared layout for every unauthenticated screen: a centered card (Shell)
// with drifting background "orbs", plus the language toggle button shown
// on both the intro page and the login card.
import { tr } from "../lib/i18n";
import { PAPER } from "../lib/theme";
import { GlobeIcon } from "./Icons";

function LanguageToggle({ isAr, onToggle, floating = true }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={tr(isAr, "Switch to Arabic", "التبديل إلى الإنجليزية")}
      className="lift-hover"
      style={{
        ...(floating ? { position: "absolute", top: 14, insetInlineEnd: 14 } : {}),
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 10px", fontSize: 12, fontWeight: 600,
        color: "var(--icon-muted)", background: "var(--input-bg)",
        border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 20,
        cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif",
      }}>
      <GlobeIcon size={13} />
      {isAr ? "English" : "العربية"}
    </button>
  );
}

function Shell({ children }) {
  return (
    <div style={{ position: "relative", minHeight: "100vh", background: PAPER, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(var(--border-rgb),0.06) 1px, transparent 0)", backgroundSize: "18px 18px", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden" }}>
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
