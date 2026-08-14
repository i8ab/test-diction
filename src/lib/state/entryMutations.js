/**
 * Word entry mutations used by MainView (add / edit / delete / undo / CSV import).
 * Keeps persistEntries + log shape consistent without owning React state.
 */
import { uid } from "../utils/quizHelpers";
import { parseCsv } from "../utils/csvUtils";
import { normalizePairs } from "../utils/pairUtils";
import { makeLogEntry } from "./logs";
import { tr } from "../config/i18n";

export async function addEntry({
  newEntry,
  section,
  sectionEntries,
  entries,
  accountCode,
  name,
  cfg,
  appIsAr,
  persistEntries,
  onCloseAdd,
  showToast,
}) {
  const key = (newEntry.word || "").trim().toLowerCase();
  const existing = sectionEntries.find((e) => (e.word || "").trim().toLowerCase() === key);
  if (existing) {
    return { duplicate: existing };
  }

  const newRow = {
    ...newEntry,
    id: uid(),
    section,
    addedBy: accountCode,
    addedAt: Date.now(),
  };
  let skippedDup = false;
  await persistEntries(
    (curEntries) => {
      if (
        curEntries.some(
          (e) => e.section === section && (e.word || "").trim().toLowerCase() === key
        )
      ) {
        skippedDup = true;
        return curEntries;
      }
      return [...curEntries, newRow];
    },
    () =>
      skippedDup
        ? null
        : makeLogEntry(
            "word_add",
            `${name} added "${newEntry.word}" (${cfg.shortLabel})`,
            name,
            accountCode
          )
  );
  if (skippedDup) {
    const again = entries.find(
      (e) => e.section === section && (e.word || "").trim().toLowerCase() === key
    );
    if (again) return { duplicate: again };
    showToast(
      tr(
        appIsAr,
        `"${newEntry.word}" is already in the dictionary.`,
        `«${newEntry.word}» موجودة أصلًا في القاموس.`
      )
    );
    return { duplicate: null };
  }
  onCloseAdd();
  return { ok: true };
}

export async function editEntry({
  id,
  updates,
  entries,
  sectionEntries,
  section,
  accountCode,
  name,
  appIsAr,
  persistEntries,
  showToast,
  setEditingEntry,
}) {
  const target = entries.find((e) => e.id === id);
  const wordChanged = target && updates.word && updates.word !== target.word;
  if (wordChanged) {
    const key = (updates.word || "").trim().toLowerCase();
    const clash = sectionEntries.find(
      (e) => e.id !== id && (e.word || "").trim().toLowerCase() === key
    );
    if (clash) {
      showToast(
        tr(
          appIsAr,
          `"${clash.word}" is already in the dictionary.`,
          `«${clash.word}» موجودة أصلًا في القاموس.`
        )
      );
      return;
    }
  }
  await persistEntries(
    (curEntries) => {
      if (wordChanged) {
        const key = (updates.word || "").trim().toLowerCase();
        if (
          curEntries.some(
            (e) =>
              e.id !== id &&
              e.section === section &&
              (e.word || "").trim().toLowerCase() === key
          )
        ) {
          return curEntries;
        }
      }
      return curEntries.map((e) =>
        e.id === id
          ? { ...e, ...updates, editedBy: accountCode, editedAt: Date.now() }
          : e
      );
    },
    () =>
      makeLogEntry(
        "word_edit",
        `${name} edited "${(target && target.word) || id}"${
          wordChanged ? ` → "${updates.word}"` : ""
        }`,
        name,
        accountCode
      )
  );
  setEditingEntry(null);
}

export async function deleteEntry({
  id,
  entries,
  persistEntries,
  name,
  accountCode,
  setUndoDelete,
  undoTimerRef,
}) {
  const target = entries.find((e) => e.id === id);
  const prevEntries = entries;
  await persistEntries(
    (curEntries) => curEntries.filter((e) => e.id !== id),
    () =>
      makeLogEntry(
        "word_delete",
        `${name} deleted "${(target && target.word) || id}"`,
        name,
        accountCode
      )
  );
  if (target) {
    clearTimeout(undoTimerRef.current);
    setUndoDelete({ entry: target, prevEntries });
    undoTimerRef.current = setTimeout(() => setUndoDelete(null), 6000);
  }
}

