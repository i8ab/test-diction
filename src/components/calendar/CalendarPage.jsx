import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS } from "../../lib/config/theme";
import { dateKey, computeStreak } from "../../lib/utils/quizHelpers";
import { loadTimerDayStats, getTodayTimerMinutes } from "../../lib/state/goals";
import { XIcon, CalendarIcon, FlameIcon, ChevronIcon, ClockIcon } from "../common/Icons";
import { useBodyScrollLock } from "../../lib/utils/useBodyScrollLock";

const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_AR = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];
const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function buildDayMap(studiedAt, entries) {
  // dayKey (YYYY-M-D) -> { count, entryIds: [] }
  const map = {};
  const entryById = {};
  for (const e of entries || []) entryById[e.id] = e;

  for (const [id, ts] of Object.entries(studiedAt || {})) {
    if (typeof ts !== "number") continue;
    const key = dateKey(ts);
    if (!map[key]) map[key] = { count: 0, entryIds: [] };
    map[key].count += 1;
    map[key].entryIds.push(id);
  }
  return { map, entryById };
}

function intensityColor(count, max) {
  if (!count) return "transparent";
  if (max <= 0) return "var(--accent-1-soft)";
  const t = Math.min(1, count / Math.max(max, 1));
  // soft → strong accent
  if (t < 0.25) return "color-mix(in srgb, var(--accent-1) 18%, transparent)";
  if (t < 0.5) return "color-mix(in srgb, var(--accent-1) 35%, transparent)";
  if (t < 0.75) return "color-mix(in srgb, var(--accent-1) 55%, transparent)";
  return "color-mix(in srgb, var(--accent-1) 80%, transparent)";
}

/**
 * Study activity calendar.
 * - Full view: monthly grid, day details, streak.
 * - Bubble: small floating widget that stays on top of the dictionary
 *   (same idea as the timer bubble — can be added/removed and remains visible).
 */
