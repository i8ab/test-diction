import { useState, useEffect, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import {
  loadExamDate, saveExamDate, daysUntilExam, formatExamCountdown,
  loadExamPrefs, saveExamPrefs,
} from "../../lib/state/exam";
import { selectExamPool } from "../../lib/utils/quizHelpers";
import { FlameIcon, XIcon, CalendarIcon } from "../common/Icons";

const DISMISS_KEY = "twoTongues.examBannerDismissedOn";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Banner shown above the dictionary when an exam date is set.
 * Shows days remaining + weak/due count + quick start Exam Mode.
 * User can set/clear the exam date from this banner.
 */
export default function ExamBanner({
  entries,
  studiedIds,
  studiedAt,
  srsDueAt,
  srsBox,
  isAr,
  onOpenExamMode,
}) {
  const [examDate, setExamDate] = useState(() => loadExamDate());
  const [prefs, setPrefs] = useState(() => loadExamPrefs());
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === todayKey(); } catch (_) { return false; }
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(examDate || "");

  const days = daysUntilExam(examDate);
  const countdown = formatExamCountdown(days, isAr);

  const weakCount = useMemo(
    () => selectExamPool(entries, studiedIds, srsDueAt, srsBox, studiedAt, 500).length,
    [entries, studiedIds, srsDueAt, srsBox, studiedAt]
  );

  // Show when: prefs on, not dismissed today, and either date is set OR user wants to set one
  // Always allow setting a date even if none is set — but keep the banner compact.
  const show = prefs.bannerEnabled && !dismissed;

  if (!show) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, todayKey()); } catch (_) {}
    setDismissed(true);
  }

  function applyDate() {
    const v = draft.trim();
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      saveExamDate(v);
      setExamDate(v);
    } else if (!v) {
      saveExamDate(null);
      setExamDate(null);
    }
    setEditing(false);
  }

  function clearDate() {
    saveExamDate(null);
    setExamDate(null);
    setDraft("");
    setEditing(false);
  }

  const urgent = days != null && days >= 0 && days <= 7;
  const past = days != null && days < 0;

  return (
    <div
      role="region"
      aria-label={tr(isAr, "Exam reminder", "تذكير الامتحان")}
      style={{
        margin: "0 0 12px",
        padding: "12px 14px",
        borderRadius: 10,
        background: urgent
          ? "linear-gradient(135deg, rgba(232,93,4,0.12), rgba(244,162,97,0.1))"
          : past
            ? "var(--input-bg)"
            : "linear-gradient(135deg, rgba(25,167,206,0.1), rgba(91,141,239,0.08))",
        border: `1px solid ${urgent ? "rgba(232,93,4,0.35)" : "rgba(var(--border-rgb),0.15)"}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: urgent ? "rgba(232,93,4,0.18)" : "rgba(25,167,206,0.15)",
          color: urgent ? "#e85d04" : "var(--accent-1)",
        }}>
          <FlameIcon size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: "var(--ink)",
            marginBottom: 2, lineHeight: 1.35,
          }}>
            {examDate
              ? countdown
              : tr(isAr, "Set your exam date", "حدّد تاريخ امتحانك")}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.4 }}>
            {examDate
              ? tr(isAr,
                  weakCount > 0
                    ? `${weakCount} weak/due words need practice`
                    : "No weak words right now — keep studying!",
                  weakCount > 0
                    ? `${weakCount} كلمة ضعيفة/مستحقة تحتاج تدريب`
                    : "مفيش كلمات ضعيفة دلوقتي — كمّل مذاكرة!")
              : tr(isAr,
                  "We’ll remind you how many days are left and how many weak words to review.",
                  "هنورّيك فاضل كام يوم و كام كلمة ضعيفة تحتاج مراجعة.")}
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={tr(isAr, "Dismiss for today", "إخفاء لليوم")}
          style={{
            border: "none", background: "none", cursor: "pointer",
            color: "var(--icon-muted)", padding: 4, borderRadius: 8,
            flexShrink: 0, lineHeight: 0,
          }}
        >
          <XIcon size={16} />
        </button>
      </div>

      {editing ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <input
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{
              padding: "8px 10px", borderRadius: 8, fontSize: 14,
              border: "1px solid rgba(var(--border-rgb),0.25)",
              background: "var(--card)", color: "var(--ink)",
            }}
          />
          <button type="button" onClick={applyDate}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "none",
              background: "var(--accent-1)", color: "#fff", fontWeight: 700,
              fontSize: 13, cursor: "pointer",
            }}>
            {tr(isAr, "Save", "حفظ")}
          </button>
          {examDate && (
            <button type="button" onClick={clearDate}
              style={{
                padding: "8px 12px", borderRadius: 8,
                border: "1px solid rgba(var(--border-rgb),0.25)",
                background: "none", color: "var(--danger)", fontWeight: 600,
                fontSize: 13, cursor: "pointer",
              }}>
              {tr(isAr, "Clear", "مسح")}
            </button>
          )}
          <button type="button" onClick={() => setEditing(false)}
            style={{
              padding: "8px 12px", borderRadius: 8,
              border: "1px solid rgba(var(--border-rgb),0.25)",
              background: "none", color: "var(--muted-strong)", fontWeight: 600,
              fontSize: 13, cursor: "pointer",
            }}>
            {tr(isAr, "Cancel", "إلغاء")}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {examDate && weakCount > 0 && typeof onOpenExamMode === "function" && (
            <button
              type="button"
              onClick={onOpenExamMode}
              style={{
                padding: "8px 14px", borderRadius: 8, border: "none",
                background: "linear-gradient(135deg, #e85d04, #f4a261)",
                color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <FlameIcon size={14} />
              {tr(isAr, "Start exam practice", "ابدأ تدريب الامتحان")}
            </button>
          )}
          <button
            type="button"
            onClick={() => { setDraft(examDate || ""); setEditing(true); }}
            style={{
              padding: "8px 12px", borderRadius: 8,
              border: "1px solid rgba(var(--border-rgb),0.25)",
              background: "var(--card)", color: "var(--muted-strong)",
              fontWeight: 600, fontSize: 13, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <CalendarIcon size={14} />
            {examDate
              ? tr(isAr, "Change date", "تغيير التاريخ")
              : tr(isAr, "Set exam date", "تحديد تاريخ الامتحان")}
          </button>
        </div>
      )}
    </div>
  );
}
