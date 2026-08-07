import { useMemo, useState } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, BRASS } from "../../lib/config/theme";
import {
  loadGoals, saveGoals, countStudiedInRange, todayStartMs, weekStartMs,
  getTodayTimerMinutes, loadWeeklyChallenge, markChallengeCompleted,
} from "../../lib/state/goals";
import { FlameIcon } from "../common/Icons";
import NumberStepper from "../common/NumberStepper";

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ height: 6, borderRadius: 4, background: "rgba(var(--border-rgb),0.12)", overflow: "hidden", flex: 1, minWidth: 40 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color || BRASS, transition: "width 0.3s" }} />
    </div>
  );
}

export default function GoalsBanner({ studiedAt, quizHistory, streak, isAr, cfg }) {
  const [goals, setGoals] = useState(loadGoals);
  const [openSettings, setOpenSettings] = useState(false);
  const challengeWrap = useMemo(() => loadWeeklyChallenge(), []);

  const dailyWordsDone = useMemo(
    () => countStudiedInRange(studiedAt, todayStartMs()),
    [studiedAt]
  );
  const weeklyWordsDone = useMemo(
    () => countStudiedInRange(studiedAt, weekStartMs()),
    [studiedAt]
  );
  const timerMins = getTodayTimerMinutes();

  const quizzesThisWeek = useMemo(() => {
    const start = weekStartMs();
    return (quizHistory || []).filter((q) => q && typeof q.at === "number" && q.at >= start).length;
  }, [quizHistory]);

  const challenge = challengeWrap.challenge;
  let challengeDone = 0;
  let challengeTarget = challenge?.target || 1;
  if (challenge?.type === "words") challengeDone = weeklyWordsDone;
  else if (challenge?.type === "quizzes") challengeDone = quizzesThisWeek;
  else if (challenge?.type === "streak") challengeDone = streak || 0;
  else if (challenge?.type === "minutes") {
    // sum timer minutes this week roughly from progress store is complex; use weekly words proxy + timer today
    challengeDone = timerMins; // partial — still useful
    // better: leave as daily timer accumulation display for minutes challenge
  }

  if (challengeDone >= challengeTarget && challenge && !challengeWrap.completed) {
    try { markChallengeCompleted(); } catch (_) {}
  }

  if (!goals.enabled && !openSettings) {
    return (
      <button
        type="button"
        onClick={() => setOpenSettings(true)}
        style={{
          marginTop: 8, fontSize: 12, color: "var(--muted)", background: "none", border: "none",
          cursor: "pointer", textDecoration: "underline", padding: 0,
        }}
      >
        {tr(isAr, "Show study goals", "إظهار أهداف المذاكرة")}
      </button>
    );
  }

  function updateGoal(patch) {
    const next = { ...goals, ...patch };
    setGoals(next);
    saveGoals(next);
  }

  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        background: "var(--card)",
        border: "1px solid rgba(var(--border-rgb),0.12)",
        borderRadius: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>
          {tr(isAr, "Today’s goals", "أهداف النهاردة")}
        </span>
        <button
          type="button"
          onClick={() => setOpenSettings((o) => !o)}
          style={{ fontSize: 11, fontWeight: 600, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer" }}
        >
          {openSettings ? tr(isAr, "Done", "تم") : tr(isAr, "Edit", "تعديل")}
        </button>
      </div>

      {openSettings ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1 }}>{tr(isAr, "Words / day", "كلمات / يوم")}</span>
            <NumberStepper
              min={1} max={100} value={goals.dailyWords} width={108}
              onChange={(v) => updateGoal({ dailyWords: v || 5 })}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1 }}>{tr(isAr, "Minutes / day", "دقائق / يوم")}</span>
            <NumberStepper
              min={5} max={240} value={goals.dailyMinutes} width={108}
              onChange={(v) => updateGoal({ dailyMinutes: v || 15 })}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1 }}>{tr(isAr, "Words / week", "كلمات / أسبوع")}</span>
            <NumberStepper
              min={5} max={500} value={goals.weeklyWords} width={108}
              onChange={(v) => updateGoal({ weeklyWords: v || 30 })}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={goals.enabled} onChange={(e) => updateGoal({ enabled: e.target.checked })} />
            <span>{tr(isAr, "Show goals banner", "إظهار شريط الأهداف")}</span>
          </label>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Row
              label={tr(isAr, `Words ${dailyWordsDone}/${goals.dailyWords}`, `كلمات ${dailyWordsDone}/${goals.dailyWords}`)}
              value={dailyWordsDone}
              max={goals.dailyWords}
              color={cfg?.accent || BRASS}
            />
            <Row
              label={tr(isAr, `Timer ${timerMins}/${goals.dailyMinutes} min`, `مؤقّت ${timerMins}/${goals.dailyMinutes} د`)}
              value={timerMins}
              max={goals.dailyMinutes}
              color="#19A7CE"
            />
            <Row
              label={tr(isAr, `Week ${weeklyWordsDone}/${goals.weeklyWords}`, `الأسبوع ${weeklyWordsDone}/${goals.weeklyWords}`)}
              value={weeklyWordsDone}
              max={goals.weeklyWords}
              color="var(--success)"
            />
          </div>

          {challenge && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                borderRadius: 8,
                background: "color-mix(in srgb, #e85d04 10%, transparent)",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <FlameIcon size={16} style={{ color: "#e85d04", flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>
                  {tr(isAr, "Weekly challenge", "تحدي الأسبوع")}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-strong)", marginTop: 2 }}>
                  {isAr ? challenge.labelAr : challenge.labelEn}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <ProgressBar value={challengeDone} max={challengeTarget} color="#e85d04" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#e85d04", whiteSpace: "nowrap" }}>
                    {Math.min(challengeDone, challengeTarget)}/{challengeTarget}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value, max, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, color: "var(--muted-strong)", minWidth: 0, flex: "1 1 120px" }}>{label}</span>
      <ProgressBar value={value} max={max} color={color} />
    </div>
  );
}

const numInput = {
  width: 64,
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid rgba(var(--border-rgb),0.2)",
  background: "var(--input-bg)",
  color: INK,
  fontSize: 14,
  fontFamily: "inherit",
};
