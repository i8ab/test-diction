import { useEffect, useRef, memo } from "react";

/**
 * One digit — digitalclock.live Flipper, synced to 1s timer ticks.
 * Animation is 0.7s so it always finishes before the next second.
 * If a new value arrives mid-flip, we interrupt and start a fresh flip
 * to the latest value (stays in sync with the clock, no skipped backlog).
 */
function FlipDigit({ value }) {
  const rootRef = useRef(null);
  const frontRef = useRef(null);
  const backRef = useRef(null);
  const shownRef = useRef(String(value));
  const busyRef = useRef(false);
  const finishRef = useRef(null);
  const raf1Ref = useRef(null);
  const raf2Ref = useRef(null);

  useEffect(() => {
    const v = String(value);
    shownRef.current = v;
    if (frontRef.current) frontRef.current.setAttribute("data-number", v);
    if (backRef.current) backRef.current.setAttribute("data-number", v);
  }, []);

  useEffect(() => {
    const to = String(value);
    if (to === shownRef.current && !busyRef.current) return;

    const root = rootRef.current;
    const front = frontRef.current;
    const back = backRef.current;
    if (!root || !front || !back) return;

    // Interrupt any in-progress flip so we never lag behind the real time
    if (finishRef.current) {
      root.removeEventListener("animationend", finishRef.current);
      finishRef.current = null;
    }
    if (raf1Ref.current) cancelAnimationFrame(raf1Ref.current);
    if (raf2Ref.current) cancelAnimationFrame(raf2Ref.current);
    raf1Ref.current = null;
    raf2Ref.current = null;
    root.classList.remove("running");

    const from = shownRef.current;
    if (from === to) {
      busyRef.current = false;
      front.setAttribute("data-number", to);
      back.setAttribute("data-number", to);
      return;
    }

    busyRef.current = true;
    front.setAttribute("data-number", from);
    back.setAttribute("data-number", to);

    const finish = (e) => {
      if (e && e.animationName && !/frontFlipDown|backFlipDown/i.test(e.animationName)) {
        return;
      }
      root.classList.remove("running");
      front.setAttribute("data-number", to);
      back.setAttribute("data-number", to);
      shownRef.current = to;
      busyRef.current = false;
      root.removeEventListener("animationend", finish);
      finishRef.current = null;
    };

    finishRef.current = finish;
    root.addEventListener("animationend", finish);
    // Restart CSS animation without a synchronous forced reflow.
    // `void root.offsetWidth` forces the browser to flush layout immediately
    // (this clock ticks every second across several digits, so that adds up
    // to real main-thread cost). A double rAF gets the same "class removed,
    // then re-added on the next frame" restart, letting the browser batch
    // the reflow with the rest of the frame's work instead of forcing it now.
    const raf1 = requestAnimationFrame(() => {
      raf2Ref.current = requestAnimationFrame(() => {
        root.classList.add("running");
      });
    });
    raf1Ref.current = raf1;

    // Safety: if animationend never fires, settle at 0.75s
    const safety = setTimeout(() => {
      if (busyRef.current && finishRef.current === finish) {
        finish({ animationName: "frontFlipDown" });
      }
    }, 750);

    return () => {
      clearTimeout(safety);
      if (raf1Ref.current) cancelAnimationFrame(raf1Ref.current);
      if (raf2Ref.current) cancelAnimationFrame(raf2Ref.current);
    };
  }, [value]);

  return (
    <div className="flip" ref={rootRef} aria-hidden="true">
      <div className="digital front" ref={frontRef} data-number="0" />
      <div className="digital back" ref={backRef} data-number="0" />
    </div>
  );
}

const MemoDigit = memo(FlipDigit);

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

export function FlipClock({ text, color, fontFamily, fontSize, cardBg, cardOpacity }) {
  const chars = String(text || "00:00").split("");
  const n = chars.length;
  const height = fontSize || "96px";
  const opacity = typeof cardOpacity === "number" ? Math.max(0, Math.min(1, cardOpacity)) : 1;
  const bg = cardBg || "#000000";

  return (
    <div
      className="clock"
      role="timer"
      aria-live="off"
      aria-label={text}
      style={{
        fontFamily:
          fontFamily ||
          'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        ["--flip-h"]: height,
        ["--flip-fg"]: color || "#ffffff",
        ["--flip-bg"]: bg,
        ["--flip-bg-opacity"]: opacity,
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
