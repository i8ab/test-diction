import { useState, useEffect, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import {
  normalizeExamConfig,
  examCountdownParts,
  loadExamConfigCache,
} from "../../lib/state/exam";
import { selectExamPool } from "../../lib/utils/quizHelpers";
import { FlameIcon, CalendarIcon } from "../common/Icons";

/**
 * Fixed exam countdown banner.
 * - Visible to everyone when admin has enabled + set a date.
 * - No dismiss (X) for regular users — only admin can turn it off from settings.
 * - Color controlled by admin.
 * - Live countdown: weeks · days · hours · minutes · seconds
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
    if (!cfg.enabled || !cfg.date) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cfg.enabled, cfg.date]);

  const parts = useMemo(() => examCountdownParts(cfg, now), [cfg, now]);

  const weakCount = useMemo(
    () => selectExamPool(entries, studiedIds, srsDueAt, srsBox, studiedAt, 500).length,
    [entries, studiedIds, srsDueAt, srsBox, studiedAt]
  );

  // Hidden when admin hasn't enabled it
  if (!cfg.enabled || !cfg.date) {
    // Admins still see a small prompt to set it up (optional)
    if (isAdmin && typeof onOpenExamSettings === "function") {
      return (
        <div
          role="region"
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

  const accent = cfg.color || "#e85d04";
  const label = isAr
    ? (cfg.labelAr || "الامتحان")
    : (cfg.labelEn || "Exam");

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
      aria-label={tr(isAr, "Exam countdown", "عدّاد الامتحان")}
      style={{
        margin: 0,
        padding: "14px 14px 12px",
        borderRadius: 12,
        background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
        border: `1px solid ${accent}`,
        boxShadow: `0 8px 24px -10px ${accent}99`,
        color: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <FlameIcon size={18} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", opacity: 0.9 }}>
            {label}
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
