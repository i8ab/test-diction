// Add/edit-word form modal.
import { useState, useEffect } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, labelStyle, inputStyle, errorStyle, primaryBtnStyle } from "../../lib/config/theme";
import { normalizePairs } from "../../lib/utils/pairUtils";
import { uid } from "../../lib/utils/quizHelpers";
import { fetchDictionarySuggestion, DictionaryLookupError } from "../../lib/utils/dictionaryApi";
import { PairListEditor } from "../common/PairList";
import { PlusIcon, XIcon, CheckIcon, LoaderIcon, WandIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

function AddModal({ cfg, onClose, onSubmit, initialEntry }) {
  const isAr = cfg.dir === "rtl";
  const isEdit = !!initialEntry;
  const [word, setWord] = useState(isEdit ? initialEntry.word : "");
  const [meaning, setMeaning] = useState(isEdit ? initialEntry.meaning : "");
  const [definition, setDefinition] = useState(isEdit ? (initialEntry.definition || "") : "");
  const [example, setExample] = useState(isEdit ? (initialEntry.example || "") : "");
  const [extraExamples, setExtraExamples] = useState(isEdit && initialEntry.examples ? initialEntry.examples : []);
  const [synonyms, setSynonyms] = useState(isEdit ? normalizePairs(initialEntry.synonyms, cfg) : []);
  const [antonyms, setAntonyms] = useState(isEdit ? normalizePairs(initialEntry.antonyms, cfg) : []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
      const result = await fetchDictionarySuggestion(word);
      if (!definition.trim() && result.definition) setDefinition(result.definition);
      if (!example.trim() && result.example) setExample(result.example);
      if (result.synonyms.length) {
        setSynonyms((list) => {
          const existing = new Set(list.map((p) => p.word.trim().toLowerCase()).filter(Boolean));
          const additions = result.synonyms
            .filter((s) => !existing.has(s.toLowerCase()))
            .map((s) => ({ id: uid(), word: s, meaning: "" }));
          return additions.length ? [...list, ...additions] : list;
        });
      }
      if (!result.definition && !result.example && !result.synonyms.length) {
        setSuggestError(tr(isAr, "No extra details found for that word.", "معرفتش ألاقي تفاصيل إضافية للكلمة دي."));
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
    if (!word.trim() || !meaning.trim()) { setError(tr(isAr, "Word and meaning are both required.", "الكلمة والمعنى مطلوبان.")); return; }
    setSaving(true);
    await onSubmit({
      word: word.trim(), meaning: meaning.trim(), definition: definition.trim(), example: example.trim(),
      examples: extraExamples.map((ex) => ex.trim()).filter(Boolean),
      synonyms: cleanPairs(synonyms), antonyms: cleanPairs(antonyms),
    });
    setSaving(false);
  }

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 2000 }}>
      <BodyScrollLock />
      <div onClick={(e) => e.stopPropagation()} className="modal-card" dir={cfg.dir} role="dialog" aria-modal="true" aria-labelledby="add-modal-title" style={{ width: "100%", maxWidth: 440, background: CARD, borderRadius: 4, padding: "24px 24px 22px", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 id="add-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0 }}>{isEdit ? tr(isAr, "Edit word", "تعديل الكلمة") : tr(isAr, `Add to ${cfg.label}`, `إضافة إلى ${cfg.label}`)}</h2>
          <button onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)" }}><XIcon size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          <label style={labelStyle} htmlFor="add-word">{tr(isAr, "Word *", "الكلمة *")}</label>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <input id="add-word" value={word} onChange={(e) => setWord(e.target.value)} placeholder={cfg.wordPlaceholder} dir={cfg.wordDir} style={{ ...inputStyle, flex: 1, fontFamily: cfg.wordFont, fontSize: 16 }} autoFocus />
            {canAutoSuggest && (
              <button type="button" onClick={handleAutoSuggest} disabled={!word.trim() || suggesting}
                title={tr(isAr, "Fetch definition/example from dictionary", "جلب التعريف والمثال من القاموس")}
                style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", padding: "10px 12px", fontSize: 12.5, fontWeight: 700, color: cfg.accent, background: cfg.accentSoft, border: "none", borderRadius: 3, cursor: !word.trim() || suggesting ? "default" : "pointer", opacity: !word.trim() ? 0.6 : 1 }}>
                {suggesting ? <LoaderIcon size={14} /> : <WandIcon size={14} />}
                {tr(isAr, "Auto-fill", "تعبئة تلقائية")}
              </button>
            )}
          </div>
          {suggestError && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{suggestError}</div>}
          <label style={labelStyle} htmlFor="add-meaning">{tr(isAr, "Meaning *", "المعنى *")}</label>
          <input id="add-meaning" value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder={cfg.meaningPlaceholder} dir={cfg.meaningDir} style={{ ...inputStyle, fontFamily: cfg.meaningFont, fontSize: 16 }} />
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
            style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, border: "none", background: "none", color: cfg.accent, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
            <PlusIcon size={12} /> {tr(isAr, "Add another example", "أضف جملة تانية")}
          </button>
          <PairListEditor cfg={cfg} label={tr(isAr, "Synonyms (optional)", "مرادفات (اختياري)")} pairs={synonyms} onChange={setSynonyms} isAr={isAr} />
          <PairListEditor cfg={cfg} label={tr(isAr, "Antonyms (optional)", "مضادات (اختياري)")} pairs={antonyms} onChange={setAntonyms} isAr={isAr} />
          {error && <div style={errorStyle} role="alert" aria-live="assertive">{error}</div>}
          <button type="submit" disabled={saving} style={{ ...primaryBtnStyle, background: cfg.accent }}>
            {saving ? <LoaderIcon size={16} /> : (isEdit ? <CheckIcon size={16} /> : <PlusIcon size={16} />)} {isEdit ? tr(isAr, "Save changes", "حفظ التغييرات") : tr(isAr, "Save word", "حفظ الكلمة")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddModal;
