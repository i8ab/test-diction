import { useMemo, useState } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS } from "../../lib/config/theme";
import { isSrsDue, computeStreak, SRS_BOX_LABELS, formatDueIn, loadSrsPrefs, saveSrsPrefs } from "../../lib/utils/quizHelpers";
import { XIcon, FlameIcon, StatsIcon, LayersIcon, ClockIcon, CheckIcon } from "../common/Icons";
import { useBodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { getTodayTimerMinutes, loadWeeklyChallenge } from "../../lib/state/goals";

export default function DashboardPage({
  onClose,
  isAr,
  entries = [],
  studiedIds,
  studiedAt = {},
  favoriteIds,
  srsBox = {},
  srsDueAt = {},
  quizHistory = [],
  streak = 0,
  section,
  onOpenQuiz,
  onOpenDue,
  onOpenStats,
  onOpenGoals,
  onOpenCalendar,
  onOpenFlashcards,
  name,
}) {
  useBodyScrollLock(true);
  const [srsPrefs, setSrsPrefs] = useState(() => loadSrsPrefs());

  function updateSrsPref(key, value) {
    const next = { ...srsPrefs, [key]: value };
    setSrsPrefs(next);
    saveSrsPrefs(next);
  }

  const sectionEntries = useMemo(
    () => (entries || []).filter((e) => !section || e.section === section),
    [entries, section]
  );
  const studiedCount = useMemo(
    () => sectionEntries.filter((e) => studiedIds && studiedIds.has(e.id)).length,
    [sectionEntries, studiedIds]
  );
  const favCount = useMemo(
    () => sectionEntries.filter((e) => favoriteIds && favoriteIds.has(e.id)).length,
    [sectionEntries, favoriteIds]
  );
  const dueList = useMemo(
    () =>
      sectionEntries.filter(
        (e) => studiedIds && studiedIds.has(e.id) && isSrsDue(e.id, srsDueAt)
      ),
    [sectionEntries, studiedIds, srsDueAt]
  );
  const weakList = useMemo(
    () =>
      sectionEntries
        .filter((e) => studiedIds && studiedIds.has(e.id) && ((srsBox && srsBox[e.id]) || 0) <= 1)
        .slice(0, 8),
    [sectionEntries, studiedIds, srsBox]
  );
  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  })();
  const todayWords = useMemo(() => {
    let n = 0;
    for (const [id, t] of Object.entries(studiedAt || {})) {
      if (typeof t !== "number") continue;
      const d = new Date(t);
      if (`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === todayKey) n += 1;
    }
    return n;
  }, [studiedAt, todayKey]);
  const quizzesToday = useMemo(() => {
    return (quizHistory || []).filter((q) => {
      if (!q || typeof q.at !== "number") return false;
      const d = new Date(q.at);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === todayKey;
    }).length;
  }, [quizHistory, todayKey]);
  const timerMins = getTodayTimerMinutes();
  const challengeWrap = loadWeeklyChallenge();
  const challenge = challengeWrap?.challenge;

  const cards = [
    {
      key: "streak",
      label: tr(isAr, "Streak", "السلسلة"),
      value: streak,
      unit: tr(isAr, "days", "يوم"),
      color: "#ff9f0a",
      icon: <FlameIcon size={20} />,
    },
    {
      key: "due",
      label: tr(isAr, "Due for review", "مستحقة للمراجعة"),
      value: dueList.length,
      unit: tr(isAr, "words", "كلمة"),
      color: "#e76f51",
      icon: <LayersIcon size={20} />,
      onClick: onOpenDue,
    },
    {
      key: "studied",
      label: tr(isAr, "Studied", "تمت دراستها"),
      value: studiedCount,
      unit: `/ ${sectionEntries.length}`,
      color: "#30d158",
      icon: <CheckIcon size={20} />,
    },
    {
      key: "today",
      label: tr(isAr, "Today", "اليوم"),
      value: todayWords,
      unit: tr(isAr, "words", "كلمة"),
      color: "#5b8def",
      icon: <StatsIcon size={20} />,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5000,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-card"
        dir={isAr ? "rtl" : "ltr"}
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          background: CARD,
          borderRadius: 16,
          padding: "20px 20px 24px",
          boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
          position: "relative",
        }}
      >
        {/* هيدر ثابت واضح */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-strong)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {tr(isAr, "Dashboard", "لوحة القيادة")}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: INK, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name ? tr(isAr, `Hi, ${name}`, `مرحباً، ${name}`) : tr(isAr, "Your progress", "تقدّمك")}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{ border: "none", background: "var(--input-bg)", width: 40, height: 40, borderRadius: 12, cursor: "pointer", color: "var(--ink)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <XIcon size={18} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
          {cards.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.onClick}
              style={{
                textAlign: "start",
                border: "1px solid rgba(var(--border-rgb),0.14)",
                background: "var(--input-bg)",
                borderRadius: 14,
                padding: "14px 14px 12px",
                cursor: c.onClick ? "pointer" : "default",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: c.color, marginBottom: 8 }}>
                {c.icon}
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-strong)" }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: INK, lineHeight: 1 }}>
                {c.value}
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-strong)", marginInlineStart: 8 }}>{c.unit}</span>
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
          {[
            { label: tr(isAr, "Favorites", "المفضلة"), value: favCount },
            { label: tr(isAr, "Quizzes today", "اختبارات اليوم"), value: quizzesToday },
            { label: tr(isAr, "Timer min", "دقائق المؤقت"), value: timerMins },
          ].map((x) => (
            <div key={x.label} style={{ background: "var(--input-bg)", borderRadius: 12, padding: "10px 12px", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
              <div style={{ fontSize: 11, color: "var(--muted-strong)", fontWeight: 600 }}>{x.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: INK }}>{x.value}</div>
            </div>
          ))}
        </div>

        {challenge && (
          <div style={{ background: "var(--input-bg)", borderRadius: 14, padding: 14, marginBottom: 16, border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRASS, marginBottom: 4 }}>
              {tr(isAr, "Weekly challenge", "تحدي الأسبوع")}
            </div>
            <div style={{ fontSize: 14, color: INK }}>
              {isAr ? (challenge.labelAr || challenge.labelEn) : (challenge.labelEn || challenge.type)} · {tr(isAr, "target", "الهدف")} {challenge.target}
            </div>
            <button
              type="button"
              onClick={onOpenGoals}
              style={{ marginTop: 8, border: "none", background: "none", color: "var(--accent-1)", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0 }}
            >
              {tr(isAr, "Open goals →", "فتح الأهداف ←")}
            </button>
          </div>
        )}

        {dueList.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{tr(isAr, "Due now", "مستحقة الآن")}</div>
              <button type="button" onClick={onOpenDue} style={{ border: "none", background: "none", color: "var(--accent-1)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                {tr(isAr, "Review", "راجع")}
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {dueList.slice(0, 6).map((e) => (
                <div key={e.id} style={{ background: "var(--input-bg)", borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 10, border: "1px solid rgba(var(--border-rgb),0.1)" }}>
                  <span style={{ fontWeight: 700, color: INK }}>{e.word}</span>
                  <span style={{ fontSize: 12, color: "var(--muted-strong)" }}>{formatDueIn(srsDueAt[e.id], isAr)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {weakList.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 8 }}>
              {tr(isAr, "Needs practice", "تحتاج تمرين")}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {weakList.map((e) => (
                <span
                  key={e.id}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    padding: "6px 10px",
                    borderRadius: 20,
                    background: "var(--accent-1-soft)",
                    color: "var(--accent-1)",
                  }}
                >
                  {e.word}
                  <span style={{ opacity: 0.7, marginInlineStart: 8, fontSize: 11 }}>
                    {SRS_BOX_LABELS[(srsBox && srsBox[e.id]) || 0]?.[isAr ? "ar" : "en"] || ""}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: "var(--input-bg)", borderRadius: 14, padding: 14, marginBottom: 16, border: "1px solid rgba(var(--border-rgb),0.12)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 8 }}>
            {tr(isAr, "SRS intervals (custom)", "فترات التكرار المتباعد (تخصيص)")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
            <label style={{ fontSize: 12, color: "var(--muted-strong)" }}>
              {tr(isAr, "Relearn (min)", "إعادة (دقائق)")}
              <input type="number" min={1} value={srsPrefs.learningMinutes}
                onChange={(e) => updateSrsPref("learningMinutes", Math.max(1, Number(e.target.value) || 10))}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 8, border: "1px solid rgba(var(--border-rgb),0.2)", background: "var(--input-bg)", color: INK }} />
            </label>
            <label style={{ fontSize: 12, color: "var(--muted-strong)" }}>
              {tr(isAr, "Graduate (days)", "تخرج (أيام)")}
              <input type="number" min={1} value={srsPrefs.graduatingDays}
                onChange={(e) => updateSrsPref("graduatingDays", Math.max(1, Number(e.target.value) || 1))}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 8, border: "1px solid rgba(var(--border-rgb),0.2)", background: "var(--input-bg)", color: INK }} />
            </label>
            <label style={{ fontSize: 12, color: "var(--muted-strong)" }}>
              {tr(isAr, "Easy bonus", "مكافأة السهل")}
              <input type="number" min={1.1} step={0.1} value={srsPrefs.easyBonus}
                onChange={(e) => updateSrsPref("easyBonus", Math.max(1.1, Number(e.target.value) || 1.3))}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 8, border: "1px solid rgba(var(--border-rgb),0.2)", background: "var(--input-bg)", color: INK }} />
            </label>
            <label style={{ fontSize: 12, color: "var(--muted-strong)" }}>
              {tr(isAr, "Hard factor", "معامل الصعب")}
              <input type="number" min={1.05} step={0.05} value={srsPrefs.hardFactor}
                onChange={(e) => updateSrsPref("hardFactor", Math.max(1.05, Number(e.target.value) || 1.2))}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 8, border: "1px solid rgba(var(--border-rgb),0.2)", background: "var(--input-bg)", color: INK }} />
            </label>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          {[
            { label: tr(isAr, "Quiz", "اختبار"), onClick: onOpenQuiz },
            { label: tr(isAr, "Flashcards", "بطاقات"), onClick: onOpenFlashcards },
            { label: tr(isAr, "Stats", "إحصائيات"), onClick: onOpenStats },
            { label: tr(isAr, "Calendar", "التقويم"), onClick: onOpenCalendar },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={b.onClick}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(var(--border-rgb),0.18)",
                background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                minHeight: 48,
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
