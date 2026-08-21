import { useEffect, useRef, memo } from "react";

/**
 * One digit — DOM/animation identical to digitalclock.live Flipper:
 *   setFront(current) → setBack(next) → .running → animationend → setFront(next)
 */
function FlipDigit({ value }) {
  const rootRef = useRef(null);
  const frontRef = useRef(null);
  const backRef = useRef(null);
  const shownRef = useRef(String(value));
  const busyRef = useRef(false);
  const pendingRef = useRef(null);

  // First mount
  useEffect(() => {
    const v = String(value);
    shownRef.current = v;
    if (frontRef.current) frontRef.current.setAttribute("data-number", v);
    if (backRef.current) backRef.current.setAttribute("data-number", v);
  }, []);

  useEffect(() => {
    const v = String(value);
    if (v === shownRef.current && !busyRef.current) return;

    const run = (from, to) => {
      const root = rootRef.current;
      const front = frontRef.current;
      const back = backRef.current;
      if (!root || !front || !back) return;

      busyRef.current = true;
      front.setAttribute("data-number", from);
      back.setAttribute("data-number", to);

      const finish = (e) => {
        // frontFlipDown is on ::before — animationend bubbles from the element
        // that has the animation. In WebKit it may target the host; accept both.
        if (e && e.animationName && !/frontFlipDown|backFlipDown/i.test(e.animationName)) {
          return;
        }
        root.classList.remove("running");
        front.setAttribute("data-number", to);
        back.setAttribute("data-number", to);
        shownRef.current = to;
        busyRef.current = false;
        root.removeEventListener("animationend", finish);

        if (pendingRef.current != null && pendingRef.current !== to) {
          const next = pendingRef.current;
          pendingRef.current = null;
          run(to, next);
        } else {
          pendingRef.current = null;
        }
      };

      root.addEventListener("animationend", finish);
      root.classList.remove("running");
      // Force reflow so the animation always restarts
      // eslint-disable-next-line no-unused-expressions
      root.offsetWidth;
      root.classList.add("running");
    };

    if (busyRef.current) {
      pendingRef.current = v;
      return;
    }

    run(shownRef.current, v);
  }, [value]);

  return (
    <div className="flip" ref={rootRef} aria-hidden="true">
      <div className="digital front" ref={frontRef} data-number="0" />
      <div className="digital back" ref={backRef} data-number="0" />
    </div>
  );
}

const MemoDigit = memo(FlipDigit);

/** Plain fixed cells */
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
 * Flip clock row.
 * Uses the same class names + CSS as digitalclock.live.
 * --flip-h = card height (px). Digit font ≈ 0.81 × height (site: 130/160).
 */
export function FlipClock({ text, color, fontFamily, fontSize }) {
  const chars = String(text || "00:00").split("");
  const n = chars.length;

  // Prefer a concrete px height so calc() ratios stay stable.
  // Timer passes clamp(...); use it directly as height.
  const height = fontSize || "96px";

  return (
    <div
      className="clock"
      role="timer"
      aria-live="off"
      aria-label={text}
      style={{
        // System UI for digits — matches the clean sans look on digitalclock.live
        fontFamily:
          fontFamily ||
          'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        ["--flip-h"]: height,
        ["--flip-fg"]: color || "#ffffff",
      }}
    >
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
