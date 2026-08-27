import { useState, useEffect, useMemo, useRef } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, labelStyle, inputStyle, primaryBtnStyle } from "../../lib/config/theme";
import {
  loadLanguageNotes,
  createLanguageNote,
  updateLanguageNote,
  deleteLanguageNote,
  addGroup,
  updateGroup,
  updateEntry,
  removeGroup,
  saveLanguageNotesView,
} from "../../lib/state/languageNotes";
import { XIcon, PlusIcon, BookIcon, ChevronIcon, TrashIcon, CheckIcon } from "../common/Icons";
import HowItWorksButton from "../common/HowItWorksButton";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

/**
 * Language Notes — independent tool tab (like Timer).
 * List view shows note cards with word (type) : meaning.
 * Expanded view shows examples + additional notes per word group.
 */
export default function LanguageNotesPage({
  accountCode,
  isAr,
  onClose,
  onMinimize,
}) {
  const [notes, setNotes] = useState(() => loadLanguageNotes(accountCode));
  const [activeId, setActiveId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [draftWords, setDraftWords] = useState("");
  const [editEntry, setEditEntry] = useState(null); // { groupId, word }

  useEffect(() => {
    setNotes(loadLanguageNotes(accountCode));
  }, [accountCode]);

  useEffect(() => {
    saveLanguageNotesView(true, false);
    return () => saveLanguageNotesView(false, false);
  }, []);

  const active = useMemo(
    () => notes.find((n) => n.id === activeId) || null,
    [notes, activeId]
  );

  function refresh() {
    setNotes(loadLanguageNotes(accountCode));
  }

  function handleCreate() {
    if (!newName.trim()) return;
    const note = createLanguageNote(accountCode, {
      name: newName.trim(),
      description: newDesc.trim(),
    });
    setNewName("");
    setNewDesc("");
    setCreating(false);
    refresh();
    setActiveId(note.id);
  }

  function handleAddGroup() {
    if (!active) return;
    const words = draftWords
      .split(/[-–,،|/]+/)
      .map((w) => w.trim())
      .filter(Boolean);
    if (!words.length) return;
    addGroup(accountCode, active.id, words);
    setDraftWords("");
    refresh();
  }

  function handleSaveEntry(groupId, word, fields) {
    updateEntry(accountCode, active.id, groupId, word, fields);
    setEditEntry(null);
    refresh();
  }

  const panelRef = useRef(null);
  const dragRef = useRef({ active: false, ox: 0, oy: 0, x: 0, y: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 420, h: 560 });
  const resizeRef = useRef({ active: false, startX: 0, startY: 0, startW: 0, startH: 0 });

  function onDragStart(e) {
    if (e.button != null && e.button !== 0) return;
    // only from header drag handle
    dragRef.current = {
      active: true,
      ox: e.clientX - pos.x,
      oy: e.clientY - pos.y,
      x: pos.x,
      y: pos.y,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onDragMove(e) {
    if (!dragRef.current.active) return;
    setPos({
      x: e.clientX - dragRef.current.ox,
      y: e.clientY - dragRef.current.oy,
    });
  }
  function onDragEnd() {
    dragRef.current.active = false;
  }

  function onResizeStart(e) {
    e.stopPropagation();
    e.preventDefault();
    resizeRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startW: size.w,
      startH: size.h,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onResizeMove(e) {
    if (!resizeRef.current.active) return;
    const dw = e.clientX - resizeRef.current.startX;
    const dh = e.clientY - resizeRef.current.startY;
    setSize({
      w: Math.max(300, Math.min(720, resizeRef.current.startW + dw)),
      h: Math.max(320, Math.min(window.innerHeight - 24, resizeRef.current.startH + dh)),
    });
  }
  function onResizeEnd() {
    resizeRef.current.active = false;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 6100,
        pointerEvents: "none",
      }}
      aria-hidden={false}
    >
      <div
        ref={panelRef}
        className="modal-card"
        dir={isAr ? "rtl" : "ltr"}
        role="dialog"
        aria-modal="false"
        aria-labelledby="lang-notes-title"
        style={{
          pointerEvents: "auto",
          position: "fixed",
          left: `calc(50% + ${pos.x}px)`,
          top: `calc(8% + ${pos.y}px)`,
          transform: "translateX(-50%)",
          width: `min(92vw, ${size.w}px)`,
          height: `min(88dvh, ${size.h}px)`,
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          background: CARD,
          overflow: "hidden",
          boxShadow: "0 24px 64px -12px rgba(0,0,0,0.45)",
          border: "1.5px solid color-mix(in srgb, var(--accent-1) 35%, rgba(var(--border-rgb),0.25))",
          position: "fixed",
        }}
      >
        {/* Header */}
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            borderBottom: "1px solid rgba(var(--border-rgb),0.14)",
            flexShrink: 0,
            cursor: "grab",
            touchAction: "none",
            userSelect: "none",
          }}
        >
          {active && (
            <button
              type="button"
              onClick={() => setActiveId(null)}
              aria-label={tr(isAr, "Back", "رجوع")}
              style={{
                border: "none",
                background: "var(--input-bg)",
                borderRadius: 10,
                width: 36,
                height: 36,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronIcon size={18} style={{ transform: isAr ? "none" : "rotate(180deg)" }} />
            </button>
          )}
          <h2
            id="lang-notes-title"
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 18,
              fontWeight: 600,
              color: INK,
              margin: 0,
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <BookIcon size={18} color={BRASS} />
            {active
              ? active.name
              : tr(isAr, "Language Notes", "ملاحظات اللغة")}
          </h2>
          <HowItWorksButton isAr={isAr} guideId="languageNotes" />
          {typeof onMinimize === "function" && (
            <button
              type="button"
              onClick={onMinimize}
              aria-label={tr(isAr, "Minimize", "تصغير")}
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "var(--icon-muted)",
                fontSize: 18,
                width: 36,
                height: 36,
              }}
            >
              —
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              color: "var(--icon-muted)",
              width: 36,
              height: 36,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 16px 28px", WebkitOverflowScrolling: "touch" }}>
          {!active && (
            <>
              {/* Create */}
              {!creating ? (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  style={{ ...primaryBtnStyle, width: "100%", marginBottom: 16 }}
                >
                  <PlusIcon size={16} /> {tr(isAr, "New note", "ملاحظة جديدة")}
                </button>
              ) : (
                <div
                  style={{
                    marginBottom: 16,
                    padding: 14,
                    borderRadius: 14,
                    border: "1.5px solid rgba(var(--border-rgb),0.18)",
                    background: "var(--input-bg)",
                  }}
                >
                  <label style={labelStyle}>{tr(isAr, "Name", "الاسم")}</label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={tr(isAr, "e.g. Confusing verbs", "مثل: أفعال متشابهة")}
                    style={{ ...inputStyle, width: "100%", marginBottom: 10 }}
                  />
                  <label style={labelStyle}>{tr(isAr, "Description", "الوصف")}</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={2}
                    placeholder={tr(isAr, "Optional short description…", "وصف قصير اختياري…")}
                    style={{ ...inputStyle, width: "100%", resize: "vertical" }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button type="button" onClick={handleCreate} disabled={!newName.trim()} style={{ ...primaryBtnStyle, flex: 1, opacity: newName.trim() ? 1 : 0.5 }}>
                      {tr(isAr, "Create", "إنشاء")}
                    </button>
                    <button type="button" onClick={() => setCreating(false)} style={{ ...primaryBtnStyle, flex: 1, background: "var(--input-bg)", color: INK }}>
                      {tr(isAr, "Cancel", "إلغاء")}
                    </button>
                  </div>
                </div>
              )}

              {notes.length === 0 && (
                <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 14, marginTop: 40 }}>
                  {tr(isAr, "No language notes yet. Create one to group related words.", "مفيش ملاحظات لسه. اعمل واحدة لتجميع كلمات متشابهة.")}
                </p>
              )}

              {notes.map((n) => {
                const preview = [];
                for (const g of n.groups || []) {
                  for (const e of g.entries || []) {
                    if (e.word) preview.push(`${e.word}${e.type ? ` (${e.type})` : ""}${e.meaning ? ` : ${e.meaning}` : ""}`);
                  }
                }
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setActiveId(n.id)}
                    className="list-item-creative"
                    style={{
                      width: "100%",
                      textAlign: "start",
                      marginBottom: 10,
                      cursor: "pointer",
                      border: "1px solid rgba(var(--border-rgb),0.16)",
                      borderRadius: 12,
                      padding: 0,
                      background: "color-mix(in srgb, var(--card) 92%, transparent)",
                      display: "flex",
                      overflow: "hidden",
                    }}
                  >
                    <span className="accent-rail" style={{ width: 5, background: "linear-gradient(180deg, var(--accent-1), var(--brass))" }} />
                    <span style={{ flex: 1, padding: "12px 14px" }}>
                      <span style={{ display: "block", fontWeight: 700, fontSize: 15, color: INK, marginBottom: 4 }}>{n.name}</span>
                      {n.description && (
                        <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{n.description}</span>
                      )}
                      {preview.length > 0 ? (
                        <span style={{ display: "block", fontSize: 13, color: "var(--muted-strong)", lineHeight: 1.45 }}>
                          {preview.slice(0, 4).join(" · ")}
                          {preview.length > 4 ? "…" : ""}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>{tr(isAr, "Empty — tap to add word groups", "فاضية — اضغط لإضافة مجموعات")}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {active && (
            <>
              {active.description && (
                <p style={{ fontSize: 13, color: "var(--muted-strong)", margin: "0 0 14px" }}>{active.description}</p>
              )}

              {/* Add related words row */}
              <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: "var(--input-bg)", border: "1px solid rgba(var(--border-rgb),0.14)" }}>
                <label style={{ ...labelStyle, marginTop: 0 }}>
                  {tr(isAr, "Related words (word1 - word2 - word3)", "كلمات متشابهة (كلمة١ - كلمة٢ - كلمة٣)")}
                </label>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <input
                    value={draftWords}
                    onChange={(e) => setDraftWords(e.target.value)}
                    placeholder="affect - effect - impact"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button type="button" onClick={handleAddGroup} disabled={!draftWords.trim()} style={{ ...primaryBtnStyle, width: "auto", padding: "10px 14px", opacity: draftWords.trim() ? 1 : 0.5 }}>
                    <PlusIcon size={15} />
                  </button>
                </div>
              </div>

              {(active.groups || []).map((g) => {
                const isOpen = expandedGroup === g.id;
                return (
                  <div
                    key={g.id}
                    style={{
                      marginBottom: 14,
                      borderRadius: 14,
                      border: "1.5px solid rgba(var(--border-rgb),0.16)",
                      overflow: "hidden",
                      background: "color-mix(in srgb, var(--card) 96%, transparent)",
                    }}
                  >
                    {/* Horizontal related words row */}
                    <button
                      type="button"
                      onClick={() => setExpandedGroup(isOpen ? null : g.id)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "12px 14px",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        textAlign: "start",
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontWeight: 700,
                          fontSize: 14.5,
                          color: INK,
                          letterSpacing: "0.01em",
                          overflowX: "auto",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {(g.relatedWords || []).join(" — ")}
                      </span>
                      <ChevronIcon
                        size={16}
                        style={{
                          transform: isOpen ? "rotate(90deg)" : isAr ? "rotate(180deg)" : "none",
                          transition: "transform 0.2s",
                          flexShrink: 0,
                          color: "var(--muted)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(tr(isAr, "Delete this group?", "حذف المجموعة؟"))) {
                            removeGroup(accountCode, active.id, g.id);
                            refresh();
                          }
                        }}
                        style={{ border: "none", background: "none", cursor: "pointer", color: "var(--danger)", padding: 4 }}
                        aria-label={tr(isAr, "Delete group", "حذف المجموعة")}
                      >
                        <TrashIcon size={15} />
                      </button>
                    </button>

                    {/* Collapsed: word (type) : meaning */}
                    {!isOpen && (
                      <div style={{ padding: "0 14px 12px" }}>
                        {(g.entries || []).map((e) => (
                          <div key={e.word} style={{ fontSize: 13, color: "var(--muted-strong)", marginBottom: 4, lineHeight: 1.4 }}>
                            <strong style={{ color: INK }}>{e.word}</strong>
                            {e.type ? ` (${e.type})` : ""}
                            {e.meaning ? ` : ${e.meaning}` : ""}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Expanded: full fields */}
                    {isOpen && (
                      <div style={{ padding: "0 14px 14px", borderTop: "1px solid rgba(var(--border-rgb),0.1)" }}>
                        {(g.entries || []).map((e) => {
                          const editing = editEntry && editEntry.groupId === g.id && editEntry.word === e.word;
                          return (
                            <div
                              key={e.word}
                              style={{
                                marginTop: 12,
                                padding: 12,
                                borderRadius: 12,
                                background: "var(--input-bg)",
                                border: "1px solid rgba(var(--border-rgb),0.12)",
                              }}
                            >
                              <div style={{ fontWeight: 800, fontSize: 15, color: INK, marginBottom: 8 }}>{e.word}</div>
                              {editing ? (
                                <EntryEditor
                                  entry={e}
                                  isAr={isAr}
                                  onSave={(fields) => handleSaveEntry(g.id, e.word, fields)}
                                  onCancel={() => setEditEntry(null)}
                                />
                              ) : (
                                <>
                                  <Line label="type" value={e.type} isAr={isAr} />
                                  <Line label="meaning" value={e.meaning} isAr={isAr} />
                                  <Line label="ex" value={e.example} isAr={isAr} />
                                  <Line label="note" value={e.note} isAr={isAr} />
                                  <Line label="additional note" value={e.additionalNote} isAr={isAr} />
                                  <button
                                    type="button"
                                    onClick={() => setEditEntry({ groupId: g.id, word: e.word })}
                                    style={{
                                      marginTop: 8,
                                      border: "1px solid rgba(var(--border-rgb),0.2)",
                                      background: "var(--card)",
                                      borderRadius: 8,
                                      padding: "6px 12px",
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      color: BRASS,
                                    }}
                                  >
                                    {tr(isAr, "Edit", "تعديل")}
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  if (window.confirm(tr(isAr, "Delete this entire note?", "حذف الملاحظة كلها؟"))) {
                    deleteLanguageNote(accountCode, active.id);
                    setActiveId(null);
                    refresh();
                  }
                }}
                style={{
                  marginTop: 20,
                  width: "100%",
                  border: "1px solid var(--danger-border)",
                  background: "var(--danger-bg)",
                  color: "var(--danger)",
                  borderRadius: 12,
                  padding: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {tr(isAr, "Delete note", "حذف الملاحظة")}
              </button>
            </>
          )}
        </div>
        {/* Resize handle — bottom-end corner */}
        <div
          className="lang-notes-resize"
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
          style={{
            position: "absolute",
            insetInlineEnd: 4,
            bottom: 4,
            width: 18,
            height: 18,
            cursor: "nwse-resize",
            touchAction: "none",
            opacity: 0.45,
            background: "linear-gradient(135deg, transparent 50%, var(--muted) 50%)",
            borderRadius: 2,
          }}
          aria-hidden
        />
      </div>
    </div>
  );
}

function Line({ label, value, isAr }) {
  if (!value) return null;
  return (
    <div style={{ fontSize: 13, marginBottom: 4, lineHeight: 1.45 }}>
      <span style={{ fontWeight: 700, color: "var(--muted-strong)" }}>{label}:</span>{" "}
      <span style={{ color: INK }}>{value}</span>
    </div>
  );
}

function EntryEditor({ entry, isAr, onSave, onCancel }) {
  const [type, setType] = useState(entry.type || "");
  const [meaning, setMeaning] = useState(entry.meaning || "");
  const [example, setExample] = useState(entry.example || "");
  const [note, setNote] = useState(entry.note || "");
  const [additionalNote, setAdditionalNote] = useState(entry.additionalNote || "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Field label={tr(isAr, "Type (n / v / adj…)", "النوع (n / v / adj…)")} value={type} onChange={setType} />
      <Field label={tr(isAr, "Meaning", "المعنى")} value={meaning} onChange={setMeaning} />
      <Field label="ex:" value={example} onChange={setExample} multiline />
      <Field label="note:" value={note} onChange={setNote} multiline />
      <Field label="additional note:" value={additionalNote} onChange={setAdditionalNote} multiline />
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button type="button" onClick={() => onSave({ type, meaning, example, note, additionalNote })} style={{ ...primaryBtnStyle, flex: 1 }}>
          <CheckIcon size={14} /> {tr(isAr, "Save", "حفظ")}
        </button>
        <button type="button" onClick={onCancel} style={{ ...primaryBtnStyle, flex: 1, background: "var(--card)", color: INK }}>
          {tr(isAr, "Cancel", "إلغاء")}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, multiline }) {
  const Tag = multiline ? "textarea" : "input";
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-strong)", display: "block", marginBottom: 3 }}>{label}</span>
      <Tag
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={multiline ? 2 : undefined}
        style={{
          ...inputStyle,
          width: "100%",
          resize: multiline ? "vertical" : undefined,
        }}
      />
    </label>
  );
}
