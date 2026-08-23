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
  unitId = null,
}) {
  const key = (newEntry.word || "").trim().toLowerCase();
  const isAcademic = section === "academic";
  const effectiveUnitId = isAcademic ? (newEntry.unitId || unitId || null) : null;

  const sameScope = (e) => {
    if (e.section !== section) return false;
    if (!isAcademic) return true;
    return (e.unitId || null) === (effectiveUnitId || null);
  };

  const existing = sectionEntries.find(
    (e) => sameScope(e) && (e.word || "").trim().toLowerCase() === key
  );
  if (existing) {
    return { duplicate: existing };
  }

  const newRow = {
    ...newEntry,
    id: uid(),
    section,
    addedBy: accountCode,
    addedAt: Date.now(),
    ...(isAcademic && effectiveUnitId ? { unitId: effectiveUnitId } : {}),
  };
  let skippedDup = false;
  await persistEntries(
    (curEntries) => {
      if (
        curEntries.some(
          (e) => sameScope(e) && (e.word || "").trim().toLowerCase() === key
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
            `${name} added "${newEntry.word}" (${cfg.shortLabel}${effectiveUnitId ? ` / ${effectiveUnitId}` : ""})`,
            name,
            accountCode
          )
  );
  if (skippedDup) {
    const again = entries.find(
      (e) => sameScope(e) && (e.word || "").trim().toLowerCase() === key
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
  const idStr = String(id);
  const target = (entries || []).find((e) => String(e.id) === idStr);
  const prevEntries = entries;
  // Persist immediately (optimistic UI + offline snapshot + cloud flush).
  await persistEntries(
    (curEntries) => (curEntries || []).filter((e) => String(e && e.id) !== idStr),
    () =>
      makeLogEntry(
        "word_delete",
        `${name} deleted "${(target && target.word) || id}"`,
        name,
        accountCode
      )
  );
  if (target && typeof setUndoDelete === "function") {
    clearTimeout(undoTimerRef?.current);
    setUndoDelete({ entry: target, prevEntries });
    if (undoTimerRef) {
      undoTimerRef.current = setTimeout(() => setUndoDelete(null), 6000);
    }
  }
}

/**
 * Delete ALL words in the current section (and unit, when academic).
 * Protected: callers MUST gate this behind isAdmin || isTeacher.
 * Permanent: persistEntries → cloud flush + offline snapshot. Not undoable.
 */
export async function deleteAllWordsInScope({
  section,
  unitId = null,
  entries,
  persistEntries,
  name,
  accountCode,
  setUndoDelete = null,
  undoTimerRef = null,
}) {
  const isAcademic = section === "academic";
  const inScope = (e) => {
    if (e.section !== section) return false;
    if (!isAcademic) return true;
    return (e.unitId || null) === (unitId || null);
  };
  const toRemove = (entries || []).filter(inScope);
  if (!toRemove.length) return { removed: 0 };

  // Bulk delete is not undoable — clear any single-word undo buffer.
  if (typeof setUndoDelete === "function") setUndoDelete(null);
  if (undoTimerRef && undoTimerRef.current) {
    try {
      clearTimeout(undoTimerRef.current);
    } catch (_) {}
  }

  // Capture ids so the op stays correct even if `entries` prop is stale later.
  const removeIds = new Set(toRemove.map((e) => String(e.id)));
  await persistEntries(
    (curEntries) => (curEntries || []).filter((e) => !removeIds.has(String(e && e.id))),
    () =>
      makeLogEntry(
        "word_delete_all",
        `${name} deleted ALL ${toRemove.length} word(s) in ${section}${
          isAcademic && unitId ? ` / ${unitId}` : ""
        }`,
        name,
        accountCode
      )
  );
  return { removed: toRemove.length };
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
  unitId = null,
}) {
  if (!aiEntries || !aiEntries.length) return;

  const isAcademic = section === "academic";
  const targetUnitId = isAcademic ? unitId || null : null;

  // One card per English word (same spelling). Multiple meanings/POS → senses on that card.
  // Academic: uniqueness is scoped per unit.
  const existingWords = new Set(
    (entries || [])
      .filter((e) => {
        if (e.section !== section) return false;
        if (!isAcademic) return true;
        return (e.unitId || null) === (targetUnitId || null);
      })
      .map((e) => (e.word || "").trim().toLowerCase())
  );

  const toPairList = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) => {
        if (typeof item === "string") {
          const w = item.trim();
          return w ? { word: w, meaning: "" } : null;
        }
        const w = (item?.word || item?.text || "").trim();
        return w ? { word: w, meaning: (item?.meaning || "").trim() } : null;
      })
      .filter(Boolean);
  };

  // Group AI rows by word
  const groups = new Map();
  for (const e of aiEntries) {
    const word = (e.word || "").trim();
    if (!word) continue;
    const key = word.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  const newEntries = [];
  for (const [, rows] of groups) {
    const word = (rows[0].word || "").trim();
    const key = word.toLowerCase();
    if (existingWords.has(key)) continue;
    existingWords.add(key);

    // Collect all senses from all rows for this word
    const senses = [];
    const seenSense = new Set();
    let synonyms = [];
    let antonyms = [];
    let definition = "";
    let example = "";
    let examples = [];
    let source_book = null;
    let unit = null;
    let page = null;
    let importance = "key";

    for (const e of rows) {
      const pos = (e.pos || "").trim();

      if (Array.isArray(e.senses) && e.senses.length) {
        for (const s of e.senses) {
          const m = String(s.meaning || "").trim();
          if (!m) continue;
          const p = (s.pos || pos || "").trim();
          const sk = `${p}|${m}`;
          if (seenSense.has(sk)) continue;
          seenSense.add(sk);
          senses.push({ id: uid(), pos: p, meaning: m });
        }
      } else {
        const rawMeaning = String(e.meaning || "").trim();
        if (rawMeaning) {
          // split "a / b" into separate senses
          const parts = rawMeaning
            .split(/\s*[\/|｜،]\s*/)
            .map((p) => p.trim())
            .filter(Boolean);
          for (const m of parts) {
            const sk = `${pos}|${m}`;
            if (seenSense.has(sk)) continue;
            seenSense.add(sk);
            senses.push({ id: uid(), pos, meaning: m });
          }
        }
      }

      synonyms = synonyms.concat(toPairList(e.synonyms));
      antonyms = antonyms.concat(toPairList(e.antonyms));
      if (!definition && e.definition) definition = e.definition;
      if (!example && e.example) example = e.example;
      if (Array.isArray(e.examples) && e.examples.length) {
        examples = examples.concat(e.examples);
      }
      if (!source_book && e.source_book) source_book = e.source_book;
      if (!unit && e.unit) unit = e.unit;
      if (!page && e.page) page = e.page;
      if (e.importance) importance = e.importance;
    }

    // dedupe pairs by word
    const dedupePairs = (list) => {
      const seen = new Set();
      const out = [];
      for (const p of list) {
        const k = (p.word || "").toLowerCase();
        if (!k || seen.has(k)) continue;
        seen.add(k);
        out.push(p);
      }
      return out;
    };

    if (!senses.length) continue;

    const primaryMeaning = senses[0].meaning;
    const primaryPos = senses[0].pos || "";

    newEntries.push({
      id: uid(),
      section: section,
      word,
      meaning: primaryMeaning,
      definition: definition || "",
      example: example || "",
      examples: examples.filter(Boolean),
      pos: primaryPos,
      ...(senses.length > 1 ? { senses } : {}),
      synonyms: dedupePairs(synonyms),
      antonyms: dedupePairs(antonyms),
      addedBy: accountCode || "ai-agent",
      addedAt: Date.now(),
      source_book: source_book || null,
      unit: unit || null,
      page: page || null,
      from_ai: true,
      importance,
      ...(isAcademic && targetUnitId ? { unitId: targetUnitId } : {}),
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
