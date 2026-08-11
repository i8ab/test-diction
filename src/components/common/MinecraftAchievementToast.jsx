import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { achievementById } from "../../lib/state/achievements";

/**
 * Minecraft-style achievement / advancement toast.
 * Listens for `twotongues:achievement` CustomEvents and queues toasts.
 * Renders via portal at z-index 12000 so it sits above every modal/toast.
 */
const DISPLAY_MS = 4200;
const ANIM_MS = 320;

function playUnlockChime() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    // Soft two-note "plop" similar to classic MC achievement jingle
    const notes = [
      { f: 523.25, t: 0, d: 0.12 },
      { f: 659.25, t: 0.1, d: 0.18 },
      { f: 783.99, t: 0.22, d: 0.28 },
    ];
    for (const n of notes) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = n.f;
      g.gain.setValueAtTime(0.0001, now + n.t);
      g.gain.exponentialRampToValueAtTime(0.08, now + n.t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + n.t);
      o.stop(now + n.t + n.d + 0.02);
    }
    setTimeout(() => {
      try { ctx.close(); } catch (_) {}
    }, 800);
  } catch (_) {}
}

function ToastItem({ item, isAr, onDone }) {
  const [phase, setPhase] = useState("enter"); // enter | show | exit
  const doneRef = useRef(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("show"), 20);
    const t2 = setTimeout(() => setPhase("exit"), DISPLAY_MS);
    const t3 = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone(item.key);
      }
    }, DISPLAY_MS + ANIM_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [item.key, onDone]);

  const a = item.achievement;
  const title = isAr ? "تم إنجاز!" : "Achievement get!";
  const name = isAr ? (a?.ar || a?.en || item.id) : (a?.en || item.id);
  const icon = a?.icon || "🏆";

  // Slide in from top-right (classic Minecraft achievement toast direction)
  const slide =
    phase === "enter" || phase === "exit"
      ? "translate(28px, -120%)"
      : "translate(0, 0)";
  const opacity = phase === "show" ? 1 : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        pointerEvents: "none",
        transform: slide,
        opacity,
        transition: `transform ${ANIM_MS}ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity ${ANIM_MS}ms ease`,
        marginBottom: 10,
        alignSelf: "flex-end",
      }}
    >
      {/* Outer frame — classic MC double-border look */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          minWidth: 280,
          maxWidth: "min(360px, calc(100vw - 24px))",
          background: "#000",
          border: "2px solid #555",
          boxShadow:
            "inset 0 0 0 2px #c6c6c6, inset 0 0 0 4px #555, 0 6px 20px rgba(0,0,0,0.55)",
          fontFamily:
            '"Minecraft", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
          imageRendering: "pixelated",
        }}
      >
        {/* Icon slot */}
        <div
          style={{
            width: 52,
            minWidth: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(180deg, #8b8b8b 0%, #373737 8%, #8b8b8b 16%, #555 50%, #8b8b8b 100%)",
            borderRight: "2px solid #373737",
            fontSize: 26,
            lineHeight: 1,
            textShadow: "2px 2px 0 #000",
          }}
          aria-hidden
        >
          {icon}
        </div>
        {/* Text */}
        <div
          style={{
            flex: 1,
            padding: "8px 12px 9px",
            background: "linear-gradient(180deg, #212121 0%, #111 100%)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 2,
            textAlign: isAr ? "right" : "left",
            direction: isAr ? "rtl" : "ltr",
          }}
        >
          <div
            style={{
              color: "#fcfc00",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 0.2,
              textShadow: "1px 1px 0 #3f3f00, 2px 2px 0 #000",
              lineHeight: 1.25,
            }}
          >
            {title}
          </div>
          <div
            style={{
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
              textShadow: "1px 1px 0 #000",
              lineHeight: 1.3,
              wordBreak: "break-word",
            }}
          >
            {name}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MinecraftAchievementToast({ isAr = false }) {
  const [queue, setQueue] = useState([]); // { key, id, achievement }
  const keySeq = useRef(0);

  useEffect(() => {
    function onAchievement(e) {
      const detail = e?.detail;
      if (!detail) return;
      const ids = Array.isArray(detail.ids)
        ? detail.ids
        : detail.id
          ? [detail.id]
          : [];
      if (!ids.length) return;

      const additions = [];
      for (const id of ids) {
        if (!id) continue;
        keySeq.current += 1;
        additions.push({
          key: `${id}-${keySeq.current}-${Date.now()}`,
          id: String(id),
          achievement: achievementById(String(id)) || {
            id: String(id),
            icon: "🏆",
            en: String(id),
            ar: String(id),
          },
        });
      }
      if (!additions.length) return;

      playUnlockChime();
      setQueue((prev) => {
        // Cap queue so a bulk unlock doesn't spam forever
        const next = [...prev, ...additions];
        return next.slice(-8);
      });
    }

    window.addEventListener("twotongues:achievement", onAchievement);
    return () => window.removeEventListener("twotongues:achievement", onAchievement);
  }, []);

  const onDone = useCallback((key) => {
    setQueue((prev) => prev.filter((t) => t.key !== key));
  }, []);

  // Show at most 3 stacked at once (top ones visible)
  const visible = queue.slice(0, 3);
  if (!visible.length || typeof document === "undefined") return null;

  // Top-right stack (mirrors classic MC Java achievement toast corner)
  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        left: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        zIndex: 12000,
        pointerEvents: "none",
        maxWidth: "min(360px, calc(100vw - 24px))",
      }}
    >
      {visible.map((item) => (
        <ToastItem key={item.key} item={item} isAr={isAr} onDone={onDone} />
      ))}
    </div>,
    document.body
  );
}
