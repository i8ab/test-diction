// Add/edit-word form modal.
import { useState, useEffect, useRef } from "react";
import { useKeyboardAware, keyboardAwareBodyStyle } from "../../lib/utils/useKeyboardAware";
import { tr } from "../../lib/config/i18n";
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
        setError("");
        try {
          if (cardRef.current) cardRef.current.scrollTop = 0;
        } catch (_) {}
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="addm-backdrop"
      style={{
        position: "fixed", inset: 0, zIndex: 5000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "max(12px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))",
        background: "rgba(3, 6, 14, 0.72)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <BodyScrollLock />
      <style>{ADDM_CSS}</style>
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        className="addm-card"
        dir={cfg.dir}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-modal-title"
        style={{ "--addm-accent": cfg.accent, "--addm-accent-soft": cfg.accentSoft }}
      >
        <div className="addm-head">
          <div className="addm-head-text">
            <div className="addm-kicker">{isEdit ? tr(isAr, "Edit", "تعديل") : tr(isAr, "New entry", "مدخل جديد")}</div>
            <h2 id="add-modal-title" className="addm-title">
              {isEdit ? tr(isAr, "Edit word", "تعديل الكلمة") : tr(isAr, `Add to ${cfg.label}`, `إضافة إلى ${cfg.label}`)}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="addm-close" aria-label={tr(isAr, "Close", "إغلاق")}>
            <XIcon size={18} />
          </button>
        </div>

        <div className="addm-body">
          {dupEntry && (
            <div role="alert" className="addm-dup">
              <div className="addm-dup-text">
                {tr(
                  isAr,
                  `"${dupEntry.word}" is already in the dictionary.`,
                  `«${dupEntry.word}» موجودة أصلًا في القاموس.`
                )}
              </div>
              <button
                type="button"
                className="addm-dup-btn"
                onClick={() => {
                  if (typeof onGoToExisting === "function") onGoToExisting(dupEntry);
                  else onClose();
                }}
              >
                {tr(isAr, "Go to it", "اذهب إليها")}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="addm-form">
            <label className="addm-label" htmlFor="add-word">{tr(isAr, "Word", "الكلمة")} <span className="addm-req">*</span></label>
            <div className="addm-row">
              <input
                id="add-word"
                className="addm-input"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder={cfg.wordPlaceholder}
                dir={cfg.wordDir}
                style={{ fontFamily: cfg.wordFont }}
               
              />
              {canAutoSuggest && (
                <button
                  type="button"
                  onClick={handleAutoSuggest}
                  disabled={!word.trim() || suggesting}
                  title={tr(isAr, "Fetch definition and examples only", "جلب التعريف والأمثلة فقط")}
                  className="addm-autofill"
                  style={{ opacity: !word.trim() ? 0.55 : 1 }}
                >
                  {suggesting ? <LoaderIcon size={14} /> : <WandIcon size={14} />}
                  {tr(isAr, "Auto-fill", "تعبئة")}
                </button>
              )}
            </div>
            {suggestError && <div className="addm-hint">{suggestError}</div>}

            <div className="addm-type-row">
              <span className="addm-label" style={{ margin: 0 }}>{tr(isAr, "Word type", "نوع الكلمة")}</span>
              <label className="addm-check">
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
                <span>{tr(isAr, "More than one meaning", "أكتر من معنى")}</span>
              </label>
            </div>

            {!multiSense ? (
              <>
                <select
                  id="add-pos"
                  value={pos}
                  onChange={(e) => setPos(e.target.value)}
                  className="addm-input addm-select"
                  aria-label={tr(isAr, "Word type", "نوع الكلمة")}
                >
                  <option value="">{tr(isAr, "— optional —", "— اختياري —")}</option>
                  {WORD_TYPES.map((wt) => (
                    <option key={wt.id} value={wt.id}>{tr(isAr, wt.en, wt.ar)}</option>
                  ))}
                </select>
                <label className="addm-label" htmlFor="add-meaning">{tr(isAr, "Meaning", "المعنى")} <span className="addm-req">*</span></label>
                <input
                  id="add-meaning"
                  className="addm-input"
                  value={meaning}
                  onChange={(e) => setMeaning(e.target.value)}
                  placeholder={cfg.meaningPlaceholder}
                  dir={cfg.meaningDir}
                  style={{ fontFamily: cfg.meaningFont }}
                />
                <button
                  type="button"
                  className="addm-link"
                  onClick={() => {
                    setMultiSense(true);
                    setSenses([
                      { id: uid(), pos: pos || "", meaning: meaning.trim() },
                      { id: uid(), pos: pos || "", meaning: "" },
                    ]);
                  }}
                >
                  <PlusIcon size={13} /> {tr(isAr, "Add another meaning (e.g. زلزال + هزة أرضية)", "أضف معنى تاني (مثلاً زلزال + هزة أرضية)")}
                </button>
              </>
            ) : (
              <div className="addm-senses">
                <p className="addm-hint" style={{ marginBottom: 4 }}>
                  {tr(isAr,
                    "Add every valid meaning. Same word type is fine. Type is optional.",
                    "ضيف كل معنى صحيح. نفس النوع عادي. نوع الكلمة اختياري.")}
                </p>
                {senses.map((s, i) => (
                  <div key={s.id} className="addm-sense">
                    <div className="addm-row">
                      <select
                        value={s.pos}
                        onChange={(e) => setSenses((list) => list.map((row, idx) => idx === i ? { ...row, pos: e.target.value } : row))}
                        className="addm-input addm-select"
                        style={{ flex: 1, margin: 0 }}
                        aria-label={tr(isAr, `Type ${i + 1}`, `النوع ${i + 1}`)}
                      >
                        <option value="">{tr(isAr, "Pick type…", "اختار النوع…")}</option>
                        {WORD_TYPES.map((wt) => (
                          <option key={wt.id} value={wt.id}>{tr(isAr, wt.en, wt.ar)}</option>
                        ))}
                      </select>
                      {senses.length > 1 && (
                        <button type="button" className="addm-icon-btn" onClick={() => setSenses((list) => list.filter((_, idx) => idx !== i))}
                          aria-label={tr(isAr, "Remove", "حذف")}>
                          <XIcon size={16} />
                        </button>
                      )}
                    </div>
                    <input
                      value={s.meaning}
                      onChange={(e) => setSenses((list) => list.map((row, idx) => idx === i ? { ...row, meaning: e.target.value } : row))}
                      placeholder={tr(isAr, `Meaning (${i + 1}) *`, `المعنى (${i + 1}) *`)}
                      dir={cfg.meaningDir}
                      className="addm-input"
                      style={{ margin: 0, fontFamily: cfg.meaningFont }}
                    />
                  </div>
                ))}
                <button type="button" className="addm-link" onClick={() => setSenses((list) => [...list, { id: uid(), pos: "", meaning: "" }])}>
                  <PlusIcon size={13} /> {tr(isAr, "Add another meaning", "أضف معنى تاني")}
                </button>
              </div>
            )}

            <label className="addm-label" htmlFor="add-definition">{tr(isAr, "Definition", "تعريف")} <span className="addm-opt">{tr(isAr, "optional", "اختياري")}</span></label>
            <textarea
              id="add-definition"
              className="addm-input addm-textarea"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder={tr(isAr, "Extra explanation or note", "شرح إضافي أو مثال")}
              dir="rtl"
              rows={3}
              style={{ fontFamily: "'Amiri', serif" }}
            />

            <label className="addm-label" htmlFor="add-example">{tr(isAr, "Example sentence", "جملة توضيحية")} <span className="addm-opt">{tr(isAr, "optional", "اختياري")}</span></label>
            <textarea
              id="add-example"
              className="addm-input addm-textarea"
              value={example}
              onChange={(e) => setExample(e.target.value)}
              placeholder={cfg.wordPlaceholder}
              dir={cfg.wordDir}
              rows={2}
              style={{ fontFamily: cfg.wordFont }}
            />
            {extraExamples.map((ex, i) => (
              <div key={i} className="addm-row" style={{ marginTop: 8 }}>
                <textarea
                  value={ex}
                  dir={cfg.wordDir}
                  rows={2}
                  onChange={(e) => setExtraExamples((list) => list.map((v, idx) => (idx === i ? e.target.value : v)))}
                  placeholder={cfg.wordPlaceholder}
                  className="addm-input addm-textarea"
                  style={{ flex: 1, margin: 0, fontFamily: cfg.wordFont }}
                />
                <button type="button" className="addm-icon-btn" onClick={() => setExtraExamples((list) => list.filter((_, idx) => idx !== i))}
                  aria-label={tr(isAr, "Remove example", "إزالة الجملة")}>
                  <XIcon size={15} />
                </button>
              </div>
            ))}
            <button type="button" className="addm-link" onClick={() => setExtraExamples((list) => [...list, ""])}>
              <PlusIcon size={13} /> {tr(isAr, "Add another example", "أضف جملة تانية")}
            </button>

            <PairListEditor cfg={cfg} label={tr(isAr, "Synonyms (optional)", "مرادفات (اختياري)")} pairs={synonyms} onChange={setSynonyms} isAr={isAr} />
            <PairListEditor cfg={cfg} label={tr(isAr, "Antonyms (optional)", "مضادات (اختياري)")} pairs={antonyms} onChange={setAntonyms} isAr={isAr} />

            {error && (
              <div className="addm-error" role="alert" aria-live="assertive">{error}</div>
            )}

            <button type="submit" disabled={saving} className="addm-submit" style={{ background: cfg.accent }}>
              {saving ? <LoaderIcon size={16} /> : (isEdit ? <CheckIcon size={16} /> : <PlusIcon size={16} />)}
              {isEdit ? tr(isAr, "Save changes", "حفظ التغييرات") : tr(isAr, "Save word", "حفظ الكلمة")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const ADDM_CSS = `
.addm-card {
  width: 100%; max-width: 440px; max-height: min(92dvh, 720px);
  display: flex; flex-direction: column;
  border-radius: 22px; overflow: hidden;
  background: linear-gradient(165deg, rgba(28,34,48,0.98) 0%, rgba(16,20,30,0.99) 100%);
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.04),
    0 28px 80px -20px rgba(0,0,0,0.65),
    0 0 60px -28px color-mix(in srgb, var(--addm-accent, #5b8def) 45%, transparent);
  color: #eef2f8;
}
[data-theme="light"] .addm-card,
:root:not([data-theme="dark"]) .addm-card {
  /* keep dark glass look in modal for consistency; theme vars still used for accents */
}
.addm-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 12px; padding: 18px 18px 12px; flex-shrink: 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.addm-kicker {
  font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--addm-accent, #7eb6ff);
  margin-bottom: 4px;
}
.addm-title {
  margin: 0; font-size: 18px; font-weight: 800;
  letter-spacing: -0.02em; line-height: 1.25; color: #f4f7fc;
}
.addm-close {
  width: 36px; height: 36px; border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.65);
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: background 0.15s, color 0.15s;
}
.addm-close:hover { background: rgba(255,255,255,0.12); color: #fff; }
.addm-body {
  flex: 1; min-height: 0; overflow-y: auto;
  -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
  padding: 14px 18px 20px;
}
.addm-form { display: flex; flex-direction: column; gap: 0; }
.addm-label {
  display: block; margin: 12px 0 6px;
  font-size: 11.5px; font-weight: 700; letter-spacing: 0.04em;
  text-transform: uppercase; color: rgba(255,255,255,0.45);
}
.addm-label:first-child { margin-top: 0; }
.addm-req { color: #ff7b8a; }
.addm-opt {
  text-transform: none; font-weight: 600; letter-spacing: 0;
  color: rgba(255,255,255,0.28); margin-inline-start: 4px;
}
.addm-input {
  width: 100%; box-sizing: border-box;
  padding: 12px 14px; border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: #f2f5fa; font-size: 15.5px; font-weight: 500;
  outline: none; transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.addm-input::placeholder { color: rgba(255,255,255,0.28); }
.addm-input:focus {
  border-color: color-mix(in srgb, var(--addm-accent, #5b8def) 70%, transparent);
  background: rgba(255,255,255,0.07);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--addm-accent, #5b8def) 22%, transparent);
}
.addm-select {
  cursor: pointer; appearance: none; -webkit-appearance: none;
  color-scheme: dark;
  background-color: rgba(255,255,255,0.05);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='rgba(255,255,255,0.55)' d='M1 1l5 5 5-5'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 14px center;
  background-size: 12px 8px; padding-right: 36px;
}
[dir="rtl"] .addm-select { background-position: left 14px center; padding-right: 14px; padding-left: 36px; }
.addm-select option,
.addm-select optgroup {
  background: #1a2030;
  color: #eef2f8;
}
.addm-select option:checked,
.addm-select option:hover {
  background: #2a3550;
  color: var(--on-accent, #fff);
}
.addm-textarea { resize: vertical; min-height: 72px; line-height: 1.5; }
.addm-row { display: flex; gap: 8px; align-items: flex-start; }
.addm-row .addm-input { flex: 1; }
.addm-autofill {
  display: inline-flex; align-items: center; gap: 6px;
  white-space: nowrap; padding: 0 14px; height: 46px;
  border-radius: 14px; border: none; cursor: pointer;
  font-size: 12.5px; font-weight: 700;
  color: var(--addm-accent, #7eb6ff);
  background: color-mix(in srgb, var(--addm-accent, #5b8def) 18%, transparent);
  transition: filter 0.15s, opacity 0.15s;
}
.addm-autofill:disabled { cursor: default; }
.addm-autofill:not(:disabled):hover { filter: brightness(1.12); }
.addm-type-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; margin-top: 14px; margin-bottom: 6px; flex-wrap: wrap;
}
.addm-check {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 12.5px; font-weight: 600; color: rgba(255,255,255,0.55);
  cursor: pointer; user-select: none;
}
.addm-check input {
  width: 16px; height: 16px; accent-color: var(--addm-accent, #5b8def);
  cursor: pointer;
}
.addm-link {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 10px; border: none; background: none; padding: 0;
  color: var(--addm-accent, #7eb6ff); font-size: 12.5px; font-weight: 700;
  cursor: pointer;
}
.addm-link:hover { filter: brightness(1.15); }
.addm-senses { display: flex; flex-direction: column; gap: 10px; margin-bottom: 4px; }
.addm-sense {
  padding: 12px; border-radius: 16px;
  background: rgba(255,255,255,0.035);
  border: 1px solid rgba(255,255,255,0.08);
  display: flex; flex-direction: column; gap: 8px;
}
.addm-icon-btn {
  width: 36px; height: 36px; border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5);
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.addm-icon-btn:hover { color: var(--on-accent, #fff); background: rgba(255,255,255,0.1); }
.addm-hint { font-size: 12px; color: rgba(255,255,255,0.38); line-height: 1.45; margin-top: 6px; }
.addm-dup {
  margin-bottom: 12px; padding: 14px;
  border-radius: 16px;
  background: color-mix(in srgb, #e74c3c 14%, transparent);
  border: 1px solid color-mix(in srgb, #e74c3c 40%, transparent);
  display: flex; flex-direction: column; gap: 10px;
}
.addm-dup-text { font-size: 13px; font-weight: 700; color: #ff8a8a; line-height: 1.45; }
.addm-dup-btn {
  border: none; cursor: pointer; border-radius: 12px;
  background: var(--addm-accent, #5b8def); color: var(--on-accent, #fff);
  font-weight: 800; font-size: 14px; padding: 12px 14px; width: 100%;
}
.addm-error {
  margin-top: 12px; padding: 10px 12px; border-radius: 12px;
  background: color-mix(in srgb, #e74c3c 14%, transparent);
  border: 1px solid color-mix(in srgb, #e74c3c 35%, transparent);
  color: #ff9a9a; font-size: 13px; font-weight: 600;
}
.addm-submit {
  margin-top: 16px; width: 100%;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  border: none; cursor: pointer; border-radius: 16px;
  color: var(--on-accent, #fff); font-weight: 800; font-size: 15px;
  padding: 14px 16px;
  box-shadow: 0 12px 28px -10px color-mix(in srgb, var(--addm-accent, #5b8def) 65%, transparent);
  transition: filter 0.15s, transform 0.12s;
}
.addm-submit:hover:not(:disabled) { filter: brightness(1.08); }
.addm-submit:active:not(:disabled) { transform: scale(0.98); }
.addm-submit:disabled { opacity: 0.7; cursor: default; }
`;

export default AddModal;
