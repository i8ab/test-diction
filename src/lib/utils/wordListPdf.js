import { getEntrySenses } from "./wordTypes";

/**
 * Export a selection of dictionary entries as a printable PDF-style sheet
 * ("Word List" layout — dark, gradient cards, synonym/antonym/example/note).
 *
 * Usage:
 *   import { exportWordListPdf } from "../lib/utils/wordListPdf";
 *   exportWordListPdf(selectedEntries, { title: "Travel Words", unit: "Travel" });
 *
 * Each entry can look like what entryMutations.js already produces:
 *   {
 *     word, pos, phonetic, translation,
 *     meaning, definition, example, note,
 *     synonyms: [{ word: "leave" }, { word: "desert" }],   // or plain strings
 *     antonyms: [{ word: "keep" }, { word: "maintain" }],  // or plain strings
 *     senses: [ { label, synonyms, antonyms, example, note } ] // optional, for multi-sense words
 *   }
 * Missing fields are simply skipped — nothing is required except `word`.
 */

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pairsToText(list) {
  if (!list) return "";
  const arr = Array.isArray(list) ? list : [list];
  return arr
    .map((p) => (typeof p === "string" ? p : p && p.word))
    .filter(Boolean)
    .join(" · ");
}

function highlightExample(example, word) {
  let html = escapeHtml(example);
  const safe = escapeHtml(word || "");
  if (!safe) return html;
  const re = new RegExp(`(${safe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i");
  return html.replace(re, '<span class="hl">$1</span>');
}

function renderFields(part, word) {
  const rows = [];
  const syn = pairsToText(part.synonyms);
  if (syn) {
    rows.push(`
      <div class="field">
        <div class="lab">Synonym</div>
        <div class="val meaning">${escapeHtml(syn)}</div>
      </div>`);
  }
  const ant = pairsToText(part.antonyms);
  if (ant) {
    rows.push(`
      <div class="field">
        <div class="lab ant">Antonym</div>
        <div class="val antonym">${escapeHtml(ant)}</div>
      </div>`);
  }
  // Show every example sentence, not just the first one.
  const examples = Array.isArray(part.examples) && part.examples.length
    ? part.examples
    : (part.example ? [part.example] : []);
  examples.forEach((ex, i) => {
    rows.push(`
      <div class="field">
        <div class="lab ex">${examples.length > 1 ? `Example ${i + 1}` : "Example"}</div>
        <div class="val example">${highlightExample(ex, word)}</div>
      </div>`);
  });
  if (part.note) {
    rows.push(`
      <div class="field">
        <div class="lab note">Note</div>
        <div class="val note">${escapeHtml(part.note)}</div>
      </div>`);
  }
  return rows.join("");
}

function renderCard(entry, index) {
  const num = String(index + 1).padStart(2, "0");
  const phonetic = entry.phonetic
    ? `<div class="phonetic">${escapeHtml(entry.phonetic)}</div>`
    : "";
  const translation = entry.translation
    ? `<div class="translation">${escapeHtml(entry.translation)}</div>`
    : "";

  // getEntrySenses is the app's single source of truth for resolving a word's
  // meaning(s): it merges legacy top-level fields and multi-sense entries the
  // same way the dictionary itself does, so the PDF never drops a meaning,
  // synonym/antonym set, or example the app shows on the card.
  const senses = getEntrySenses(entry);
  const multi = senses.length > 1;
  const pos = !multi && entry.pos ? `<span class="pos">${escapeHtml(entry.pos)}</span>` : "";

  let body;
  if (senses.length) {
    body = senses
      .map((sense, i) => {
        const label = multi
          ? `<div class="sense">${escapeHtml(
              [sense.pos, sense.meaning].filter(Boolean).join(" · ") || `Sense ${i + 1}`
            )}</div>`
          : sense.pos
          ? ""
          : "";
        const meaningRow = multi
          ? ""
          : `
      <div class="field">
        <div class="lab">Meaning</div>
        <div class="val meaning">${escapeHtml(sense.meaning)}</div>
      </div>`;
        const split = i > 0 ? '<div class="split"></div>' : "";
        return `${split}${label}${meaningRow}${renderFields(sense, entry.word)}`;
      })
      .join("");
    if (entry.note) {
      body += `
      <div class="field">
        <div class="lab note">Note</div>
        <div class="val note">${escapeHtml(entry.note)}</div>
      </div>`;
    }
  } else {
    body = "";
  }

  return `
    <article class="card">
      <div class="card-top">
        <div class="num">${num}</div>
        <div class="word-line">
          <div class="word">${escapeHtml(entry.word)} ${pos}</div>
          ${phonetic}
          ${translation}
        </div>
      </div>
      <div class="card-body">${body}</div>
    </article>`;
}

function buildHtml(entries, { title, unit, section } = {}) {
  const heading = title || "Word List · EN → AR";
  const cards = entries.map(renderCard).join("");
  const meta = [
    section ? `<span class="chip">Section <i>${escapeHtml(section)}</i></span>` : "",
    unit ? `<span class="chip">Unit <i>${escapeHtml(unit)}</i></span>` : "",
    `<span class="chip">Words <i>${entries.length}</i></span>`,
  ].join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(heading)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  @font-face { font-family: "Fraunces"; src: url("/fonts/fraunces-latin-600-normal.woff2") format("woff2"); font-weight: 600; font-display: swap; }
  @font-face { font-family: "Fraunces"; src: url("/fonts/fraunces-latin-700-normal.woff2") format("woff2"); font-weight: 700; font-display: swap; }
  @font-face { font-family: "Source Sans 3"; src: url("/fonts/source-sans-3-latin-400-normal.woff2") format("woff2"); font-weight: 400; font-display: swap; }
  @font-face { font-family: "Source Sans 3"; src: url("/fonts/source-sans-3-latin-600-normal.woff2") format("woff2"); font-weight: 600; font-display: swap; }
  @font-face { font-family: "Source Sans 3"; src: url("/fonts/source-sans-3-latin-700-normal.woff2") format("woff2"); font-weight: 700; font-display: swap; }
  @font-face { font-family: "Amiri"; src: url("/fonts/amiri-arabic-400-normal.woff2") format("woff2"); font-weight: 400; font-display: swap; }
  @font-face { font-family: "Amiri"; src: url("/fonts/amiri-arabic-700-normal.woff2") format("woff2"); font-weight: 700; font-display: swap; }
  body {
    margin: 0;
    font-family: "Source Sans 3", "Segoe UI", system-ui, sans-serif;
    background:
      radial-gradient(1200px 600px at 10% -10%, rgba(221,214,254,0.55) 0%, transparent 55%),
      radial-gradient(900px 500px at 100% 0%, rgba(253,230,138,0.4) 0%, transparent 50%),
      #0f0c1a;
    color: #1c1917;
    min-height: 100vh;
    padding: 28px 16px 60px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .stage { max-width: 880px; margin: 0 auto; }
  .toolbar { max-width: 880px; margin: 0 auto 14px; display: flex; gap: 8px; justify-content: flex-end; }
  .toolbar button { border: none; border-radius: 10px; padding: 10px 16px; font-weight: 700; font-size: 13px; cursor: pointer; background: #a78bfa; color: #1c1730; }
  .toolbar button.secondary { background: rgba(255,255,255,0.12); color: #f5f3ff; }
  @media print { .toolbar { display: none !important; } body { padding: 0; } .card { break-inside: avoid; } }

  .sheet { background: #0b0914; border-radius: 20px; padding: 10px; box-shadow: 0 20px 50px -28px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06); }
  .page { background: linear-gradient(165deg, #1a1430 0%, #120e22 40%, #1b1530 100%); border-radius: 14px; padding: 22px 22px 26px; color: #f5f3ff; position: relative; overflow: hidden; }
  .page::before { content: ""; position: absolute; inset: -40% auto auto -20%; width: 70%; height: 70%; background: radial-gradient(circle, rgba(167,139,250,0.13), transparent 70%); pointer-events: none; }
  .page::after { content: ""; position: absolute; inset: auto -15% -25% auto; width: 55%; height: 55%; background: radial-gradient(circle, rgba(251,191,36,0.07), transparent 70%); pointer-events: none; }
  .content { position: relative; z-index: 1; }

  .hero { display: flex; justify-content: space-between; align-items: stretch; gap: 14px; margin-bottom: 16px; }
  .hero-main { flex: 1; padding: 16px 18px; border-radius: 16px; background: linear-gradient(135deg, rgba(99,102,241,0.22), rgba(168,85,247,0.16) 50%, rgba(234,179,8,0.1)); border: 1px solid rgba(255,255,255,0.12); }
  .hero-main h1 { margin: 0 0 6px; font-family: "Fraunces", "Source Sans 3", serif; font-size: 1.55rem; font-weight: 700; letter-spacing: -0.01em; background: linear-gradient(90deg, #fff 0%, #e9d5ff 50%, #fde68a 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .hero-main .sub { font-size: 11.5px; color: rgba(245,243,255,0.72); }

  .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .chip { font-size: 11px; font-weight: 650; padding: 6px 11px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: rgba(245,243,255,0.85); }
  .chip i { font-style: normal; color: #c4b5fd; font-weight: 800; }

  .grid { display: flex; flex-direction: column; gap: 12px; }
  .card { border-radius: 16px; background: linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03)); border: 1px solid rgba(255,255,255,0.1); overflow: hidden; box-shadow: 0 8px 18px -14px rgba(0,0,0,0.4); }
  .card-top { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: linear-gradient(90deg, rgba(99,102,241,0.16), rgba(168,85,247,0.08)); border-bottom: 1px solid rgba(255,255,255,0.08); }
  .num { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; font-size: 12px; font-weight: 800; color: #0f0c1a; background: linear-gradient(135deg, #fbbf24, #f59e0b); flex-shrink: 0; }
  .word-line { flex: 1; min-width: 0; }
  .word { font-family: "Fraunces", "Source Sans 3", serif; font-size: 1.32rem; font-weight: 600; letter-spacing: -0.01em; color: #fff; line-height: 1.2; }
  .pos { display: inline-block; margin-inline-start: 8px; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: rgba(255,255,255,0.12); color: #e9d5ff; vertical-align: middle; }
  .phonetic { font-size: 11px; color: rgba(245,243,255,0.5); margin-top: 2px; }
  .translation { margin-top: 3px; font-family: "Amiri", "Source Sans 3", serif; font-size: 14px; font-weight: 700; color: #4ade80; direction: rtl; text-align: right; unicode-bidi: isolate; }
  .card-body { padding: 12px 14px 14px; }

  .field { display: grid; grid-template-columns: 92px 1fr; gap: 6px 12px; margin-bottom: 8px; font-size: 13px; line-height: 1.45; }
  .field:last-child { margin-bottom: 0; }
  .lab { font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #4ade80; padding-top: 2px; }
  .lab.ant { color: #fb7185; }
  .lab.ex { color: #38bdf8; }
  .lab.note { color: #7dd3fc; }
  .val { color: rgba(245,243,255,0.92); }
  .val.meaning { font-weight: 700; color: #4ade80; }
  .val.antonym { color: #f87171; font-weight: 600; }
  .val.note { color: rgba(245,243,255,0.85); }
  .val.example { border-inline-start: 3px solid rgba(56,189,248,0.45); padding-inline-start: 10px; color: rgba(245,243,255,0.8); }
  .val.example .hl { background: linear-gradient(90deg, rgba(251,191,36,0.22), rgba(251,191,36,0.08)); border-radius: 4px; padding: 0 3px; color: #fff; font-weight: 700; }

  .sense { font-size: 10px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: #fbbf24; margin: 4px 0 8px; }
  .split { height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent); margin: 10px 0; }

  .foot { margin-top: 18px; display: flex; justify-content: space-between; gap: 10px; font-size: 10px; color: rgba(245,243,255,0.4); padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
</style>
</head>
<body>
  <div class="stage">
    <div class="toolbar">
      <button type="button" class="secondary" onclick="window.close()">Close</button>
      <button type="button" onclick="window.print()">Print / Save PDF</button>
    </div>
    <div class="sheet">
      <div class="page">
        <div class="content">
          <header class="hero">
            <div class="hero-main">
              <h1>${escapeHtml(heading)}</h1>
              <div class="sub">Bacaloria Community · Print-ready study sheet</div>
            </div>
          </header>
          <div class="meta">${meta}</div>
          <div class="grid">${cards}</div>
          <div class="foot">
            <span>Bacaloria · personal study export</span>
            <span>Synonym · Antonym · Example</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Open a print-friendly window for the given entries (Blob URL — same pattern
 * as exportLanguageNotesPdf / exportSchedulePdf).
 * @param {object[]} entries - dictionary entries to include
 * @param {{title?: string, unit?: string, section?: string}} [opts]
 */
export function exportWordListPdf(entries, opts = {}) {
  const list = (entries || []).filter((e) => e && e.word);
  if (!list.length) {
    try {
      window.alert("No words selected.");
    } catch (_) {}
    return;
  }

  const html = buildHtml(list, opts);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const w = window.open(url, "_blank");
  if (!w) {
    const a = document.createElement("a");
    a.href = url;
    a.download = (opts.title || "word-list").replace(/[^\w\-]+/g, "_") + ".html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    try {
      window.alert(
        "Popup blocked. An HTML file was downloaded — open it and use Print → Save as PDF."
      );
    } catch (_) {}
    return;
  }

  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch (_) {}
  }, 120_000);
}
