import { useState, useMemo, useEffect } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, labelStyle, inputStyle, primaryBtnStyle } from "../../lib/config/theme";
import {
  loadWordLists,
  createWordList,
  updateWordList,
  deleteWordList,
  shareWordList,
  loadSharedList,
} from "../../lib/state/wordLists";
import { XIcon, CheckIcon, ShareIcon, DownloadIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

export default function WordListsModal({
  accountCode,
  entries = [],
  section,
  isAr,
  onClose,
  onImportWords,
  showToast,
}) {
  const [lists, setLists] = useState(() => loadWordLists(accountCode));
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [viewId, setViewId] = useState(null);
  const [shareCodeInput, setShareCodeInput] = useState("");
  const [importPreview, setImportPreview] = useState(null);

  useEffect(() => {
    setLists(loadWordLists(accountCode));
  }, [accountCode]);

  const sectionEntries = useMemo(
    () => (entries || []).filter((e) => e.section === section),
    [entries, section]
  );
  const viewList = lists.find((l) => l.id === viewId);

  function refresh() {
    setLists(loadWordLists(accountCode));
  }

  function handleCreate() {
    if (!name.trim()) return;
    const ids = selectedIds.size ? [...selectedIds] : [];
    createWordList(accountCode, { name: name.trim(), entryIds: ids, section });
    setName("");
    setSelectedIds(new Set());
    refresh();
    showToast?.(tr(isAr, "List created", "تم إنشاء القائمة"));
  }

  function toggleId(id) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function handleShare(listId) {
    const res = shareWordList(accountCode, listId, entries);
    if (!res) return;
    refresh();
    const text = res.code;
    try {
      navigator.clipboard?.writeText(text);
    } catch (_) {}
    showToast?.(tr(isAr, `Share code copied: ${text}`, `تم نسخ كود المشاركة: ${text}`));
  }

  function handleLoadShare() {
    const snap = loadSharedList(shareCodeInput.trim());
    if (!snap) {
      showToast?.(tr(isAr, "Code not found", "الكود غير موجود"));
      return;
    }
    setImportPreview(snap);
  }

  function handleImportShared() {
    if (!importPreview || !onImportWords) return;
    onImportWords(importPreview.words || [], importPreview.section);
    setImportPreview(null);
    setShareCodeInput("");
    showToast?.(tr(isAr, "Words imported", "تم استيراد الكلمات"));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3600,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <BodyScrollLock />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "92dvh",
          overflowY: "auto",
          background: CARD,
          borderRadius: "18px 18px 0 0",
          padding: "18px 16px 28px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: INK }}>
            {tr(isAr, "Word lists", "قوائم الكلمات")}
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)" }}>
            <XIcon size={20} />
          </button>
        </div>

        {/* Import by code */}
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: "var(--input-bg)", border: "1px solid rgba(var(--border-rgb),0.14)" }}>
          <div style={{ ...labelStyle, marginTop: 0 }}>{tr(isAr, "Import shared list", "استيراد قائمة مشاركة")}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <input
              value={shareCodeInput}
              onChange={(e) => setShareCodeInput(e.target.value.toUpperCase())}
              placeholder={tr(isAr, "Share code", "كود المشاركة")}
              style={{ ...inputStyle, flex: 1, margin: 0 }}
            />
            <button type="button" onClick={handleLoadShare} style={{ ...primaryBtnStyle, marginTop: 0, width: "auto", padding: "10px 14px" }}>
              {tr(isAr, "Load", "تحميل")}
            </button>
          </div>
          {importPreview && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{importPreview.name} · {importPreview.words?.length || 0} {tr(isAr, "words", "كلمة")}</div>
              <button type="button" onClick={handleImportShared} style={{ ...primaryBtnStyle, marginTop: 8 }}>
                {tr(isAr, "Import words into dictionary", "استيراد الكلمات للقاموس")}
              </button>
            </div>
          )}
        </div>

        {/* Create */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...labelStyle, marginTop: 0 }}>{tr(isAr, "New list", "قائمة جديدة")}</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tr(isAr, "List name", "اسم القائمة")}
            style={inputStyle}
          />
          <div style={{ fontSize: 12, color: "var(--muted-strong)", margin: "8px 0 6px" }}>
            {tr(isAr, "Optional: pick words below", "اختياري: اختر كلمات بالأسفل")} ({selectedIds.size})
          </div>
          <div style={{ maxHeight: 140, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            {sectionEntries.slice(0, 80).map((e) => {
              const on = selectedIds.has(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggleId(e.id)}
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 16,
                    border: `1px solid ${on ? "var(--accent-1)" : "rgba(var(--border-rgb),0.2)"}`,
                    background: on ? "var(--accent-1-soft)" : "transparent",
                    color: on ? "var(--accent-1)" : INK,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {e.word}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={handleCreate} disabled={!name.trim()} style={{ ...primaryBtnStyle, opacity: name.trim() ? 1 : 0.5 }}>
            {tr(isAr, "Create list", "إنشاء القائمة")}
          </button>
        </div>

        {/* Existing lists */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lists.length === 0 && (
            <div style={{ fontSize: 14, color: "var(--muted-strong)", textAlign: "center", padding: 16 }}>
              {tr(isAr, "No lists yet", "لا توجد قوائم بعد")}
            </div>
          )}
          {lists.map((l) => (
            <div key={l.id} style={{ border: "1px solid rgba(var(--border-rgb),0.14)", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <button type="button" onClick={() => setViewId(viewId === l.id ? null : l.id)} style={{ border: "none", background: "none", textAlign: "start", cursor: "pointer", flex: 1, padding: 0 }}>
                  <div style={{ fontWeight: 800, color: INK }}>{l.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-strong)" }}>
                    {(l.entryIds || []).length} {tr(isAr, "words", "كلمة")}
                    {l.shareCode ? ` · ${l.shareCode}` : ""}
                  </div>
                </button>
                <button type="button" onClick={() => handleShare(l.id)} title={tr(isAr, "Share", "مشاركة")} style={{ border: "none", background: "var(--input-bg)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: BRASS }}>
                  <ShareIcon size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteWordList(accountCode, l.id);
                    refresh();
                  }}
                  style={{ border: "none", background: "var(--input-bg)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "var(--danger, #c0392b)" }}
                >
                  <XIcon size={14} />
                </button>
              </div>
              {viewId === l.id && (
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {(l.entryIds || []).map((id) => {
                    const e = entries.find((x) => x.id === id);
                    return e ? (
                      <span key={id} style={{ fontSize: 12, padding: "3px 8px", borderRadius: 12, background: "var(--accent-1-soft)", color: "var(--accent-1)", fontWeight: 600 }}>
                        {e.word}
                      </span>
                    ) : null;
                  })}
                  {!(l.entryIds || []).length && (
                    <span style={{ fontSize: 12, color: "var(--muted-strong)" }}>{tr(isAr, "Empty list", "قائمة فارغة")}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
