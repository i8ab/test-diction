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
