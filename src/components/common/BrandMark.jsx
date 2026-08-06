/**
 * Site brand: Bacaloria Community — animated logo + title.
 * size: "sm" | "md" | "lg"
 */
export default function BrandMark({ size = "md", showUnderline = false }) {
  const cfg = {
    sm: { badge: 32, font: 16, gap: 8, radius: 10, letter: 13 },
    md: { badge: 38, font: 18, gap: 10, radius: 11, letter: 15 },
    lg: { badge: 48, font: 22, gap: 12, radius: 14, letter: 18 },
  }[size] || { badge: 38, font: 18, gap: 10, radius: 11, letter: 15 };

  return (
    <div className="brand-mark" style={{ display: "inline-flex", alignItems: "center", gap: cfg.gap }}>
      <div
        className="brand-mark-badge"
        aria-hidden="true"
        style={{
          width: cfg.badge,
          height: cfg.badge,
          borderRadius: cfg.radius,
          position: "relative",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, var(--accent-1), var(--accent-2))",
          color: "#fff",
          boxShadow: "0 6px 16px -6px color-mix(in srgb, var(--accent-1) 55%, transparent)",
        }}
      >
        <span
          className="brand-mark-badge-shine"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            overflow: "hidden",
            pointerEvents: "none",
          }}
        />
        <span
          style={{
            position: "relative",
            zIndex: 1,
            fontFamily: "'Fraunces', serif",
            fontWeight: 700,
            fontSize: cfg.letter,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          B
        </span>
        <span
          className="brand-mark-ring"
          style={{
            position: "absolute",
            inset: -4,
            borderRadius: cfg.radius + 4,
            border: "1.5px solid color-mix(in srgb, var(--accent-1) 40%, transparent)",
            pointerEvents: "none",
          }}
        />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          className="brand-mark-title"
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: cfg.font,
            fontWeight: 600,
            color: "var(--ink)",
            margin: 0,
            lineHeight: 1.15,
            whiteSpace: "nowrap",
            WebkitTextFillColor: "transparent",
          }}
        >
          Bacaloria{" "}
          <span className="brand-mark-accent">Community</span>
        </div>
        {showUnderline && (
          <div
            className="brand-mark-underline"
            style={{
              width: 36,
              height: 3,
              borderRadius: 2,
              background: "linear-gradient(90deg, var(--accent-1), var(--accent-2))",
              marginTop: 6,
            }}
          />
        )}
      </div>
    </div>
  );
}
