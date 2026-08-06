import { useEffect } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD } from "../../lib/config/theme";
import { ACHIEVEMENTS } from "../../lib/state/achievements";
import { XIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

export default function AchievementsModal({ unlockedIds = [], isAr, onClose }) {
  const unlocked = new Set(unlockedIds || []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const count = ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "12px 12px max(12px, env(safe-area-inset-bottom))",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <BodyScrollLock />
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "92dvh",
          overflow: "auto",
          background: CARD,
          borderRadius: 16,
          padding: "20px 18px 24px",
          boxShadow: "0 20px 50px -12px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: INK }}>
            {tr(isAr, "Achievements", "الإنجازات")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--muted)" }}
          >
            <XIcon size={22} />
          </button>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted-strong)" }}>
          {count} / {ACHIEVEMENTS.length} {tr(isAr, "unlocked", "مفتوح")}
        </p>

        <div style={{ display: "grid", gap: 10 }}>
          {ACHIEVEMENTS.map((a) => {
            const on = unlocked.has(a.id);
            return (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: on
                    ? "1px solid rgba(var(--focus-rgb),0.35)"
                    : "1px solid rgba(var(--border-rgb),0.12)",
                  background: on ? "var(--accent-1-soft)" : "var(--input-bg)",
                  opacity: on ? 1 : 0.55,
                }}
              >
                <div style={{ fontSize: 28, lineHeight: 1, filter: on ? "none" : "grayscale(1)" }}>
                  {a.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: INK }}>
                    {tr(isAr, a.en, a.ar)}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted-strong)", marginTop: 2 }}>
                    {tr(isAr, a.descEn, a.descAr)}
                  </div>
                </div>
                {on && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-1)", letterSpacing: "0.04em" }}>
                    ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
