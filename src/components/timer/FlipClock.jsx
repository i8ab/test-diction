import { useState, useEffect, useRef } from "react";

/**
 * Split-flap digit matching timer.css (.flip-digit / .flip-digit-flap).
 * Rapid second changes restart the flap toward the latest value (no freeze).
 */
export function FlipDigit({ value, color }) {
  const next = String(value);
  const [current, setCurrent] = useState(next);
  const [previous, setPrevious] = useState(next);
  const [animating, setAnimating] = useState(false);
  const [flipId, setFlipId] = useState(0);
  const currentRef = useRef(next);
  const endTimerRef = useRef(null);

  useEffect(() => {
    if (next === currentRef.current) return undefined;

    if (endTimerRef.current) {
      clearTimeout(endTimerRef.current);
      endTimerRef.current = null;
    }

    setPrevious(currentRef.current);
    setCurrent(next);
    currentRef.current = next;
    setAnimating(true);
    setFlipId((n) => n + 1);

    // Match flipDigitDown duration in timer.css (0.4s)
    endTimerRef.current = setTimeout(() => {
      setAnimating(false);
      endTimerRef.current = null;
    }, 400);

    return undefined;
  }, [next]);

  useEffect(() => {
    return () => {
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
    };
  }, []);

  return (
    <div className="flip-digit" style={color ? { color } : undefined} aria-hidden>
      <div className="flip-digit-card">
        {/* Static top half — shows the new digit */}
        <div className="flip-digit-half top">
          <span className="flip-digit-glyph">{current}</span>
        </div>
        {/* Static bottom half — shows old while flapping, then new */}
        <div className="flip-digit-half bottom">
          <span className="flip-digit-glyph">{animating ? previous : current}</span>
        </div>
        <div className="flip-digit-hinge" />
        {/* Animated top flap: folds down from previous → reveals new top */}
        {animating && (
          <div key={flipId} className="flip-digit-flap animating">
            <span className="flip-digit-glyph">{previous}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Renders a time string (e.g. "12:34" or "01:02:03") as flip cards. */
export function FlipClock({ text, color, fontFamily, fontSize }) {
  const chars = String(text || "00:00").split("");
  const n = chars.length;
  return (
    <div
      className="flip-clock"
      role="timer"
      aria-live="off"
      aria-label={text}
      style={{
        fontFamily: fontFamily || "inherit",
        fontSize: fontSize || "inherit",
        color: color || "inherit",
      }}
    >
      {chars.map((ch, i) => {
        // Keys from the end so "1:23" → "01:23" length change doesn't remount digits
        const fromEnd = n - 1 - i;
        if (ch === ":") {
          return (
            <span key={`sep-${fromEnd}`} className="flip-clock-sep">
              :
            </span>
          );
        }
        return <FlipDigit key={`d-${fromEnd}`} value={ch} color={color} />;
      })}
    </div>
  );
}
