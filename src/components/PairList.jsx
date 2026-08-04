// Synonym/antonym pair list — an editable form (PairListEditor, used in
// AddModal) and a read-only display (PairListDisplay, used in EntryCard and
// WordZoomModal).
import { useState, useEffect, useRef } from "react";
import { tr } from "../lib/i18n";
import { INK, labelStyle, inputStyle } from "../lib/theme";
import { normalizePairs } from "../lib/pairUtils";
import { PlusIcon, XIcon, SpeakButton } from "./Icons";

function PairListEditor({ cfg, label, pairs, onChange, isAr }) {
  const [focusId, setFocusId] = useState(null);
  const wordRefs = useRef({});

  useEffect(() => {
    if (focusId && wordRefs.current[focusId]) {
      wordRefs.current[focusId].focus();
      setFocusId(null);
    }
  }, [focusId, pairs]);

  function updateRow(id, field, value) {
    onChange(pairs.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }
  function addRow(focusNew) {
    const row = { id: uid(), word: "", meaning: "" };
    onChange([...pairs, row]);
    if (focusNew) setFocusId(row.id);
  }
  function removeRow(id) {
    onChange(pairs.filter((p) => p.id !== id));
  }
  function handleEnter(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      addRow(true);
    }
  }
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {pairs.map((p) => (
        <div key={p.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
          <input
            ref={(el) => (wordRefs.current[p.id] = el)}
            value={p.word} onChange={(e) => updateRow(p.id, "word", e.target.value)}
            onKeyDown={handleEnter}
            placeholder={tr(isAr, "Word", "الكلمة")} dir={cfg.wordDir}
            style={{ ...inputStyle, flex: 1, minWidth: 0, fontFamily: cfg.wordFont, fontSize: 14 }}
          />
          <input
            value={p.meaning} onChange={(e) => updateRow(p.id, "meaning", e.target.value)}
            onKeyDown={handleEnter}
            placeholder={tr(isAr, "Meaning in Arabic", "المعنى بالعربي")} dir={cfg.meaningDir}
            style={{ ...inputStyle, flex: 1, minWidth: 0, fontFamily: cfg.meaningFont, fontSize: 14 }}
          />
          <button
            type="button" onClick={() => removeRow(p.id)}
            aria-label={tr(isAr, "Remove", "حذف")}
            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", padding: 4, flexShrink: 0, display: "flex" }}
          >
            <XIcon size={15} />
          </button>
        </div>
      ))}
      <button
        type="button" onClick={() => addRow(true)}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "none", cursor: "pointer", color: "var(--accent-1)", fontSize: 13, fontWeight: 600, padding: "2px 0 12px" }}
      >
        <PlusIcon size={13} /> {tr(isAr, "Add", "إضافة")}
      </button>
    </div>
  );
}

function PairListDisplay({ cfg, pairs }) {
  const clean = normalizePairs(pairs, cfg);
  if (!clean.length) return null;
  const isAr = cfg.dir === "rtl";
  return (
    <div dir={cfg.dir} style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 3 }}>
      {clean.map((p) => (
        <div key={p.id} style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
          <span dir={cfg.wordDir} style={{ flex: 1, minWidth: 0, fontFamily: cfg.wordFont, padding: "3px 8px", background: "var(--input-bg)", borderRadius: 3, color: INK, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
            <span style={{ minWidth: 0, overflowWrap: "break-word" }}>{p.word || "—"}</span>
            {!!p.word && <SpeakButton text={p.word} dir={cfg.wordDir} isAr={isAr} size={13} style={{ padding: 2, flexShrink: 0 }} />}
          </span>
          <span dir={cfg.meaningDir} style={{ flex: 1, minWidth: 0, fontFamily: cfg.meaningFont, padding: "3px 8px", background: "var(--input-bg)", borderRadius: 3, color: "var(--meaning)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
            <span style={{ minWidth: 0, overflowWrap: "break-word" }}>{p.meaning || "—"}</span>
            {!!p.meaning && <SpeakButton text={p.meaning} dir={cfg.meaningDir} isAr={isAr} size={13} style={{ padding: 2, flexShrink: 0 }} />}
          </span>
        </div>
      ))}
    </div>
  );
}

export { PairListEditor, PairListDisplay };