export async function undoDeleteEntry({
  undoDelete,
  setUndoDelete,
  undoTimerRef,
  name,
  accountCode,
  cfg,
  persistEntries,
}) {
  if (!undoDelete) return;
  clearTimeout(undoTimerRef.current);
  const restored = undoDelete;
  setUndoDelete(null);
  const logEntry = makeLogEntry(
    "word_add",
    `${name} restored "${restored.entry.word}" (${cfg.shortLabel})`,
    name,
    accountCode
  );
  await persistEntries(restored.prevEntries, logEntry);
}

export async function importEntriesFromCsv({
  file,
  section,
  sectionEntries,
  accountCode,
  name,
  cfg,
  isAr,
  persistEntries,
  showToast,
  setImporting,
}) {
  setImporting(true);
  try {
    const text = await file.text();
    const rows = parseCsv(text);
    let dataRows = rows;
    if (rows.length && rows[0][0] && rows[0][0].trim().toLowerCase() === "word") {
      dataRows = rows.slice(1);
    }

    const IMPORT_ROW_CAP = 2000;
    const truncated = dataRows.length > IMPORT_ROW_CAP;
    if (truncated) dataRows = dataRows.slice(0, IMPORT_ROW_CAP);

    const existingWords = new Set(
      sectionEntries.map((e) => e.word.trim().toLowerCase())
    );
    let skippedInvalid = 0;
    let skippedDuplicate = 0;
    const seenInFile = new Set();
    const newEntries = [];
    for (const r of dataRows) {
      const word = (r[0] || "").trim();
      const meaning = (r[1] || "").trim();
      if (!word || !meaning) {
        skippedInvalid++;
        continue;
      }
      const key = word.toLowerCase();
      if (existingWords.has(key) || seenInFile.has(key)) {
        skippedDuplicate++;
        continue;
      }
      seenInFile.add(key);
      newEntries.push({
        id: uid(),
        section,
        word,
        meaning,
        definition: (r[2] || "").trim(),
        example: "",
        synonyms: normalizePairs(
          (r[3] || "")
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean),
          cfg
        ),
        antonyms: normalizePairs(
          (r[4] || "")
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean),
          cfg
        ),
        addedBy: accountCode,
        addedAt: Date.now(),
      });
    }

    if (!newEntries.length) {
      showToast(
        skippedDuplicate && !skippedInvalid
          ? tr(
              isAr,
              "Every word in that file is already in your dictionary.",
              "كل الكلمات في الملف ده موجودة أصلاً في قاموسك."
            )
          : tr(isAr, "No valid rows found in that file.", "الملف ده مفيهوش صفوف صالحة.")
      );
      return;
    }

    await persistEntries(
      (curEntries) => [...curEntries, ...newEntries],
      () =>
        makeLogEntry(
          "word_add",
          `${name} imported ${newEntries.length} word(s) via CSV (${cfg.shortLabel})`,
          name,
          accountCode
        )
    );

    const notes = [];
    if (skippedInvalid) {
      notes.push(
        tr(
          isAr,
          `${skippedInvalid} row(s) skipped (missing word/meaning)`,
          `${skippedInvalid} صف اتجاهل (ناقص كلمة/معنى)`
        )
      );
    }
    if (skippedDuplicate) {
      notes.push(
        tr(
          isAr,
          `${skippedDuplicate} duplicate(s) skipped`,
          `${skippedDuplicate} كلمة مكررة اتجاهلت`
        )
      );
    }
    if (truncated) {
      notes.push(
        tr(
          isAr,
          `only the first ${IMPORT_ROW_CAP} rows were processed`,
          `اتعالج بس أول ${IMPORT_ROW_CAP} صف`
        )
      );
    }
    const suffix = notes.length ? ` (${notes.join(", ")})` : "";
    showToast(
      tr(
        isAr,
        `Imported ${newEntries.length} word(s).${suffix}`,
        `تم استيراد ${newEntries.length} كلمة.${suffix}`
      )
    );
  } catch (_) {
    showToast(
      tr(isAr, "Couldn't read that CSV file.", "تعذر قراءة ملف الـ CSV ده.")
    );
  } finally {
    setImporting(false);
  }
}


