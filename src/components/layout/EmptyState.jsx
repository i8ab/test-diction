import { tr } from "../../lib/config/i18n";
import { INK, emptyStateStyle } from "../../lib/config/theme";
import { PlusIcon } from "../common/Icons";

/**
 * Polished empty dictionary / no-results state.
 * Calm focused aesthetic with soft dashed card + primary CTA.
 */
export default function EmptyState({ hasQuery, onAdd, accent, isAr }) {
  return (
    <div
      className="empty-state-card"
      style={emptyStateStyle}
      role="status"
      aria-live="polite"
    >
      <div
        className="empty-state-icon"
        aria-hidden="true"
        style={{
          width: 52,
          height: 52,
          margin: "0 auto 16px",
          borderRadius: "14px 16px 12px 15px",
          display: "grid",
          placeItems: "center",
          background: "color-mix(in srgb, var(--accent-1) 14%, transparent)",
          color: "var(--accent-1)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.12) inset",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <path d="M8 7h8M8 11h5" strokeLinecap="round" />
        </svg>
      </div>

      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 18,
          fontWeight: 600,
          color: INK,
          margin: "0 0 6px",
          letterSpacing: "-0.01em",
        }}
      >
        {hasQuery
          ? tr(isAr, "No entries match your search", "لا توجد نتائج مطابقة لبحثك")
          : tr(isAr, "This dictionary is empty", "هذا القاموس فارغ")}
      </p>

      <p style={{ fontSize: 14, margin: "0 0 20px", lineHeight: 1.5, opacity: 0.9 }}>
        {hasQuery
          ? tr(isAr, "Try a different word.", "جرّب كلمة أخرى.")
          : tr(isAr, "Be the first to add a word.", "كن أول من يضيف كلمة.")}
      </p>

      {!hasQuery && (
        <button
          type="button"
          onClick={onAdd}
          className="lift-hover empty-state-cta"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 18px",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--on-accent, #fff)",
            background: accent || "var(--accent-1)",
            border: "1px solid color-mix(in srgb, var(--accent-1) 65%, black)",
            borderRadius: "11px 13px 10px 12px",
            cursor: "pointer",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.16) inset, 0 8px 18px -10px rgba(var(--focus-rgb),0.5)",
            fontFamily: "var(--font-latin)",
          }}
        >
          <PlusIcon size={16} />
          {tr(isAr, "Add word", "إضافة كلمة")}
        </button>
      )}
    </div>
  );
}
