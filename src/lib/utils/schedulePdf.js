/**
 * Export student weekly schedule as a print-ready PDF (HTML → print dialog).
 * No external deps — uses the browser print engine.
 */
import {
  orderedWeekDays,
  dayLabel,
  dateKey,
  dateForWeekday,
  blocksForDate,
  completionsForDate,
  buildWeekSummary,
  formatTimeDisplay,
  formatMins,
  BLOCK_TYPES,
  scheduleStreak,
  hasTime,
} from "../state/schedule";

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function typeLabel(type, isAr) {
  const m = BLOCK_TYPES[type] || BLOCK_TYPES.custom;
  return isAr ? m.ar : m.en;
}

/**
 * @param {object} opts
 * @param {object} opts.schedule
 * @param {string} opts.accountCode
 * @param {boolean} opts.isAr
 */
export function openSchedulePdf({ schedule, accountCode = "", isAr = false }) {
  const weekStartsOn = schedule?.weekStartsOn ?? 6;
  const days = orderedWeekDays(weekStartsOn);
  const summary = buildWeekSummary(schedule, accountCode, weekStartsOn);
  const streak = scheduleStreak(schedule, accountCode);
  const generated = new Date();
  const genStr = generated.toLocaleString(isAr ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const dayColumns = days
    .map((day) => {
      const d = dateForWeekday(day, weekStartsOn);
      const dk = dateKey(d);
      const blocks = blocksForDate(schedule, d);
      const doneMap = completionsForDate(accountCode, d);
      const dayProg = summary.days.find((x) => x.day === day);
      const items = blocks.length
        ? blocks
            .map((b) => {
              const done = !!doneMap[b.id];
              const color = escapeHtml(b.color || (BLOCK_TYPES[b.type] || {}).color || "#64748b");
              const rec =
                b.recurrence === "once"
                  ? isAr
                    ? "يوم واحد"
                    : "one day"
                  : b.recurrence === "week"
                    ? isAr
                      ? "هذا الأسبوع"
                      : "this week"
                    : "";
              const timeLine = hasTime(b)
                ? `<div class="time">${escapeHtml(formatTimeDisplay(b.start, isAr))} – ${escapeHtml(formatTimeDisplay(b.end, isAr))}</div>`
                : `<div class="time time-none">${isAr ? "بلا وقت" : "No time"}</div>`;
              return `
            <div class="block ${done ? "done" : ""}">
              <i class="swatch" style="background:${color}"></i>
              <div class="block-body">
                ${timeLine}
                <div class="title">${escapeHtml(b.title)}${done ? " ✓" : ""}</div>
                <div class="meta">${escapeHtml(typeLabel(b.type, isAr))}${rec ? " · " + escapeHtml(rec) : ""}</div>
              </div>
            </div>`;
            })
            .join("")
        : `<div class="empty">${isAr ? "لا يوجد" : "Empty"}</div>`;

      return `
        <section class="day">
          <header>
            <h2>${escapeHtml(dayLabel(day, isAr, false))}</h2>
            <span class="date">${escapeHtml(dk)}</span>
            <span class="pct">${dayProg ? dayProg.pct : 0}%</span>
          </header>
          <div class="blocks">${items}</div>
        </section>`;
    })
    .join("");

  const title = isAr ? "جدولي الأسبوعي" : "My Weekly Schedule";
  const subtitle = isAr ? "Bacaloria Community" : "Bacaloria Community";

  const html = `<!DOCTYPE html>
<html lang="${isAr ? "ar" : "en"}" dir="${isAr ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", "Source Sans 3", Tahoma, sans-serif;
    color: #1c1917;
    background: #f5f0e8;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    max-width: 1100px;
    margin: 0 auto;
    padding: 18px 20px 28px;
  }
  .hero {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 20px;
    border-radius: 16px;
    background: linear-gradient(125deg, #1e1b4b 0%, #312e81 45%, #b45309 100%);
    color: #fff7ed;
    margin-bottom: 16px;
    box-shadow: 0 12px 30px -16px rgba(30, 27, 75, 0.55);
  }
  .hero h1 {
    margin: 0 0 4px;
    font-size: 1.55rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .hero .sub { opacity: 0.85; font-size: 12px; }
  .hero-stats {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .stat {
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 12px;
    padding: 8px 12px;
    min-width: 88px;
    text-align: center;
  }
  .stat b { display: block; font-size: 1.15rem; }
  .stat span { font-size: 10px; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.04em; }
  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;
  }
  .day {
    background: #fffdf9;
    border: 1px solid rgba(28, 25, 23, 0.1);
    border-radius: 12px;
    min-height: 220px;
    display: flex;
    flex-direction: column;
    break-inside: avoid-column;
  }
  .day header {
    padding: 8px 8px 6px;
    background: #faf6ef;
    border-bottom: 1px solid rgba(28, 25, 23, 0.08);
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 6px;
  }
  .day h2 {
    margin: 0;
    font-size: 12px;
    font-weight: 800;
    grid-column: 1;
  }
  .day .date { font-size: 9px; color: #78716c; grid-column: 1; }
  .day .pct {
    grid-row: 1 / span 2;
    grid-column: 2;
    align-self: center;
    font-size: 11px;
    font-weight: 800;
    color: #b45309;
  }
  .blocks { padding: 6px; display: flex; flex-direction: column; gap: 5px; flex: 1; }
  .block {
    display: flex;
    gap: 6px;
    padding: 5px 6px;
    border-radius: 8px;
    background: #f8f4ec;
    border: 1px solid rgba(28,25,23,0.06);
  }
  .block { break-inside: avoid; }
  .block.done { opacity: 0.55; }
  .block.done .title { text-decoration: line-through; }
  .swatch {
    width: 4px;
    border-radius: 4px;
    flex-shrink: 0;
    align-self: stretch;
  }
  .time { font-size: 9px; font-weight: 700; color: #78716c; }
  .title { font-size: 10.5px; font-weight: 700; line-height: 1.25; }
  .meta { font-size: 9px; color: #a8a29e; }
  .empty {
    font-size: 10px;
    color: #a8a29e;
    text-align: center;
    padding: 16px 4px;
  }
  .footer {
    margin-top: 14px;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 10px;
    color: #78716c;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-top: 10px;
    font-size: 9px;
    color: #57534e;
  }
  .legend span { display: inline-flex; align-items: center; gap: 4px; }
  .legend i {
    width: 8px; height: 8px; border-radius: 50%; display: inline-block;
  }
  @media print {
    body { background: #fff; }
    .sheet { max-width: none; padding: 0; }
    .hero { break-inside: avoid; }
  }
  @media (max-width: 900px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
    @page { size: A4 portrait; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="hero">
      <div>
        <h1>${escapeHtml(title)}</h1>
        <div class="sub">${escapeHtml(subtitle)} · ${escapeHtml(genStr)}</div>
      </div>
      <div class="hero-stats">
        <div class="stat"><b>${summary.pct}%</b><span>${isAr ? "إنجاز" : "Done"}</span></div>
        <div class="stat"><b>${summary.totalDone}/${summary.totalBlocks}</b><span>${isAr ? "بلوكات" : "Blocks"}</span></div>
        <div class="stat"><b>${escapeHtml(formatMins(summary.studyMinsDone, isAr))}</b><span>${isAr ? "مذاكرة" : "Study"}</span></div>
        ${streak > 0 ? `<div class="stat"><b>${streak}</b><span>${isAr ? "سلسلة" : "Streak"}</span></div>` : ""}
      </div>
    </div>
    <div class="grid">
      ${dayColumns}
    </div>
    <div class="legend">
      ${Object.entries(BLOCK_TYPES)
        .map(
          ([k, v]) =>
            `<span><i style="background:${v.color}"></i>${escapeHtml(isAr ? v.ar : v.en)}</span>`
        )
        .join("")}
    </div>
    <div class="footer">
      <span>${isAr ? "✓ = مكتمل" : "✓ = completed"} · ${isAr ? "البلوكات المؤقتة تظهر في أيامها فقط" : "Temporary blocks show on their days only"}</span>
      <span>${isAr ? "للطباعة: احفظ كـ PDF من نافذة الطباعة" : "Print → Save as PDF"}</span>
    </div>
  </div>
  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 200);
    };
  </script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) {
    window.alert(
      isAr
        ? "المتصفح منع النافذة. اسمح بالنوافذ المنبثقة ثم حاول تاني."
        : "Popup blocked. Allow popups and try again."
    );
    return false;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  try {
    w.focus();
  } catch (_) {}
  return true;
}

export default openSchedulePdf;
