import { useState, useEffect, useRef, memo } from "react";

/**
 * Split-flap digit matching digitalclock.live / classic FlipClock mechanics:
 *   .flip > .digital.front (old) + .digital.back (new)
 *   each half via ::before (top) / ::after (bottom)
 *   on change: add .running → frontFlipDown + backFlipDown (0.6s)
 */
function FlipDigit({ value }) {
  const next = String(value);
  const [front, setFront] = useState(next);
  const [back, setBack] = useState(next);
  const [running, setRunning] = useState(false);
  const currentRef = useRef(next);
  const timerRef = useRef(null);

  useEffect(() => {
    if (next === currentRef.current) return undefined;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Front keeps the old digit; back gets the new one; play the flip.
    setFront(currentRef.current);
    setBack(next);
    setRunning(true);

    timerRef.current = setTimeout(() => {
      // Settle: both faces show the new digit, remove animation class
      currentRef.current = next;
      setFront(next);
      setBack(next);
      setRunning(false);
      timerRef.current = null;
    }, 600); // match frontFlipDown / backFlipDown duration

    return undefined;
  }, [next]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className={`tt-flip${running ? " running" : ""}`} aria-hidden>
      <div className="tt-digital front" data-number={front} />
      <div className="tt-digital back" data-number={back} />
    </div>
  );
}

const MemoDigit = memo(FlipDigit);

/** Fixed-width plain digits — no vertical/horizontal jump between glyphs. */
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

/** Full flip-clock row — same card/hinge/animation model as digitalclock.live */
export function FlipClock({ text, color, fontFamily, fontSize }) {
  const chars = String(text || "00:00").split("");
  const n = chars.length;
  return (
    <div
      className="tt-flip-clock"
      role="timer"
      aria-live="off"
      aria-label={text}
      style={{
        fontFamily: fontFamily || "inherit",
        fontSize: fontSize || "inherit",
        color: color || "inherit",
        // CSS variables drive card fill from the active text color
        ["--tt-flip-fg"]: color || "currentColor",
      }}
    >
      {chars.map((ch, i) => {
        const fromEnd = n - 1 - i;
        if (ch === ":") {
          return (
            <span key={`sep-${fromEnd}`} className="tt-flip-divider">
              :
            </span>
          );
        }
        return <MemoDigit key={`d-${fromEnd}`} value={ch} />;
      })}
    </div>
  );
}