/** Import words from a shared word list (WordListsModal). */
export async function importWordsFromList({
  words,
  listSection,
  section,
  entries,
  accountCode,
  name,
  isAr,
  persistEntries,
  showToast,
}) {
  if (!words || !words.length) return;
  const sec = listSection || section;
  const existing = new Set(
    entries.filter((e) => e.section === sec).map((e) => (e.word || "").trim().toLowerCase())
  );
  const newEntries = [];
  for (const w of words) {
    const key = (w.word || "").trim().toLowerCase();
    if (!key || !w.meaning || existing.has(key)) continue;
    existing.add(key);
    newEntries.push({
      id: uid(),
      section: sec,
      word: w.word,
      meaning: w.meaning,
      definition: w.definition || "",
      example: w.example || "",
      pos: w.pos || "",
      synonyms: [],
      antonyms: [],
      addedBy: accountCode,
      addedAt: Date.now(),
    });
  }
  if (!newEntries.length) {
    showToast(tr(isAr, "No new words to import", "لا توجد كلمات جديدة للاستيراد"));
    return;
  }
  await persistEntries(
    (cur) => [...cur, ...newEntries],
    () =>
      makeLogEntry(
        "word_add",
        `${name} imported ${newEntries.length} word(s) from shared list`,
        name,
        accountCode
      )
  );
  showToast(tr(isAr, `Imported ${newEntries.length} word(s)`, `تم استيراد ${newEntries.length} كلمة`));
}

/** Add words extracted from free text (TextExtractModal). */
export async function importWordsFromText({
  words,
  section,
  entries,
  accountCode,
  name,
  appIsAr,
  persistEntries,
  showToast,
  onGrantedExtract,
}) {
  if (!words || !words.length) return;
  const existing = new Set(
    (entries || [])
      .filter((e) => e.section === section)
      .map((e) => (e.word || "").trim().toLowerCase())
  );
  const newEntries = [];
  for (const w of words) {
    const key = (w.word || "").trim().toLowerCase();
    if (!key || existing.has(key)) continue;
    existing.add(key);
    newEntries.push({
      id: uid(),
      section: w.section || section,
      word: w.word,
      meaning: w.meaning || "",
      definition: "",
      example: "",
      examples: [],
      pos: "",
      synonyms: [],
      antonyms: [],
      addedBy: accountCode,
      addedAt: Date.now(),
    });
  }
  if (!newEntries.length) {
    showToast?.(tr(appIsAr, "No new words to add", "مفيش كلمات جديدة للإضافة"));
    return;
  }
  await persistEntries(
    (cur) => [...cur, ...newEntries],
    () =>
      makeLogEntry(
        "word_add",
        `${name} extracted ${newEntries.length} word(s) from text`,
        name,
        accountCode
      )
  );
  if (typeof onGrantedExtract === "function") {
    try {
      onGrantedExtract(newEntries.length);
    } catch (_) {}
  }
}


/**
 * Import rich entries coming from the AI Agent (PDF extraction).
 * Preserves meaning, definition, example, synonyms, antonyms, etc.
 */
export async function importWordsFromAi({
  aiEntries,
  section,
  entries,
  accountCode,
  name,
  appIsAr,
  persistEntries,
  showToast,
}) {
  if (!aiEntries || !aiEntries.length) return;

  const existing = new Set(
    (entries || [])
      .filter((e) => e.section === section)
      .map((e) => (e.word || "").trim().toLowerCase())
  );

  const newEntries = [];
  for (const e of aiEntries) {
    const key = (e.word || "").trim().toLowerCase();
    if (!key || existing.has(key)) continue;
    existing.add(key);

    // normalize synonyms / antonyms to simple string arrays
    const normList = (arr) => {
      if (!Array.isArray(arr)) return [];
      return arr
        .map((item) => (typeof item === "string" ? item : item?.word || ""))
        .filter(Boolean);
    };

    newEntries.push({
      id: e.id || uid(),
      section: e.section || section,
      word: e.word,
      meaning: e.meaning || "",
      definition: e.definition || "",
      example: e.example || "",
      examples: Array.isArray(e.examples) ? e.examples : [],
      pos: e.pos || "",
      synonyms: normList(e.synonyms),
      antonyms: normList(e.antonyms),
      addedBy: accountCode || e.addedBy || "ai-agent",
      addedAt: e.addedAt || Date.now(),
      // extra metadata
      source_book: e.source_book || null,
      unit: e.unit || null,
      page: e.page || null,
      from_ai: true,
      importance: e.importance || "key",
    });
  }

  if (!newEntries.length) {
    showToast?.(tr(appIsAr, "No new words to add", "مفيش كلمات جديدة للإضافة"));
    return { added: 0 };
  }

  await persistEntries(
    (cur) => [...cur, ...newEntries],
    () =>
      makeLogEntry(
        "word_add",
        `${name} imported ${newEntries.length} word(s) from AI (PDF)`,
        name,
        accountCode
      )
  );

  return { added: newEntries.length };
}
