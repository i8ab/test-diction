// Shared theme tokens and small style objects used across the app.
// Production-ready design tokens — calm focused modern aesthetic.

const INK = "var(--ink)", PAPER = "var(--paper)", CARD = "var(--card)", BRASS = "var(--accent-1)";

const labelStyle = {
  display: "block",
  fontFamily: "var(--font-latin)",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--muted-strong)",
  margin: "16px 0 7px",
};

// Boxed inputs with consistent inner padding (text ↔ border spacing)
const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 14px",
  fontFamily: "var(--font-latin)",
  fontSize: 15.5,
  color: INK,
  background: "var(--input-bg, transparent)",
  border: "1px solid rgba(var(--border-rgb),0.22)",
  borderRadius: 12,
  transition: "border-color 0.18s ease, box-shadow 0.18s ease",
};

const errorStyle = {
  marginTop: 12,
  fontFamily: "var(--font-latin)",
  fontSize: 13,
  color: "var(--danger)",
  background: "var(--danger-bg)",
  borderInlineStart: "3px solid var(--danger)",
  borderRadius: "2px 10px 10px 2px",
  padding: "10px 14px",
  animation: "staggerIn 0.3s ease both",
};

const primaryBtnStyle = {
  marginTop: 22,
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "14px 18px",
  fontFamily: "var(--font-latin)",
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "0.01em",
  color: "var(--on-accent, #fff)",
  background: "var(--accent-1)",
  border: "1px solid color-mix(in srgb, var(--accent-1) 70%, black)",
  borderRadius: "12px 14px 11px 13px",
  cursor: "pointer",
  boxShadow:
    "0 1px 0 rgba(255,255,255,0.18) inset, 0 8px 20px -10px rgba(var(--focus-rgb),0.55)",
  transition: "transform 0.15s ease, box-shadow 0.2s ease, filter 0.15s ease",
};

// Deliberately uneven corners — a real card cut by hand is never four
// identical radii. Small enough that it just reads as "considered", not broken.
const authCardStyle = {
  position: "relative",
  width: "100%",
  maxWidth: 400,
  background: CARD,
  border: "1px solid rgba(var(--border-rgb),0.14)",
  borderRadius: "20px 16px 22px 14px",
  padding: "42px 36px 34px",
  boxShadow:
    "0 1px 0 rgba(255,255,255,0.35) inset, 0 22px 48px -24px rgba(var(--border-rgb),0.4)",
};

const authInputStyle = { ...inputStyle };

const authBadgeWrapStyle = {
  position: "relative",
  width: 56,
  height: 56,
  borderRadius: "14px 16px 13px 17px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--accent-1)",
  boxShadow:
    "0 1px 0 rgba(255,255,255,0.22) inset, 0 10px 22px -8px rgba(var(--focus-rgb),0.55)",
  flexShrink: 0,
  transform: "rotate(-1.5deg)",
};

// Social sign-in buttons — outlined, not filled, so they sit one visual
// step below the primary accent button rather than competing with it.
const socialBtnStyle = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "12px 16px",
  fontFamily: "var(--font-latin)",
  fontSize: 14.5,
  fontWeight: 600,
  color: "var(--ink)",
  background: "var(--card)",
  border: "1.5px solid rgba(var(--border-rgb),0.24)",
  borderRadius: "11px 9px 12px 10px",
  cursor: "pointer",
  transition: "background 0.15s ease, border-color 0.15s ease, transform 0.12s ease",
};

// Empty-state card — refined dashed container
const emptyStateStyle = {
  textAlign: "center",
  padding: "56px 24px",
  color: "var(--muted-strong)",
  border: "1.5px dashed rgba(var(--border-rgb),0.28)",
  borderRadius: "18px 14px 20px 12px",
  background: "color-mix(in srgb, var(--card) 55%, transparent)",
};

export {
  INK,
  PAPER,
  CARD,
  BRASS,
  labelStyle,
  inputStyle,
  errorStyle,
  primaryBtnStyle,
  authCardStyle,
  authInputStyle,
  authBadgeWrapStyle,
  socialBtnStyle,
  emptyStateStyle,
};
