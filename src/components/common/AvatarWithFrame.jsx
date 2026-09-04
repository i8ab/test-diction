import { useState, useEffect, useId } from "react";
import { getEquippedBadge, getEquippedFrame } from "../../lib/state/xp";

/**
 * Avatar circle with optional level-unlocked frame + badge corner.
 * Uses the user's equipped choice from Account settings when set.
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
  const [tick, setTick] = useState(0);
  const reactId = useId();
  const letterId = `avatar-letter-${reactId}`;
  const titleId = `avatar-title-${reactId}`;

  useEffect(() => {
    function onCosmetics() {
      setTick((n) => n + 1);
    }
    window.addEventListener("twotongues:cosmetics", onCosmetics);
    return () => window.removeEventListener("twotongues:cosmetics", onCosmetics);
  }, []);

  void tick;
  const frame = getEquippedFrame(accountCode);
  const badge = getEquippedBadge(accountCode);

  const letter = String(name || "?").trim().slice(0, 2).toUpperCase() || "?";
  const border = frame?.border || "2px solid color-mix(in srgb, var(--accent-1) 45%, transparent)";
  const boxShadow = frame?.glow || undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={avatarUrl ? title : undefined}
      aria-labelledby={avatarUrl ? undefined : `${letterId} ${titleId}`}
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
        color: "var(--on-accent, #fff)",
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
        id={avatarUrl ? undefined : letterId}
        aria-hidden={avatarUrl ? "true" : undefined}
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
      {!avatarUrl && (
        <span
          id={titleId}
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          {title}
        </span>
      )}
      {badge && (
        <span
          aria-hidden="true"
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
