import { useMemo, useRef, useState } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS } from "../../lib/config/theme";
import { srsLevelFromStats, computeStreak, isSrsDue, formatDueIn } from "../../lib/utils/quizHelpers";
import { XIcon, DownloadIcon, StatsIcon } from "../common/Icons";
import HowItWorksButton from "../common/HowItWorksButton";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

/**
 * Weekly study report — forgotten / weak words + simple export (PNG image + text).
 */
function weekAgoMs() {
  return Date.now() - 7 * 24 * 60 * 60 * 1000;
}

function buildForgotten(entries, studiedIds, srsStats, studiedAt, wordPriorities) {
  const since = weekAgoMs();
  const list = (entries || []).filter((e) => studiedIds.has(e.id));
  const scored = list.map((e) => {
    const stats = srsStats[e.id] || { correct: 0, total: 0 };
    const level = srsLevelFromStats(stats);
    const ratio = stats.total > 0 ? stats.correct / stats.total : 1;
    const studiedRecently = typeof studiedAt[e.id] === "number" && studiedAt[e.id] >= since;
    const weak = level <= 2 || (stats.total >= 2 && ratio < 0.7);
    const prio = Number(wordPriorities[e.id]) || 0;
    return { entry: e, stats, level, ratio, studiedRecently, weak, prio };
  });
  // Forgotten / weak: low accuracy or low box, prefer those touched this week
  return scored
    .filter((x) => x.weak)
    .sort((a, b) => {
      if (b.prio !== a.prio) return b.prio - a.prio;
      if (a.level !== b.level) return a.level - b.level;
      return a.ratio - b.ratio;
    });
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportReportImage(canvasEl, filename) {
  if (!canvasEl) return;
  try {
    const url = canvasEl.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  } catch (_) {}
}

function drawReportCanvas(canvas, data, isAr) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = 720;
  const rows = Math.min(data.forgotten.length, 12);
  const H = 200 + rows * 36 + 80;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  // background
  ctx.fillStyle = "#0f1419";
  ctx.fillRect(0, 0, W, H);

  // header bar
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, "#5b8def");
  grad.addColorStop(1, "#af52de");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 72);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.fillText(isAr ? "التقرير الأسبوعي" : "Weekly Report", 24, 44);

  ctx.font = "14px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  const dateStr = new Date().toLocaleDateString(isAr ? "ar" : "en");
  ctx.fillText(dateStr, W - 140, 44);

  // stats row
  ctx.fillStyle = "#e7ecf3";
  ctx.font = "15px system-ui, sans-serif";
  let y = 100;
  const statsLine = isAr
    ? `كلمات مدروسة: ${data.studiedCount}  ·  ضعيف: ${data.forgotten.length}  ·  سلسلة: ${data.streak} يوم`
    : `Studied: ${data.studiedCount}  ·  Weak: ${data.forgotten.length}  ·  Streak: ${data.streak}d`;
  ctx.fillText(statsLine, 24, y);

  y = 130;
  ctx.fillStyle = "#9aa4b2";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(isAr ? "الكلمات الأضعف هذا الأسبوع" : "Weakest words this week", 24, y);

  y = 160;
  data.forgotten.slice(0, 12).forEach((item, i) => {
    const word = item.entry.word || item.entry.term || "—";
    const meaning = item.entry.meaning || item.entry.translation || "";
    const pct = item.stats.total ? Math.round(item.ratio * 100) : "—";
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.04)" : "transparent";
    ctx.fillRect(16, y - 20, W - 32, 34);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText(`${i + 1}. ${word}`, 28, y);
    ctx.fillStyle = "#9aa4b2";
    ctx.font = "13px system-ui, sans-serif";
    const meta = `${meaning}  ·  ${pct}%  ·  Lv${item.level}`;
    ctx.fillText(meta.slice(0, 70), 28, y + 16);
    y += 36;
  });

  // footer
  ctx.fillStyle = "#6b7280";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText("Bacaloria Community", 24, H - 24);
}

