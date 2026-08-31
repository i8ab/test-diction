import { useState, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, labelStyle, inputStyle, primaryBtnStyle } from "../../lib/config/theme";
import { XIcon, DownloadIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { exportWordListPdf } from "../../lib/utils/wordListPdf";

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
}) {
  const [title, setTitle] = useState("");

  const marked = useMemo(
    () => entries.filter((e) => markedIds && markedIds.has(e.id)),
    [entries, markedIds]
  );

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
