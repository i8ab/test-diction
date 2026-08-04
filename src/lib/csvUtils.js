// CSV import/export helpers for bulk-adding and exporting dictionary entries.
import { normalizePairs } from "./pairUtils";

function csvEscape(value) {
  const str = value == null ? "" : String(value);
  // Quote whenever the field has a comma, a quote, OR any kind of line
  // break — including a lone \r (some paste sources use old Mac-style \r
  // only). Missing that case used to let an un-quoted \r slip through,
  // which parseCsv (correctly) treats as a row terminator on import — so a
  // meaning/definition containing a bare \r would silently split into two
  // bogus rows instead of staying one field.
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// Minimal CSV parser (handles quoted fields, escaped "" quotes, and both
// \n and \r\n line endings) — the counterpart to entriesToCsv() above, used
// by the "Import CSV" bulk-add feature. Good enough for the flat,
// non-nested rows this app itself exports; not a general-purpose parser.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, ""); // strip BOM if present
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function entriesToCsv(entries, cfg) {
  const header = ["word", "meaning", "definition", "synonyms", "antonyms"];
  const rows = entries.map((e) => {
    const syn = normalizePairs(e.synonyms, cfg).map((p) => p.word).filter(Boolean).join("; ");
    const ant = normalizePairs(e.antonyms, cfg).map((p) => p.word).filter(Boolean).join("; ");
    return [e.word, e.meaning, e.definition || "", syn, ant];
  });
  const lines = [header, ...rows].map((row) => row.map(csvEscape).join(","));
  return "\uFEFF" + lines.join("\r\n");
}

function downloadTextFile(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportEntriesAsCsv(entries, cfg, sectionLabel) {
  const csv = entriesToCsv(entries, cfg);
  const date = new Date().toISOString().slice(0, 10);
  downloadTextFile(`two-tongues-${sectionLabel}-${date}.csv`, csv, "text/csv;charset=utf-8;");
}

export { csvEscape, parseCsv, entriesToCsv, downloadTextFile, exportEntriesAsCsv };
