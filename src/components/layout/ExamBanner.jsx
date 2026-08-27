import { useState, useEffect, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import {
  normalizeExamConfig,
  examCountdownParts,
  loadExamConfigCache,
  getActiveExam,
  getExamQueueInfo,
  examItemTimestamp,
} from "../../lib/state/exam";
import { selectExamPool } from "../../lib/utils/quizHelpers";
import { FlameIcon, CalendarIcon } from "../common/Icons";

/**
 * Exam countdown banner — shows the *active* exam from the queue.
 * When that exam passes, the next one becomes active automatically.
 */
export default function ExamBanner({
  examConfig,
  entries,
  studiedIds,
  studiedAt,
  srsDueAt,
  srsBox,
  isAr,
  isAdmin = false,
  onOpenExamMode,
  onOpenExamSettings,
}) {
  const cfg = useMemo(
    () => normalizeExamConfig(examConfig || loadExamConfigCache()),
    [examConfig]
  );

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!cfg.enabled || !cfg.exams?.length) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cfg.enabled, cfg.exams]);

  const queue = useMemo(() => getExamQueueInfo(cfg, now), [cfg, now]);
  const active = queue.active;
  const parts = useMemo(() => {
    if (!active) {
      return { totalMs: 0, past: false, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0, totalDays: 0 };
    }
    // countdown against the active item only
    return examCountdownParts(
      { enabled: true, exams: [active], date: active.date, time: active.time },
      now
    );
  }, [active, now]);

  const weakCount = useMemo(
    () => selectExamPool(entries, studiedIds, srsDueAt, srsBox, studiedAt, 500).length,
    [entries, studiedIds, srsDueAt, srsBox, studiedAt]
  );

  if (!cfg.enabled || !cfg.exams?.length) {
    if (isAdmin && typeof onOpenExamSettings === "function") {
      return (
        <div
          role="region"
          dir={isAr ? "rtl" : "ltr"}
          style={{
            margin: 0,
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--input-bg)",
            border: "1px dashed rgba(var(--border-rgb),0.3)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <CalendarIcon size={16} color="var(--muted)" />
          <span style={{ flex: 1, fontSize: 13, color: "var(--muted-strong)" }}>
            {tr(isAr, "Exam countdown is off — set a date from Settings.", "عدّاد الامتحان متوقف — حدّد تاريخ من الإعدادات.")}
          </span>
          <button
            type="button"
            onClick={onOpenExamSettings}
            style={{
              padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(var(--border-rgb),0.25)",
              background: "var(--card)", color: "var(--ink)", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
            }}
          >
            {tr(isAr, "Set exam", "تحديد الامتحان")}
          </button>
        </div>
      );
    }
    return null;
  }

  if (!active) return null;

  const accent = active.color || cfg.color || "#e85d04";
  const label = isAr
    ? (active.labelAr || active.labelEn || "الامتحان")
    : (active.labelEn || active.labelAr || "Exam");

  const nextUpcoming = queue.sorted?.find((it) => {
    if (it.id === active.id) return false;
    const ts = examItemTimestamp(it);
    return ts != null && ts > now;
  });

  function Unit({ value, unitEn, unitAr }) {
    return (
      <div style={{
        minWidth: 44, textAlign: "center", padding: "6px 4px",
        background: "rgba(255,255,255,0.14)", borderRadius: 8,
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
          {String(value).padStart(2, "0")}
        </div>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.85)", marginTop: 2, letterSpacing: "0.02em" }}>
          {isAr ? unitAr : unitEn}
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      dir={isAr ? "rtl" : "ltr"}
      aria-label={tr(isAr, "Exam countdown", "عدّاد الامتحان")}
      style={{
        margin: 0,
        padding: "14px 14px 12px",
        borderRadius: 12,
        background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
        border: `1px solid ${accent}`,
        boxShadow: `0 8px 24px -10px ${accent}99`,
        color: "var(--on-accent, #fff)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <FlameIcon size={18} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", opacity: 0.9 }}>
            {label}
            {queue.total > 1 && (
              <span style={{ opacity: 0.85, fontWeight: 600 }}>
                {" · "}
                {tr(
                  isAr,
                  `${Math.min(queue.index + 1, queue.total)} of ${queue.total}`,
                  `${Math.min(queue.index + 1, queue.total)} من ${queue.total}`
                )}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 1 }}>
            {parts.past
              ? tr(isAr, "Exam has passed", "الامتحان عدّى")
              : tr(isAr, "Time remaining", "الوقت المتبقي")}
          </div>
        </div>
        {isAdmin && typeof onOpenExamSettings === "function" && (
          <button
            type="button"
            onClick={onOpenExamSettings}
            style={{
              padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.35)",
              background: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 600, fontSize: 11.5, cursor: "pointer",
            }}
          >
            {tr(isAr, "Edit", "تعديل")}
          </button>
        )}
      </div>

      {!parts.past && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {(parts.weeks > 0 || parts.totalDays >= 7) && (
            <Unit value={parts.weeks} unitEn="WEEKS" unitAr="أسبوع" />
          )}
          <Unit value={parts.days} unitEn="DAYS" unitAr="يوم" />
          <Unit value={parts.hours} unitEn="HRS" unitAr="ساعة" />
          <Unit value={parts.minutes} unitEn="MIN" unitAr="دقيقة" />
          <Unit value={parts.seconds} unitEn="SEC" unitAr="ثانية" />
        </div>
      )}

      {parts.past && nextUpcoming && (
        <div style={{ fontSize: 12.5, marginBottom: 10, opacity: 0.95 }}>
          {tr(
            isAr,
            `Next: ${nextUpcoming.labelAr || nextUpcoming.labelEn || nextUpcoming.date}`,
            `التالي: ${nextUpcoming.labelEn || nextUpcoming.labelAr || nextUpcoming.date}`
          )}
        </div>
      )}

      {!parts.past && nextUpcoming && queue.total > 1 && (
        <div style={{ fontSize: 11.5, marginBottom: 8, opacity: 0.88 }}>
          {tr(
            isAr,
            `After this → ${nextUpcoming.labelAr || nextUpcoming.labelEn || nextUpcoming.date}`,
            `بعده → ${nextUpcoming.labelEn || nextUpcoming.labelAr || nextUpcoming.date}`
          )}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12.5, opacity: 0.95 }}>
          {weakCount > 0
            ? tr(isAr, `${weakCount} weak/due words`, `${weakCount} كلمة ضعيفة/مستحقة`)
            : tr(isAr, "No weak words right now", "مفيش كلمات ضعيفة دلوقتي")}
        </span>
        {weakCount > 0 && typeof onOpenExamMode === "function" && (
          <button
            type="button"
            onClick={onOpenExamMode}
            style={{
              marginInlineStart: "auto",
              padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.4)",
              background: "rgba(255,255,255,0.2)", color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 5,
            }}
          >
            <FlameIcon size={13} />
            {tr(isAr, "Exam practice", "تدريب الامتحان")}
          </button>
        )}
      </div>
    </div>
  );
}