export default function CalendarPage({
  onClose,
  isAr,
  studiedAt = {},
  entries = [],
  onBubbleChange,
  initialBubble = false,
}) {
  const [viewMode, setViewMode] = useState(initialBubble ? "bubble" : "full");
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(null); // dateKey string
  const [bubblePos, setBubblePos] = useState({ x: null, y: null });
  const [timerDayStats, setTimerDayStats] = useState(() => loadTimerDayStats());
  const dragRef = useRef(null);

  useEffect(() => {
    onBubbleChange?.(viewMode === "bubble");
  }, [viewMode, onBubbleChange]);

  // Refresh timer aggregates when calendar opens / becomes visible
  useEffect(() => {
    setTimerDayStats(loadTimerDayStats());
    function onVis() {
      if (document.visibilityState === "visible") setTimerDayStats(loadTimerDayStats());
    }
    document.addEventListener("visibilitychange", onVis);
    const id = setInterval(() => setTimerDayStats(loadTimerDayStats()), 15000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(id);
    };
  }, []);

  useBodyScrollLock(viewMode === "full");

  const { map: dayMap, entryById } = useMemo(
    () => buildDayMap(studiedAt, entries),
    [studiedAt, entries]
  );

  const streak = useMemo(() => computeStreak(studiedAt), [studiedAt]);

  const maxCount = useMemo(() => {
    let m = 0;
    for (const v of Object.values(dayMap)) if (v.count > m) m = v.count;
    return m;
  }, [dayMap]);

  const daysInMonth = useMemo(() => {
    const { year, month } = cursor;
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startPad = first.getDay(); // 0 = Sun
    const total = last.getDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= total; d++) {
      const dt = new Date(year, month, d);
      const key = dateKey(dt.getTime());
      cells.push({
        day: d,
        key,
        ts: dt.getTime(),
        count: dayMap[key]?.count || 0,
        entryIds: dayMap[key]?.entryIds || [],
        isToday: key === dateKey(Date.now()),
      });
    }
    return cells;
  }, [cursor, dayMap]);

  const selectedInfo = selectedDay ? dayMap[selectedDay] : null;
  const selectedEntries = useMemo(() => {
    if (!selectedInfo) return [];
    return selectedInfo.entryIds
      .map((id) => entryById[id])
      .filter(Boolean);
  }, [selectedInfo, entryById]);

  function prevMonth() {
    setCursor((c) => {
      let m = c.month - 1;
      let y = c.year;
      if (m < 0) { m = 11; y -= 1; }
      return { year: y, month: m };
    });
    setSelectedDay(null);
  }

  function nextMonth() {
    setCursor((c) => {
      let m = c.month + 1;
      let y = c.year;
      if (m > 11) { m = 0; y += 1; }
      return { year: y, month: m };
    });
    setSelectedDay(null);
  }

  function goToday() {
    const n = new Date();
    setCursor({ year: n.getFullYear(), month: n.getMonth() });
    setSelectedDay(dateKey(Date.now()));
  }

  // ── Bubble drag (ignore clicks on buttons so X / expand work) ────────────
  const onBubblePointerDown = useCallback((e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    // Don't start drag when pressing a control button
    if (e.target?.closest?.("button")) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: bubblePos.x != null ? bubblePos.x : rect.left,
      origY: bubblePos.y != null ? bubblePos.y : rect.top,
      moved: false,
      pointerId: e.pointerId,
    };
    try { el.setPointerCapture?.(e.pointerId); } catch (_) {}
  }, [bubblePos]);

  const onBubblePointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    const x = Math.max(8, Math.min(window.innerWidth - 170, d.origX + dx));
    const y = Math.max(8, Math.min(window.innerHeight - 140, d.origY + dy));
    setBubblePos({ x, y });
  }, []);

  const onBubblePointerUp = useCallback((e) => {
    const d = dragRef.current;
    if (d && e?.currentTarget) {
      try { e.currentTarget.releasePointerCapture?.(d.pointerId); } catch (_) {}
    }
    dragRef.current = null;
  }, []);

  const weekdays = isAr ? WEEKDAYS_AR : WEEKDAYS_EN;
  const monthName = isAr ? MONTHS_AR[cursor.month] : MONTHS_EN[cursor.month];

  const todayLabel = useMemo(() => {
    const n = new Date();
    return n.toLocaleDateString(isAr ? "ar-EG" : "en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [isAr]);

  const todayShort = useMemo(() => {
    const n = new Date();
    return n.toLocaleDateString(isAr ? "ar-EG" : "en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [isAr]);

  // ── Bubble view ──────────────────────────────────────────────────────────
  if (viewMode === "bubble") {
    const todayKey = dateKey(Date.now());
    const todayCount = dayMap[todayKey]?.count || 0;
    const style = {
      position: "fixed",
      zIndex: 5500,
      width: 168,
      borderRadius: 14,
      background: CARD,
      border: "1px solid rgba(var(--border-rgb),0.18)",
      boxShadow: "0 12px 32px -10px rgba(0,0,0,0.28)",
      padding: "10px 10px 12px",
      cursor: "grab",
      userSelect: "none",
      touchAction: "none",
      ...(bubblePos.x != null
        ? { left: bubblePos.x, top: bubblePos.y }
        : { bottom: 20, insetInlineEnd: 16 }),
    };

    const bubble = (
      <div
        role="dialog"
        aria-label={tr(isAr, "Study calendar", "تقويم المذاكرة")}
        style={style}
        onPointerDown={onBubblePointerDown}
        onPointerMove={onBubblePointerMove}
        onPointerUp={onBubblePointerUp}
        onPointerCancel={onBubblePointerUp}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: BRASS }}>
            <CalendarIcon size={14} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>{tr(isAr, "Calendar", "التقويم")}</span>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            <button
              type="button"
              title={tr(isAr, "Expand", "توسيع")}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setViewMode("full"); }}
              style={iconBtn}
            >
              <ChevronIcon size={14} style={{ transform: "rotate(-90deg)" }} />
            </button>
            <button
              type="button"
              title={tr(isAr, "Close", "إغلاق")}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}
              style={iconBtn}
            >
              <XIcon size={14} />
            </button>
          </div>
        </div>

        {/* Today's full date */}
        <div style={{ fontSize: 11, fontWeight: 600, color: INK, marginBottom: 6, lineHeight: 1.3 }}>
          {todayShort}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <FlameIcon size={16} style={{ color: streak > 0 ? "#e85d04" : "var(--muted)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>
            {streak} {tr(isAr, streak === 1 ? "day" : "days", streak === 1 ? "يوم" : "أيام")}
          </span>
        </div>

        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
          {tr(isAr, "Today", "اليوم")}: {todayCount} {tr(isAr, "word(s)", "كلمة")}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
          <ClockIcon size={12} />
          {getTodayTimerMinutes()} {tr(isAr, "min focus", "د تركيز")}
        </div>

        {/* mini 7-day strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginTop: 6 }}>
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            d.setHours(0, 0, 0, 0);
            const key = dateKey(d.getTime());
            const c = dayMap[key]?.count || 0;
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                title={`${d.getDate()}: ${c}`}
                style={{
                  aspectRatio: "1",
                  borderRadius: 4,
                  background: c ? intensityColor(c, maxCount) : "rgba(var(--border-rgb),0.08)",
                  border: isToday ? `1.5px solid ${BRASS}` : "1px solid transparent",
                  fontSize: 9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: c ? INK : "var(--muted)",
                  fontWeight: isToday ? 700 : 400,
                }}
              >
                {d.getDate()}
              </div>
            );
          })}
        </div>
      </div>
    );

    return typeof document !== "undefined" ? createPortal(bubble, document.body) : bubble;
  }

  // ── Full view ────────────────────────────────────────────────────────────
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr(isAr, "Study calendar", "تقويم المذاكرة")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 6000,
        background: "var(--paper)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderBottom: "1px solid rgba(var(--border-rgb),0.12)",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
          <CalendarIcon size={20} style={{ color: BRASS, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: INK, lineHeight: 1.2 }}>
              {tr(isAr, "Study Calendar", "تقويم المذاكرة")}
            </h1>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginTop: 2 }}>
              {todayLabel}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "4px 10px",
              borderRadius: 20,
              background: "color-mix(in srgb, #e85d04 12%, transparent)",
              color: "#e85d04",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <FlameIcon size={14} />
            {streak} {tr(isAr, streak === 1 ? "day streak" : "day streak", "يوم متتالي")}
          </div>

          <button
            type="button"
            onClick={() => setViewMode("bubble")}
            title={tr(isAr, "Minimize to floating widget", "تصغير لودجت عائم")}
            style={headerBtn}
          >
            {tr(isAr, "Pin", "تثبيت")}
          </button>

          <button type="button" onClick={onClose} style={headerBtn} aria-label={tr(isAr, "Close", "إغلاق")}>
            <XIcon size={16} />
          </button>
        </div>
      </header>

      {/* Month navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px 8px",
          flexShrink: 0,
        }}
      >
        <button type="button" onClick={prevMonth} style={navBtn} aria-label={tr(isAr, "Previous month", "الشهر السابق")}>
          <ChevronIcon size={18} style={{ transform: isAr ? "none" : "rotate(180deg)" }} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: INK }}>
            {monthName} {cursor.year}
          </span>
          <button type="button" onClick={goToday} style={{ ...headerBtn, fontSize: 12, padding: "4px 10px" }}>
            {tr(isAr, "Today", "اليوم")}
          </button>
        </div>

        <button type="button" onClick={nextMonth} style={navBtn} aria-label={tr(isAr, "Next month", "الشهر التالي")}>
          <ChevronIcon size={18} style={{ transform: isAr ? "rotate(180deg)" : "none" }} />
        </button>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 12px 16px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 4,
            maxWidth: 520,
            margin: "0 auto",
          }}
        >
          {weekdays.map((w) => (
            <div
              key={w}
              style={{
                textAlign: "center",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--muted)",
                padding: "4px 0",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
              }}
            >
              {w}
            </div>
          ))}

          {daysInMonth.map((cell, i) => {
            if (!cell) {
              return <div key={`pad-${i}`} style={{ aspectRatio: "1" }} />;
            }
            const isSelected = selectedDay === cell.key;
            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => setSelectedDay(cell.key === selectedDay ? null : cell.key)}
                style={{
                  aspectRatio: "1",
                  borderRadius: 10,
                  border: isSelected
                    ? `2px solid ${BRASS}`
                    : cell.isToday
                    ? `1.5px solid ${BRASS}`
                    : "1px solid rgba(var(--border-rgb),0.1)",
                  background: cell.count
                    ? intensityColor(cell.count, maxCount)
                    : "var(--card)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  padding: 2,
                  minHeight: 44,
                  transition: "transform 0.12s ease",
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: cell.isToday || isSelected ? 700 : 500,
                    color: INK,
                  }}
                >
                  {cell.day}
                </span>
                {cell.count > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--muted-strong)",
                      lineHeight: 1,
                    }}
                  >
                    {cell.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 14,
            fontSize: 11,
            color: "var(--muted)",
          }}
        >
          <span>{tr(isAr, "Less", "أقل")}</span>
          {[0, 0.2, 0.4, 0.6, 0.85].map((t, i) => (
            <div
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: t === 0
                  ? "rgba(var(--border-rgb),0.1)"
                  : intensityColor(Math.round(t * Math.max(maxCount, 4)), Math.max(maxCount, 4)),
                border: "1px solid rgba(var(--border-rgb),0.12)",
              }}
            />
          ))}
          <span>{tr(isAr, "More", "أكثر")}</span>
        </div>

        {/* Day detail panel */}
        {selectedDay && (
          <div
            style={{
              maxWidth: 520,
              margin: "18px auto 0",
              background: CARD,
              border: "1px solid rgba(var(--border-rgb),0.14)",
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: INK }}>
                {formatDayTitle(selectedDay, isAr)}
              </h3>
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
                {selectedInfo?.count || 0} {tr(isAr, "word(s)", "كلمة")}
              </span>
            </div>

            {/* Timer / Pomodoro summary for this day */}
            {(() => {
              const t = timerDayStats[selectedDay];
              if (!t || !t.minutes) {
                return (
                  <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(var(--border-rgb),0.06)", fontSize: 13, color: "var(--muted)" }}>
                    {tr(isAr, "No timer sessions logged this day.", "مفيش جلسات تايمر مسجّلة اليوم ده.")}
                  </div>
                );
              }
              return (
                <div style={{ marginBottom: 12, padding: "12px 12px", borderRadius: 10, background: "var(--accent-1-soft)", border: "1px solid color-mix(in srgb, var(--accent-1) 25%, transparent)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontWeight: 700, fontSize: 13, color: INK }}>
                    <ClockIcon size={14} />
                    {tr(isAr, "Focus time", "وقت التركيز")}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted-strong)", lineHeight: 1.55 }}>
                    <div>
                      <strong style={{ color: INK }}>{t.minutes}</strong> {tr(isAr, "min total", "د إجمالي")}
                      {" · "}
                      {t.sessions} {tr(isAr, "session(s)", "جلسة")}
                    </div>
                    {(t.countdownMinutes > 0 || t.pomodoroMinutes > 0) && (
                      <div style={{ marginTop: 4 }}>
                        {t.countdownMinutes > 0 && (
                          <span>
                            {tr(isAr, "Regular timer", "تايمر عادي")}: {t.countdownMinutes} {tr(isAr, "min", "د")}
                          </span>
                        )}
                        {t.countdownMinutes > 0 && t.pomodoroMinutes > 0 ? " · " : null}
                        {t.pomodoroMinutes > 0 && (
                          <span>
                            {tr(isAr, "Pomodoro", "بومودورو")}: {t.pomodoroMinutes} {tr(isAr, "min", "د")}
                            {t.pomodoroWorkSessions
                              ? ` (${t.pomodoroWorkSessions} ${tr(isAr, "study", "مذاكرة")}`
                              : ""}
                            {t.pomodoroBreakSessions
                              ? ` / ${t.pomodoroBreakSessions} ${tr(isAr, "break", "راحة")})`
                              : t.pomodoroWorkSessions
                              ? ")"
                              : ""}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {selectedEntries.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                {tr(isAr, "No words marked as studied on this day.", "مفيش كلمات اتعلمت في اليوم ده.")}
              </p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                {selectedEntries.slice(0, 40).map((e) => (
                  <li
                    key={e.id}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                      fontSize: 14,
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: "rgba(var(--border-rgb),0.05)",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: INK, direction: e.section === "ar-ar" ? "rtl" : "ltr" }}>
                      {e.word}
                    </span>
                    <span style={{ color: "var(--muted)", fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.meaning || e.definition || ""}
                    </span>
                  </li>
                ))}
                {selectedEntries.length > 40 && (
                  <li style={{ fontSize: 12, color: "var(--muted)", padding: "4px 8px" }}>
                    +{selectedEntries.length - 40} {tr(isAr, "more", "أخرى")}
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDayTitle(key, isAr) {
  // key is "YYYY-M-D"
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m, d);
  return dt.toLocaleDateString(isAr ? "ar-EG" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const iconBtn = {
  border: "none",
  background: "transparent",
  color: "var(--icon-muted)",
  padding: 4,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 6,
};

const headerBtn = {
  border: "1px solid rgba(var(--border-rgb),0.18)",
  background: "var(--card)",
  color: INK,
  padding: "6px 12px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

const navBtn = {
  border: "none",
  background: "rgba(var(--border-rgb),0.08)",
  color: INK,
  width: 36,
  height: 36,
  borderRadius: 10,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
