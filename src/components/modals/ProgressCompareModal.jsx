import { useMemo, useEffect } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, primaryBtnStyle } from "../../lib/config/theme";
import { XIcon, StatsIcon, FlameIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { loadProgressSnapshots, loadXp, levelFromXp, snapshotProgress } from "../../lib/state/xp";

function daysAgoKey(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function findSnap(snaps, dayKey) {
  return snaps.find((s) => s.dayKey === dayKey) || null;
}

function findClosestBefore(snaps, dayKey) {
  // snaps sorted by time ascending ideally
  const sorted = [...snaps].sort((a, b) => a.at - b.at);
  let best = null;
  for (const s of sorted) {
    if (s.dayKey <= dayKey || s.at) best = s;
    // dayKey is string like 2026-7-10 — string compare is ok for same format only if zero-padded; ours isn't.
  }
  // Better: by timestamp
  const target = sorted.filter((s) => {
    // approximate: any snap older than now - period handled by caller
    return true;
  });
  return sorted.length ? sorted[0] : null;
}

export default function ProgressCompareModal({
  accountCode,
  isAr,
  onClose,
  currentStats, // { studied, quizzes, streak, mastered }
}) {
  const xpData = loadXp(accountCode);
  const snaps = useMemo(() => loadProgressSnapshots(accountCode), [accountCode]);

  // Ensure today's snapshot exists
  useEffect(() => {
    snapshotProgress(accountCode, {
      studied: currentStats?.studied || 0,
      quizzes: currentStats?.quizzes || 0,
      streak: currentStats?.streak || 0,
      xp: xpData.total,
      mastered: currentStats?.mastered || 0,
    });
  }, [accountCode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const allSnaps = useMemo(() => {
    const list = loadProgressSnapshots(accountCode);
    return [...list].sort((a, b) => a.at - b.at);
  }, [accountCode, snaps]);

  const now = {
    studied: Number(currentStats?.studied) || 0,
    quizzes: Number(currentStats?.quizzes) || 0,
    streak: Number(currentStats?.streak) || 0,
    xp: xpData.total,
    mastered: Number(currentStats?.mastered) || 0,
  };

  function snapAtLeastDaysAgo(days) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    // oldest snap that is still >= cutoff? we want the snap closest to (now - days)
    let best = null;
    let bestDiff = Infinity;
    for (const s of allSnaps) {
      const diff = Math.abs(s.at - cutoff);
      if (s.at <= Date.now() - (days - 1) * 24 * 60 * 60 * 1000 && diff < bestDiff) {
        best = s;
        bestDiff = diff;
      }
    }
    // fallback: earliest snap if any older
    if (!best) {
      const older = allSnaps.filter((s) => s.at <= cutoff);
      best = older.length ? older[older.length - 1] : allSnaps[0] || null;
    }
    return best;
  }

  const week = snapAtLeastDaysAgo(7);
  const month = snapAtLeastDaysAgo(30);

  function delta(nowVal, thenVal) {
    if (thenVal == null) return null;
    return nowVal - thenVal;
  }

  function DeltaBadge({ d }) {
    if (d == null) return <span style={{ color: "var(--muted-strong)" }}>—</span>;
    if (d === 0) return <span style={{ color: "var(--muted-strong)" }}>0</span>;
    const pos = d > 0;
    return (
      <span style={{ fontWeight: 800, color: pos ? "#30d158" : "var(--danger)" }}>
        {pos ? `+${d}` : d}
      </span>
    );
  }

  const rows = [
    { key: "studied", en: "Words studied", ar: "كلمات مُذاكرة", now: now.studied, week: week?.studied, month: month?.studied },
    { key: "mastered", en: "Mastered (SRS)", ar: "متقنة (SRS)", now: now.mastered, week: week?.mastered, month: month?.mastered },
    { key: "quizzes", en: "Quizzes taken", ar: "اختبارات", now: now.quizzes, week: week?.quizzes, month: month?.quizzes },
    { key: "xp", en: "Total XP", ar: "مجموع النقاط", now: now.xp, week: week?.xp, month: month?.xp },
    { key: "streak", en: "Streak (days)", ar: "السلسلة (أيام)", now: now.streak, week: week?.streak, month: month?.streak },
  ];

  const levelInfo = levelFromXp(now.xp);
  const weekLevel = week ? levelFromXp(week.xp || 0) : null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={tr(isAr, "Compare with past you", "قارن مع نفسك القديمة")}
      style={{
        position: "fixed", inset: 0, zIndex: 6000, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.45)", padding: "max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <BodyScrollLock />
      <div
        className="modal-card responsive-modal"
        style={{
          width: "100%", maxWidth: 480, maxHeight: "92dvh", overflow: "hidden", display: "flex", flexDirection: "column",
          background: CARD, borderRadius: 18, padding: "18px 18px 22px",
          boxShadow: "0 24px 60px -20px rgba(0,0,0,0.45)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #5b8def, #19A7CE)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
            }}>
              <StatsIcon size={18} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: INK }}>
              {tr(isAr, "You vs past you", "أنت ونفسك القديمة")}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", padding: 6 }}>
            <XIcon size={20} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>


        <div style={{
          padding: 14, borderRadius: 14, marginBottom: 16,
          background: "linear-gradient(135deg, rgba(48,209,88,0.12), rgba(25,167,206,0.08))",
          border: "1px solid rgba(48,209,88,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <FlameIcon size={16} style={{ color: "#ff9f0a" }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: INK }}>
              {tr(isAr, `Level ${levelInfo.level} · ${isAr ? levelInfo.titleAr : levelInfo.titleEn}`, `المستوى ${levelInfo.level} · ${levelInfo.titleAr}`)}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "var(--muted-strong)", lineHeight: 1.45 }}>
            {allSnaps.length < 2
              ? tr(
                  isAr,
                  "Keep studying — snapshots are saved daily so you can compare next week.",
                  "كمل مذاكرة — بنحفظ لقطة يومية عشان تقدر تقارن الأسبوع الجاي."
                )
              : week && delta(now.studied, week.studied) > 0
                ? tr(
                    isAr,
                    `In the last week you learned about ${delta(now.studied, week.studied)} more words. Keep going!`,
                    `خلال آخر أسبوع اتعلمت حوالي ${delta(now.studied, week.studied)} كلمة زيادة. كمّل!`
                  )
                : tr(isAr, "Your progress history is building up. Check back after more study days.", "سجل تقدمك بيتبني. ارجع بعد أيام مذاكرة أكتر.")}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--muted-strong)", textAlign: isAr ? "right" : "left" }}>
                <th style={{ padding: "8px 6px", fontWeight: 700 }}>{tr(isAr, "Metric", "المقياس")}</th>
                <th style={{ padding: "8px 6px", fontWeight: 700 }}>{tr(isAr, "Now", "الآن")}</th>
                <th style={{ padding: "8px 6px", fontWeight: 700 }}>{tr(isAr, "vs 7d", "مقابل ٧ أيام")}</th>
                <th style={{ padding: "8px 6px", fontWeight: 700 }}>{tr(isAr, "vs 30d", "مقابل ٣٠ يوم")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} style={{ borderTop: "1px solid rgba(var(--border-rgb),0.12)" }}>
                  <td style={{ padding: "10px 6px", color: INK, fontWeight: 600 }}>{isAr ? r.ar : r.en}</td>
                  <td style={{ padding: "10px 6px", color: INK, fontWeight: 800 }}>{r.now}</td>
                  <td style={{ padding: "10px 6px" }}><DeltaBadge d={delta(r.now, r.week)} /></td>
                  <td style={{ padding: "10px 6px" }}><DeltaBadge d={delta(r.now, r.month)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {allSnaps.length > 0 && (
          <div style={{ marginTop: 16, fontSize: 12, color: "var(--muted-strong)" }}>
            {tr(isAr, `${allSnaps.length} daily snapshots saved`, `${allSnaps.length} لقطة يومية محفوظة`)}
          </div>
        )}

        <button type="button" onClick={onClose} style={{ ...primaryBtnStyle, marginTop: 16 }}>
          {tr(isAr, "Close", "إغلاق")}
        </button>
        </div>
      </div>
    </div>
  );
}
