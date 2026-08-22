// Shared theme tokens and small style objects used across the app.

const INK = "var(--ink)", PAPER = "var(--paper)", CARD = "var(--card)", BRASS = "var(--accent-1)";

const labelStyle = { display: "block", fontFamily: "var(--font-latin)", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted-strong)", margin: "14px 0 6px" };
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px 12px", fontFamily: "var(--font-latin)", fontSize: 15, color: INK, background: "var(--input-bg)", border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 3 };
const errorStyle = { marginTop: 12, fontFamily: "var(--font-latin)", fontSize: 13, color: "var(--danger)", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 3, padding: "8px 10px", animation: "staggerIn 0.3s ease both" };

const primaryBtnStyle = { marginTop: 20, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 14px", fontFamily: "var(--font-latin)", fontSize: 15, fontWeight: 700, letterSpacing: "0.01em", color: "#fff", background: "var(--accent-1)", border: "none", borderRadius: 8, cursor: "pointer", boxShadow: "0 2px 8px -2px rgba(var(--focus-rgb),0.35)" };
const authCardStyle = { position: "relative", width: "100%", maxWidth: 400, background: CARD, border: "1px solid rgba(var(--border-rgb),0.15)", borderRadius: 12, padding: "34px 30px 30px", boxShadow: "0 2px 0 rgba(0,0,0,0.06), 0 24px 60px -20px rgba(var(--border-rgb),0.4)" };
const authInputStyle = { ...inputStyle, borderRadius: 8, padding: "11px 13px" };
const authBadgeWrapStyle = { position: "relative", width: 56, height: 56, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent-1)", boxShadow: "0 3px 10px -3px rgba(var(--focus-rgb),0.4)", flexShrink: 0 };

export { INK, PAPER, CARD, BRASS, labelStyle, inputStyle, errorStyle, primaryBtnStyle, authCardStyle, authInputStyle, authBadgeWrapStyle };
