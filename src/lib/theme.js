// Shared theme tokens and small style objects used across the app.

const INK = "var(--ink)", PAPER = "var(--paper)", CARD = "var(--card)", BRASS = "var(--accent-1)";

const labelStyle = { display: "block", fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted-strong)", margin: "14px 0 6px" };
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px 12px", fontFamily: "'Source Sans 3', sans-serif", fontSize: 15, color: INK, background: "var(--input-bg)", border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 3 };
const errorStyle = { marginTop: 12, fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: "var(--danger)", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 3, padding: "8px 10px", animation: "staggerIn 0.3s ease both" };

export { INK, PAPER, CARD, BRASS, labelStyle, inputStyle, errorStyle };
