/**
 * Modern +/- number control. Replaces native browser number spinners.
 */
export default function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  disabled = false,
  width = 112,
  "aria-label": ariaLabel,
}) {
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : min;
  const atMin = safe <= min;
  const atMax = safe >= max;

  function clamp(n) {
    let v = Number(n);
    if (!Number.isFinite(v)) v = min;
    return Math.min(max, Math.max(min, v));
  }

  function bump(delta) {
    if (disabled) return;
    onChange?.(clamp(safe + delta));
  }

  function onInput(e) {
    const raw = e.target.value;
    if (raw === "" || raw === "-") {
      // allow empty while typing; commit on blur
      onChange?.(raw === "" ? min : safe);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChange?.(clamp(n));
  }

  const btnBase = {
    width: 32,
    height: 36,
    border: "none",
    background: "transparent",
    color: "var(--ink)",
    cursor: disabled ? "default" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    padding: 0,
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
    transition: "background 0.15s, color 0.15s, opacity 0.15s",
  };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "stretch",
        width,
        height: 36,
        borderRadius: 10,
        border: "1px solid rgba(var(--border-rgb),0.2)",
        background: "var(--input-bg)",
        overflow: "hidden",
        opacity: disabled ? 0.55 : 1,
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <button
        type="button"
        disabled={disabled || atMin}
        onClick={() => bump(-step)}
        aria-label="Decrease"
        style={{
          ...btnBase,
          borderInlineEnd: "1px solid rgba(var(--border-rgb),0.12)",
          opacity: atMin || disabled ? 0.35 : 1,
          cursor: atMin || disabled ? "default" : "pointer",
        }}
        onMouseDown={(e) => {
          if (!atMin && !disabled) e.currentTarget.style.background = "rgba(var(--border-rgb),0.12)";
        }}
        onMouseUp={(e) => { e.currentTarget.style.background = "transparent"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M5 12h14" />
        </svg>
      </button>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={Number.isFinite(num) ? String(safe) : ""}
        disabled={disabled}
        onChange={onInput}
        onBlur={() => onChange?.(clamp(safe))}
        aria-label={ariaLabel}
        style={{
          flex: 1,
          minWidth: 0,
          width: "100%",
          border: "none",
          background: "transparent",
          color: "var(--ink)",
          fontSize: 14,
          fontWeight: 700,
          fontFamily: "inherit",
          textAlign: "center",
          padding: "0 2px",
          outline: "none",
          WebkitAppearance: "none",
          MozAppearance: "textfield",
        }}
      />

      <button
        type="button"
        disabled={disabled || atMax}
        onClick={() => bump(step)}
        aria-label="Increase"
        style={{
          ...btnBase,
          borderInlineStart: "1px solid rgba(var(--border-rgb),0.12)",
          opacity: atMax || disabled ? 0.35 : 1,
          cursor: atMax || disabled ? "default" : "pointer",
        }}
        onMouseDown={(e) => {
          if (!atMax && !disabled) e.currentTarget.style.background = "rgba(var(--border-rgb),0.12)";
        }}
        onMouseUp={(e) => { e.currentTarget.style.background = "transparent"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
