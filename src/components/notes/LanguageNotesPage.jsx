import { useState, useEffect, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, BRASS, labelStyle, inputStyle, primaryBtnStyle } from "../../lib/config/theme";
import {
  loadLanguageNotes,
  createLanguageNote,
  updateLanguageNote,
  deleteLanguageNote,
  addGroup,
  updateEntry,
  removeGroup,
  saveLanguageNotesView,
} from "../../lib/state/languageNotes";
import { exportLanguageNotesPdf } from "../../lib/utils/languageNotesPdf";
import { XIcon, PlusIcon, BookIcon, ChevronIcon, TrashIcon, CheckIcon } from "../common/Icons";
import HowItWorksButton from "../common/HowItWorksButton";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { Z_INDEX } from "../../lib/config/zIndex";

/**
 * Language Notes — full-screen tool with External / Curriculum sections,
 * role field on each note, and PDF export matching the handout style.
 */
export default function LanguageNotesPage({
  accountCode,
  isAr,
  onClose,
  onMinimize,
}) {
  const [notes, setNotes] = useState(() => loadLanguageNotes(accountCode));
  const [sectionTab, setSectionTab] = useState("external"); // external | curriculum
  const [activeId, setActiveId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [draftWords, setDraftWords] = useState("");
  const [editEntry, setEditEntry] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  useEffect(() => {
    setNotes(loadLanguageNotes(accountCode));
  }, [accountCode]);

  useEffect(() => {
    saveLanguageNotesView(true, false);
    return () => saveLanguageNotesView(false, false);
  }, []);

  const filteredNotes = useMemo(
    () => notes.filter((n) => (n.section || "external") === sectionTab),
    [notes, sectionTab]
  );

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
      section: sectionTab,
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

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportSelected() {
    const list = notes.filter((n) => selectedIds.has(n.id));
    if (!list.length) return;
    exportLanguageNotesPdf(list, { isAr });
  }

  function exportOne(note) {
    if (!note) return;
    exportLanguageNotesPdf([note], { isAr });
  }

  const sectionBtn = (id) => {
    const activeSec = sectionTab === id;
    const label =
      id === "external"
        ? tr(isAr, "External", "خارجي")
        : tr(isAr, "Curriculum", "المنهج");
    return (
      <button
        key={id}
        type="button"
        onClick={() => {
          setSectionTab(id);
          setActiveId(null);
          setCreating(false);
          setSelectMode(false);
          setSelectedIds(new Set());
        }}
        style={{
          flex: 1,
          padding: "9px 12px",
          borderRadius: 12,
          border: activeSec
            ? "1.5px solid var(--accent-1)"
            : "1px solid rgba(var(--border-rgb),0.18)",
          background: activeSec
            ? "color-mix(in srgb, var(--accent-1) 16%, transparent)"
            : "var(--card)",
          color: activeSec ? "var(--accent-1)" : "var(--muted-strong)",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className="tool-full-page"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z_INDEX?.TOOL_FULL || 6000,
        background: "var(--paper, #0c0c0e)",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
      }}
    >
      <BodyScrollLock />
      <div
        dir={isAr ? "rtl" : "ltr"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lang-notes-title"
        style={{
          width: "100%",
          maxWidth: "100%",
          height: "100%",
          maxHeight: "100dvh",
          borderRadius: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--paper, #0c0c0e)",
          overflow: "hidden",
          margin: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px clamp(14px, 3vw, 28px)",
            borderBottom: "1px solid rgba(var(--border-rgb),0.14)",
            flexShrink: 0,
            background: "var(--card)",
            width: "100%",
            boxSizing: "border-box",
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
            {active ? active.name : tr(isAr, "Language Notes", "ملاحظات اللغة")}
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

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "16px clamp(14px, 3vw, 28px) calc(28px + var(--kb-inset, 0px))",
            WebkitOverflowScrolling: "touch",
            maxWidth: 720,
            width: "100%",
            margin: "0 auto",
            boxSizing: "border-box",
          }}
        >
          {/* List view */}
          {!active && (
            <>
              {/* Section tabs */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {sectionBtn("external")}
                {sectionBtn("curriculum")}
              </div>

              {/* Select + PDF toolbar */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 14,
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectMode((v) => !v);
                    setSelectedIds(new Set());
                  }}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(var(--border-rgb),0.2)",
                    background: selectMode
                      ? "color-mix(in srgb, var(--accent-1) 14%, transparent)"
                      : "var(--card)",
                    color: selectMode ? "var(--accent-1)" : INK,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {selectMode
                    ? tr(isAr, "Cancel select", "إلغاء التحديد")
                    : tr(isAr, "Select notes", "تحديد ملاحظات")}
                </button>
                {selectMode && (
                  <button
                    type="button"
                    disabled={selectedIds.size === 0}
                    onClick={exportSelected}
                    style={{
                      ...primaryBtnStyle,
                      marginTop: 0,
                      width: "auto",
                      padding: "8px 14px",
                      fontSize: 12,
                      opacity: selectedIds.size ? 1 : 0.45,
                    }}
                  >
                    {tr(
                      isAr,
                      `PDF (${selectedIds.size})`,
                      `PDF (${selectedIds.size})`
                    )}
                  </button>
                )}
              </div>

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
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      marginTop: 8,
                      marginBottom: 4,
                    }}
                  >
                    {tr(isAr, "Section", "القسم")}:{" "}
                    <strong style={{ color: "var(--accent-1)" }}>
                      {sectionTab === "curriculum"
                        ? tr(isAr, "Curriculum", "المنهج")
                        : tr(isAr, "External", "خارجي")}
                    </strong>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={!newName.trim()}
                      style={{
                        ...primaryBtnStyle,
                        flex: 1,
                        opacity: newName.trim() ? 1 : 0.5,
                      }}
                    >
                      {tr(isAr, "Create", "إنشاء")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreating(false)}
                      style={{
                        ...primaryBtnStyle,
                        flex: 1,
                        background: "var(--input-bg)",
                        color: INK,
                      }}
                    >
                      {tr(isAr, "Cancel", "إلغاء")}
                    </button>
                  </div>
                </div>
              )}

              {filteredNotes.length === 0 && !creating && (
                <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 14, marginTop: 24 }}>
                  {tr(
                    isAr,
                    "No notes in this section yet.",
                    "مفيش ملاحظات في القسم ده لسه."
                  )}
                </p>
              )}

              {filteredNotes.map((n) => {
                const preview = [];
                for (const g of n.groups || []) {
                  for (const e of g.entries || []) {
                    if (e.word) {
                      preview.push(
                        `${e.word}${e.type ? ` (${e.type})` : ""}${e.meaning ? ` : ${e.meaning}` : ""}`
                      );
                    }
                  }
                }
                const selected = selectedIds.has(n.id);
                return (
                  <div
                    key={n.id}
                    style={{
                      width: "100%",
                      marginBottom: 10,
                      border: selected
                        ? "1.5px solid var(--accent-1)"
                        : "1px solid rgba(var(--border-rgb),0.16)",
                      borderRadius: 12,
                      background: "color-mix(in srgb, var(--card) 92%, transparent)",
                      display: "flex",
                      overflow: "hidden",
                      alignItems: "stretch",
                    }}
                  >
                    {selectMode && (
                      <button
                        type="button"
                        onClick={() => toggleSelect(n.id)}
                        aria-label="select"
                        style={{
                          width: 40,
                          flexShrink: 0,
                          border: "none",
                          background: selected
                            ? "color-mix(in srgb, var(--accent-1) 22%, transparent)"
                            : "var(--input-bg)",
                          cursor: "pointer",
                          color: selected ? "var(--accent-1)" : "var(--muted)",
                          fontWeight: 800,
                          fontSize: 16,
                        }}
                      >
                        {selected ? "✓" : ""}
                      </button>
                    )}
                    <span
                      style={{
                        width: 5,
                        flexShrink: 0,
                        background:
                          "linear-gradient(180deg, var(--accent-1), var(--brass, var(--accent-2)))",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (selectMode) toggleSelect(n.id);
                        else setActiveId(n.id);
                      }}
                      style={{
                        flex: 1,
                        textAlign: "start",
                        border: "none",
                        background: "transparent",
                        padding: "12px 14px",
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          alignItems: "center",
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: 15, color: INK }}>
                          {n.name}
                        </span>
                      </span>
                      {n.description && (
                        <span
                          style={{
                            display: "block",
                            fontSize: 12,
                            color: "var(--muted)",
                            marginBottom: 6,
                          }}
                        >
                          {n.description}
                        </span>
                      )}
                      {preview.length > 0 ? (
                        <span
                          style={{
                            display: "block",
                            fontSize: 13,
                            color: "var(--muted-strong)",
                            lineHeight: 1.45,
                          }}
                        >
                          {preview.slice(0, 4).join(" · ")}
                          {preview.length > 4 ? "…" : ""}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          {tr(
                            isAr,
                            "Empty — tap to add word groups",
                            "فاضية — اضغط لإضافة مجموعات"
                          )}
                        </span>
                      )}
                    </button>
                    {!selectMode && (
                      <button
                        type="button"
                        title={tr(isAr, "Export PDF", "تصدير PDF")}
                        onClick={(e) => {
                          e.stopPropagation();
                          exportOne(n);
                        }}
                        style={{
                          border: "none",
                          background: "var(--input-bg)",
                          color: "var(--accent-1)",
                          fontWeight: 800,
                          fontSize: 11,
                          padding: "0 12px",
                          cursor: "pointer",
                          flexShrink: 0,
                          letterSpacing: "0.02em",
                        }}
                      >
                        PDF
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* Detail view */}
          {active && (
            <>
              {/* Role + section + PDF */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 12,
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                    background: "var(--input-bg)",
                    borderRadius: 999,
                    padding: "4px 10px",
                  }}
                >
                  {(active.section || "external") === "curriculum"
                    ? tr(isAr, "Curriculum", "المنهج")
                    : tr(isAr, "External", "خارجي")}
                </span>
                <button
                  type="button"
                  onClick={() => exportOne(active)}
                  style={{
                    ...primaryBtnStyle,
                    marginTop: 0,
                    width: "auto",
                    padding: "8px 14px",
                    fontSize: 12,
                  }}
                >
                  {tr(isAr, "Export PDF", "تصدير PDF")}
                </button>
              </div>

              {active.description && (
                <p style={{ fontSize: 13, color: "var(--muted-strong)", marginTop: 0, marginBottom: 14 }}>
                  {active.description}
                </p>
              )}

              <label style={labelStyle}>
                {tr(isAr, "Add related words (split by - or ,)", "أضف كلمات مرتبطة (افصل بـ - أو ،)")}
              </label>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input
                  value={draftWords}
                  onChange={(e) => setDraftWords(e.target.value)}
                  placeholder="able to - capable of"
                  style={{ ...inputStyle, flex: 1 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddGroup();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddGroup}
                  disabled={!draftWords.trim()}
                  style={{
                    ...primaryBtnStyle,
                    marginTop: 0,
                    width: "auto",
                    padding: "10px 14px",
                    opacity: draftWords.trim() ? 1 : 0.45,
                  }}
                >
                  <PlusIcon size={16} />
                </button>
              </div>

              {(active.groups || []).map((g) => {
                const open = expandedGroup === g.id;
                const title = (g.relatedWords || []).join(" - ") || "—";
                return (
                  <div
                    key={g.id}
                    style={{
                      marginBottom: 12,
                      border: "1px solid rgba(var(--border-rgb),0.16)",
                      borderRadius: 14,
                      overflow: "hidden",
                      background: "var(--card)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedGroup(open ? null : g.id)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "12px 14px",
                        border: "none",
                        background: "color-mix(in srgb, var(--accent-1) 8%, transparent)",
                        cursor: "pointer",
                        textAlign: "start",
                      }}
                    >
                      <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: INK }}>
                        {title}
                      </span>
                      <ChevronIcon
                        size={16}
                        style={{
                          transform: open ? "rotate(90deg)" : isAr ? "rotate(180deg)" : "none",
                          transition: "transform 0.15s",
                          color: "var(--icon-muted)",
                        }}
                      />
                    </button>
                    {open && (
                      <div style={{ padding: "10px 14px 14px" }}>
                        {(g.entries || []).map((e) => {
                          const editing =
                            editEntry &&
                            editEntry.groupId === g.id &&
                            editEntry.word === e.word;
                          return (
                            <div
                              key={e.word}
                              style={{
                                padding: "10px 0",
                                borderBottom: "1px solid rgba(var(--border-rgb),0.1)",
                              }}
                            >
                              {editing ? (
                                <EntryEditor
                                  entry={e}
                                  isAr={isAr}
                                  onSave={(fields) => handleSaveEntry(g.id, e.word, fields)}
                                  onCancel={() => setEditEntry(null)}
                                />
                              ) : (
                                <>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      gap: 10,
                                      marginBottom: 4,
                                    }}
                                  >
                                    <span style={{ fontWeight: 700, color: "var(--accent-1)", fontSize: 14 }}>
                                      {e.word}
                                      {e.type ? (
                                        <span style={{ fontWeight: 600, color: "var(--muted)", marginInlineStart: 6 }}>
                                          ({e.type})
                                        </span>
                                      ) : null}
                                    </span>
                                    {e.meaning ? (
                                      <span dir="rtl" style={{ fontSize: 14, color: INK, fontFamily: "var(--font-arabic)" }}>
                                        {e.meaning}
                                      </span>
                                    ) : null}
                                  </div>
                                  <Line label="ex" value={e.example} />
                                  <Line label="role" value={e.role} />
                                  <Line label="note" value={e.note} />
                                  <Line label="additional" value={e.additionalNote} />
                                  <button
                                    type="button"
                                    onClick={() => setEditEntry({ groupId: g.id, word: e.word })}
                                    style={{
                                      marginTop: 6,
                                      border: "none",
                                      background: "none",
                                      color: "var(--accent-1)",
                                      fontWeight: 700,
                                      fontSize: 12,
                                      cursor: "pointer",
                                      padding: 0,
                                    }}
                                  >
                                    {tr(isAr, "Edit", "تعديل")}
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                tr(isAr, "Delete this group?", "تحذف المجموعة دي؟")
                              )
                            ) {
                              removeGroup(accountCode, active.id, g.id);
                              refresh();
                            }
                          }}
                          style={{
                            marginTop: 10,
                            border: "none",
                            background: "none",
                            color: "var(--danger)",
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <TrashIcon size={13} /> {tr(isAr, "Delete group", "حذف المجموعة")}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      tr(isAr, "Delete this entire note?", "تحذف الملاحظة كلها؟")
                    )
                  ) {
                    deleteLanguageNote(accountCode, active.id);
                    setActiveId(null);
                    refresh();
                  }
                }}
                style={{
                  marginTop: 20,
                  width: "100%",
                  padding: "12px",
                  borderRadius: 12,
                  border: "1px solid var(--danger)",
                  background: "var(--danger-bg, transparent)",
                  color: "var(--danger)",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {tr(isAr, "Delete note", "حذف الملاحظة")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }) {
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
  const [role, setRole] = useState(entry.role || "");
  const [note, setNote] = useState(entry.note || "");
  const [additionalNote, setAdditionalNote] = useState(entry.additionalNote || "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Field label={tr(isAr, "Type (n / v / adj…)", "النوع (n / v / adj…)")} value={type} onChange={setType} />
      <Field label={tr(isAr, "Meaning", "المعنى")} value={meaning} onChange={setMeaning} />
      <Field label="ex:" value={example} onChange={setExample} multiline />
      <Field label={tr(isAr, "Role", "Role / الدور")} value={role} onChange={setRole} />
      <Field label="note:" value={note} onChange={setNote} multiline />
      <Field label="additional note:" value={additionalNote} onChange={setAdditionalNote} multiline />
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={() => onSave({ type, meaning, example, role, note, additionalNote })}
          style={{ ...primaryBtnStyle, flex: 1 }}
        >
          <CheckIcon size={14} /> {tr(isAr, "Save", "حفظ")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ ...primaryBtnStyle, flex: 1, background: "var(--card)", color: INK }}
        >
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
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--muted-strong)",
          display: "block",
          marginBottom: 3,
        }}
      >
        {label}
      </span>
      <Tag
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={multiline ? 2 : undefined}
        style={{ ...inputStyle, width: "100%", resize: multiline ? "vertical" : undefined }}
      />
    </label>
  );
}
