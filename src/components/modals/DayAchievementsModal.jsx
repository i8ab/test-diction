/**
 * Day achievements — table layout, recall % at review, weakness notes per review.
 */
import { useState, useEffect, useMemo, Fragment } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, primaryBtnStyle } from "../../lib/config/theme";
import { XIcon, CheckIcon, PlusIcon, TrashIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import {
  loadDayAchievements,
  saveDayAchievements,
  loadDayAchievementNotifsEnabled,
  saveDayAchievementNotifsEnabled,
  createDayAchievement,
  recordDayAchievementReview,
  getDueDayAchievements,
  formatDayAchievementDue,
  todayISO,
  MEDICAL_SRS_LABELS,
  computeNextDueAt,
  notifyAllDueDayAchievements,
  purgeExpiredDayAchievements,
  syncDayAchievementPushSchedule,
  startDayAchievementDueWatcher,
  previewReviewOutcome,
  clampRecallPercent,
} from "../../lib/state/dayAchievements";

function dueDateLabel(ms, isAr) {
  if (ms == null) return "—";
  const d = new Date(ms);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const rel = formatDayAchievementDue(ms, isAr);
  return { iso, rel };
}

export default function DayAchievementsModal({
  onClose,
  isAr = false,
  accountCode = "",
  onDueCountChange,
}) {
  const [list, setList] = useState(() => loadDayAchievements(accountCode));
  const [notifsOn, setNotifsOn] = useState(() => loadDayAchievementNotifsEnabled(accountCode));
  const [draftTitle, setDraftTitle] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [draftDate, setDraftDate] = useState(() => todayISO());
  const [draftUseSrs, setDraftUseSrs] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("all");
  /** { [id]: { percent, weaknessNote } } while reviewing */
  const [recallDraft, setRecallDraft] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setList((prev) => purgeExpiredDayAchievements(prev));
  }, []);

  useEffect(() => {
    saveDayAchievements(list, accountCode);
    onDueCountChange?.(getDueDayAchievements(list).length);
  }, [list, accountCode, onDueCountChange]);

  useEffect(() => {
    saveDayAchievementNotifsEnabled(notifsOn, accountCode);
  }, [notifsOn, accountCode]);

  // Sync due SRS items to server → real Web Push via same cron as study reminders
  useEffect(() => {
    if (!accountCode || accountCode === "guest") return;
    const t = setTimeout(() => {
      syncDayAchievementPushSchedule(accountCode, list, notifsOn).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [list, accountCode, notifsOn]);

  // Precise local timers while this screen (or app) is active
  useEffect(() => {
    const stop = startDayAchievementDueWatcher({
      accountCode,
      enabled: notifsOn,
      isAr,
      intervalMs: 60 * 1000,
      getList: () => list,
    });
    return () => { try { stop(); } catch (_) {} };
  }, [list, accountCode, notifsOn, isAr]);

  useEffect(() => {
    if (!notifsOn) return;
    let cancelled = false;
    (async () => {
      if (!cancelled) await notifyAllDueDayAchievements(list, isAr, true);
    })();
    return () => {
      cancelled = true;
    };
  }, [list, notifsOn, isAr]);

  const dueCount = useMemo(() => getDueDayAchievements(list).length, [list]);

  const visible = useMemo(() => {
    let arr = [...list];
    if (filter === "due") arr = getDueDayAchievements(arr);
    else if (filter === "srs") arr = arr.filter((e) => e.useSrs);
    arr.sort((a, b) => {
      // Sort by next review date ascending (soonest first). Non-SRS fall to the end by their day date.
      const now = Date.now();
      const rank = (e) => {
        if (e.useSrs && e.srsDueAt != null) return Number(e.srsDueAt);
        // non-SRS: sort by calendar date at end of list band
        if (e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
          return Date.parse(e.date + "T23:59:59") || Number.MAX_SAFE_INTEGER - 1;
        }
        return Number.MAX_SAFE_INTEGER;
      };
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      // Due items (past dueAt) already naturally first via timestamp
      return String(a.title || "").localeCompare(String(b.title || ""), isAr ? "ar" : "en");
    });
    return arr;
  }, [list, filter]);

  function resetDraft() {
    setDraftTitle("");
    setDraftNote("");
    setDraftDate(todayISO());
    setDraftUseSrs(true);
    setEditingId(null);
  }

  function startEdit(entry) {
    setEditingId(entry.id);
    setDraftTitle(entry.title);
    setDraftNote(entry.note || "");
    setDraftDate(entry.date || todayISO());
    setDraftUseSrs(!!entry.useSrs);
  }

  function submitEntry(e) {
    e?.preventDefault?.();
    const title = draftTitle.trim();
    if (!title) return;

    if (editingId) {
      setList((prev) =>
        prev.map((item) => {
          if (item.id !== editingId) return item;
          const next = {
            ...item,
            title,
            note: draftNote.trim(),
            date: draftDate,
            useSrs: draftUseSrs,
            updatedAt: Date.now(),
          };
          if (draftUseSrs && !item.useSrs) {
            next.srsLevel = 0;
            next.srsDueAt = computeNextDueAt(0);
          }
          if (!draftUseSrs) next.srsDueAt = null;
          return next;
        })
      );
    } else {
      setList((prev) => [
        createDayAchievement({
          title,
          note: draftNote.trim(),
          date: draftDate,
          useSrs: draftUseSrs,
        }),
        ...prev,
      ]);
    }
    resetDraft();
  }

  function removeEntry(id) {
    setList((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) resetDraft();
  }

  function patchRecall(id, patch) {
    setRecallDraft((prev) => ({
      ...prev,
      [id]: {
        percent: clampRecallPercent(prev[id]?.percent ?? 70),
        weaknessNote: prev[id]?.weaknessNote || "",
        ...patch,
        ...(patch.percent != null ? { percent: clampRecallPercent(patch.percent) } : {}),
      },
    }));
  }

  function submitRecallReview(id) {
    const draft = recallDraft[id] || {};
    const pct = clampRecallPercent(draft.percent ?? 70);
    const weaknessNote = String(draft.weaknessNote || "").trim().slice(0, 800);
    setList((prev) =>
      prev.map((item) =>
        item.id === id ? recordDayAchievementReview(item, pct, { weaknessNote }) : item
      )
    );
    setRecallDraft((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setExpandedId(null);
  }

  const inputStyle = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(var(--border-rgb),0.18)",
    background: "var(--input-bg)",
    color: INK,
    fontSize: 14,
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
  };

  const thStyle = {
    textAlign: isAr ? "right" : "left",
    padding: "10px 12px",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--muted)",
    borderBottom: "1px solid rgba(var(--border-rgb),0.14)",
    whiteSpace: "nowrap",
    background: "color-mix(in srgb, var(--card) 70%, var(--input-bg))",
  };

  const tdStyle = {
    padding: "12px 12px",
    fontSize: 13,
    color: INK,
    borderBottom: "1px solid rgba(var(--border-rgb),0.08)",
    verticalAlign: "middle",
  };

  return (
    <div
      onClick={onClose}
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.52)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        zIndex: 6000,
      }}
    >
      <BodyScrollLock />
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-card"
        dir={isAr ? "rtl" : "ltr"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-ach-title"
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "94vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: CARD,
          borderRadius: 22,
          padding: "18px 16px 14px",
          boxShadow: "0 28px 64px -18px rgba(0,0,0,0.5)",
          border: "1px solid rgba(var(--border-rgb),0.1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
            gap: 8,
            flexShrink: 0,
          }}
        >
          <h2
            id="day-ach-title"
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 19,
              fontWeight: 600,
              color: INK,
              margin: 0,
            }}
          >
            {tr(isAr, "Day achievements", "إنجازات اليوم")}
            {dueCount > 0 && (
              <span
                style={{
                  marginInlineStart: 8,
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#fff",
                  background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                  borderRadius: 999,
                  padding: "3px 9px",
                  verticalAlign: "middle",
                }}
              >
                {dueCount} {tr(isAr, "due", "مستحق")}
              </span>
            )}
          </h2>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              style={{
                border: "1px solid rgba(var(--border-rgb),0.2)",
                background: showHelp ? "var(--accent-1-soft)" : "var(--input-bg)",
                cursor: "pointer",
                color: "var(--muted-strong)",
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 10px",
                borderRadius: 10,
              }}
            >
              {tr(isAr, "How it works", "إزاي بتشتغل؟")}
            </button>
            <button
              onClick={onClose}
              aria-label={tr(isAr, "Close", "إغلاق")}
              style={{
                border: "none",
                background: "rgba(var(--border-rgb),0.1)",
                cursor: "pointer",
                color: "var(--icon-muted)",
                width: 36,
                height: 36,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
              }}
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          {showHelp && (
            <div
              style={{
                marginBottom: 12,
                padding: "12px 14px",
                borderRadius: 14,
                background: "var(--input-bg)",
                border: "1px solid rgba(var(--border-rgb),0.12)",
                fontSize: 13,
                lineHeight: 1.55,
                color: "var(--muted-strong)",
              }}
            >
              <strong style={{ color: INK }}>
                {tr(isAr, "Two consecutive successes", "نجاحين متتاليين")}
              </strong>
              <p style={{ margin: "6px 0 0" }}>
                {tr(
                  isAr,
                  "To move up the medical ladder (e.g. from Day 3 → Week 1), you need two good reviews in a row (about 75%+ recall each time, without a weak score in between). One excellent score (90%+) can promote faster. A weak recall resets the streak and may lower the step.",
                  "عشان تطلع درجة في السلّم الطبي (مثلاً من يوم ٣ ← أسبوع ١) لازم تذاكر كويس مرتين ورا بعض (حوالي ٧٥٪+ تذكر كل مرة، من غير تقييم ضعيف في النص). درجة ممتازة (٩٠٪+) ممكن ترقّيك أسرع. التذكر الضعيف بيصفر السلسلة وقد ينزّلك درجة."
                )}
              </p>
              <p style={{ margin: "8px 0 0" }}>
                {tr(
                  isAr,
                  "At review time you enter recall % (1–100). The system picks the next date. You can also write weakness notes for that review.",
                  "وقت المراجعة تكتب نسبة التذكر (١–١٠٠). النظام يختار تاريخ المراجعة الجاية. وتقدر تكتب ملاحظات نقاط ضعفك لهذه المراجعة."
                )}
              </p>
            </div>
          )}

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
              fontSize: 13,
              color: "var(--muted-strong)",
              cursor: "pointer",
              padding: "10px 12px",
              borderRadius: 12,
              background: "var(--input-bg)",
              border: "1px solid rgba(var(--border-rgb),0.12)",
            }}
          >
            <input
              type="checkbox"
              checked={notifsOn}
              onChange={(e) => setNotifsOn(e.target.checked)}
            />
            <span>
              {tr(
                isAr,
                "Notify when a review is due",
                "نبّهني عند استحقاق مراجعة"
              )}
            </span>
          </label>

          {/* Add / edit form */}
          <form
            onSubmit={submitEntry}
            style={{
              marginBottom: 14,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 12,
              borderRadius: 16,
              background: "linear-gradient(160deg, var(--accent-1-soft), transparent 70%)",
              border: "1px solid rgba(var(--border-rgb),0.1)",
            }}
          >
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder={tr(isAr, "What did you achieve today?", "ماذا أنجزت اليوم؟")}
              maxLength={200}
              required
              style={inputStyle}
            />
            <textarea
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              placeholder={tr(isAr, "Optional general note…", "ملاحظة عامة اختيارية…")}
              rows={2}
              maxLength={800}
              style={{ ...inputStyle, resize: "vertical", fontSize: 13 }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <input
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                style={{ ...inputStyle, width: "auto", padding: "7px 10px" }}
              />
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  color: "var(--muted-strong)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={draftUseSrs}
                  onChange={(e) => setDraftUseSrs(e.target.checked)}
                />
                {tr(
                  isAr,
                  "Spaced repetition (rate recall when reviewing)",
                  "تكرار متباعد (تقيّم التذكر عند المراجعة)"
                )}
              </label>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                disabled={!draftTitle.trim()}
                style={{
                  ...primaryBtnStyle,
                  opacity: draftTitle.trim() ? 1 : 0.5,
                  flex: 1,
                  borderRadius: 14,
                }}
              >
                <PlusIcon size={14} />{" "}
                {editingId
                  ? tr(isAr, "Save changes", "حفظ التعديلات")
                  : tr(isAr, "Add achievement", "إضافة إنجاز")}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetDraft}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 14,
                    border: "1px solid rgba(var(--border-rgb),0.2)",
                    background: "var(--card)",
                    color: "var(--muted-strong)",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {tr(isAr, "Cancel", "إلغاء")}
                </button>
              )}
            </div>
          </form>

          {/* Filters */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {[
              { id: "all", en: "All", ar: "الكل" },
              { id: "due", en: "Due", ar: "مستحق" },
              { id: "srs", en: "SRS only", ar: "تكرار فقط" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: filter === f.id ? BRASS : "rgba(var(--border-rgb),0.08)",
                  color: filter === f.id ? "#fff" : "var(--muted-strong)",
                }}
              >
                {tr(isAr, f.en, f.ar)}
              </button>
            ))}
          </div>

          {/* Table */}
          {visible.length === 0 ? (
            <p
              style={{
                fontSize: 13,
                color: "var(--muted)",
                textAlign: "center",
                padding: "28px 16px",
                borderRadius: 16,
                background: "var(--input-bg)",
              }}
            >
              {tr(
                isAr,
                "No items yet. Add one above.",
                "لا توجد عناصر بعد. أضف واحداً أعلاه."
              )}
            </p>
          ) : (
            <div
              style={{
                borderRadius: 16,
                border: "1px solid rgba(var(--border-rgb),0.12)",
                overflow: "hidden",
                background: "var(--card)",
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 520,
                  }}
                >
                  <thead>
                    <tr>
                      <th style={thStyle}>{tr(isAr, "Item", "العنصر")}</th>
                      <th style={thStyle}>{tr(isAr, "Step", "الدرجة")}</th>
                      <th style={thStyle}>{tr(isAr, "Next review", "المراجعة الجاية")}</th>
                      <th style={thStyle}>{tr(isAr, "Streak", "سلسلة")}</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>
                        {tr(isAr, "Actions", "إجراءات")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((entry) => {
                      const isDue =
                        entry.useSrs &&
                        entry.srsDueAt != null &&
                        entry.srsDueAt <= Date.now();
                      const box =
                        MEDICAL_SRS_LABELS[entry.srsLevel] || MEDICAL_SRS_LABELS[0];
                      const due = entry.useSrs
                        ? dueDateLabel(entry.srsDueAt, isAr)
                        : null;
                      const open = expandedId === entry.id;
                      const pct = clampRecallPercent(
                        recallDraft[entry.id]?.percent ?? 70
                      );
                      const preview = entry.useSrs
                        ? previewReviewOutcome(entry, pct, isAr)
                        : null;
                      const weaknessLogs = Array.isArray(entry.weaknessNotes)
                        ? entry.weaknessNotes
                        : [];

                      return (
                        <Fragment key={entry.id}>
                          <tr
                            style={{
                              background: isDue
                                ? "var(--accent-1-soft)"
                                : "transparent",
                            }}
                          >
                            <td style={tdStyle}>
                              <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                                {entry.title}
                              </div>
                              {entry.note ? (
                                <div
                                  style={{
                                    fontSize: 11.5,
                                    color: "var(--muted)",
                                    marginTop: 2,
                                    maxWidth: 200,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {entry.note}
                                </div>
                              ) : null}
                              {!entry.useSrs && (
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: "var(--muted)",
                                    marginTop: 2,
                                  }}
                                >
                                  {tr(isAr, "Expires overnight", "ينتهي مع نهاية اليوم")} ·{" "}
                                  {entry.date}
                                </div>
                              )}
                              {entry.lastRecallPercent != null && (
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: "var(--muted)",
                                    marginTop: 2,
                                  }}
                                >
                                  {tr(isAr, "Last recall", "آخر تذكر")}:{" "}
                                  {entry.lastRecallPercent}%
                                </div>
                              )}
                            </td>
                            <td style={tdStyle}>
                              {entry.useSrs ? (
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "3px 8px",
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: "rgba(var(--border-rgb),0.1)",
                                    color: "var(--accent-1)",
                                  }}
                                >
                                  {tr(isAr, box.en, box.ar)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td style={tdStyle}>
                              {entry.useSrs && due ? (
                                <div>
                                  <div
                                    style={{
                                      fontWeight: 700,
                                      fontSize: 13,
                                      color: isDue ? "var(--accent-1)" : INK,
                                    }}
                                  >
                                    {due.iso}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: isDue
                                        ? "var(--accent-1)"
                                        : "var(--muted)",
                                      fontWeight: isDue ? 800 : 600,
                                    }}
                                  >
                                    {isDue
                                      ? tr(isAr, "Due now", "مستحق الآن")
                                      : due.rel}
                                  </div>
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td style={tdStyle}>
                              {entry.useSrs ? (
                                <span style={{ fontWeight: 700 }}>
                                  {entry.correctStreak || 0}
                                  <span
                                    style={{
                                      fontSize: 10,
                                      color: "var(--muted)",
                                      fontWeight: 600,
                                      marginInlineStart: 4,
                                    }}
                                  >
                                    /2
                                  </span>
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 4,
                                  justifyContent: "center",
                                  flexWrap: "wrap",
                                }}
                              >
                                {entry.useSrs && isDue && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedId(open ? null : entry.id)
                                    }
                                    style={{
                                      padding: "5px 10px",
                                      borderRadius: 8,
                                      border: "none",
                                      background: "var(--accent-1)",
                                      color: "#fff",
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {open
                                      ? tr(isAr, "Close", "إغلاق")
                                      : tr(isAr, "Review", "مراجعة")}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => startEdit(entry)}
                                  style={{
                                    padding: "5px 8px",
                                    borderRadius: 8,
                                    border: "1px solid rgba(var(--border-rgb),0.2)",
                                    background: "var(--card)",
                                    color: "var(--muted-strong)",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  {tr(isAr, "Edit", "تعديل")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeEntry(entry.id)}
                                  style={{
                                    padding: "5px 8px",
                                    borderRadius: 8,
                                    border: "none",
                                    background: "transparent",
                                    color: "#ef4444",
                                    cursor: "pointer",
                                  }}
                                  aria-label={tr(isAr, "Delete", "حذف")}
                                >
                                  <TrashIcon size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded review + weakness notes row */}
                          {(open || weaknessLogs.length > 0) && (
                            <tr>
                              <td
                                colSpan={5}
                                style={{
                                  padding: open ? "12px 14px 16px" : "8px 14px 12px",
                                  background: isDue
                                    ? "color-mix(in srgb, var(--accent-1-soft) 80%, var(--card))"
                                    : "var(--input-bg)",
                                  borderBottom: "1px solid rgba(var(--border-rgb),0.1)",
                                }}
                              >
                                {open && entry.useSrs && isDue && (
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 10,
                                      marginBottom: weaknessLogs.length ? 12 : 0,
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: 12.5,
                                        fontWeight: 700,
                                        color: "var(--muted-strong)",
                                      }}
                                    >
                                      {tr(
                                        isAr,
                                        "How well did you remember? (1–100%)",
                                        "قدّر نسبة تذكرك (١–١٠٠٪)"
                                      )}
                                    </div>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 8,
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <input
                                        type="number"
                                        min={1}
                                        max={100}
                                        value={pct}
                                        onChange={(e) =>
                                          patchRecall(entry.id, {
                                            percent: e.target.value,
                                          })
                                        }
                                        style={{
                                          width: 72,
                                          padding: "8px 10px",
                                          borderRadius: 10,
                                          border: "1px solid rgba(var(--border-rgb),0.2)",
                                          background: "var(--card)",
                                          color: INK,
                                          fontWeight: 700,
                                          fontSize: 14,
                                          fontFamily: "inherit",
                                        }}
                                      />
                                      <input
                                        type="range"
                                        min={1}
                                        max={100}
                                        value={pct}
                                        onChange={(e) =>
                                          patchRecall(entry.id, {
                                            percent: e.target.value,
                                          })
                                        }
                                        style={{
                                          flex: 1,
                                          minWidth: 120,
                                          accentColor: "var(--accent-1)",
                                        }}
                                      />
                                      <span
                                        style={{
                                          fontSize: 14,
                                          fontWeight: 800,
                                          color: "var(--accent-1)",
                                        }}
                                      >
                                        {pct}%
                                      </span>
                                    </div>
                                    {preview && (
                                      <div
                                        style={{
                                          fontSize: 12,
                                          color: "var(--muted-strong)",
                                        }}
                                      >
                                        {tr(
                                          isAr,
                                          `Next: ${preview.levelLabel} · ${preview.intervalLabel}`,
                                          `الجاي: ${preview.levelLabel} · ${preview.intervalLabel}`
                                        )}
                                        {(entry.correctStreak || 0) === 1 &&
                                          pct >= 75 && (
                                            <span
                                              style={{
                                                marginInlineStart: 6,
                                                color: "var(--accent-1)",
                                                fontWeight: 700,
                                              }}
                                            >
                                              {tr(
                                                isAr,
                                                "(1 success already — this good score can promote)",
                                                "(عندك نجاح واحد — التقييم الجيد ده ممكن يرقّيك)"
                                              )}
                                            </span>
                                          )}
                                      </div>
                                    )}
                                    <label
                                      style={{
                                        fontSize: 12.5,
                                        fontWeight: 700,
                                        color: "var(--muted-strong)",
                                      }}
                                    >
                                      {tr(
                                        isAr,
                                        "Weakness notes for this review (optional)",
                                        "ملاحظات نقاط الضعف لهذه المراجعة (اختياري)"
                                      )}
                                    </label>
                                    <textarea
                                      value={recallDraft[entry.id]?.weaknessNote || ""}
                                      onChange={(e) =>
                                        patchRecall(entry.id, {
                                          weaknessNote: e.target.value,
                                        })
                                      }
                                      placeholder={tr(
                                        isAr,
                                        "e.g. mixed up terms X and Y, forgot formula…",
                                        "مثال: لخبطت بين مصطلح س و ص، نسيت القانون…"
                                      )}
                                      rows={2}
                                      maxLength={800}
                                      style={{
                                        ...inputStyle,
                                        resize: "vertical",
                                        fontSize: 13,
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => submitRecallReview(entry.id)}
                                      style={{
                                        padding: "11px 12px",
                                        borderRadius: 12,
                                        border: "none",
                                        cursor: "pointer",
                                        background:
                                          "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                                        color: "#fff",
                                        fontWeight: 700,
                                        fontSize: 13,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 6,
                                        alignSelf: "stretch",
                                      }}
                                    >
                                      <CheckIcon size={14} />{" "}
                                      {tr(
                                        isAr,
                                        "Confirm & schedule next review",
                                        "تأكيد وجدولة المراجعة الجاية"
                                      )}
                                    </button>
                                  </div>
                                )}

                                {weaknessLogs.length > 0 && (
                                  <div>
                                    <div
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 800,
                                        color: "var(--muted)",
                                        marginBottom: 6,
                                        letterSpacing: "0.03em",
                                        textTransform: "uppercase",
                                      }}
                                    >
                                      {tr(
                                        isAr,
                                        "Weakness log",
                                        "سجل نقاط الضعف"
                                      )}
                                    </div>
                                    <ul
                                      style={{
                                        margin: 0,
                                        paddingInlineStart: 18,
                                        fontSize: 12.5,
                                        color: "var(--muted-strong)",
                                        lineHeight: 1.45,
                                      }}
                                    >
                                      {weaknessLogs
                                        .slice()
                                        .reverse()
                                        .slice(0, 5)
                                        .map((w, i) => (
                                          <li key={i} style={{ marginBottom: 4 }}>
                                            <span
                                              style={{
                                                fontWeight: 700,
                                                color: INK,
                                              }}
                                            >
                                              {w.at
                                                ? new Date(w.at).toLocaleDateString()
                                                : "—"}
                                              {w.percent != null
                                                ? ` · ${w.percent}%`
                                                : ""}
                                              :
                                            </span>{" "}
                                            {w.text}
                                          </li>
                                        ))}
                                    </ul>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
