import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS } from "../../lib/config/theme";
import {
  loadGoals, saveGoals, countStudiedInRange, todayStartMs, weekStartMs,
  getTodayTimerMinutes, loadWeeklyChallenge,
} from "../../lib/state/goals";
import { XIcon, FlameIcon, CheckIcon } from "../common/Icons";
import NumberStepper from "../common/NumberStepper";
import { useBodyScrollLock } from "../../lib/utils/useBodyScrollLock";

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ height: 8, borderRadius: 6, background: "rgba(var(--border-rgb),0.12)", overflow: "hidden", flex: 1, minWidth: 48 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color || BRASS, transition: "width 0.3s" }} />
    </div>
  );
}

/**
 * Goals panel — full page or floating bubble (like Timer / Calendar / Todo).
 */
export default function GoalsPage({
  onClose, isAr, studiedAt = {}, quizHistory = [], streak = 0, cfg,
  onBubbleChange, initialBubble = false,
}) {
  const [goals, setGoals] = useState(loadGoals);
  const [viewMode, setViewMode] = useState(initialBubble ? "bubble" : "full");
  const [bubblePos, setBubblePos] = useState({ x: null, y: null });
  const dragRef = useRef(null);
  const challengeWrap = useMemo(() => loadWeeklyChallenge(), []);

  useEffect(() => {
    onBubbleChange?.(viewMode === "bubble");
  }, [viewMode, onBubbleChange]);

  useBodyScrollLock(viewMode === "full");

  const dailyWordsDone = useMemo(() => countStudiedInRange(studiedAt, todayStartMs()), [studiedAt]);
  const weeklyWordsDone = useMemo(() => countStudiedInRange(studiedAt, weekStartMs()), [studiedAt]);
  const timerMins = getTodayTimerMinutes();
  const quizzesThisWeek = useMemo(() => {
    const start = weekStartMs();
    return (quizHistory || []).filter((q) => q && typeof q.at === "number" && q.at >= start).length;
  }, [quizHistory]);

  const challenge = challengeWrap.challenge;
  let challengeDone = 0;
  const challengeTarget = challenge?.target || 1;
  if (challenge?.type === "words") challengeDone = weeklyWordsDone;
  else if (challenge?.type === "quizzes") challengeDone = quizzesThisWeek;
  else if (challenge?.type === "streak") challengeDone = streak || 0;
  else if (challenge?.type === "minutes") challengeDone = timerMins;

  function updateGoal(patch) {
    const next = { ...goals, ...patch };
    setGoals(next);
    saveGoals(next);
  }

  const onBubblePointerDown = useCallback((e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (e.target?.closest?.("button")) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      origX: bubblePos.x != null ? bubblePos.x : rect.left,
      origY: bubblePos.y != null ? bubblePos.y : rect.top,
      pointerId: e.pointerId,
    };
    try { el.setPointerCapture?.(e.pointerId); } catch (_) {}
  }, [bubblePos]);

  const onBubblePointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.hypot(dx, dy) < 6) return;
    setBubblePos({
      x: Math.max(8, Math.min(window.innerWidth - 180, d.origX + dx)),
      y: Math.max(8, Math.min(window.innerHeight - 140, d.origY + dy)),
    });
  }, []);

  const onBubblePointerUp = useCallback((e) => {
    const d = dragRef.current;
    if (d && e?.currentTarget) {
      try { e.currentTarget.releasePointerCapture?.(d.pointerId); } catch (_) {}
    }
    dragRef.current = null;
  }, []);

  if (viewMode === "bubble") {
    const style = {
      position: "fixed", zIndex: 55, width: 168, borderRadius: 14, background: CARD,
      border: "1px solid rgba(var(--border-rgb),0.18)",
      boxShadow: "0 12px 32px -10px rgba(0,0,0,0.28)",
      padding: "10px 10px 12px", cursor: "grab", userSelect: "none", touchAction: "none",
      ...(bubblePos.x != null ? { left: bubblePos.x, top: bubblePos.y } : { bottom: 88, insetInlineEnd: 16 }),
    };
    return (
      <div role="dialog" aria-label={tr(isAr, "Goals", "الأهداف")} style={style}
        onPointerDown={onBubblePointerDown} onPointerMove={onBubblePointerMove}
        onPointerUp={onBubblePointerUp} onPointerCancel={onBubblePointerUp}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: BRASS }}>{tr(isAr, "Goals", "أهداف")}</span>
          <div style={{ display: "flex", gap: 2 }}>
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setViewMode("full")} style={iconBtn} title={tr(isAr, "Expand", "توسيع")}>↗</button>
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onClose} style={iconBtn}><XIcon size={14} /></button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: INK, marginBottom: 4 }}>
          {tr(isAr, `Words ${dailyWordsDone}/${goals.dailyWords}`, `كلمات ${dailyWordsDone}/${goals.dailyWords}`)}
        </div>
        <ProgressBar value={dailyWordsDone} max={goals.dailyWords} color={cfg?.accent || BRASS} />
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
          <FlameIcon size={12} style={{ color: "#e85d04" }} />
          {streak} {tr(isAr, "day streak", "يوم متتالي")}
        </div>
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal="true" style={{
      position: "fixed", inset: 0, zIndex: 50, background: "var(--paper)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <header style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
        borderBottom: "1px solid rgba(var(--border-rgb),0.12)", flexWrap: "wrap",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: INK }}>
            {tr(isAr, "Study goals", "أهداف المذاكرة")}
          </h1>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {tr(isAr, "Set targets and track today’s progress", "حط أهداف وتابع تقدّم النهاردة")}
          </div>
        </div>
        <button type="button" onClick={() => setViewMode("bubble")} style={headerBtn}>
          {tr(isAr, "Pin", "تثبيت")}
        </button>
        <button type="button" onClick={onClose} style={headerBtn} aria-label={tr(isAr, "Close", "إغلاق")}>
          <XIcon size={16} />
        </button>
      </header>

      <div style={{ flex: 1, overflow: "auto", padding: "16px", maxWidth: 480, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <Section title={tr(isAr, "Today", "النهاردة")}>
          <Metric
            label={tr(isAr, "Words studied", "كلمات اتدرست")}
            value={dailyWordsDone} max={goals.dailyWords} color={cfg?.accent || BRASS}
          />
          <Metric
            label={tr(isAr, "Timer minutes", "دقائق المؤقّت")}
            value={timerMins} max={goals.dailyMinutes} color="#19A7CE"
          />
        </Section>

        <Section title={tr(isAr, "This week", "هذا الأسبوع")}>
          <Metric
            label={tr(isAr, "Words", "كلمات")}
            value={weeklyWordsDone} max={goals.weeklyWords} color="var(--success)"
          />
          <div style={{ fontSize: 13, color: "var(--muted-strong)", marginTop: 6 }}>
            {tr(isAr, `${quizzesThisWeek} quiz(zes) finished`, `${quizzesThisWeek} اختبار اتعمل`)}
            {" · "}
            <FlameIcon size={12} style={{ color: "#e85d04", verticalAlign: -2 }} /> {streak} {tr(isAr, "streak", "سلسلة")}
          </div>
        </Section>

        {challenge && (
          <Section title={tr(isAr, "Weekly challenge", "تحدي الأسبوع")}>
            <div style={{
              padding: "10px 12px", borderRadius: 10,
              background: "color-mix(in srgb, #e85d04 10%, transparent)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>
                {isAr ? challenge.labelAr : challenge.labelEn}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <ProgressBar value={challengeDone} max={challengeTarget} color="#e85d04" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#e85d04", whiteSpace: "nowrap" }}>
                  {Math.min(challengeDone, challengeTarget)}/{challengeTarget}
                </span>
              </div>
            </div>
          </Section>
        )}

        <Section title={tr(isAr, "Edit targets", "تعديل الأهداف")}>
          <label style={rowLabel}>
            <span>{tr(isAr, "Words per day", "كلمات في اليوم")}</span>
            <NumberStepper
              min={1} max={100} value={goals.dailyWords}
              onChange={(v) => updateGoal({ dailyWords: v || 5 })}
              aria-label={tr(isAr, "Words per day", "كلمات في اليوم")}
            />
          </label>
          <label style={rowLabel}>
            <span>{tr(isAr, "Minutes per day", "دقائق في اليوم")}</span>
            <NumberStepper
              min={5} max={240} value={goals.dailyMinutes}
              onChange={(v) => updateGoal({ dailyMinutes: v || 15 })}
              aria-label={tr(isAr, "Minutes per day", "دقائق في اليوم")}
            />
          </label>
          <label style={rowLabel}>
            <span>{tr(isAr, "Words per week", "كلمات في الأسبوع")}</span>
            <NumberStepper
              min={5} max={500} value={goals.weeklyWords}
              onChange={(v) => updateGoal({ weeklyWords: v || 30 })}
              aria-label={tr(isAr, "Words per week", "كلمات في الأسبوع")}
            />
          </label>
        </Section>

        <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, marginTop: 8 }}>
          {tr(isAr,
            "Tip: mark words as studied and finish timer sessions — progress updates automatically.",
            "نصيحة: علّم الكلمات كمدروسة وخلّص جلسات المؤقّت — التقدّم بيتحدّث لوحده.")}
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--muted-strong)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Metric({ label, value, max, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4, color: INK }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700 }}>{value}/{max}</span>
      </div>
      <ProgressBar value={value} max={max} color={color} />
    </div>
  );
}

const iconBtn = { border: "none", background: "transparent", color: "var(--icon-muted)", padding: 4, cursor: "pointer", display: "inline-flex", borderRadius: 6 };
const headerBtn = {
  border: "1px solid rgba(var(--border-rgb),0.18)", background: "var(--card)", color: INK,
  padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
  display: "inline-flex", alignItems: "center", gap: 4,
};
const rowLabel = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, fontSize: 14, color: INK };
const numInput = {
  width: 72, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(var(--border-rgb),0.2)",
  background: "var(--input-bg)", color: INK, fontSize: 14, fontFamily: "inherit",
};
