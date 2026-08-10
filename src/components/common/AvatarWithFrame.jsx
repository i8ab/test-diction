import { useMemo } from "react";
import { loadXp, getUnlockedBadge, getUnlockedFrame } from "../../lib/state/xp";

/**
 * Avatar circle with optional level-unlocked frame + badge corner.
 * size: pixel diameter (default 40)
 */
export default function AvatarWithFrame({
  accountCode,
  avatarUrl,
  name,
  size = 40,
  onClick,
  title,
  style = {},
  className,
}) {
  const { frame, badge } = useMemo(() => {
    const total = loadXp(accountCode).total;
    return {
      frame: getUnlockedFrame(total),
      badge: getUnlockedBadge(total),
    };
  }, [accountCode]);

  const letter = String(name || "?").trim().slice(0, 2).toUpperCase() || "?";
  const border = frame?.border || "2px solid color-mix(in srgb, var(--accent-1) 45%, transparent)";
  const boxShadow = frame?.glow || undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={className}
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        border,
        boxShadow,
        padding: 0,
        overflow: "visible",
        cursor: onClick ? "pointer" : "default",
        background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
        color: "#fff",
        fontWeight: 800,
        fontSize: Math.max(11, Math.round(size * 0.32)),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      <span
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          letter
        )}
      </span>
      {badge && (
        <span
          title={badge.en}
          style={{
            position: "absolute",
            bottom: -2,
            insetInlineEnd: -2,
            width: Math.max(16, Math.round(size * 0.42)),
            height: Math.max(16, Math.round(size * 0.42)),
            borderRadius: "50%",
            background: "#fff",
            border: `1.5px solid ${badge.color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.max(9, Math.round(size * 0.28)),
            lineHeight: 1,
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            zIndex: 2,
          }}
        >
          {badge.emoji}
        </span>
      )}
    </button>
  );
}
