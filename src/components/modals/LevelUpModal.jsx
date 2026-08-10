import { useEffect, useRef } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, primaryBtnStyle } from "../../lib/config/theme";
import { TrophyIcon, StarIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { COSMETICS } from "../../lib/state/xp";

/**
 * Level-up celebration modal.
 * z-index 8800 — above regular modals (6000), below critical toasts (10000).
 * Confetti + short Web-Audio fanfare: zero network, tiny CPU, auto-cleanup.
 */
export default function LevelUpModal({
  isAr,
  fromLevel,
  toLevel,
  titleEn,
  titleAr,
  rewardKey,
  rewardEn,
  rewardAr,
  onClose,
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Confetti particles (canvas only — no assets)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const COLORS = ["#f5c542", "#19A7CE", "#e11d48", "#22c55e", "#a855f7", "#f97316", "#ffffff", "#7dd3fc"];
    const N = 120;
    const GROUND_PAD = 10; // sit slightly above bottom edge
    const particles = [];
    for (let i = 0; i < N; i++) {
      particles.push({
        x: Math.random() * w,
        y: -12 - Math.random() * 80,
        // staggered release so they rain gradually, not all at once
        delay: Math.random() * 900 + (i / N) * 700,
        vx: (Math.random() - 0.5) * 2.4,
        vy: 1.6 + Math.random() * 2.8,
        w: 5 + Math.random() * 7,
        h: 3 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.22,
        color: COLORS[i % COLORS.length],
        settled: false,
        life: 1,
      });
    }

    const start = performance.now();
    // fall + settle, then hold pile briefly, then fade the ground line
    const DURATION = 5200;

    function frame(now) {
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      const floorY = h - GROUND_PAD;

      for (const p of particles) {
        if (t < p.delay) continue; // not released yet — gradual rain

        if (!p.settled) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.055; // gravity
          p.vx *= 0.995; // slight air drag
          p.rot += p.vr;

          // bounce softly once near floor, then settle into a line
          if (p.y + p.h / 2 >= floorY) {
            p.y = floorY - p.h / 2;
            if (p.vy > 1.2) {
              p.vy *= -0.28; // small bounce
              p.vx *= 0.7;
            } else {
              p.settled = true;
              p.vy = 0;
              p.vx = 0;
              p.vr = 0;
              // stack slightly so the pile has a bit of depth
              p.y = floorY - p.h / 2 - Math.random() * 6;
              p.rot = (Math.random() - 0.5) * 0.5; // almost flat on ground
            }
          }

          // keep on screen horizontally
          if (p.x < 0) { p.x = 0; p.vx *= -0.4; }
          if (p.x > w) { p.x = w; p.vx *= -0.4; }
        }

        // after most have settled, fade the whole pile out
        if (t > DURATION * 0.72) {
          p.life = Math.max(0, 1 - (t - DURATION * 0.72) / (DURATION * 0.28));
        }
        if (p.life <= 0) continue;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.life * 0.94;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (t < DURATION) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
    }
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ctx.clearRect(0, 0, w, h);
    };
  }, []);

  // Short celebratory tones via Web Audio (no audio files / zero bandwidth)
  useEffect(() => {
    let cancelled = false;
    let ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      audioCtxRef.current = ctx;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
      const t0 = ctx.currentTime + 0.05;

      notes.forEach((freq, i) => {
        if (cancelled) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        const start = t0 + i * 0.11;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.12, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      });

      const sparkle = ctx.createOscillator();
      const sg = ctx.createGain();
      sparkle.type = "sine";
      sparkle.frequency.value = 1568;
      const st = t0 + 0.48;
      sg.gain.setValueAtTime(0.0001, st);
      sg.gain.exponentialRampToValueAtTime(0.06, st + 0.02);
      sg.gain.exponentialRampToValueAtTime(0.0001, st + 0.28);
      sparkle.connect(sg);
      sg.connect(ctx.destination);
      sparkle.start(st);
      sparkle.stop(st + 0.3);
    } catch (_) {}

    return () => {
      cancelled = true;
      try {
        if (ctx && ctx.state !== "closed") ctx.close();
      } catch (_) {}
    };
  }, []);

  const rewardLabel = rewardKey
    ? (isAr ? rewardAr : rewardEn) || rewardKey
    : null;

  let rewardEmoji = "✨";
  if (rewardKey?.startsWith("badge:")) {
    const id = rewardKey.slice(6);
    rewardEmoji = COSMETICS.badges[id]?.emoji || "🏅";
  } else if (rewardKey?.startsWith("frame:")) {
    rewardEmoji = "🖼️";
  } else if (rewardKey?.startsWith("theme:")) {
    rewardEmoji = "🎨";
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={tr(isAr, "Level up!", "مستوى جديد!")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 8800,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.58)",
        padding: "max(14px, env(safe-area-inset-top)) 16px max(14px, env(safe-area-inset-bottom))",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <BodyScrollLock />

      <canvas
        ref={canvasRef}
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      <div
        className="modal-card responsive-modal"
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          maxWidth: 440,
          maxHeight: "90dvh",
          overflow: "auto",
          background: CARD,
          borderRadius: 22,
          padding: "32px 26px 26px",
          boxShadow: "0 32px 80px -20px rgba(0,0,0,0.55)",
          textAlign: "center",
          animation: "levelUpPop 0.5s cubic-bezier(0.22, 1.25, 0.36, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: "50%",
            margin: "0 auto 16px",
            background: "linear-gradient(135deg, #f5c542, #d4a017)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            boxShadow: "0 10px 28px -6px rgba(212,160,23,0.6)",
          }}
        >
          <TrophyIcon size={36} />
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 0.7,
            textTransform: "uppercase",
            color: "var(--accent-1)",
            marginBottom: 8,
          }}
        >
          {tr(isAr, "Congratulations!", "مبروك!")}
        </div>

        <div style={{ fontSize: 26, fontWeight: 800, color: INK, marginBottom: 6, lineHeight: 1.25 }}>
          {tr(
            isAr,
            `Level ${fromLevel} → ${toLevel}`,
            `المستوى ${fromLevel} ← ${toLevel}`
          )}
        </div>

        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--muted-strong)", marginBottom: 20 }}>
          {isAr ? titleAr : titleEn}
        </div>

        {rewardLabel && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 18px",
              borderRadius: 14,
              background: "rgba(var(--focus-rgb),0.12)",
              border: "1px solid rgba(var(--focus-rgb),0.28)",
              marginBottom: 22,
              fontSize: 15,
              fontWeight: 700,
              color: INK,
            }}
          >
            <span style={{ fontSize: 22 }}>{rewardEmoji}</span>
            <span>
              {tr(isAr, "Unlocked: ", "اتفتح: ")}
              {rewardLabel}
            </span>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 22 }}>
          {[0, 1, 2].map((i) => (
            <StarIcon key={i} size={22} style={{ color: "#f5c542" }} />
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{ ...primaryBtnStyle, width: "100%", maxWidth: 260, margin: "0 auto", padding: "12px 20px", fontSize: 15 }}
        >
          {tr(isAr, "Awesome!", "رائع!")}
        </button>
      </div>

      <style>{`
        @keyframes levelUpPop {
          0% { transform: scale(0.78); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
