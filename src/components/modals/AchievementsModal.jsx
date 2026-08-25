import { useEffect, useMemo, useState } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD } from "../../lib/config/theme";
import {
  ACHIEVEMENT_SECTIONS,
  buildAchievementStats,
  sectionProgress,
  isAchievementEarned,
} from "../../lib/state/achievements";
import { XIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

export default function AchievementsModal({
  unlockedIds = [],
  isAr,
  onClose,
  account = null,
  streak = 0,
  srsBox = {},
  timerMinutesTotal = 0,
  dictationRounds = 0,
}) {
  const unlocked = useMemo(() => new Set(unlockedIds || []), [unlockedIds]);
  const [openSection, setOpenSection] = useState(null);

  const stats = useMemo(
    () =>
      buildAchievementStats(account, {
        streak,
        srsBox,
        timerMinutesTotal,
        dictationRounds,
      }),
    [account, streak, srsBox, timerMinutesTotal, dictationRounds]
  );

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        if (openSection) setOpenSection(null);
        else onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, openSection]);

  const totalLevels = ACHIEVEMENT_SECTIONS.reduce((n, s) => n + s.levels.length, 0);
  // Count levels earned by stored unlocks OR by live stats (so old progress isn't invisible)
  const unlockedCount = ACHIEVEMENT_SECTIONS.reduce(
    (n, s) => n + s.levels.filter((lv) => isAchievementEarned(lv.id, unlocked, stats)).length,
    0
  );

  const detail = openSection
    ? ACHIEVEMENT_SECTIONS.find((s) => s.id === openSection)
    : null;
  const detailProg = detail ? sectionProgress(detail, stats, unlocked) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 15000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "12px 12px max(12px, env(safe-area-inset-bottom))",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (openSection) setOpenSection(null);
          else onClose();
        }
      }}
    >
      <BodyScrollLock />
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "92dvh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: CARD,
          borderRadius: 16,
          padding: "20px 18px 24px",
          boxShadow: "0 20px 50px -12px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: INK }}>
            {detail
              ? tr(isAr, detail.en, detail.ar)
              : tr(isAr, "Achievements", "الإنجازات")}
          </h2>
          <button
            type="button"
            onClick={() => (detail ? setOpenSection(null) : onClose())}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", width: 36, height: 36, padding: 0, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 0 }}
          >
            <XIcon size={20} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>

        {!detail ? (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted-strong)" }}>
              {unlockedCount} / {totalLevels} {tr(isAr, "levels unlocked", "مستوى مفتوح")}
              <span style={{ marginInlineStart: 6, color: "var(--muted)" }}>
                · {tr(isAr, "Tap a category for details", "اضغط على قسم للتفاصيل")}
              </span>
            </p>

            <div style={{ display: "grid", gap: 10 }}>
              {ACHIEVEMENT_SECTIONS.map((sec) => {
                const prog = sectionProgress(sec, stats, unlocked);
                const unlockedInSec = sec.levels.filter((lv) => isAchievementEarned(lv.id, unlocked, stats)).length;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setOpenSection(sec.id)}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      padding: "14px 14px",
                      borderRadius: 12,
                      border: prog.done
                        ? "1px solid rgba(var(--focus-rgb),0.35)"
                        : "1px solid rgba(var(--border-rgb),0.12)",
                      background: prog.done ? "var(--accent-1-soft)" : "var(--input-bg)",
                      cursor: "pointer",
                      textAlign: "start",
                      width: "100%",
                      font: "inherit",
                      color: "inherit",
                    }}
                  >
                    <div style={{ fontSize: 28, lineHeight: 1 }}>{sec.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                        <div style={{ fontWeight: 700, fontSize: 14.5, color: INK }}>
                          {tr(isAr, sec.en, sec.ar)}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent-1)", flexShrink: 0 }}>
                          {prog.overallPct}%
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted-strong)", marginTop: 2 }}>
                        {tr(isAr, sec.descEn, sec.descAr)}
                      </div>
                      <div style={{ marginTop: 8, height: 6, borderRadius: 999, background: "rgba(var(--border-rgb),0.15)", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${prog.overallPct}%`,
                            background: "linear-gradient(90deg, var(--accent-1), var(--accent-2))",
                            borderRadius: 999,
                            transition: "width 0.25s ease",
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4, fontWeight: 600 }}>
                        {tr(
                          isAr,
                          `Level ${prog.currentLevel}/${prog.maxLevel} · ${unlockedInSec} badges`,
                          `المستوى ${prog.currentLevel}/${prog.maxLevel} · ${unlockedInSec} شارة`
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--muted-strong)" }}>
              {tr(isAr, detail.descEn, detail.descAr)}
            </p>
            <div
              style={{
                marginBottom: 14,
                padding: "12px 14px",
                borderRadius: 12,
                background: "var(--input-bg)",
                border: "1px solid rgba(var(--border-rgb),0.12)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: INK }}>
                  {tr(
                    isAr,
                    `Level ${detailProg.currentLevel} / ${detailProg.maxLevel}`,
                    `المستوى ${detailProg.currentLevel} / ${detailProg.maxLevel}`
                  )}
                </span>
                <span style={{ fontWeight: 800, fontSize: 16, color: "var(--accent-1)" }}>
                  {detailProg.overallPct}%
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: "rgba(var(--border-rgb),0.15)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${detailProg.overallPct}%`,
                    background: "linear-gradient(90deg, var(--accent-1), var(--accent-2))",
                    borderRadius: 999,
                  }}
                />
              </div>
              <div style={{ fontSize: 12, color: "var(--muted-strong)", marginTop: 8, fontWeight: 600 }}>
                {detailProg.done
                  ? tr(isAr, "Category complete!", "القسم خلصان!")
                  : tr(
                      isAr,
                      `Progress: ${detailProg.value} / ${detailProg.nextThreshold} toward next level (${detailProg.pctToNext}%)`,
                      `التقدّم: ${detailProg.value} / ${detailProg.nextThreshold} للمستوى الجاي (${detailProg.pctToNext}%)`
                    )}
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {detail.levels.map((lv) => {
                const permanentlyUnlocked = unlocked.has(lv.id);
                const raw = Number(stats[detail.metric]) || 0;
                const reachedNow = raw >= lv.threshold;
                const on = permanentlyUnlocked || reachedNow;
                const prev = lv.n === 1 ? 0 : detail.levels[lv.n - 2]?.threshold ?? 0;
                const span = Math.max(1, lv.threshold - prev);
                const levelPct = on
                  ? 100
                  : Math.max(0, Math.min(100, Math.round(((raw - prev) / span) * 100)));
                // Once unlocked (or currently at threshold): always "Completed".
                // Live metric drops (e.g. un-favorite) do not change the label.
                const statusLabel = on
                  ? tr(isAr, "Completed", "مكتمل")
                  : tr(isAr, `${raw} / ${lv.threshold} (${levelPct}%)`, `${raw} / ${lv.threshold} (${levelPct}%)`);
                return (
                  <div
                    key={lv.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: on
                        ? "1px solid rgba(var(--focus-rgb),0.35)"
                        : "1px solid rgba(var(--border-rgb),0.12)",
                      background: on ? "var(--accent-1-soft)" : "var(--input-bg)",
                      opacity: on ? 1 : 0.7,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 13,
                        background: on ? "var(--accent-1)" : "rgba(var(--border-rgb),0.12)",
                        color: on ? "#fff" : "var(--muted-strong)",
                        flexShrink: 0,
                      }}
                    >
                      {lv.n}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: INK }}>
                        {tr(isAr, lv.en, lv.ar)}
                      </div>
                      <div style={{ marginTop: 5, height: 5, borderRadius: 999, background: "rgba(var(--border-rgb),0.15)", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${levelPct}%`,
                            background: on
                              ? "linear-gradient(90deg, var(--accent-1), var(--accent-2))"
                              : "var(--muted)",
                            borderRadius: 999,
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, fontWeight: 600 }}>
                        {statusLabel}
                      </div>
                    </div>
                    {on && (
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-1)" }}>✓</span>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setOpenSection(null)}
              style={{
                marginTop: 14,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(var(--border-rgb),0.2)",
                background: "var(--input-bg)",
                color: INK,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {tr(isAr, "Back to categories", "رجوع للأقسام")}
            </button>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
