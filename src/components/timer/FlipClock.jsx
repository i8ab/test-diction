import { useState, useEffect, useRef, memo } from "react";

/**
 * Full split-flap digit (top flap down + bottom flap up) matched to timer.css.
 * Fixed box geometry — parent layout does not move while flipping.
 */
function FlipDigit({ value }) {
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

    // Must match --flip-ms in timer.css (450ms)
    endTimerRef.current = setTimeout(() => {
      setAnimating(false);
      endTimerRef.current = null;
    }, 450);

    return undefined;
  }, [next]);

  useEffect(() => {
    return () => {
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
    };
  }, []);

  // While animating: static layers show the settle state (new on top, old on bottom
  // until flaps finish). Flaps carry previous→current motion.
  const topStatic = current;
  const botStatic = animating ? previous : current;

  return (
    <div className={`flip-digit${animating ? " is-flipping" : ""}`} aria-hidden>
      <div className="flip-digit-card">
        <div className="flip-digit-half top">
          <span className="flip-digit-glyph">{topStatic}</span>
        </div>
        <div className="flip-digit-half bottom">
          <span className="flip-digit-glyph">{botStatic}</span>
        </div>
        <div className="flip-digit-hinge" />
        {animating && (
          <>
            {/* Top flap: old digit folds down */}
            <div key={`up-${flipId}`} className="flip-digit-flap flap-top">
              <span className="flip-digit-glyph">{previous}</span>
            </div>
            {/* Bottom flap: new digit folds up into place */}
            <div key={`dn-${flipId}`} className="flip-digit-flap flap-bottom">
              <span className="flip-digit-glyph">{current}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const MemoDigit = memo(FlipDigit);

/** Fixed-width plain digits — prevents per-glyph vertical/horizontal jump. */
export function PlainDigits({ text, color, fontFamily, fontSize, textShadow }) {
  const chars = String(text || "00:00").split("");
  return (
    <div
      className="timer-plain-digits"
      role="timer"
      aria-live="off"
      aria-label={text}
      style={{
        fontFamily: fontFamily || "inherit",
        fontSize: fontSize || "inherit",
        color: color || "inherit",
        textShadow: textShadow || "none",
      }}
    >
      {chars.map((ch, i) =>
        ch === ":" ? (
          <span key={`s-${i}`} className="timer-plain-sep">
            :
          </span>
        ) : (
          <span key={`d-${i}`} className="timer-plain-cell">
            {ch}
          </span>
        )
      )}
    </div>
  );
}

/** Renders a time string as flip cards. */
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
        return <MemoDigit key={`d-${fromEnd}`} value={ch} />;
      })}
    </div>
  );
}
