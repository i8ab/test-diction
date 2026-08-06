import { useEffect, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, labelStyle } from "../../lib/config/theme";
import { isSrsDue, SRS_BOX_LABELS, computeStreak, formatDueIn } from "../../lib/utils/quizHelpers";
import { XIcon, StatsIcon, FlameIcon } from "../common/Icons";

// Builds a cumulative "words studied over time" series from `studiedAt`
// ({ entryId: timestamp }), one point per day from the first studied day
// through today. Capped to the most recent 30 days so the chart stays
// readable even for accounts with a long history — the cap only trims
// which days are *shown*, the cumulative total itself still includes
// everything studied before the window.
function buildProgressSeries(studiedAt, maxDays = 30) {
  const timestamps = Object.values(studiedAt || {}).filter((t) => typeof t === "number").sort((a, b) => a - b);
  if (timestamps.length === 0) return [];

  const oneDay = 24 * 60 * 60 * 1000;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const firstStart = new Date(timestamps[0]);
  firstStart.setHours(0, 0, 0, 0);

  let dayCursor = firstStart.getTime();
  const totalDays = Math.round((todayStart.getTime() - dayCursor) / oneDay) + 1;
  if (totalDays > maxDays) dayCursor = todayStart.getTime() - (maxDays - 1) * oneDay;

  const days = [];
  let tsIndex = 0;
  let cumulative = 0;
  // Count everything studied before the visible window into the running
  // total so the first visible point isn't misleadingly low.
  while (tsIndex < timestamps.length && timestamps[tsIndex] < dayCursor) { cumulative += 1; tsIndex += 1; }

  for (let d = dayCursor; d <= todayStart.getTime(); d += oneDay) {
    const dayEnd = d + oneDay;
    while (tsIndex < timestamps.length && timestamps[tsIndex] < dayEnd) { cumulative += 1; tsIndex += 1; }
    days.push({ date: d, count: cumulative });
  }
  return days;
}

