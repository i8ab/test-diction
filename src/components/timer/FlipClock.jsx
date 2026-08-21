import { useState, useEffect, useRef } from "react";

/**
 * Split-flap digit (flipclock.online style).
 * No busy-lock: rapid second changes must never freeze a digit.
 */
export function FlipDigit({ value, color }) {
  const next = String(value);
  const [display, setDisplay] = useState(next);
  const [from, setFrom] = useState(next);
  const [flipId, setFlipId] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const displayRef = useRef(next);
  const endTimerRef = useRef(null);

  useEffect(() => {
    if (next === displayRef.current) return undefined;

    // Restart flip toward the latest value (even mid-animation)
    if (endTimerRef.current) {
      clearTimeout(endTimerRef.current);
      endTimerRef.current = null;
    }

    setFrom(displayRef.current);
    setDisplay(next);
    displayRef.current = next;
    setFlipping(true);
    setFlipId((n) => n + 1);

    endTimerRef.current = setTimeout(() => {
      setFlipping(false);
      endTimerRef.current = null;
    }, 600);

    return undefined; // do not clear the end timer on dependency change
  }, [next]);

  useEffect(() => {
    return () => {
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
    };
  }, []);

  return (
    <div
      className={`tt-flip${flipping ? " tt-go" : ""}`}
      style={color ? { color } : undefined}
      aria-hidden
    >
      <div className="tt-top">
        <span>{display}</span>
      </div>
      <div className="tt-bot">
        <span>{flipping ? from : display}</span>
      </div>
      {flipping && (
        <>
          <div key={`t-${flipId}`} className="tt-fold-top">
            <span>{from}</span>
          </div>
          <div key={`b-${flipId}`} className="tt-fold-bot">
            <span>{display}</span>
          </div>
        </>
      )}
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

