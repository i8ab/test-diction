import { useState, useEffect, useRef, memo, useCallback } from "react";

/**
 * Flip digit — same DOM + timing as digitalclock.live:
 *   <div class="flip">
 *     <div class="digital front" data-number="…"></div>
 *     <div class="digital back" data-number="…"></div>
 *   </div>
 * flipDown(current, next) → set front/back → add .running → animationend settle
 */
function FlipDigit({ value }) {
  const next = String(value);
  const nodeRef = useRef(null);
  const frontRef = useRef(null);
  const backRef = useRef(null);
  const currentRef = useRef(next);
  const flippingRef = useRef(false);

  // Initial paint
  useEffect(() => {
    if (frontRef.current) frontRef.current.dataset.number = currentRef.current;
    if (backRef.current) backRef.current.dataset.number = currentRef.current;
  }, []);

  useEffect(() => {
    if (next === currentRef.current) return;
    if (flippingRef.current) {
      // Mid-flip: jump to target after current animation ends is handled below;
      // queue the latest target so we don't drop updates.
      currentRef.current = next; // will be applied on settle if still flipping
      return;
    }

    const node = nodeRef.current;
    const front = frontRef.current;
    const back = backRef.current;
    if (!node || !front || !back) return;

    const from = front.dataset.number || currentRef.current;
    const to = next;

    flippingRef.current = true;
    front.dataset.number = from;
    back.dataset.number = to;

    const onEnd = (e) => {
      // Only react to the front flap animation
      if (e.target !== front && e.animationName && !/frontFlipDown/i.test(e.animationName)) {
        return;
      }
      node.classList.remove("running");
      flippingRef.current = false;
      front.dataset.number = to;
      back.dataset.number = to;
      currentRef.current = to;
      node.removeEventListener("animationend", onEnd);
    };

    node.addEventListener("animationend", onEnd);
    // Restart animation even if class was already present
    node.classList.remove("running");
    void node.offsetWidth;
    node.classList.add("running");

    return () => {
      node.removeEventListener("animationend", onEnd);
    };
  }, [next]);

  return (
    <div className="flip" ref={nodeRef} aria-hidden>
      <div className="digital front" ref={frontRef} data-number={currentRef.current} />
      <div className="digital back" ref={backRef} data-number={currentRef.current} />
    </div>
  );
}

const MemoDigit = memo(FlipDigit);

/** Fixed-width plain digits */
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
          <span key={`s-${i}`} className="timer-plain-sep">:</span>
        ) : (
          <span key={`d-${i}`} className="timer-plain-cell">{ch}</span>
        )
      )}
    </div>
  );
}

/**
 * Flip clock row. fontSize drives --flip-h so cards scale like the site
 * (site desktop: height 160px, width 130px, digit font 130px).
 */
export function FlipClock({ text, color, fontFamily, fontSize }) {
  const chars = String(text || "00:00").split("");
  const n = chars.length;

  // Resolve a pixel height from the same clamp expression used by the timer
  // so cards stay proportional to the plain-digit size.
  const style = {
    fontFamily: fontFamily || "inherit",
    // CSS var used by .flip width/height/font-size ratios
    ["--flip-h"]: typeof fontSize === "string" ? fontSize : fontSize ? `${fontSize}px` : "80px",
    ["--flip-fg"]: color || "#ffffff",
    ["--flip-card"]: "rgba(21, 21, 21, 0.98)",
    ["--flip-card-border"]: "rgba(255,255,255,0.08)",
    ["--flip-page"]: "transparent",
  };

  return (
    <div className="clock tt-flip-clock" role="timer" aria-live="off" aria-label={text} style={style}>
      {chars.map((ch, i) => {
        const fromEnd = n - 1 - i;
        if (ch === ":") {
          return (
            <em key={`sep-${fromEnd}`} className="divider">
              :
            </em>
          );
        }
        return <MemoDigit key={`d-${fromEnd}`} value={ch} />;
      })}
    </div>
  );
}
