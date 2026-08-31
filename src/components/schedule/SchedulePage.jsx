/**
 * Student Schedule — Today timeline + Week grid.
 * Organize sleep, lessons, study blocks. Fully editable per day.
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
  ChevronIcon,
  ClockIcon,
  MoonIcon,
  BookIcon,
  FlameIcon,
  StarIcon,
} from "../common/Icons";
import HowItWorksButton from "../common/HowItWorksButton";
import {
  loadSchedule,
  saveSchedule,
  defaultSchedule,
  blocksForDay,
  blockDurationMinutes,
  orderedWeekDays,
  dayLabel,
  todayIndex,
  timeToMinutes,
  formatTimeDisplay,
  BLOCK_TYPES,
  loadCompletions,
  toggleCompletion,
  dayProgress,
  applySleepToSchedule,
  removeBlock,
} from "../../lib/state/schedule";
import "./schedule.css";

const TYPE_KEYS = Object.keys(BLOCK_TYPES);

function typeMeta(type) {
  return BLOCK_TYPES[type] || BLOCK_TYPES.custom;
}

function emptyDraft(day) {
  return {
    id: null,
    title: "",
    type: "study",
    start: "16:00",
    end: "17:30",
    note: "",
    days: [typeof day === "number" ? day : todayIndex()],
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
  const [completions, setCompletions] = useState(() => loadCompletions(accountCode).done);
  const [view, setView] = useState("today"); // today | week | sleep
  const [selectedDay, setSelectedDay] = useState(() => todayIndex());
  const [editor, setEditor] = useState(null); // draft block or null
  const [sleepDraft, setSleepDraft] = useState(() => ({
    bedtime: schedule.sleep?.bedtime || "23:00",
    wake: schedule.sleep?.wake || "06:30",
  }));

  const T = useCallback((en, ar) => tr(isAr, en, ar), [isAr]);
  const today = todayIndex();
  const weekDays = useMemo(
    () => orderedWeekDays(schedule.weekStartsOn ?? 6),
    [schedule.weekStartsOn]
  );

  useEffect(() => {
    setSchedule(loadSchedule(accountCode));
    setCompletions(loadCompletions(accountCode).done);
  }, [accountCode]);

  const persist = useCallback(
    (next) => {
      const saved = saveSchedule(accountCode, next);
      setSchedule(saved);
      return saved;
    },
    [accountCode]
  );

  const dayBlocks = useMemo(
    () => blocksForDay(schedule, selectedDay),
    [schedule, selectedDay]
  );

  const todayBlocks = useMemo(() => blocksForDay(schedule, today), [schedule, today]);

  const progress = useMemo(
    () => dayProgress(schedule, selectedDay, completions),
    [schedule, selectedDay, completions]
  );

  const nowMins = useMemo(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }, [view, selectedDay]); // refresh when switching views

  function handleToggleDone(id) {
    const next = toggleCompletion(accountCode, id);
    setCompletions({ ...next });
  }

  function openNew() {
    setEditor(emptyDraft(selectedDay));
  }

  function openEdit(b) {
    setEditor({
      id: b.id,
      title: b.title,
      type: b.type,
      start: b.start,
      end: b.end,
      note: b.note || "",
      days: [...(b.days || [selectedDay])],
    });
  }

  function saveEditor(e) {
    e?.preventDefault?.();
    if (!editor) return;
    const title = (editor.title || "").trim() || typeMeta(editor.type)[isAr ? "ar" : "en"];
    const nextBlock = { ...editor, title };
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
    if (!window.confirm(T("Reset to recommended student schedule?", "ترجع للجدول المقترح للطالب؟"))) return;
    persist(defaultSchedule());
    setCompletions({});
  }

  function isActiveNow(b) {
    if (selectedDay !== today) return false;
    let s = timeToMinutes(b.start);
    let e = timeToMinutes(b.end);
    if (e <= s) {
      // overnight
      return nowMins >= s || nowMins < e;
    }
    return nowMins >= s && nowMins < e;
  }

  const shell = (
    <div
      className="sch-root"
      dir={isAr ? "rtl" : "ltr"}
      role="dialog"
      aria-modal="true"
      aria-label={T("Schedule", "الجدول")}
      style={{ zIndex: Z_INDEX?.tool || 6000 }}
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
                {T("Sleep · lessons · study — adjustable every day", "نوم · حصص · مذاكرة — تظبطه كل يوم")}
              </p>
            </div>
          </div>
          <div className="sch-header-actions">
            <HowItWorksButton isAr={isAr} guideId="schedule" />
            <button type="button" className="sch-icon-btn" onClick={onClose} aria-label={T("Close", "إغلاق")}>
              <XIcon size={18} />
            </button>
          </div>
        </div>

        <nav className="sch-tabs" aria-label={T("Views", "العروض")}>
          {[
            { id: "today", en: "Today", ar: "اليوم" },
            { id: "week", en: "Week", ar: "الأسبوع" },
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
                    "Same bedtime and wake time every day improves focus and memory more than extra late-night study.",
                    "مواعيد نوم واستيقاظ ثابتة كل يوم بتحسّن التركيز والذاكرة أكتر من السهر الزيادة."
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
                  onChange={(e) => setSleepDraft((s) => ({ ...s, bedtime: e.target.value }))}
                  required
                />
              </label>
              <label>
                <span>{T("Wake up", "الاستيقاظ")}</span>
                <input
                  type="time"
                  value={sleepDraft.wake}
                  onChange={(e) => setSleepDraft((s) => ({ ...s, wake: e.target.value }))}
                  required
                />
              </label>
            </div>
            <p className="sch-sleep-hint">
              {T("Recommended: 7–9 hours. Aim to sleep before midnight.", "المستحسن: 7–9 ساعات. حاول تنام قبل منتصف الليل.")}
            </p>
            <button type="submit" className="sch-primary-btn">
              {T("Save sleep window", "حفظ مواعيد النوم")}
            </button>
          </form>
        )}

        {view !== "sleep" && (
          <>
            <div className="sch-day-strip" role="tablist">
              {weekDays.map((d) => {
                const p = dayProgress(schedule, d, completions);
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
                    const done = !!completions[b.id];
                    const active = isActiveNow(b);
                    const dur = blockDurationMinutes(b);
                    return (
                      <li
                        key={b.id}
                        className={
                          "sch-block" +
                          (done ? " is-done" : "") +
                          (active ? " is-now" : "")
                        }
                        style={{ "--block-color": meta.color }}
                      >
                        <button
                          type="button"
                          className="sch-block-check"
                          aria-label={T("Mark done", "تم")}
                          onClick={() => handleToggleDone(b.id)}
                        >
                          {done ? <CheckIcon size={14} /> : null}
                        </button>
                        <button type="button" className="sch-block-main" onClick={() => openEdit(b)}>
                          <div className="sch-block-time">
                            <span>{formatTimeDisplay(b.start, isAr)}</span>
                            <span className="sch-block-dur">
                              {dur >= 60
                                ? `${Math.floor(dur / 60)}h${dur % 60 ? ` ${dur % 60}m` : ""}`
                                : `${dur}m`}
                            </span>
                          </div>
                          <div className="sch-block-body">
                            <span className="sch-block-type">{isAr ? meta.ar : meta.en}</span>
                            <strong className="sch-block-title">{b.title}</strong>
                            {b.note ? <span className="sch-block-note">{b.note}</span> : null}
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
                      <p>{T("This day is empty. Add school, study, or rest blocks.", "اليوم فاضي. ضيف مدرسة أو مذاكرة أو راحة.")}</p>
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
                  const blocks = blocksForDay(schedule, d).filter((b) => b.type !== "sleep");
                  const p = dayProgress(schedule, d, completions);
                  return (
                    <article key={d} className={"sch-week-col" + (d === today ? " is-today" : "")}>
                      <header>
                        <strong>{dayLabel(d, isAr)}</strong>
                        <span>{p.total ? `${p.done}/${p.total}` : "—"}</span>
                      </header>
                      <ul>
                        {blocks.slice(0, 6).map((b) => (
                          <li
                            key={b.id}
                            style={{ borderInlineStartColor: typeMeta(b.type).color }}
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
              `${todayBlocks.filter((b) => b.type === "study").length} study blocks today`,
              `${todayBlocks.filter((b) => b.type === "study").length} جلسات مذاكرة النهاردة`
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
              <h3>{editor.id ? T("Edit block", "تعديل بلوك") : T("New block", "بلوك جديد")}</h3>
              <button type="button" className="sch-icon-btn" onClick={() => setEditor(null)}>
                <XIcon size={16} />
              </button>
            </div>

            <label className="sch-field">
              <span>{T("Title", "العنوان")}</span>
              <input
                value={editor.title}
                onChange={(e) => setEditor((d) => ({ ...d, title: e.target.value }))}
                placeholder={T("e.g. Math revision", "مثال: مراجعة رياضة")}
                maxLength={80}
                autoFocus
              />
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
                    onClick={() => setEditor((d) => ({ ...d, type: k }))}
                  >
                    {isAr ? BLOCK_TYPES[k].ar : BLOCK_TYPES[k].en}
                  </button>
                ))}
              </div>
            </label>

            <div className="sch-field-row">
              <label className="sch-field">
                <span>{T("Start", "من")}</span>
                <input
                  type="time"
                  value={editor.start}
                  onChange={(e) => setEditor((d) => ({ ...d, start: e.target.value }))}
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

            <label className="sch-field">
              <span>{T("Note (optional)", "ملاحظة (اختياري)")}</span>
              <input
                value={editor.note}
                onChange={(e) => setEditor((d) => ({ ...d, note: e.target.value }))}
                maxLength={200}
                placeholder={T("Focus topic, chapter…", "موضوع التركيز، الفصل…")}
              />
            </label>

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
