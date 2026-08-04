import { useState, useEffect, useMemo } from "react";
import { tr } from "../lib/i18n";
import { INK, CARD, BRASS, labelStyle } from "../lib/theme";
import { shuffleArray } from "../lib/quizHelpers";
import { XIcon, LayersIcon } from "./Icons";

function FlashcardsModal({ entries, cfg, sectionLabel, studiedIds, favoriteIds, onToggleStudied, isAr, onClose }) {
  const [filterKey, setFilterKey] = useState("all"); // all | studied | favorites
  const [deck, setDeck] = useState(null); // null = setup stage, array = running
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knewCount, setKnewCount] = useState(0);
  const [learningCount, setLearningCount] = useState(0);
  const [enterDir, setEnterDir] = useState(1); // 1 = next card enters from the "forward" side
  const [pulse, setPulse] = useState(null); // "knew" | "learning" | null — brief button feedback

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") { onClose(); return; }
      if (!deck) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped((f) => !f); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, deck]);

  const pool = useMemo(() => {
    if (filterKey === "studied") return entries.filter((e) => studiedIds.has(e.id));
    if (filterKey === "favorites") return entries.filter((e) => favoriteIds && favoriteIds.has(e.id));
    return entries;
  }, [entries, filterKey, studiedIds, favoriteIds]);

  function startDeck() {
    setDeck(shuffleArray(pool));
    setPos(0);
    setFlipped(false);
    setKnewCount(0);
    setLearningCount(0);
  }

  function advance(knew) {
    if (knew) setKnewCount((c) => c + 1); else setLearningCount((c) => c + 1);
    setPulse(knew ? "knew" : "learning");
    setTimeout(() => setPulse(null), 300);
    setEnterDir(1);
    if (pos + 1 >= deck.length) { setPos(deck.length); return; } // reached the summary screen
    setPos((p) => p + 1);
    setFlipped(false);
  }

  const current = deck && pos < deck.length ? deck[pos] : null;
  const isDone = deck && pos >= deck.length;

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 2000 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card" dir={isAr ? "rtl" : "ltr"} role="dialog" aria-modal="true" aria-labelledby="flashcards-modal-title"
        style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", background: CARD, borderRadius: 4, padding: "24px 24px 22px", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 id="flashcards-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <LayersIcon size={19} color={BRASS} /> {tr(isAr, "Flashcards", "بطاقات تعليمية")}
            {sectionLabel && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>· {sectionLabel}</span>}
          </h2>
          <button onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)" }}><XIcon size={20} /></button>
        </div>

        {!deck && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontFamily: "'Source Sans 3', sans-serif", color: "var(--muted-strong)", fontSize: 14, margin: "0 0 14px" }}>
              {tr(isAr,
                "Flip through your words one at a time. Tap a card to reveal the meaning, then mark whether you knew it.",
                "قلّب على كلماتك واحدة واحدة. اضغط على البطاقة عشان تشوف المعنى، وبعدين حدد هل كنت عارفها ولا لسه.")}
            </p>
            <label style={labelStyle}>{tr(isAr, "Which words?", "أنهي كلمات؟")}</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              {[
                { key: "all", label: tr(isAr, "All words", "كل الكلمات") },
                { key: "studied", label: tr(isAr, "Studied only", "المدروسة بس") },
                { key: "favorites", label: tr(isAr, "Favorites only", "المفضلة بس") },
              ].map((opt) => (
                <button key={opt.key} type="button" onClick={() => setFilterKey(opt.key)}
                  style={{ padding: "7px 14px", fontSize: 13, fontWeight: 600, borderRadius: 20, cursor: "pointer", border: `1px solid ${filterKey === opt.key ? cfg.accent : "rgba(var(--border-rgb),0.25)"}`, background: filterKey === opt.key ? cfg.accentSoft : "none", color: filterKey === opt.key ? cfg.accent : "var(--muted-strong)" }}>
                  {opt.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 13, color: "var(--icon-muted)", margin: "0 0 16px" }}>
              {tr(isAr, `${pool.length} word(s) in this deck.`, `${pool.length} كلمة في المجموعة دي.`)}
            </p>
            <button type="button" onClick={startDeck} disabled={pool.length === 0} className="btn-shine"
              style={{ ...primaryBtnStyle, opacity: pool.length === 0 ? 0.5 : 1, cursor: pool.length === 0 ? "default" : "pointer" }}>
              <LayersIcon size={16} /> {tr(isAr, "Start reviewing", "ابدأ المراجعة")}
            </button>
          </div>
        )}

        {current && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: "var(--icon-muted)", marginBottom: 10, textAlign: "center" }}>
              {tr(isAr, `Card ${pos + 1} of ${deck.length}`, `بطاقة ${pos + 1} من ${deck.length}`)}
            </div>
            <div key={current.id} className="flashcard-scene flashcard-enter" style={{ "--flashcard-enter-x": `${enterDir * 24}px` }}>
              <div onClick={() => setFlipped((f) => !f)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFlipped((f) => !f); } }}
                className={`flashcard-flip${flipped ? " is-flipped" : ""}`}>
                <div className="flashcard-face" style={{ border: `1px solid ${cfg.accentSoft}`, background: "var(--input-bg)" }}>
                  <span dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 30, fontWeight: 700, color: INK }}>{current.word}</span>
                  <span style={{ fontSize: 11, color: "var(--icon-muted)", marginTop: 4 }}>{tr(isAr, "Tap to flip", "اضغط عشان تقلب")}</span>
                </div>
                <div className="flashcard-face flashcard-face-back" style={{ border: `1px solid ${cfg.accent}`, background: cfg.accentSoft }}>
                  <span dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: 22, fontWeight: 700, color: cfg.accent }}>{current.meaning}</span>
                  {current.definition && <span dir="rtl" style={{ fontFamily: "'Amiri', serif", fontSize: 14, color: "var(--muted-strong)" }}>{current.definition}</span>}
                  {current.example && <span dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 13, color: "var(--icon-muted)", fontStyle: "italic" }}>{current.example}</span>}
                  <span style={{ fontSize: 11, color: "var(--icon-muted)", marginTop: 4 }}>{tr(isAr, "Tap to flip back", "اضغط عشان ترجع")}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button type="button" onClick={() => advance(false)}
                className={pulse === "learning" ? "flashcard-choice-pop" : undefined}
                style={{ flex: 1, padding: "11px 0", fontSize: 14, fontWeight: 700, borderRadius: 10, cursor: "pointer", border: "1px solid var(--danger)", background: "none", color: "var(--danger)" }}>
                {tr(isAr, "Still learning", "لسه بتعلّمها")}
              </button>
              <button type="button" onClick={() => { if (onToggleStudied && !studiedIds.has(current.id)) onToggleStudied(current.id); advance(true); }}
                className={pulse === "knew" ? "flashcard-choice-pop" : undefined}
                style={{ flex: 1, padding: "11px 0", fontSize: 14, fontWeight: 700, borderRadius: 10, cursor: "pointer", border: "none", background: cfg.accent, color: "#fff" }}>
                {tr(isAr, "Knew it", "كنت عارفها")}
              </button>
            </div>
          </div>
        )}

        {isDone && (
          <div className="flashcard-enter" style={{ marginTop: 20, textAlign: "center" }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 700, color: INK, marginBottom: 6 }}>
              {knewCount} / {deck.length}
            </div>
            <p style={{ fontSize: 14, color: "var(--muted-strong)", marginBottom: 18 }}>
              {tr(isAr, `You knew ${knewCount} and are still learning ${learningCount}.`, `كنت عارف ${knewCount} ولسه بتتعلّم ${learningCount}.`)}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button type="button" onClick={startDeck} className="btn-shine" style={{ ...primaryBtnStyle, width: "auto", padding: "11px 22px" }}>
                {tr(isAr, "Review again", "راجع تاني")}
              </button>
              <button type="button" onClick={() => setDeck(null)}
                style={{ padding: "11px 22px", fontSize: 14, fontWeight: 700, borderRadius: 10, cursor: "pointer", border: "1px solid rgba(var(--border-rgb),0.25)", background: "none", color: INK }}>
                {tr(isAr, "Change selection", "غيّر الاختيار")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FlashcardsModal;
