import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { achievementById } from "../../lib/state/achievements";

/**
 * Minecraft-style achievement toast.
 * - Slides in from the right edge of the screen
 * - Click opens the Achievements modal (via twotongues:open-achievements)
 * - Icon has a short bounce/pulse animation
 * - Portal at z-index 12000 (above modals/toasts)
 */
const DISPLAY_MS = 5200;
const ANIM_MS = 380;
const STYLE_ID = "mc-ach-toast-keyframes";

function ensureKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
@keyframes mcAchIconPop {
  0%   { transform: scale(0.2) rotate(-12deg); opacity: 0.3; }
  45%  { transform: scale(1.22) rotate(6deg); opacity: 1; }
  70%  { transform: scale(0.92) rotate(-3deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes mcAchIconGlow {
  0%, 100% { filter: drop-shadow(0 0 0 transparent); }
  50% { filter: drop-shadow(0 0 6px rgba(252, 252, 0, 0.65)); }
}
@keyframes mcAchSlideIn {
  from { transform: translateX(110%); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}
@keyframes mcAchSlideOut {
  from { transform: translateX(0); opacity: 1; }
  to   { transform: translateX(110%); opacity: 0; }
}
`;
  document.head.appendChild(style);
}

function playUnlockChime() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
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

function openAchievementsFromToast(achievementId) {
  // Opens Achievements overlay only — does NOT close quiz/exam/timer or change their state.
  try {
    window.dispatchEvent(
      new CustomEvent("twotongues:open-achievements", {
        detail: { id: achievementId || null, fromToast: true },
      })
    );
  } catch (_) {}
}

function ToastItem({ item, isAr, onDone }) {
  const [phase, setPhase] = useState("enter"); // enter | show | exit
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone(item.key);
  }, [item.key, onDone]);

  useEffect(() => {
    ensureKeyframes();
    const t1 = setTimeout(() => setPhase("show"), 20);
    const t2 = setTimeout(() => setPhase("exit"), DISPLAY_MS);
    const t3 = setTimeout(finish, DISPLAY_MS + ANIM_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [item.key, finish]);

  const a = item.achievement;
  const title = isAr ? "تم إنجاز!" : "Achievement get!";
  const name = isAr ? (a?.ar || a?.en || item.id) : (a?.en || item.id);
  const icon = a?.icon || "🏆";

  const animName =
    phase === "enter" || phase === "show"
      ? "mcAchSlideIn"
      : "mcAchSlideOut";
  // enter runs once; show holds; exit slides out
  const animStyle =
    phase === "show"
      ? {
          transform: "translateX(0)",
          opacity: 1,
          animation: "none",
        }
      : {
          animation: `${animName} ${ANIM_MS}ms cubic-bezier(0.2, 0.9, 0.2, 1) forwards`,
        };

  function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    openAchievementsFromToast(item.id);
    setPhase("exit");
    setTimeout(finish, ANIM_MS);
  }

  function handleKey(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick(e);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={isAr ? `إنجاز: ${name} — اضغط للفتح` : `Achievement: ${name} — click to open`}
      onClick={handleClick}
      onKeyDown={handleKey}
      style={{
        pointerEvents: "auto",
        cursor: "pointer",
        marginBottom: 10,
        alignSelf: "flex-end",
        ...animStyle,
        transition: phase === "show" ? "none" : undefined,
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
        {/* Icon slot with pop + glow */}
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
            overflow: "hidden",
          }}
          aria-hidden
        >
          <span
            style={{
              display: "inline-block",
              animation:
                "mcAchIconPop 0.55s cubic-bezier(0.34, 1.4, 0.64, 1) both, mcAchIconGlow 1.4s ease-in-out 0.4s 2",
            }}
          >
            {icon}
          </span>
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
          <div
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 10,
              fontWeight: 600,
              marginTop: 1,
            }}
          >
            {isAr ? "اضغط للعرض" : "Click to view"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MinecraftAchievementToast({ isAr = false }) {
  const [queue, setQueue] = useState([]);
  const keySeq = useRef(0);

  useEffect(() => {
    ensureKeyframes();
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
      setQueue((prev) => [...prev, ...additions].slice(-8));
    }

    window.addEventListener("twotongues:achievement", onAchievement);
    return () => window.removeEventListener("twotongues:achievement", onAchievement);
  }, []);

  const onDone = useCallback((key) => {
    setQueue((prev) => prev.filter((t) => t.key !== key));
  }, []);

  const visible = queue.slice(0, 3);
  if (!visible.length || typeof document === "undefined") return null;

  // Right edge of the screen — always above quiz/exam/timer modals (z ≥ 20000)
  return createPortal(
    <div
      style={{
        position: "fixed",
        top: "max(16px, env(safe-area-inset-top))",
        right: "max(12px, env(safe-area-inset-right))",
        left: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        zIndex: 20000,
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
