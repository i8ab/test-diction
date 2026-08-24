/**
 * Day achievements manager with optional spaced repetition + notifications toggle.
 * All user-facing text is English (Arabic via tr() when isAr).
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, primaryBtnStyle } from "../../lib/config/theme";
import { XIcon, CheckIcon, PlusIcon, TrashIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { SRS_BOX_LABELS } from "../../lib/utils/quizHelpers";
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
} from "../../lib/state/dayAchievements";

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
  const [filter, setFilter] = useState("all"); // all | due | srs

  useEffect(() => {
    saveDayAchievements(list, accountCode);
    onDueCountChange?.(getDueDayAchievements(list).length);
  }, [list, accountCode, onDueCountChange]);

  useEffect(() => {
    saveDayAchievementNotifsEnabled(notifsOn, accountCode);
  }, [notifsOn, accountCode]);

  // Browser Notification alerts for due SRS items when toggle is on
  useEffect(() => {
    if (!notifsOn) return;
    const due = getDueDayAchievements(list);
    if (!due.length) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    let cancelled = false;
    async function maybeNotify() {
      try {
        let perm = Notification.permission;
        if (perm === "default") {
          perm = await Notification.requestPermission();
        }
        if (cancelled || perm !== "granted") return;
        // Avoid spamming: one notification summarizing due items
        const key = `dayAchNotif.${due.map((d) => d.id).sort().join(",")}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
        const title = tr(isAr, "Spaced repetition due", "مراجعة متباعدة مستحقة");
        const body = due.length === 1
          ? due[0].title
          : tr(isAr, `${due.length} day achievements need review`, `${due.length} إنجازات يومية تحتاج مراجعة`);
        new Notification(title, { body, tag: "day-achievement-srs" });
      } catch (_) {}
    }
    maybeNotify();
    return () => { cancelled = true; };
  }, [list, notifsOn, isAr]);

  const dueCount = useMemo(() => getDueDayAchievements(list).length, [list]);

  const visible = useMemo(() => {
    let arr = [...list];
    if (filter === "due") arr = getDueDayAchievements(arr);
    else if (filter === "srs") arr = arr.filter((e) => e.useSrs);
    arr.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
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
          // If SRS newly enabled and no due date yet, schedule first interval
          if (draftUseSrs && !item.useSrs && item.srsDueAt == null) {
            next.srsDueAt = Date.now() + 10 * 60 * 1000;
            next.srsLevel = 0;
          }
          if (!draftUseSrs) {
            next.srsDueAt = null;
          }
          return next;
        })
      );
    } else {
      const created = createDayAchievement({
        title,
        note: draftNote.trim(),
        date: draftDate,
        useSrs: draftUseSrs,
      });
      setList((prev) => [created, ...prev]);
    }
    resetDraft();
  }

  function removeEntry(id) {
    setList((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) resetDraft();
  }

  function markReview(id, correct) {
    setList((prev) =>
      prev.map((item) => (item.id === id ? recordDayAchievementReview(item, correct) : item))
    );
  }

  return (
    <div
      onClick={onClose}
      className="modal-backdrop"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, zIndex: 6000,
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
          width: "100%", maxWidth: 520, maxHeight: "92vh", overflow: "hidden",
          display: "flex", flexDirection: "column", background: CARD, borderRadius: 20,
          padding: "20px 18px 18px", boxShadow: "0 24px 60px -16px rgba(0,0,0,0.45)",
          border: "1px solid rgba(var(--border-rgb),0.1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexShrink: 0 }}>
          <h2 id="day-ach-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0 }}>
            {tr(isAr, "Day achievements", "إنجازات اليوم")}
            {dueCount > 0 && (
              <span style={{ marginInlineStart: 8, fontSize: 12, fontWeight: 700, color: BRASS }}>
                · {dueCount} {tr(isAr, "due", "مستحق")}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", width: 36, height: 36 }}
          >
            <XIcon size={20} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          {/* Notifications toggle */}
          <label style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
            fontSize: 13.5, color: "var(--muted-strong)", cursor: "pointer",
            padding: "10px 12px", borderRadius: 12, background: "var(--input-bg)",
            border: "1px solid rgba(var(--border-rgb),0.12)",
          }}>
            <input
              type="checkbox"
              checked={notifsOn}
              onChange={(e) => setNotifsOn(e.target.checked)}
            />
            <span>
              {tr(isAr, "Notify me when spaced-repetition items are due", "نبّهني عند استحقاق عناصر التكرار المتباعد")}
            </span>
          </label>

          {/* Create / edit form */}
          <form onSubmit={submitEntry} style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder={tr(isAr, "What did you achieve today?", "ما الذي أنجزته اليوم؟")}
              maxLength={200}
              required
              style={{
                padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(var(--border-rgb),0.18)",
                background: "var(--input-bg)", color: INK, fontSize: 14, fontFamily: "inherit",
              }}
            />
            <textarea
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              placeholder={tr(isAr, "Optional note…", "ملاحظة اختيارية…")}
              rows={2}
              maxLength={800}
              style={{
                padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(var(--border-rgb),0.18)",
                background: "var(--input-bg)", color: INK, fontSize: 13, fontFamily: "inherit", resize: "vertical",
              }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <input
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                style={{
                  padding: "6px 8px", borderRadius: 8, border: "1px solid rgba(var(--border-rgb),0.16)",
                  background: "var(--input-bg)", color: INK, fontSize: 13, fontFamily: "inherit",
                }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted-strong)", cursor: "pointer" }}>
                <input type="checkbox" checked={draftUseSrs} onChange={(e) => setDraftUseSrs(e.target.checked)} />
                {tr(isAr, "Count for spaced repetition", "احسب في التكرار المتباعد")}
              </label>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={!draftTitle.trim()} style={{ ...primaryBtnStyle, opacity: draftTitle.trim() ? 1 : 0.5, flex: 1 }}>
                <PlusIcon size={14} />{" "}
                {editingId ? tr(isAr, "Save changes", "حفظ التعديلات") : tr(isAr, "Add achievement", "إضافة إنجاز")}
              </button>
              {editingId && (
                <button type="button" onClick={resetDraft} style={{
                  padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(var(--border-rgb),0.2)",
                  background: "var(--card)", color: "var(--muted-strong)", fontWeight: 700, cursor: "pointer",
                }}>
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
                  padding: "4px 10px", borderRadius: 16, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  background: filter === f.id ? BRASS : "rgba(var(--border-rgb),0.08)",
                  color: filter === f.id ? "#fff" : "var(--muted-strong)",
                }}
              >
                {tr(isAr, f.en, f.ar)}
              </button>
            ))}
          </div>

          {/* List */}
          {visible.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", padding: 20 }}>
              {tr(isAr, "No day achievements yet. Add one above.", "لا توجد إنجازات يومية بعد. أضف واحداً أعلاه.")}
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visible.map((entry) => {
              const isDue = entry.useSrs && entry.srsDueAt != null && entry.srsDueAt <= Date.now();
              const box = SRS_BOX_LABELS[entry.srsLevel] || SRS_BOX_LABELS[0];
              return (
                <div
                  key={entry.id}
                  style={{
                    padding: "12px 14px", borderRadius: 12,
                    border: isDue ? "1.5px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.12)",
                    background: isDue ? "var(--accent-1-soft)" : "var(--input-bg)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: INK, fontSize: 14, wordBreak: "break-word" }}>{entry.title}</div>
                      {entry.note ? (
                        <div style={{ fontSize: 12, color: "var(--muted-strong)", marginTop: 4, whiteSpace: "pre-wrap" }}>{entry.note}</div>
                      ) : null}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>
                        <span>📅 {entry.date}</span>
                        {entry.useSrs && (
                          <>
                            <span>{tr(isAr, box.en, box.ar)}</span>
                            <span style={{ color: isDue ? "var(--accent-1)" : "inherit" }}>
                              {isDue ? tr(isAr, "Due now", "مستحق الآن") : `${tr(isAr, "Due", "الاستحقاق")}: ${formatDayAchievementDue(entry.srsDueAt)}`}
                            </span>
                            <span>
                              {entry.correctReviews}/{entry.totalReviews} {tr(isAr, "correct", "صحيح")}
                              {entry.correctStreak > 0 ? ` · 🔥${entry.correctStreak}` : ""}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button type="button" onClick={() => startEdit(entry)} title={tr(isAr, "Edit", "تعديل")}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted-strong)", fontSize: 12, fontWeight: 700, padding: 4 }}>
                        {tr(isAr, "Edit", "تعديل")}
                      </button>
                      <button type="button" onClick={() => removeEntry(entry.id)} title={tr(isAr, "Delete", "حذف")}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ef4444", padding: 4 }}>
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>
                  {entry.useSrs && isDue && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button
                        type="button"
                        onClick={() => markReview(entry.id, true)}
                        style={{
                          flex: 1, padding: "8px 10px", borderRadius: 10, border: "none", cursor: "pointer",
                          background: "var(--success, #22c55e)", color: "#fff", fontWeight: 700, fontSize: 13,
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        }}
                      >
                        <CheckIcon size={14} /> {tr(isAr, "Remembered", "تذكرتها")}
                      </button>
                      <button
                        type="button"
                        onClick={() => markReview(entry.id, false)}
                        style={{
                          flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(var(--border-rgb),0.25)",
                          cursor: "pointer", background: "var(--card)", color: "var(--muted-strong)", fontWeight: 700, fontSize: 13,
                        }}
                      >
                        {tr(isAr, "Forgot", "نسيتها")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
