import { useEffect } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, primaryBtnStyle } from "../../lib/config/theme";
import { XIcon, TrophyIcon, StarIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { COSMETICS } from "../../lib/state/xp";

/**
 * Congratulation modal shown when the user reaches a new level.
 * z-index 8800 — above regular modals (6000), below critical toasts (10000).
 * Parent is responsible for deferring display while quiz/exam is open.
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
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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
        background: "rgba(0,0,0,0.55)",
        padding: "max(12px, env(safe-area-inset-top)) 14px max(12px, env(safe-area-inset-bottom))",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <BodyScrollLock />
      <div
        className="modal-card responsive-modal"
        style={{
          width: "100%",
          maxWidth: 380,
          maxHeight: "88dvh",
          overflow: "auto",
          background: CARD,
          borderRadius: 20,
          padding: "28px 22px 22px",
          boxShadow: "0 28px 70px -18px rgba(0,0,0,0.5)",
          textAlign: "center",
          animation: "levelUpPop 0.45s cubic-bezier(0.22, 1.2, 0.36, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            margin: "0 auto 14px",
            background: "linear-gradient(135deg, #f5c542, #d4a017)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            boxShadow: "0 8px 24px -6px rgba(212,160,23,0.55)",
          }}
        >
          <TrophyIcon size={30} />
        </div>

        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: "var(--accent-1)",
            marginBottom: 6,
          }}
        >
          {tr(isAr, "Congratulations!", "مبروك!")}
        </div>

        <div style={{ fontSize: 22, fontWeight: 800, color: INK, marginBottom: 4, lineHeight: 1.25 }}>
          {tr(
            isAr,
            `Level ${fromLevel} → ${toLevel}`,
            `المستوى ${fromLevel} ← ${toLevel}`
          )}
        </div>

        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--muted-strong)", marginBottom: 18 }}>
          {isAr ? titleAr : titleEn}
        </div>

        {rewardLabel && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              borderRadius: 12,
              background: "rgba(var(--focus-rgb),0.12)",
              border: "1px solid rgba(var(--focus-rgb),0.28)",
              marginBottom: 20,
              fontSize: 14,
              fontWeight: 700,
              color: INK,
            }}
          >
            <span style={{ fontSize: 20 }}>{rewardEmoji}</span>
            <span>
              {tr(isAr, "Unlocked: ", "اتفتح: ")}
              {rewardLabel}
            </span>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 18 }}>
          {[0, 1, 2].map((i) => (
            <StarIcon key={i} size={18} style={{ color: "#f5c542" }} />
          ))}
        </div>

        <button type="button" onClick={onClose} style={{ ...primaryBtnStyle, width: "100%", maxWidth: 220, margin: "0 auto" }}>
          {tr(isAr, "Awesome!", "رائع!")}
        </button>
      </div>

      <style>{`
        @keyframes levelUpPop {
          0% { transform: scale(0.82); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
