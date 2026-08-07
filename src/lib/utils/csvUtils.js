// CSV import / export for dictionary entries.

function escapeCsv(val) {
  const s = String(val == null ? "" : val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportEntriesAsCsv(entries) {
  const headers = [
    "id",
    "section",
    "word",
    "meaning",
    "definition",
    "example",
    "examples",
    "synonyms",
    "antonyms",
    "addedAt",
  ];
  const rows = [headers.join(",")];
  for (const e of entries || []) {
    rows.push(
      [
        e.id,
        e.section,
        e.word,
        e.meaning,
        e.definition || "",
        e.example || "",
        (e.examples || []).join(" | "),
        (e.synonyms || []).map((p) => (typeof p === "string" ? p : p.word)).join(" | "),
        (e.antonyms || []).map((p) => (typeof p === "string" ? p : p.word)).join(" | "),
        e.addedAt || "",
      ]
        .map(escapeCsv)
        .join(",")
    );
  }
  return rows.join("\n");
}

export function parseCsv(text) {
  const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] != null ? cols[idx] : "";
    });
    if (!row.word && !row.meaning) continue;
    out.push({
      word: row.word || "",
      meaning: row.meaning || "",
      definition: row.definition || "",
      example: row.example || "",
      examples: row.examples
        ? String(row.examples)
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      synonyms: row.synonyms
        ? String(row.synonyms)
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((w) => ({ word: w, meaning: "" }))
        : [],
      antonyms: row.antonyms
        ? String(row.antonyms)
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((w) => ({ word: w, meaning: "" }))
        : [],
      section: row.section === "ar-ar" ? "ar-ar" : "en-ar",
      id: row.id || undefined,
      addedAt: row.addedat ? Number(row.addedat) || Date.now() : Date.now(),
    });
  }
  return out;
}

function splitCsvLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/**
 * Anki-compatible TSV export.
 * Columns: Front, Back, Tags (section + pos)
 * Users can import via Anki → File → Import → choose "Tab" separator.
 */
export function exportEntriesAsAnkiTsv(entries) {
  const rows = ["#separator:tab", "#html:false", "Front\tBack\tTags"];
  for (const e of entries || []) {
    const front = String(e.word || "").replace(/[\t\n\r]/g, " ").trim();
    const backParts = [e.meaning, e.definition, e.example].filter(Boolean).map((s) => String(s).replace(/[\t\n\r]/g, " ").trim());
    const back = backParts.join(" — ");
    const tags = [e.section || "", e.pos || ""].filter(Boolean).join(" ");
    if (!front && !back) continue;
    rows.push(`${front}\t${back}\t${tags}`);
  }
  return rows.join("\n");
}

export function downloadTextFile(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}