export default function WeeklyReportModal({
  entries,
  studiedIds,
  studiedAt = {},
  srsStats = {},
  srsDueAt = {},
  wordPriorities = {},
  isAr,
  onClose,
}) {
  const canvasRef = useRef(null);
  const [exported, setExported] = useState(false);

  const data = useMemo(() => {
    const forgotten = buildForgotten(entries, studiedIds, srsStats, studiedAt, wordPriorities);
    const studiedCount = studiedIds instanceof Set ? studiedIds.size : (studiedIds || []).length;
    const streak = computeStreak(studiedAt);
    const dueCount = (entries || []).filter(
      (e) => studiedIds.has(e.id) && isSrsDue(e.id, {}) // due map optional here
    ).length;
    const upcoming = (entries || [])
      .filter((e) => studiedIds.has(e.id) && srsDueAt[e.id] != null)
      .map((e) => ({ entry: e, due: Number(srsDueAt[e.id]) }))
      .sort((a, b) => a.due - b.due)
      .slice(0, 8);
    return { forgotten, studiedCount, streak, dueCount, upcoming };
  }, [entries, studiedIds, srsStats, studiedAt, wordPriorities, srsDueAt]);

  function handleExportImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawReportCanvas(canvas, data, isAr);
    const stamp = new Date().toISOString().slice(0, 10);
    exportReportImage(canvas, `weekly-report-${stamp}.png`);
    setExported(true);
  }

  function handleExportText() {
    const stamp = new Date().toISOString().slice(0, 10);
    const lines = [
      isAr ? "التقرير الأسبوعي — Bacaloria" : "Weekly Report — Bacaloria",
      stamp,
      "",
      isAr
        ? `كلمات مدروسة: ${data.studiedCount} | ضعيف: ${data.forgotten.length} | سلسلة: ${data.streak}`
        : `Studied: ${data.studiedCount} | Weak: ${data.forgotten.length} | Streak: ${data.streak}`,
      "",
      isAr ? "الكلمات الأضعف:" : "Weakest words:",
      ...data.forgotten.slice(0, 30).map((item, i) => {
        const w = item.entry.word || "—";
        const m = item.entry.meaning || "";
        const pct = item.stats.total ? Math.round(item.ratio * 100) + "%" : "n/a";
        return `${i + 1}. ${w} — ${m} (${pct}, Lv${item.level})`;
      }),
    ];
    downloadText(`weekly-report-${stamp}.txt`, lines.join("\n"));
    setExported(true);
  }

  function handlePrint() {
    // Open a minimal print window
    const w = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
    if (!w) return;
    const rows = data.forgotten
      .slice(0, 40)
      .map((item, i) => {
        const word = item.entry.word || "—";
        const meaning = item.entry.meaning || "";
        const pct = item.stats.total ? Math.round(item.ratio * 100) + "%" : "—";
        return `<tr><td>${i + 1}</td><td><b>${word}</b></td><td>${meaning}</td><td>${pct}</td><td>${item.level}</td></tr>`;
      })
      .join("");
    w.document.write(`<!doctype html><html><head><title>${isAr ? "تقرير أسبوعي" : "Weekly Report"}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;color:#111}
        h1{margin:0 0 8px}
        .meta{color:#555;margin-bottom:16px}
        table{width:100%;border-collapse:collapse}
        th,td{border-bottom:1px solid #ddd;padding:8px;text-align:start}
        th{background:#f5f5f5}
      </style></head><body>
      <h1>${isAr ? "التقرير الأسبوعي" : "Weekly Report"}</h1>
      <div class="meta">${new Date().toLocaleString()} · ${isAr ? "مدروسة" : "Studied"}: ${data.studiedCount} · ${isAr ? "ضعيف" : "Weak"}: ${data.forgotten.length} · ${isAr ? "سلسلة" : "Streak"}: ${data.streak}</div>
      <table><thead><tr><th>#</th><th>${isAr ? "الكلمة" : "Word"}</th><th>${isAr ? "المعنى" : "Meaning"}</th><th>%</th><th>Lv</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5">${isAr ? "لا توجد كلمات ضعيفة" : "No weak words"}</td></tr>`}</tbody></table>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr(isAr, "Weekly report", "التقرير الأسبوعي")}
      style={{
        position: "fixed", inset: 0, zIndex: 6000,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <BodyScrollLock />
      <div
        style={{
          width: "100%", maxWidth: 480, background: CARD,
          borderRadius: 18, padding: "20px 18px 18px",
          border: "1px solid rgba(var(--border-rgb),0.14)",
          boxShadow: "0 24px 56px -16px rgba(0,0,0,0.45)",
          maxHeight: "min(90dvh, 720px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatsIcon size={20} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted-strong)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {tr(isAr, "Weekly report", "التقرير الأسبوعي")}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {tr(isAr, "Last 7 days focus", "تركيز آخر 7 أيام")}
              </div>
            </div>
          </div>
          <div style={ display: "flex", alignItems: "center", gap: 6 }>
            <HowItWorksButton isAr={isAr} guideId="dashboard" />
            <button
            type="button"
            onClick={onClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{
              width: 36, height: 36, borderRadius: 10, border: "none",
              background: "rgba(var(--border-rgb),0.1)", color: INK, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <XIcon size={18} />
          </button>
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            { label: tr(isAr, "Studied", "مدروسة"), value: data.studiedCount },
            { label: tr(isAr, "Weak", "ضعيفة"), value: data.forgotten.length },
            { label: tr(isAr, "Streak", "سلسلة"), value: data.streak },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding: "12px 8px", borderRadius: 12, textAlign: "center",
                background: "rgba(var(--border-rgb),0.06)",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 700, color: INK }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 120, marginBottom: 12 }}>
          {data.forgotten.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 12px", color: "var(--muted)" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
              <div style={{ fontWeight: 600, color: INK }}>
                {tr(isAr, "No weak words this week", "ما فيش كلمات ضعيفة هالأسبوع")}
              </div>
            </div>
          ) : (
            data.forgotten.slice(0, 40).map((item) => {
              const pct = item.stats.total ? Math.round(item.ratio * 100) : null;
              return (
                <div
                  key={item.entry.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 8px", borderBottom: "1px solid rgba(var(--border-rgb),0.08)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: INK, fontSize: 15 }}>
                      {item.entry.word || item.entry.term}
                      {item.prio > 0 && (
                        <span style={{ marginInlineStart: 6, fontSize: 11, color: item.prio === 3 ? "#ff3b30" : item.prio === 2 ? "#ff9f0a" : "#34c759" }}>
                          ●
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.entry.meaning || item.entry.translation || ""}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-strong)", textAlign: "end", flexShrink: 0 }}>
                    <div>{pct != null ? `${pct}%` : "—"}</div>
                    <div>Lv{item.level}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {data.upcoming && data.upcoming.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-strong)", marginBottom: 6 }}>
              {tr(isAr, "Coming up for review", "قادمة للمراجعة")}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {data.upcoming.map(({ entry, due }) => (
                <span
                  key={entry.id}
                  style={{
                    fontSize: 12, padding: "4px 10px", borderRadius: 999,
                    background: "rgba(91,141,239,0.12)", color: "#5b8def",
                    border: "1px solid rgba(91,141,239,0.25)",
                  }}
                >
                  {entry.word || entry.term} · {formatDueIn(due, isAr)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Export actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleExportImage}
              style={{
                flex: 1, padding: "11px 10px", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <DownloadIcon size={16} />
              {tr(isAr, "Save image", "حفظ صورة")}
            </button>
            <button
              type="button"
              onClick={handleExportText}
              style={{
                flex: 1, padding: "11px 10px", borderRadius: 12,
                border: "1px solid rgba(var(--border-rgb),0.25)",
                background: "transparent", color: INK, fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}
            >
              {tr(isAr, "Save text", "حفظ نص")}
            </button>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              width: "100%", padding: "10px", borderRadius: 12,
              border: "1px solid rgba(var(--border-rgb),0.2)",
              background: "rgba(var(--border-rgb),0.05)", color: INK, fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}
          >
            {tr(isAr, "Print / PDF", "طباعة / PDF")}
          </button>
          {exported && (
            <div style={{ fontSize: 12, color: "#34c759", textAlign: "center" }}>
              {tr(isAr, "Exported", "تم التصدير")}
            </div>
          )}
        </div>

        {/* Hidden canvas for image export */}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
}
