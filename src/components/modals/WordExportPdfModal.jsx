import { useState, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, labelStyle, inputStyle, primaryBtnStyle } from "../../lib/config/theme";
import { XIcon, DownloadIcon, SearchIcon, CheckIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { exportWordListPdf } from "../../lib/utils/wordListPdf";
import { groupEntriesByLetter } from "../../lib/utils/entryListUtils";

/**
 * Dedicated "Export words as PDF" modal.
 * Words are added via the "Add to PDF" action on each word card (see EntryCard).
 * This modal shows the current selection, lets you drop any word, name the
 * sheet, and export.
 */
export default function WordExportPdfModal({
  entries = [],
  section,
  isAr,
  markedIds,
  onToggleMark,
  onClearMarked,
  onClose,
  showToast,
  academicUnits = [],
}) {
  const [title, setTitle] = useState("");
  const [browseQuery, setBrowseQuery] = useState("");

  const marked = useMemo(
    () => entries.filter((e) => markedIds && markedIds.has(e.id)),
    [entries, markedIds]
  );

  // All words in the current dictionary section, available to add without
  // hunting them down one by one on their card in the main list.
  const sectionEntries = useMemo(
    () => entries.filter((e) => e.section === section),
    [entries, section]
  );

  const browseFiltered = useMemo(() => {
    const q = browseQuery.trim().toLowerCase();
    if (!q) return sectionEntries;
    return sectionEntries.filter(
      (e) =>
        String(e.word || "").toLowerCase().includes(q) ||
        String(e.meaning || "").toLowerCase().includes(q)
    );
  }, [sectionEntries, browseQuery]);

  // Grouped by first letter (or, for the Academic dictionary, by unit) so a
  // whole group — an entire unit, or everything matching a search — can be
  // added in one tap instead of opening every word card.
  const isAcademic = section === "academic";
  const browseGroups = useMemo(() => {
    if (isAcademic) {
      const byUnit = new Map();
      for (const e of browseFiltered) {
        const uid = e.unitId || "__none";
        if (!byUnit.has(uid)) byUnit.set(uid, []);
        byUnit.get(uid).push(e);
      }
      return [...byUnit.entries()].map(([uid, list]) => {
        const unit = academicUnits.find((u) => u.id === uid);
        const label = unit ? unit.name : tr(isAr, "No unit", "بدون وحدة");
        return [label, list];
      });
    }
    const map = groupEntriesByLetter(browseFiltered, section);
    return Object.keys(map)
      .sort()
      .map((letter) => [letter, map[letter]]);
  }, [browseFiltered, section, isAcademic, academicUnits, isAr]);

  function addGroup(list) {
    for (const e of list) {
      if (!markedIds || !markedIds.has(e.id)) onToggleMark(e.id);
    }
  }

  function removeGroup(list) {
    for (const e of list) {
      if (markedIds && markedIds.has(e.id)) onToggleMark(e.id);
    }
  }

  function addAllFiltered() {
    addGroup(browseFiltered);
  }

  function handleExport() {
    if (!marked.length) return;
    exportWordListPdf(marked, {
      title: title.trim() || tr(isAr, "Word List", "قائمة كلمات"),
      section,
    });
    showToast?.(tr(isAr, "PDF ready", "الملف جاهز"));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5000,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))",
        boxSizing: "border-box",
      }}
    >
      <BodyScrollLock />
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-card"
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "min(90dvh, calc(100dvh - 24px))",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: CARD,
          borderRadius: 18,
          padding: "18px 16px max(28px, env(safe-area-inset-bottom, 0px))",
          boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: INK }}>
            {tr(isAr, "Export words as PDF", "تصدير الكلمات PDF")}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", width: 36, height: 36, padding: 0, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <XIcon size={20} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ fontSize: 13, color: "var(--muted-strong)", marginBottom: 14, lineHeight: 1.5 }}>
            {tr(
              isAr,
              "Open the ⋯ menu on any word card and tap \"Add to PDF\" to build this list.",
              "افتح قائمة ⋯ في أي كارت كلمة ودوس \"إضافة لـ PDF\" عشان تبني القائمة دي."
            )}
          </div>

          <div style={{ ...labelStyle, marginTop: 0 }}>{tr(isAr, "Sheet title (optional)", "عنوان الملف (اختياري)")}</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tr(isAr, "e.g. Unit 3 vocabulary", "مثال: مفردات الوحدة 3")}
            style={inputStyle}
          />

          <div style={{ fontSize: 12, color: "var(--muted-strong)", margin: "12px 0 6px" }}>
            {tr(isAr, "Selected words", "الكلمات المختارة")} ({marked.length})
          </div>

          {marked.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted-strong)", textAlign: "center", padding: "20px 0" }}>
              {tr(isAr, "No words added yet", "لسه مفيش كلمات مضافة")}
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {marked.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onToggleMark(e.id)}
                  title={tr(isAr, "Remove", "إزالة")}
                  style={{
                    fontSize: 12,
                    padding: "5px 10px",
                    borderRadius: 16,
                    border: "1px solid var(--accent-1)",
                    background: "var(--accent-1-soft)",
                    color: "var(--accent-1)",
                    cursor: "pointer",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {e.word}
                  <XIcon size={11} />
                </button>
              ))}
            </div>
          )}

          {marked.length > 0 && (
            <button
              type="button"
              onClick={() => onClearMarked?.()}
              style={{ border: "none", background: "none", color: "var(--muted-strong)", fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 16, textDecoration: "underline" }}
            >
              {tr(isAr, "Clear all", "مسح الكل")}
            </button>
          )}

          {/* Search + select-all system: pick words without going back to
              the main list and tapping each card individually. */}
          <div style={{ fontSize: 12, color: "var(--muted-strong)", margin: "4px 0 6px" }}>
            {tr(isAr, "Add more words", "إضافة كلمات تانية")}
          </div>

          {sectionEntries.length > 0 && (
            <button
              type="button"
              onClick={() => addGroup(sectionEntries)}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "7px 12px",
                borderRadius: 9,
                border: "1px solid var(--accent-1)",
                background: "var(--accent-1-soft)",
                color: "var(--accent-1)",
                cursor: "pointer",
                marginBottom: 10,
                width: "100%",
              }}
            >
              {tr(
                isAr,
                `Add the whole section (${sectionEntries.length} words)`,
                `إضافة كل كلمات القسم (${sectionEntries.length} كلمة)`
              )}
            </button>
          )}

          <div style={{ position: "relative", marginBottom: 8 }}>
            <SearchIcon
              size={15}
              style={{
                position: "absolute",
                insetInlineStart: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--muted)",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              value={browseQuery}
              onChange={(e) => setBrowseQuery(e.target.value)}
              placeholder={tr(isAr, "Search a word…", "دور على كلمة…")}
              style={{ ...inputStyle, margin: 0, width: "100%", boxSizing: "border-box", paddingInlineStart: 36 }}
            />
          </div>

          {browseQuery.trim() && browseFiltered.length > 0 && (
            <button
              type="button"
              onClick={addAllFiltered}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid rgba(var(--border-rgb),0.2)",
                background: "var(--input-bg)",
                color: "var(--accent-1, var(--muted-strong))",
                cursor: "pointer",
                marginBottom: 8,
              }}
            >
              {tr(isAr, `Add all ${browseFiltered.length} matches`, `إضافة كل النتائج (${browseFiltered.length})`)}
            </button>
          )}

          <div
            style={{
              maxHeight: 240,
              overflowY: "auto",
              border: "1px solid rgba(var(--border-rgb),0.12)",
              borderRadius: 12,
              padding: 8,
              marginBottom: 16,
            }}
          >
            {browseGroups.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--muted-strong)", textAlign: "center", padding: "14px 0" }}>
                {tr(isAr, "No words found", "مفيش كلمات مطابقة")}
              </div>
            )}
            {browseGroups.map(([letter, list]) => {
              const allIn = list.every((e) => markedIds && markedIds.has(e.id));
              return (
                <div key={letter} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "var(--muted-strong)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {letter} · {list.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => (allIn ? removeGroup(list) : addGroup(list))}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 7,
                        border: "none",
                        background: "transparent",
                        color: "var(--accent-1, var(--muted-strong))",
                        cursor: "pointer",
                      }}
                    >
                      {allIn ? tr(isAr, "Remove all", "إزالة الكل") : tr(isAr, "Add all", "إضافة الكل")}
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {list.map((e) => {
                      const on = markedIds && markedIds.has(e.id);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => onToggleMark(e.id)}
                          style={{
                            fontSize: 12,
                            padding: "5px 10px",
                            borderRadius: 16,
                            border: on ? "1px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.2)",
                            background: on ? "var(--accent-1-soft)" : "var(--input-bg)",
                            color: on ? "var(--accent-1)" : "var(--muted-strong)",
                            cursor: "pointer",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          {on && <CheckIcon size={11} />}
                          {e.word}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={!marked.length}
            style={{
              ...primaryBtnStyle,
              opacity: marked.length ? 1 : 0.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <DownloadIcon size={16} />
            {tr(isAr, "Export PDF", "تصدير PDF")}
          </button>
        </div>
      </div>
    </div>
  );
}
