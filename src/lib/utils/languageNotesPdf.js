/**
 * Export Language Notes as a printable PDF-style sheet
 * matching the curriculum handout layout (title badge, blue lemmas,
 * Arabic meanings on the side, examples underneath, group separators).
 */

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Highlight the first occurrence of each related word inside an example. */
function highlightExample(example, words) {
  let html = escapeHtml(example);
  const sorted = [...(words || [])]
    .filter(Boolean)
    .sort((a, b) => String(b).length - String(a).length);
  for (const w of sorted) {
    const safe = escapeHtml(w);
    if (!safe) continue;
    const re = new RegExp(`(${safe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i");
    html = html.replace(re, '<span class="hl">$1</span>');
  }
  return html;
}

function renderGroup(group) {
  const title = (group.relatedWords || []).filter(Boolean).join(" - ") || "—";
  const entries = group.entries || [];
  const items = entries
    .map((e) => {
      const lemma = [e.word, e.type ? `(${e.type})` : ""].filter(Boolean).join(" ");
      const meaning = e.meaning || "";
      const example = e.example
        ? `<div class="ex">- ${highlightExample(e.example, group.relatedWords)}</div>`
        : "";
      const note = e.note
        ? `<div class="note-line"><span class="note-lab">note:</span> ${escapeHtml(e.note)}</div>`
        : "";
      const add = e.additionalNote
        ? `<div class="note-line"><span class="note-lab">additional:</span> ${escapeHtml(e.additionalNote)}</div>`
        : "";
      return `
        <div class="entry">
          <div class="entry-row">
            <div class="lemma">• <strong>${escapeHtml(lemma)}</strong></div>
            <div class="meaning" dir="rtl">${escapeHtml(meaning)}</div>
          </div>
          ${example}
          ${note}
          ${add}
        </div>`;
    })
    .join("");

  return `
    <div class="group">
      <div class="group-title"><span>${escapeHtml(title)}</span></div>
      ${items}
    </div>`;
}

function renderNoteBlock(note) {
  const groups = (note.groups || []).map(renderGroup).join("");
  const role = note.role
    ? `<div class="note-role">${escapeHtml(note.role)}</div>`
    : "";
  const section =
    note.section === "curriculum" ? "Curriculum" : "External";
  return `
    <section class="note-card">
      <div class="note-meta">
        <div class="note-name">${escapeHtml(note.name || "Note")}</div>
        ${role}
        <div class="note-section">${section}</div>
      </div>
      ${groups || '<p class="empty">No groups yet.</p>'}
    </section>`;
}

/**
 * Open a print window with one or more notes styled like the handout PDF.
 * @param {object[]} notesList
 * @param {{ isAr?: boolean }} opts
 */
export function exportLanguageNotesPdf(notesList, opts = {}) {
  const notes = (notesList || []).filter(Boolean);
  if (!notes.length) return;

  const title =
    notes.length === 1
      ? notes[0].name || "Language Note"
      : `Language Notes (${notes.length})`;

  const body = notes.map(renderNoteBlock).join('<div class="page-break"></div>');

  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;

  w.document.write(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 18px;
    font-family: "Segoe UI", "Helvetica Neue", Arial, "Amiri", "Times New Roman", sans-serif;
    color: #1a1a1a;
    background: #fff;
    line-height: 1.45;
  }
  .note-card {
    border: 1.5px solid #2c2c2c;
    border-radius: 14px;
    padding: 18px 20px 16px;
    max-width: 720px;
    margin: 0 auto 28px;
  }
  .note-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px 14px;
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid #e5e5e5;
  }
  .note-name {
    font-weight: 800;
    font-size: 15px;
    color: #111;
  }
  .note-role {
    font-size: 12px;
    font-weight: 600;
    color: #555;
    background: #f3f0e8;
    border-radius: 999px;
    padding: 2px 10px;
  }
  .note-section {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #888;
    margin-inline-start: auto;
  }
  .group { margin-bottom: 8px; }
  .group-title {
    text-align: center;
    margin: 14px 0 12px;
    position: relative;
  }
  .group-title::before {
    content: "";
    position: absolute;
    left: 0; right: 0; top: 50%;
    border-top: 1px solid #c8c4b8;
    z-index: 0;
  }
  .group-title span {
    position: relative;
    z-index: 1;
    display: inline-block;
    background: #f5efe0;
    border: 1px solid #e0d6c0;
    border-radius: 999px;
    padding: 3px 14px;
    font-size: 12.5px;
    font-weight: 700;
    color: #3a3428;
  }
  .entry { margin-bottom: 10px; }
  .entry-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }
  .lemma {
    color: #1a4fbf;
    font-size: 13.5px;
    flex: 1;
    min-width: 0;
  }
  .lemma strong { font-weight: 700; }
  .meaning {
    color: #222;
    font-size: 14px;
    font-family: "Amiri", "Times New Roman", serif;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .ex {
    margin: 2px 0 0 16px;
    font-size: 12.5px;
    color: #333;
  }
  .ex .hl {
    color: #1a4fbf;
    font-weight: 700;
    text-decoration: underline;
    text-decoration-color: #7aa0e8;
    text-underline-offset: 2px;
  }
  .note-line {
    margin: 2px 0 0 16px;
    font-size: 12px;
    color: #555;
  }
  .note-lab { font-weight: 700; color: #777; }
  .empty { color: #999; font-size: 13px; text-align: center; }
  .page-break { page-break-after: always; height: 0; }
  @media print {
    body { padding: 0; }
    .note-card { break-inside: avoid; margin-bottom: 16px; }
    .page-break { page-break-after: always; }
  }
</style>
</head>
<body>
${body}
<script>
  window.onload = function () {
    try { window.focus(); window.print(); } catch (e) {}
  };
</script>
</body>
</html>`);
  w.document.close();
}
