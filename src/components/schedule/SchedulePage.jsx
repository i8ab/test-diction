/**
 * Student Schedule — recurring + one-off blocks, conflicts, daily tip, week summary.
 * Opens above app content like Timer (Z_INDEX.TOOL_FULL + portal).
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { tr } from "../../lib/config/i18n";
import { Z_INDEX } from "../../lib/config/zIndex";
import { useBodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import {
  XIcon,
  PlusIcon,
  CheckIcon,
  ClockIcon,
  MoonIcon,
  BookIcon,
  StarIcon,
} from "../common/Icons";
import HowItWorksButton from "../common/HowItWorksButton";
import {
  loadSchedule,
  saveSchedule,
  defaultSchedule,
  blocksForDate,
  blockDurationMinutes,
  orderedWeekDays,
  dayLabel,
  todayIndex,
  timeToMinutes,
  formatTimeDisplay,
  BLOCK_TYPES,
  PRESET_COLORS,
  completionsForDate,
  toggleCompletion,
  dayProgress,
  applySleepToSchedule,
  removeBlock,
  dateKey,
  weekKey,
  tipForDate,
  findConflictsForSave,
  buildWeekSummary,
  formatMins,
  dateForWeekday,
} from "../../lib/state/schedule";
import "./schedule.css";

const TYPE_KEYS = Object.keys(BLOCK_TYPES);

function typeMeta(type) {
  return BLOCK_TYPES[type] || BLOCK_TYPES.custom;
}

function emptyDraft(dayIndex) {
  const d = dateForWeekday(typeof dayIndex === "number" ? dayIndex : todayIndex());
  return {
    id: null,
    title: "",
    type: "study",
    color: BLOCK_TYPES.study.color,
    start: "16:00",
    end: "17:30",
    note: "",
    days: [typeof dayIndex === "number" ? dayIndex : todayIndex()],
    recurrence: "weekly",
    date: dateKey(d),
    weekKey: weekKey(d),
  };
}

export default function SchedulePage({
  onClose,
  isAr = false,
  accountCode = "",
  initialBubble = false,
  onBubbleChange,
}) {
  useBodyScrollLock(true);

  const [schedule, setSchedule] = useState(() => loadSchedule(accountCode));
  const [view, setView] = useState("today");
  const [selectedDay, setSelectedDay] = useState(() => todayIndex());
  const [editor, setEditor] = useState(null);
  const [conflictMsg, setConflictMsg] = useState("");
  const [sleepDraft, setSleepDraft] = useState(() => ({
    bedtime: schedule.sleep?.bedtime || "23:00",
    wake: schedule.sleep?.wake || "06:30",
  }));

  const T = useCallback((en, ar) => tr(isAr, en, ar), [isAr]);
  const today = todayIndex();
  const selectedDate = useMemo(
    () => dateForWeekday(selectedDay, schedule.weekStartsOn ?? 6),
    [selectedDay, schedule.weekStartsOn]
  );
  const weekDays = useMemo(
    () => orderedWeekDays(schedule.weekStartsOn ?? 6),
    [schedule.weekStartsOn]
  );

  const [completions, setCompletions] = useState(() =>
    completionsForDate(accountCode, selectedDate)
  );

  useEffect(() => {
    setSchedule(loadSchedule(accountCode));
  }, [accountCode]);

  useEffect(() => {
    setCompletions(completionsForDate(accountCode, selectedDate));
  }, [accountCode, selectedDate]);

  const persist = useCallback(
    (next) => {
      const saved = saveSchedule(accountCode, next);
      setSchedule(saved);
      return saved;
    },
    [accountCode]
  );

  const dayBlocks = useMemo(
    () => blocksForDate(schedule, selectedDate),
    [schedule, selectedDate]
  );

  const progress = useMemo(
    () => dayProgress(schedule, selectedDate, completions),
    [schedule, selectedDate, completions]
  );

  const tip = useMemo(() => tipForDate(selectedDate, isAr), [selectedDate, isAr]);

  const summary = useMemo(
    () => buildWeekSummary(schedule, accountCode, schedule.weekStartsOn ?? 6),
    [schedule, accountCode, view]
  );

  const nowMins = useMemo(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }, [view, selectedDay, dayBlocks]);

  const todayLabelLong = dayLabel(today, isAr, false);
  const selectedLabelLong = dayLabel(selectedDay, isAr, false);

  function handleToggleDone(id) {
    const next = toggleCompletion(accountCode, id, selectedDate);
    setCompletions({ ...next });
  }

  function openNew() {
    setConflictMsg("");
    setEditor(emptyDraft(selectedDay));
  }

  function openEdit(b) {
    setConflictMsg("");
    setEditor({
      id: b.id,
      title: b.title,
      type: b.type,
      color: b.color || typeMeta(b.type).color,
      start: b.start,
      end: b.end,
      note: b.note || "",
      days: [...(b.days || [selectedDay])],
      recurrence: b.recurrence || "weekly",
      date: b.date || dateKey(selectedDate),
      weekKey: b.weekKey || weekKey(selectedDate),
    });
  }

  function saveEditor(e) {
    e?.preventDefault?.();
    if (!editor) return;
    setConflictMsg("");

    const title =
      (editor.title || "").trim() || typeMeta(editor.type)[isAr ? "ar" : "en"];
    let nextBlock = {
      ...editor,
      title,
      color: editor.color || typeMeta(editor.type).color,
    };

    if (nextBlock.recurrence === "once") {
      nextBlock.date = nextBlock.date || dateKey(selectedDate);
      nextBlock.days = [new Date(nextBlock.date + "T12:00:00").getDay()];
    } else if (nextBlock.recurrence === "week") {
      nextBlock.weekKey = weekKey(selectedDate);
      if (!nextBlock.days?.length) nextBlock.days = [selectedDay];
    } else {
      nextBlock.date = null;
      nextBlock.weekKey = null;
      if (!nextBlock.days?.length) nextBlock.days = [selectedDay];
    }

    const conflicts = findConflictsForSave(schedule, nextBlock);
    if (conflicts.length) {
      const names = conflicts
        .slice(0, 3)
        .map((c) => c.title)
        .join(isAr ? "، " : ", ");
      setConflictMsg(
        T(
          `Time conflicts with: ${names}. Pick another slot.`,
          `التعارض مع: ${names}. اختَر وقت تاني.`
        )
      );
      return;
    }

    const blocks = [...(schedule.blocks || [])];
    const idx = nextBlock.id ? blocks.findIndex((b) => b.id === nextBlock.id) : -1;
    if (idx >= 0) {
      blocks[idx] = { ...blocks[idx], ...nextBlock };
    } else {
      blocks.push({
        ...nextBlock,
        id: `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      });
    }
    persist({ ...schedule, blocks });
    setEditor(null);
  }

  function deleteEditor() {
    if (!editor?.id) {
      setEditor(null);
      return;
    }
    persist(removeBlock(schedule, editor.id));
    setEditor(null);
  }

  function saveSleep(e) {
    e?.preventDefault?.();
    const next = applySleepToSchedule(schedule, sleepDraft.bedtime, sleepDraft.wake);
    persist(next);
    setView("today");
  }

  function resetDefaults() {
    if (
      !window.confirm(
        T("Reset to recommended student schedule?", "ترجع للجدول المقترح للطالب؟")
      )
    )
      return;
    persist(defaultSchedule());
    setCompletions({});
  }

  function isActiveNow(b) {
    if (selectedDay !== today) return false;
    let s = timeToMinutes(b.start);
    let e = timeToMinutes(b.end);
    if (e <= s) return nowMins >= s || nowMins < e;
    return nowMins >= s && nowMins < e;
  }

  function recurrenceBadge(b) {
    const r = b.recurrence || "weekly";
    if (r === "once") return T("Today only", "اليوم فقط");
    if (r === "week") return T("This week", "هذا الأسبوع");
    return null;
  }

  const shell = (
    <div
      className="sch-root"
      dir={isAr ? "rtl" : "ltr"}
      role="dialog"
      aria-modal="true"
      aria-label={T("Schedule", "الجدول")}
      style={{ zIndex: Z_INDEX.TOOL_FULL }}
    >
      <header className="sch-header">
        <div className="sch-header-top">
          <div className="sch-title-wrap">
            <span className="sch-badge" aria-hidden>
              <ClockIcon size={16} />
            </span>
            <div>
              <h1 className="sch-title">{T("My Schedule", "جدولي")}</h1>
              <p className="sch-sub">
                {selectedDay === today
                  ? T(
                      `Today is ${todayLabelLong} — ${dateKey(selectedDate)}`,
                      `النهاردة ${todayLabelLong} — ${dateKey(selectedDate)}`
                    )
                  : T(
                      `${selectedLabelLong} — ${dateKey(selectedDate)}`,
                      `${selectedLabelLong} — ${dateKey(selectedDate)}`
                    )}
              </p>
            </div>
          </div>
          <div className="sch-header-actions">
            <HowItWorksButton isAr={isAr} guideId="schedule" />
            <button
              type="button"
              className="sch-icon-btn"
              onClick={onClose}
              aria-label={T("Close", "إغلاق")}
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>

        <nav className="sch-tabs" aria-label={T("Views", "العروض")}>
          {[
            { id: "today", en: "Today", ar: "اليوم" },
            { id: "week", en: "Week", ar: "الأسبوع" },
            { id: "summary", en: "Summary", ar: "ملخص" },
            { id: "sleep", en: "Sleep", ar: "النوم" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={"sch-tab" + (view === t.id ? " is-active" : "")}
              onClick={() => {
                setView(t.id);
                if (t.id === "today") setSelectedDay(today);
              }}
            >
              {T(t.en, t.ar)}
            </button>
          ))}
        </nav>
      </header>

      <div className="sch-body">
        {view === "sleep" && (
          <form className="sch-sleep-card" onSubmit={saveSleep}>
            <div className="sch-sleep-hero">
              <MoonIcon size={28} />
              <div>
                <h2>{T("Protect your sleep", "احمِ نومك")}</h2>
                <p>
                  {T(
                    "Same bedtime and wake time every day improves focus more than late-night study.",
                    "مواعيد نوم واستيقاظ ثابتة بتحسّن التركيز أكتر من السهر."
                  )}
                </p>
              </div>
            </div>
            <div className="sch-sleep-fields">
              <label>
                <span>{T("Bedtime", "النوم")}</span>
                <input
                  type="time"
                  value={sleepDraft.bedtime}
                  onChange={(e) =>
                    setSleepDraft((s) => ({ ...s, bedtime: e.target.value }))
                  }
                  required
                />
              </label>
              <label>
                <span>{T("Wake up", "الاستيقاظ")}</span>
                <input
                  type="time"
                  value={sleepDraft.wake}
                  onChange={(e) =>
                    setSleepDraft((s) => ({ ...s, wake: e.target.value }))
                  }
                  required
                />
              </label>
            </div>
            <button type="submit" className="sch-primary-btn">
              {T("Save sleep window", "حفظ مواعيد النوم")}
            </button>
          </form>
        )}

        {view === "summary" && (
          <section className="sch-summary">
            <div className="sch-summary-hero">
              <h2>{T("This week", "هذا الأسبوع")}</h2>
              <div className="sch-summary-pct">{summary.pct}%</div>
              <p>
                {T(
                  `${summary.totalDone} of ${summary.totalBlocks} blocks done`,
                  `${summary.totalDone} من ${summary.totalBlocks} بلوك اتعمل`
                )}
              </p>
              <p className="sch-summary-study">
                {T("Study / school time", "وقت المذاكرة والمدرسة")}:{" "}
                <strong>
                  {formatMins(summary.studyMinsDone, isAr)}
                  {" / "}
                  {formatMins(summary.studyMinsPlanned, isAr)}
                </strong>
              </p>
            </div>
            <ul className="sch-summary-days">
              {summary.days.map((d) => (
                <li key={d.date}>
                  <span className="sch-summary-dayname">
                    {dayLabel(d.day, isAr, true)}
                  </span>
                  <div className="sch-summary-bar">
                    <i style={{ width: `${d.pct}%` }} />
                  </div>
                  <span className="sch-summary-nums">
                    {d.done}/{d.total}
                  </span>
                </li>
              ))}
            </ul>
            <p className="sch-summary-note">
              {T(
                "Summary uses what you marked done this week. Temporary blocks only count in their week.",
                "الملخص من اللي علّمته «تم» هذا الأسبوع. البلوكات المؤقتة بتتحسب في أسبوعها بس."
              )}
            </p>
          </section>
        )}

        {(view === "today" || view === "week") && (
          <>
            <div className="sch-day-strip" role="tablist">
              {weekDays.map((d) => {
                const dt = dateForWeekday(d, schedule.weekStartsOn ?? 6);
                const p = dayProgress(
                  schedule,
                  dt,
                  completionsForDate(accountCode, dt)
                );
                const isSel = selectedDay === d;
                const isTod = d === today;
                return (
                  <button
                    key={d}
                    type="button"
                    role="tab"
                    aria-selected={isSel}
                    className={
                      "sch-day-chip" +
                      (isSel ? " is-selected" : "") +
                      (isTod ? " is-today" : "")
                    }
                    onClick={() => {
                      setSelectedDay(d);
                      setView("today");
                    }}
                  >
                    <span className="sch-day-name">{dayLabel(d, isAr)}</span>
                    <span className="sch-day-pct">{p.total ? `${p.pct}%` : "—"}</span>
                  </button>
                );
              })}
            </div>

            {view === "today" && (
              <section className="sch-today">
                <div className="sch-tip" role="note">
                  <StarIcon size={14} />
                  <span>{tip}</span>
                </div>

                <div className="sch-progress-row">
                  <div className="sch-progress-ring" style={{ "--pct": progress.pct }}>
                    <span>{progress.pct}%</span>
                  </div>
                  <div>
                    <strong>
                      {selectedDay === today
                        ? T("Today's plan", "خطة النهاردة")
                        : T("Day plan", "خطة اليوم")}
                    </strong>
                    <p>
                      {progress.total
                        ? T(
                            `${progress.done} of ${progress.total} blocks done`,
                            `${progress.done} من ${progress.total} بلوكات خلصت`
                          )
                        : T("No blocks yet — add your first", "مفيش بلوكات — ضيف أول واحد")}
                    </p>
                  </div>
                  <button type="button" className="sch-add-btn" onClick={openNew}>
                    <PlusIcon size={16} />
                    {T("Add", "إضافة")}
                  </button>
                </div>

                <ul className="sch-timeline">
                  {dayBlocks.map((b) => {
                    const meta = typeMeta(b.type);
                    const color = b.color || meta.color;
                    const done = !!completions[b.id];
                    const active = isActiveNow(b);
                    const dur = blockDurationMinutes(b);
                    const badge = recurrenceBadge(b);
                    return (
                      <li
                        key={b.id}
                        className={
                          "sch-block" +
                          (done ? " is-done" : "") +
                          (active ? " is-now" : "")
                        }
                        style={{ "--block-color": color }}
                      >
                        <button
                          type="button"
                          className="sch-block-check"
                          aria-label={T("Mark done", "تم")}
                          onClick={() => handleToggleDone(b.id)}
                        >
                          {done ? <CheckIcon size={14} /> : null}
                        </button>
                        <button
                          type="button"
                          className="sch-block-main"
                          onClick={() => openEdit(b)}
                        >
                          <div className="sch-block-time">
                            <span>{formatTimeDisplay(b.start, isAr)}</span>
                            <span className="sch-block-dur">
                              {dur >= 60
                                ? `${Math.floor(dur / 60)}h${dur % 60 ? ` ${dur % 60}m` : ""}`
                                : `${dur}m`}
                            </span>
                          </div>
                          <div className="sch-block-body">
                            <span className="sch-block-type">
                              {isAr ? meta.ar : meta.en}
                              {badge ? ` · ${badge}` : ""}
                            </span>
                            <strong className="sch-block-title">{b.title}</strong>
                            {b.note ? (
                              <span className="sch-block-note">{b.note}</span>
                            ) : null}
                            {active ? (
                              <span className="sch-now-pill">{T("Now", "دلوقتي")}</span>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                  {!dayBlocks.length && (
                    <li className="sch-empty">
                      <StarIcon size={22} />
                      <p>
                        {T(
                          "This day is empty. Add school, study, or a one-day task.",
                          "اليوم فاضي. ضيف مدرسة أو مذاكرة أو مهمة لليوم ده بس."
                        )}
                      </p>
                      <button type="button" className="sch-primary-btn" onClick={openNew}>
                        {T("Add block", "ضيف بلوك")}
                      </button>
                    </li>
                  )}
                </ul>
              </section>
            )}

            {view === "week" && (
              <section className="sch-week">
                {weekDays.map((d) => {
                  const dt = dateForWeekday(d, schedule.weekStartsOn ?? 6);
                  const blocks = blocksForDate(schedule, dt).filter(
                    (b) => b.type !== "sleep"
                  );
                  const p = dayProgress(
                    schedule,
                    dt,
                    completionsForDate(accountCode, dt)
                  );
                  return (
                    <article
                      key={d}
                      className={"sch-week-col" + (d === today ? " is-today" : "")}
                    >
                      <header>
                        <strong>{dayLabel(d, isAr)}</strong>
                        <span>{p.total ? `${p.done}/${p.total}` : "—"}</span>
                      </header>
                      <ul>
                        {blocks.slice(0, 6).map((b) => (
                          <li
                            key={b.id}
                            style={{
                              borderInlineStartColor: b.color || typeMeta(b.type).color,
                            }}
                            onClick={() => {
                              setSelectedDay(d);
                              setView("today");
                              openEdit(b);
                            }}
                          >
                            <span>{formatTimeDisplay(b.start, isAr)}</span>
                            <em>{b.title}</em>
                          </li>
                        ))}
                        {!blocks.length && (
                          <li className="sch-week-empty">{T("Free", "فاضي")}</li>
                        )}
                      </ul>
                      <button
                        type="button"
                        className="sch-week-add"
                        onClick={() => {
                          setSelectedDay(d);
                          setEditor(emptyDraft(d));
                        }}
                      >
                        <PlusIcon size={12} />
                      </button>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>

      <footer className="sch-footer">
        <button type="button" className="sch-ghost-btn" onClick={resetDefaults}>
          {T("Recommended template", "القالب المقترح")}
        </button>
        <div className="sch-footer-meta">
          <BookIcon size={14} />
          <span>
            {T(
              "Recurring every week · or one-off for a day/week",
              "ثابت كل أسبوع · أو مؤقت ليوم/أسبوع"
            )}
          </span>
        </div>
      </footer>

      {editor && (
        <div className="sch-editor-backdrop" onClick={() => setEditor(null)}>
          <form
            className="sch-editor"
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveEditor}
          >
            <div className="sch-editor-head">
              <h3>
                {editor.id ? T("Edit block", "تعديل بلوك") : T("New block", "بلوك جديد")}
              </h3>
              <button
                type="button"
                className="sch-icon-btn"
                onClick={() => setEditor(null)}
              >
                <XIcon size={16} />
              </button>
            </div>

            <label className="sch-field">
              <span>{T("Title", "العنوان")}</span>
              <input
                value={editor.title}
                onChange={(e) => setEditor((d) => ({ ...d, title: e.target.value }))}
                placeholder={T("e.g. Math lecture", "مثال: محاضرة رياضة")}
                maxLength={80}
                autoFocus
              />
            </label>

            <label className="sch-field">
              <span>{T("Repeats", "التكرار")}</span>
              <div className="sch-type-grid">
                {[
                  { id: "weekly", en: "Every week", ar: "كل أسبوع" },
                  { id: "week", en: "This week only", ar: "هذا الأسبوع فقط" },
                  { id: "once", en: "This day only", ar: "اليوم ده فقط" },
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={
                      "sch-type-chip" + (editor.recurrence === r.id ? " is-on" : "")
                    }
                    style={{ "--c": "var(--accent-1)" }}
                    onClick={() => setEditor((d) => ({ ...d, recurrence: r.id }))}
                  >
                    {T(r.en, r.ar)}
                  </button>
                ))}
              </div>
            </label>

            <label className="sch-field">
              <span>{T("Type", "النوع")}</span>
              <div className="sch-type-grid">
                {TYPE_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={"sch-type-chip" + (editor.type === k ? " is-on" : "")}
                    style={{ "--c": BLOCK_TYPES[k].color }}
                    onClick={() =>
                      setEditor((d) => ({
                        ...d,
                        type: k,
                        color:
                          d.color === typeMeta(d.type).color
                            ? BLOCK_TYPES[k].color
                            : d.color,
                      }))
                    }
                  >
                    {isAr ? BLOCK_TYPES[k].ar : BLOCK_TYPES[k].en}
                  </button>
                ))}
              </div>
            </label>

            <label className="sch-field">
              <span>{T("Color", "اللون")}</span>
              <div className="sch-color-row">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={
                      "sch-color-dot" + (editor.color === c ? " is-on" : "")
                    }
                    style={{ background: c }}
                    onClick={() => setEditor((d) => ({ ...d, color: c }))}
                    aria-label={c}
                  />
                ))}
                <input
                  type="color"
                  className="sch-color-picker"
                  value={editor.color || "#64748b"}
                  onChange={(e) =>
                    setEditor((d) => ({ ...d, color: e.target.value }))
                  }
                  title={T("Custom color", "لون مخصص")}
                />
              </div>
            </label>

            <div className="sch-field-row">
              <label className="sch-field">
                <span>{T("Start", "من")}</span>
                <input
                  type="time"
                  value={editor.start}
                  onChange={(e) =>
                    setEditor((d) => ({ ...d, start: e.target.value }))
                  }
                  required
                />
              </label>
              <label className="sch-field">
                <span>{T("End", "إلى")}</span>
                <input
                  type="time"
                  value={editor.end}
                  onChange={(e) => setEditor((d) => ({ ...d, end: e.target.value }))}
                  required
                />
              </label>
            </div>

            {editor.recurrence !== "once" && (
              <label className="sch-field">
                <span>{T("Days", "الأيام")}</span>
                <div className="sch-days-pick">
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                    const on = (editor.days || []).includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        className={"sch-day-pick" + (on ? " is-on" : "")}
                        onClick={() =>
                          setEditor((prev) => {
                            const set = new Set(prev.days || []);
                            if (set.has(d)) set.delete(d);
                            else set.add(d);
                            return { ...prev, days: [...set].sort() };
                          })
                        }
                      >
                        {dayLabel(d, isAr)}
                      </button>
                    );
                  })}
                </div>
              </label>
            )}

            <label className="sch-field">
              <span>{T("Note (optional)", "ملاحظة (اختياري)")}</span>
              <input
                value={editor.note}
                onChange={(e) => setEditor((d) => ({ ...d, note: e.target.value }))}
                maxLength={200}
                placeholder={T("Focus topic…", "موضوع التركيز…")}
              />
            </label>

            {conflictMsg ? (
              <p className="sch-conflict" role="alert">
                {conflictMsg}
              </p>
            ) : null}

            <div className="sch-editor-actions">
              {editor.id ? (
                <button type="button" className="sch-danger-btn" onClick={deleteEditor}>
                  {T("Delete", "حذف")}
                </button>
              ) : (
                <span />
              )}
              <button type="submit" className="sch-primary-btn">
                {T("Save", "حفظ")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );

  return createPortal(shell, document.body);
}