// Small inline SVG line chart — no charting library dependency, matches
// the app's existing icon/rendering approach.
function ProgressChart({ studiedAt, isAr }) {
  const series = useMemo(() => buildProgressSeries(studiedAt), [studiedAt]);
  if (series.length < 2) return null;

  const width = 480, height = 120, padX = 8, padTop = 10, padBottom = 22;
  const maxCount = Math.max(...series.map((p) => p.count), 1);
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const stepX = innerW / (series.length - 1);

  const points = series.map((p, i) => {
    const x = padX + i * stepX;
    const y = padTop + innerH - (p.count / maxCount) * innerH;
    return { x, y, ...p };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${padTop + innerH} L${points[0].x.toFixed(1)},${padTop + innerH} Z`;

  // A handful of evenly spaced date labels along the x-axis, always
  // including the first and last day.
  const labelEvery = Math.max(1, Math.ceil(series.length / 5));
  const fmt = (ms) => new Date(ms).toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric" });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img"
      aria-label={tr(isAr, "Cumulative words studied over time", "إجمالي الكلمات المدروسة عبر الوقت")}>
      <path d={areaPath} fill={BRASS} opacity="0.12" stroke="none" />
      <path d={linePath} fill="none" stroke={BRASS} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        (i === points.length - 1) ? (
          <circle key={i} cx={p.x} cy={p.y} r="3.2" fill={BRASS} />
        ) : null
      ))}
      {points.map((p, i) => (
        (i === 0 || i === points.length - 1 || i % labelEvery === 0) ? (
          <text key={i} x={p.x} y={height - 6} fontSize="9" textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fill="var(--muted)">
            {fmt(p.date)}
          </text>
        ) : null
      ))}
      <text x={padX} y={padTop + 8} fontSize="10" fontWeight="700" fill={INK}>
        {points[points.length - 1].count}
      </text>
    </svg>
  );
}

function StatsModal({ entries, sectionLabel, studiedIds, studiedAt, srsBox, srsDueAt, quizHistory, isAr, cfg, onClose }) {
  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const studiedEntries = useMemo(() => entries.filter((e) => studiedIds.has(e.id)), [entries, studiedIds]);
  const total = entries.length;
  const studiedCount = studiedEntries.length;
  const pct = total ? Math.round((studiedCount / total) * 100) : 0;

  const boxCounts = useMemo(() => {
    const counts = [0, 0, 0, 0];
    for (const e of studiedEntries) {
      const box = (srsBox && srsBox[e.id]) || 0;
      counts[box] += 1;
    }
    return counts;
  }, [studiedEntries, srsBox]);

  const dueCount = useMemo(() => studiedEntries.filter((e) => isSrsDue(e.id, srsDueAt)).length, [studiedEntries, srsDueAt]);

  // "Needs work" — studied words still in box 0/1, oldest-studied first
  // (the ones sitting around the longest without being solidified).
  const weakWords = useMemo(() => {
    return studiedEntries
      .filter((e) => ((srsBox && srsBox[e.id]) || 0) <= 1)
      .sort((a, b) => (studiedAt[a.id] || 0) - (studiedAt[b.id] || 0))
      .slice(0, 8);
  }, [studiedEntries, srsBox, studiedAt]);

  const streak = useMemo(() => computeStreak(studiedAt), [studiedAt]);

  // Only words that have an actual scheduled due date (i.e. have been
  // quizzed at least once) — sorted soonest-first, closest 8 shown.
  const upcomingReviews = useMemo(() => {
    return studiedEntries
      .filter((e) => typeof (srsDueAt && srsDueAt[e.id]) === "number")
      .sort((a, b) => srsDueAt[a.id] - srsDueAt[b.id])
      .slice(0, 8);
  }, [studiedEntries, srsDueAt]);

  const recentQuizzes = useMemo(() => [...(quizHistory || [])].reverse().slice(0, 5), [quizHistory]);

  const statCardStyle = { flex: "1 1 120px", background: "var(--input-bg)", borderRadius: 6, padding: "12px 14px", textAlign: "center" };

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 2000 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card" dir={isAr ? "rtl" : "ltr"} role="dialog" aria-modal="true" aria-labelledby="stats-modal-title"
        style={{ width: "100%", maxWidth: 540, maxHeight: "88vh", overflowY: "auto", background: CARD, borderRadius: 4, padding: "24px 24px 22px", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 id="stats-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <StatsIcon size={19} color={BRASS} /> {tr(isAr, "Your stats", "إحصائياتي")}
            {sectionLabel && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>· {sectionLabel}</span>}
          </h2>
          <button onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)" }}><XIcon size={20} /></button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <div style={statCardStyle}>
            <div style={{ fontSize: 24, fontWeight: 700, color: cfg.accent }}>{pct}%</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{tr(isAr, `${studiedCount} of ${total} words`, `${studiedCount} من ${total} كلمة`)}</div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--success)" }}>{boxCounts[3]}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{tr(isAr, "Mastered", "متقنة")}</div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--danger)" }}>{dueCount}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{tr(isAr, "Due for review", "مستحقة للمراجعة")}</div>
          </div>
          <div style={{ ...statCardStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 24, fontWeight: 700, color: BRASS }}>
              <FlameIcon size={20} color={BRASS} /> {streak}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{tr(isAr, "day streak", "يوم متتالي")}</div>
          </div>
        </div>

        {Object.keys(studiedAt || {}).length > 0 && (
          <>
            <label style={{ ...labelStyle, marginTop: 20 }}>{tr(isAr, "Progress over time", "التقدّم عبر الوقت")}</label>
            <div style={{ background: "var(--input-bg)", borderRadius: 6, padding: "10px 12px 4px", marginTop: 6 }}>
              <ProgressChart studiedAt={studiedAt} isAr={isAr} />
      <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(var(--border-rgb),0.06)", fontSize: 13 }}>
        <strong style={{ color: "var(--ink)" }}>{tr(isAr, "This week", "هذا الأسبوع")}</strong>
        <div style={{ marginTop: 6, color: "var(--muted-strong)" }}>
          {tr(isAr,
            `${Object.values(studiedAt || {}).filter((t) => typeof t === "number" && t >= (Date.now() - 7 * 86400000)).length} words studied · ${(quizHistory || []).filter((q) => q && q.at >= Date.now() - 7 * 86400000).length} quizzes`,
            `${Object.values(studiedAt || {}).filter((t) => typeof t === "number" && t >= (Date.now() - 7 * 86400000)).length} كلمة اتدرست · ${(quizHistory || []).filter((q) => q && q.at >= Date.now() - 7 * 86400000).length} اختبار`)}
        </div>
      </div>
            </div>
          </>
        )}

        <label style={{ ...labelStyle, marginTop: 20 }}>{tr(isAr, "Learning progress", "مستوى التعلّم")}</label>
        <div style={{ display: "flex", height: 10, borderRadius: 20, overflow: "hidden", marginTop: 6 }}>
          {["#c9c9c9", "#e0b04a", "#7fa8d9", "var(--success)"].map((color, i) => (
            studiedCount > 0 && boxCounts[i] > 0 ? (
              <div key={i} title={tr(isAr, SRS_BOX_LABELS[i].en, SRS_BOX_LABELS[i].ar)} style={{ width: `${(boxCounts[i] / studiedCount) * 100}%`, background: color }} />
            ) : null
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
          {SRS_BOX_LABELS.map((l, i) => (
            <span key={i}>{tr(isAr, l.en, l.ar)}: {boxCounts[i]}</span>
          ))}
        </div>

        {weakWords.length > 0 && (
          <>
            <label style={{ ...labelStyle, marginTop: 20 }}>{tr(isAr, "Needs work", "محتاجة مراجعة")}</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {weakWords.map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "var(--input-bg)", borderRadius: 4 }}>
                  <span dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 14, fontWeight: 600, color: INK }}>{e.word}</span>
                  <span dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: 13, color: "var(--muted)" }}>{e.meaning}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {upcomingReviews.length > 0 && (
          <>
            <label style={{ ...labelStyle, marginTop: 20 }}>{tr(isAr, "Upcoming reviews", "موعد المراجعة الجاية")}</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {upcomingReviews.map((e) => {
                const due = srsDueAt[e.id];
                const isDueNow = due <= Date.now();
                return (
                  <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "var(--input-bg)", borderRadius: 4 }}>
                    <span dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 14, fontWeight: 600, color: INK }}>{e.word}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: isDueNow ? "var(--danger)" : "var(--muted)" }}>{formatDueIn(due, isAr)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {recentQuizzes.length > 0 && (
          <>
            <label style={{ ...labelStyle, marginTop: 20 }}>{tr(isAr, "Recent quizzes", "آخر الاختبارات")}</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {recentQuizzes.map((q) => (
                <div key={q.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "var(--input-bg)", borderRadius: 4, fontSize: 13 }}>
                  <span style={{ color: "var(--muted)" }}>{new Date(q.at).toLocaleString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  <span style={{ fontWeight: 700, color: q.total && q.score / q.total >= 0.7 ? "var(--success)" : INK }}>{q.score}/{q.total}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {studiedCount === 0 && (
          <p style={{ marginTop: 20, fontSize: 14, color: "var(--muted)", textAlign: "center" }}>
            {tr(isAr, "Mark some words as studied to start seeing stats here.", "علّم بعض الكلمات كمدروسة عشان تبدأ تشوف إحصائياتك هنا.")}
          </p>
        )}
      </div>
    </div>
  );
}

export default StatsModal;
