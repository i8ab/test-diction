/**
 * Liquid / water-style progress bar for any long-running load on the site.
 * Supports determinate (0–100) and indeterminate modes.
 */
export default function WaterProgressBar({
  progress = null,
  label = "",
  height = 12,
  showPercent = true,
  className = "",
}) {
  const determinate = progress != null && Number.isFinite(progress);
  const pct = determinate ? Math.max(0, Math.min(100, Math.round(progress))) : null;

  return (
    <div className={`water-progress ${className}`.trim()} style={{ width: "100%" }}>
      {(label || (showPercent && determinate)) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
            gap: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--muted-strong, #94a3b8)",
          }}
        >
          <span>{label}</span>
          {showPercent && determinate && (
            <span style={{ fontVariantNumeric: "tabular-nums", direction: "ltr" }}>{pct}%</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={determinate ? pct : undefined}
        aria-busy={!determinate || pct < 100}
        aria-label={label || "Loading progress"}
        className="water-progress-track"
        style={{
          position: "relative",
          height,
          borderRadius: 999,
          overflow: "hidden",
          background: "rgba(148, 163, 184, 0.22)",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.15)",
        }}
      >
        <div
          className={determinate ? "water-progress-fill" : "water-progress-fill water-progress-indeterminate"}
          style={{
            position: "absolute",
            insetBlock: 0,
            insetInlineStart: 0,
            width: determinate ? `${pct}%` : "40%",
            borderRadius: 999,
            transition: determinate ? "width 0.25s ease-out" : undefined,
            background:
              "linear-gradient(180deg, rgba(125,211,252,0.95) 0%, rgba(56,189,248,0.9) 35%, rgba(14,165,233,0.95) 70%, rgba(2,132,199,1) 100%)",
            boxShadow: "0 0 12px rgba(56, 189, 248, 0.45)",
            overflow: "hidden",
          }}
        >
          <span className="water-wave water-wave-1" aria-hidden="true" />
          <span className="water-wave water-wave-2" aria-hidden="true" />
        </div>
      </div>
      <style>{`
        .water-wave {
          position: absolute;
          left: -50%;
          width: 200%;
          height: 200%;
          top: 30%;
          border-radius: 40%;
          opacity: 0.45;
          pointer-events: none;
        }
        .water-wave-1 {
          background: radial-gradient(ellipse at center, rgba(255,255,255,0.55) 0%, transparent 60%);
          animation: water-wave-move 2.8s linear infinite;
        }
        .water-wave-2 {
          background: radial-gradient(ellipse at center, rgba(255,255,255,0.35) 0%, transparent 55%);
          animation: water-wave-move 4.2s linear infinite reverse;
          top: 45%;
        }
        @keyframes water-wave-move {
          0% { transform: translateX(0) rotate(0deg); }
          100% { transform: translateX(25%) rotate(360deg); }
        }
        .water-progress-indeterminate {
          animation: water-slide 1.6s ease-in-out infinite;
        }
        @keyframes water-slide {
          0% { inset-inline-start: -40%; }
          50% { inset-inline-start: 60%; }
          100% { inset-inline-start: -40%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .water-wave-1, .water-wave-2, .water-progress-indeterminate {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
