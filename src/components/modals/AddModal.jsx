// Add/edit-word form modal.
import { useState, useEffect, useRef } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, labelStyle, inputStyle, errorStyle, primaryBtnStyle } from "../../lib/config/theme";
import { normalizePairs } from "../../lib/utils/pairUtils";
import { fetchDictionarySuggestion, DictionaryLookupError } from "../../lib/utils/dictionaryApi";
import { uid } from "../../lib/utils/quizHelpers";
import { WORD_TYPES, getEntrySenses } from "../../lib/utils/wordTypes";
import { PairListEditor } from "../common/PairList";
import { PlusIcon, XIcon, CheckIcon, LoaderIcon, WandIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

function AddModal({ cfg, onClose, onSubmit, initialEntry, onGoToExisting, findExisting }) {
  const isAr = cfg.dir === "rtl";
  const isEdit = !!initialEntry;
  const [word, setWord] = useState(isEdit ? initialEntry.word : "");
  const [meaning, setMeaning] = useState(isEdit ? initialEntry.meaning : "");
  const initialSenses = isEdit ? getEntrySenses(initialEntry) : [];
  const [multiSense, setMultiSense] = useState(isEdit && initialSenses.length > 1);
  const [pos, setPos] = useState(isEdit ? (initialEntry.pos || (initialSenses[0] && initialSenses[0].pos) || "") : "");
  const [senses, setSenses] = useState(() => {
    if (isEdit && initialSenses.length > 1) {
      return initialSenses.map((s) => ({ id: s.id || uid(), pos: s.pos || "", meaning: s.meaning || "" }));
    }
    if (isEdit && initialSenses.length === 1) {
      return [{ id: uid(), pos: initialSenses[0].pos || initialEntry.pos || "", meaning: initialSenses[0].meaning || "" }];
    }
    return [
      { id: uid(), pos: "", meaning: "" },
      { id: uid(), pos: "", meaning: "" },
    ];
  });
  const [definition, setDefinition] = useState(isEdit ? (initialEntry.definition || "") : "");
  const [example, setExample] = useState(isEdit ? (initialEntry.example || "") : "");
  const [extraExamples, setExtraExamples] = useState(isEdit && initialEntry.examples ? initialEntry.examples : []);
  const [synonyms, setSynonyms] = useState(isEdit ? normalizePairs(initialEntry.synonyms, cfg) : []);
  const [antonyms, setAntonyms] = useState(isEdit ? normalizePairs(initialEntry.antonyms, cfg) : []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dupEntry, setDupEntry] = useState(null);
  const cardRef = useRef(null);

  // Live duplicate check as soon as the word is typed (even without meaning).
  // Only for add mode — edit of the same word should not flag itself.
  useEffect(() => {
    if (isEdit || typeof findExisting !== "function") return;
    const key = (word || "").trim();
    if (!key) {
      setDupEntry(null);
      return;
    }
    const existing = findExisting(key);
    if (existing) {
      setDupEntry(existing);
      setError(""); // top banner is enough; avoid double message
    } else {
      setDupEntry(null);
    }
  }, [word, isEdit, findExisting]);

  // "Fetch from dictionary" only makes sense for English words (there's no
  // free API for Arabic definitions), and only fills fields the user
  // hasn't already written something into.
  const canAutoSuggest = cfg.wordDir === "ltr";
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState("");

  async function handleAutoSuggest() {
    if (!word.trim() || suggesting) return;
    setSuggesting(true);
    setSuggestError("");
    try {
      // Prefer the primary meaning field; if multi-sense is on, use the first filled sense.
      const meaningForMatch = (
        meaning.trim()
        || (senses || []).map((s) => (s.meaning || "").trim()).find(Boolean)
        || ""
      );
      const result = await fetchDictionarySuggestion(word, { meaning: meaningForMatch });
      // Exactly one definition + one example, matched to the written meaning.
      const def = (result.definition || "").trim();
      const ex = (result.example || "").trim();

      if (def && !definition.trim()) setDefinition(def);
      if (ex && !example.trim()) setExample(ex);
      // Do not touch extraExamples — user asked for a single example only.

      if (!def && !ex) {
        setSuggestError(tr(isAr, "No definition or examples found for that word.", "مفيش تعريف أو أمثلة للكلمة دي."));
      }
    } catch (e) {
      if (e instanceof DictionaryLookupError && e.message === "not_found") {
        setSuggestError(tr(isAr, "That word isn't in the dictionary lookup.", "الكلمة دي مش موجودة في القاموس الخارجي."));
      } else {
        setSuggestError(tr(isAr, "Couldn't reach the dictionary lookup — check your connection.", "تعذر الوصول للقاموس الخارجي — تحقق من اتصالك."));
      }
    } finally {
      setSuggesting(false);
    }
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function cleanPairs(list) {
    return list
      .map((p) => ({ id: p.id, word: p.word.trim(), meaning: p.meaning.trim() }))
      .filter((p) => p.word || p.meaning);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmedWord = word.trim();
    if (!trimmedWord) { setError(tr(isAr, "Word is required.", "الكلمة مطلوبة.")); return; }

    // If the word already exists, show "Go to it" even when meaning is empty.
    if (!isEdit && typeof findExisting === "function") {
      const existing = findExisting(trimmedWord);
      if (existing) {
        setDupEntry(existing);
        setError("");
        try {
          if (cardRef.current) cardRef.current.scrollTop = 0;
        } catch (_) {}
        return;
      }
    }

    let payloadMeaning = meaning.trim();
    let payloadPos = pos || "";
    let payloadSenses = undefined;

    if (multiSense) {
      const cleaned = senses
        .map((s) => ({ id: s.id || uid(), pos: s.pos || "", meaning: (s.meaning || "").trim() }))
        .filter((s) => s.meaning);
      if (!cleaned.length) {
        setError(tr(isAr, "Add at least one meaning.", "ضيف معنى واحد على الأقل."));
        return;
      }
      // POS is optional per meaning (same type can have several translations).
      payloadSenses = cleaned;
      payloadMeaning = cleaned[0].meaning;
      payloadPos = cleaned[0].pos;
    } else {
      if (!payloadMeaning) {
        setError(tr(isAr, "Word and meaning are both required.", "الكلمة والمعنى مطلوبان."));
        return;
      }
    }

    setSaving(true);
    setDupEntry(null);
    try {
      const result = await onSubmit({
        word: trimmedWord,
        meaning: payloadMeaning,
        pos: payloadPos || undefined,
        senses: payloadSenses,
        definition: definition.trim(),
        example: example.trim(),
        examples: extraExamples.map((ex) => ex.trim()).filter(Boolean),
        synonyms: cleanPairs(synonyms),
        antonyms: cleanPairs(antonyms),
      });
      if (result && result.duplicate) {
        setDupEntry(result.duplicate);
        setError(""); // top banner only — avoid duplicate "Go to it"
        try {
          if (cardRef.current) cardRef.current.scrollTop = 0;
        } catch (_) {}
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 5000 }}>
      <BodyScrollLock />
      <div ref={cardRef} onClick={(e) => e.stopPropagation()} className="modal-card" dir={cfg.dir} role="dialog" aria-modal="true" aria-labelledby="add-modal-title" style={{ width: "100%", maxWidth: 440, background: CARD, borderRadius: 4, padding: "24px 24px 22px", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 id="add-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0 }}>{isEdit ? tr(isAr, "Edit word", "تعديل الكلمة") : tr(isAr, `Add to ${cfg.label}`, `إضافة إلى ${cfg.label}`)}</h2>
          <button onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", width: 36, height: 36, padding: 0, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 0 }}><XIcon size={20} /></button>
        </div>

        {dupEntry && (
          <div
            role="alert"
            style={{
              marginTop: 12,
              marginBottom: 4,
              padding: "12px 14px",
              borderRadius: 10,
              background: "color-mix(in srgb, var(--danger, #c0392b) 16%, transparent)",
              border: "1px solid color-mix(in srgb, var(--danger, #c0392b) 45%, transparent)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--danger, #e74c3c)", lineHeight: 1.45 }}>
              {tr(
                isAr,
                `"${dupEntry.word}" is already in the dictionary.`,
                `«${dupEntry.word}» موجودة أصلًا في القاموس.`
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof onGoToExisting === "function") onGoToExisting(dupEntry);
                else onClose();
              }}
              style={{
                border: "none",
                cursor: "pointer",
                background: cfg.accent,
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                padding: "12px 14px",
                borderRadius: 8,
                width: "100%",
              }}
            >
              {tr(isAr, "Go to it", "اذهب إليها")}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          <label style={labelStyle} htmlFor="add-word">{tr(isAr, "Word *", "الكلمة *")}</label>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <input
              id="add-word"
              value={word}
              onChange={(e) => {
                setWord(e.target.value);
                // dupEntry is managed by the live-check effect above
              }}
              placeholder={cfg.wordPlaceholder}
              dir={cfg.wordDir}
              style={{ ...inputStyle, flex: 1, fontFamily: cfg.wordFont, fontSize: 16 }}
              autoFocus
            />
            {canAutoSuggest && (
              <button type="button" onClick={handleAutoSuggest} disabled={!word.trim() || suggesting}
                title={tr(isAr, "Fetch definition and examples only", "جلب التعريف والأمثلة فقط")}
                style={{ display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap", padding: "10px 12px", fontSize: 12.5, fontWeight: 700, color: cfg.accent, background: cfg.accentSoft, border: "none", borderRadius: 3, cursor: !word.trim() || suggesting ? "default" : "pointer", opacity: !word.trim() ? 0.6 : 1 }}>
                {suggesting ? <LoaderIcon size={14} /> : <WandIcon size={14} />}
                {tr(isAr, "Auto-fill", "تعبئة تلقائية")}
              </button>
            )}
          </div>
          {suggestError && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{suggestError}</div>}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4, marginBottom: 4 }}>
            <span style={{ ...labelStyle, margin: 0 }}>{tr(isAr, "Word type", "نوع الكلمة")}</span>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, fontWeight: 600, color: "var(--muted-strong)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={multiSense}
                onChange={(e) => {
                  const on = e.target.checked;
                  setMultiSense(on);
                  if (on && meaning.trim() && !senses.some((s) => s.meaning.trim())) {
                    setSenses((list) => {
                      const next = list.slice();
                      next[0] = { ...next[0], pos: pos || next[0].pos, meaning: meaning.trim() };
                      return next;
                    });
                  }
                }}
              />
              {tr(isAr, "More than one meaning", "أكتر من معنى")}
            </label>
          </div>

          {!multiSense ? (
            <>
              <select
                id="add-pos"
                value={pos}
                onChange={(e) => setPos(e.target.value)}
                style={{ ...inputStyle, marginBottom: 8, cursor: "pointer" }}
                aria-label={tr(isAr, "Word type", "نوع الكلمة")}
              >
                <option value="">{tr(isAr, "— optional —", "— اختياري —")}</option>
                {WORD_TYPES.map((wt) => (
                  <option key={wt.id} value={wt.id}>{tr(isAr, wt.en, wt.ar)}</option>
                ))}
              </select>
              <label style={labelStyle} htmlFor="add-meaning">{tr(isAr, "Meaning *", "المعنى *")}</label>
              <input id="add-meaning" value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder={cfg.meaningPlaceholder} dir={cfg.meaningDir} style={{ ...inputStyle, fontFamily: cfg.meaningFont, fontSize: 16 }} />
              <button
                type="button"
                onClick={() => {
                  setMultiSense(true);
                  setSenses([
                    { id: uid(), pos: pos || "", meaning: meaning.trim() },
                    { id: uid(), pos: pos || "", meaning: "" },
                  ]);
                }}
                style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, border: "none", background: "none", color: cfg.accent, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}
              >
                <PlusIcon size={12} /> {tr(isAr, "Add another meaning (e.g. زلزال + هزة أرضية)", "أضف معنى تاني (مثلاً زلزال + هزة أرضية)")}
              </button>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 8 }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
                {tr(isAr,
                  "Add every valid meaning. Same word type is fine (e.g. earthquake → زلزال and هزة أرضية). Type is optional.",
                  "ضيف كل معنى صحيح. نفس النوع عادي (مثلاً earthquake → زلزال وهزة أرضية). نوع الكلمة اختياري.")}
              </p>
              {senses.map((s, i) => (
                <div key={s.id} style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(var(--border-rgb),0.18)", background: "var(--input-bg)" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                    <select
                      value={s.pos}
                      onChange={(e) => setSenses((list) => list.map((row, idx) => idx === i ? { ...row, pos: e.target.value } : row))}
                      style={{ ...inputStyle, margin: 0, flex: 1, cursor: "pointer" }}
                      aria-label={tr(isAr, `Type ${i + 1}`, `النوع ${i + 1}`)}
                    >
                      <option value="">{tr(isAr, "Pick type…", "اختار النوع…")}</option>
                      {WORD_TYPES.map((wt) => (
                        <option key={wt.id} value={wt.id}>{tr(isAr, wt.en, wt.ar)}</option>
                      ))}
                    </select>
                    {senses.length > 1 && (
                      <button type="button" onClick={() => setSenses((list) => list.filter((_, idx) => idx !== i))}
                        aria-label={tr(isAr, "Remove", "حذف")}
                        style={{ border: "none", background: "none", color: "var(--icon-muted)", cursor: "pointer", padding: 4 }}>
                        <XIcon size={16} />
                      </button>
                    )}
                  </div>
                  <input
                    value={s.meaning}
                    onChange={(e) => setSenses((list) => list.map((row, idx) => idx === i ? { ...row, meaning: e.target.value } : row))}
                    placeholder={tr(isAr, `Meaning (${i + 1}) *`, `المعنى (${i + 1}) *`)}
                    dir={cfg.meaningDir}
                    style={{ ...inputStyle, margin: 0, fontFamily: cfg.meaningFont, fontSize: 15 }}
                  />
                </div>
              ))}
              <button type="button" onClick={() => setSenses((list) => [...list, { id: uid(), pos: "", meaning: "" }])}
                style={{ display: "flex", alignItems: "center", gap: 10, border: "none", background: "none", color: cfg.accent, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                <PlusIcon size={12} /> {tr(isAr, "Add another meaning", "أضف معنى تاني")}
              </button>
            </div>
          )}
          <label style={labelStyle} htmlFor="add-definition">{tr(isAr, "Definition (optional)", "تعريف (اختياري)")}</label>
          <textarea id="add-definition" value={definition} onChange={(e) => setDefinition(e.target.value)} placeholder="شرح إضافي أو مثال" dir="rtl" rows={3} style={{ ...inputStyle, fontFamily: "'Amiri', serif", fontSize: 15, resize: "vertical" }} />
          <label style={labelStyle} htmlFor="add-example">{tr(isAr, "Example sentence (optional)", "جملة توضيحية (اختياري)")}</label>
          <textarea id="add-example" value={example} onChange={(e) => setExample(e.target.value)} placeholder={cfg.wordPlaceholder} dir={cfg.wordDir} rows={2} style={{ ...inputStyle, fontFamily: cfg.wordFont, fontSize: 15, resize: "vertical" }} />
          {extraExamples.map((ex, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <textarea value={ex} dir={cfg.wordDir} rows={2}
                onChange={(e) => setExtraExamples((list) => list.map((v, idx) => (idx === i ? e.target.value : v)))}
                placeholder={cfg.wordPlaceholder}
                style={{ ...inputStyle, flex: 1, fontFamily: cfg.wordFont, fontSize: 15, resize: "vertical", marginTop: 0 }} />
              <button type="button" onClick={() => setExtraExamples((list) => list.filter((_, idx) => idx !== i))}
                aria-label={tr(isAr, "Remove example", "إزالة الجملة")}
                style={{ alignSelf: "flex-start", marginTop: 4, border: "none", background: "none", color: "var(--icon-muted)", cursor: "pointer", padding: 2 }}>
                <XIcon size={15} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setExtraExamples((list) => [...list, ""])}
            style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, border: "none", background: "none", color: cfg.accent, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
            <PlusIcon size={12} /> {tr(isAr, "Add another example", "أضف جملة تانية")}
          </button>
          <PairListEditor cfg={cfg} label={tr(isAr, "Synonyms (optional)", "مرادفات (اختياري)")} pairs={synonyms} onChange={setSynonyms} isAr={isAr} />
          <PairListEditor cfg={cfg} label={tr(isAr, "Antonyms (optional)", "مضادات (اختياري)")} pairs={antonyms} onChange={setAntonyms} isAr={isAr} />
          {error && (
            <div style={{ ...errorStyle }} role="alert" aria-live="assertive">
              {error}
            </div>
          )}
          <button type="submit" disabled={saving} style={{ ...primaryBtnStyle, background: cfg.accent }}>
            {saving ? <LoaderIcon size={16} /> : (isEdit ? <CheckIcon size={16} /> : <PlusIcon size={16} />)} {isEdit ? tr(isAr, "Save changes", "حفظ التغييرات") : tr(isAr, "Save word", "حفظ الكلمة")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddModal;
