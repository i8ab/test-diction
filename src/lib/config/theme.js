// Shared theme tokens and small style objects used across the app.

const INK = "var(--ink)", PAPER = "var(--paper)", CARD = "var(--card)", BRASS = "var(--accent-1)";

const labelStyle = { display: "block", fontFamily: "var(--font-latin)", fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-strong)", margin: "16px 0 7px" };
// Boxed inputs with consistent inner padding (text ↔ border spacing)
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px 12px", fontFamily: "var(--font-latin)", fontSize: 15.5, color: INK, background: "var(--input-bg, transparent)", border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 10 };
const errorStyle = { marginTop: 12, fontFamily: "var(--font-latin)", fontSize: 13, color: "var(--danger)", background: "var(--danger-bg)", borderInlineStart: "3px solid var(--danger)", borderRadius: "2px 8px 8px 2px", padding: "10px 14px", animation: "staggerIn 0.3s ease both" };

const primaryBtnStyle = { marginTop: 22, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 16px", fontFamily: "var(--font-latin)", fontSize: 15, fontWeight: 700, letterSpacing: "0.01em", color: "#fff", background: "var(--accent-1)", border: "1px solid color-mix(in srgb, var(--accent-1) 70%, black)", borderRadius: "9px 11px 8px 12px", cursor: "pointer", boxShadow: "0 1px 0 rgba(255,255,255,0.18) inset, 0 8px 18px -10px rgba(var(--focus-rgb),0.55)" };
// Deliberately uneven corners — a real card cut by hand is never four
// identical radii. Small enough that it just reads as "considered", not broken.
const authCardStyle = { position: "relative", width: "100%", maxWidth: 400, background: CARD, border: "1px solid rgba(var(--border-rgb),0.12)", borderRadius: "18px 14px 20px 12px", padding: "40px 34px 32px", boxShadow: "0 1px 0 rgba(255,255,255,0.4) inset, 0 18px 40px -22px rgba(var(--border-rgb),0.35)" };
const authInputStyle = { ...inputStyle };
const authBadgeWrapStyle = { position: "relative", width: 54, height: 54, borderRadius: "13px 15px 12px 16px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent-1)", boxShadow: "0 1px 0 rgba(255,255,255,0.2) inset, 0 8px 18px -8px rgba(var(--focus-rgb),0.5)", flexShrink: 0, transform: "rotate(-1.5deg)" };

// Social sign-in buttons — outlined, not filled, so they sit one visual
// step below the primary accent button rather than competing with it.
const socialBtnStyle = { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "12px 16px", fontFamily: "var(--font-latin)", fontSize: 14.5, fontWeight: 600, color: "var(--ink)", background: "var(--card)", border: "1.5px solid rgba(var(--border-rgb),0.22)", borderRadius: "10px 8px 11px 9px", cursor: "pointer" };

export { INK, PAPER, CARD, BRASS, labelStyle, inputStyle, errorStyle, primaryBtnStyle, authCardStyle, authInputStyle, authBadgeWrapStyle, socialBtnStyle };
