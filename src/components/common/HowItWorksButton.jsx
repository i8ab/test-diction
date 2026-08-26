import { BookIcon } from "./Icons";
import { tr } from "../../lib/config/i18n";

/**
 * Global open helper — MainView listens for "twoTongues:openInfoGuide".
 * detail: { guideId?: string }
 */
export function openHowItWorks(guideId) {
  try {
    window.dispatchEvent(
      new CustomEvent("twoTongues:openInfoGuide", {
        detail: { guideId: guideId || null },
      })
    );
  } catch (_) {}
}

/**
 * Compact "How it works" control for modal / page headers.
 * Place next to the close (X) button so it is always visible on top.
 */
export default function HowItWorksButton({
  isAr = false,
  guideId = null,
  label,
  size = 15,
  style = {},
  className = "",
}) {
  const text =
    label != null
      ? label
      : tr(isAr, "How it works", "كيف يعمل");

  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        openHowItWorks(guideId);
      }}
      aria-label={text}
      title={text}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: "1px solid rgba(var(--border-rgb, 120,120,120), 0.22)",
        background: "var(--input-bg, rgba(0,0,0,0.04))",
        color: "var(--ink, inherit)",
        cursor: "pointer",
        borderRadius: 10,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.2,
        flexShrink: 0,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <BookIcon size={size} />
      <span>{text}</span>
    </button>
  );
}
