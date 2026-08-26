import { useState, useEffect, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, labelStyle, primaryBtnStyle, inputStyle } from "../../lib/config/theme";
import { XIcon, WandIcon, CheckIcon } from "../common/Icons";
import HowItWorksButton from "../common/HowItWorksButton";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { SECTIONS } from "../../lib/config/sections";

/**
 * Extract candidate vocabulary from pasted text and let the user
 * pick words to add to the dictionary.
 */

function tokenize(text, section) {
  const raw = String(text || "");
  if (section === "ar-ar") {
    // Arabic words: sequences of Arabic letters
    const m = raw.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]{2,}/g) || [];
    return m.map((w) => w.trim()).filter(Boolean);
  }
  // English-ish: letter sequences
  const m = raw.match(/[A-Za-z][A-Za-z'-]{1,}/g) || [];
  return m.map((w) => w.trim()).filter(Boolean);
}

const STOP_EN = new Set(
  "a an the and or but if then else when at by for with about against between into through during before after above below to from up down in out on off over under again further once here there all any both each few more most other some such no nor not only own same so than too very can will just should now is are was were be been being have has had do does did of it this that these those i you he she we they me him her us them my your his its our their what which who whom".split(" ")
);

function uniquePreserve(list) {
  const seen = new Set();
  const out = [];
  for (const w of list) {
    const k = w.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out;
}

export default function TextExtractModal({
  section,
  entries,
  isAr,
  onClose,
  onAddWords, // async (words: {word, meaning}[]) => void
  showToast,
}) {
  const [text, setText] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [meanings, setMeanings] = useState({}); // word -> meaning draft
  const [phase, setPhase] = useState("paste"); // paste | pick | saving
  const [saving, setSaving] = useState(false);

  const cfg = SECTIONS[section] || SECTIONS["en-ar"];
  const existing = useMemo(() => {
    const set = new Set();
    for (const e of entries || []) {
      if (e.section === section) set.add(String(e.word || "").toLowerCase());
    }
    return set;
  }, [entries, section]);

  const candidates = useMemo(() => {
    let tokens = tokenize(text, section);
    if (section === "en-ar") {
      tokens = tokens.filter((w) => !STOP_EN.has(w.toLowerCase()) && w.length > 2);
    }
    tokens = uniquePreserve(tokens);
    // Prefer words not already in dictionary
    const fresh = tokens.filter((w) => !existing.has(w.toLowerCase()));
    const known = tokens.filter((w) => existing.has(w.toLowerCase()));
    return { fresh: fresh.slice(0, 80), known: known.slice(0, 40) };
  }, [text, section, existing]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(w) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w);
      else next.add(w);
      return next;
    });
  }

  function selectAllFresh() {
    setSelected(new Set(candidates.fresh));
  }

  async function handleAdd() {
    const words = [...selected].map((w) => ({
      word: w,
      meaning: (meanings[w] || "").trim(),
      section,
    }));
    if (!words.length) return;
    setSaving(true);
    try {
      if (typeof onAddWords === "function") {
        await onAddWords(words);
      }
      showToast?.(tr(isAr, `Added ${words.length} word(s)`, `تمت إضافة ${words.length} كلمة`));
      onClose();
    } catch (_) {
      showToast?.(tr(isAr, "Could not add words", "تعذر إضافة الكلمات"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={tr(isAr, "Extract words from text", "استخراج كلمات من نص")}
      style={{
        position: "fixed", inset: 0, zIndex: 6000, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.45)", padding: "max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <BodyScrollLock />
      <div
        className="modal-card responsive-modal"
        style={{
          width: "100%", maxWidth: 520, maxHeight: "92dvh", overflow: "hidden",
          display: "flex", flexDirection: "column",
          background: CARD, borderRadius: 18, padding: "18px 18px 22px",
          boxShadow: "0 24px 60px -20px rgba(0,0,0,0.45)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #af52de, #ff2d55)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
            }}>
              <WandIcon size={18} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: INK }}>
              {tr(isAr, "Extract from text", "استخراج من نص")}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <HowItWorksButton isAr={isAr} guideId="add" />
            <button type="button" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", padding: 6 }}>
            <XIcon size={20} />
          </button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>


        {phase === "paste" && (
          <div>
            <p style={{ fontSize: 14, color: "var(--muted-strong)", margin: "0 0 12px", lineHeight: 1.5 }}>
              {tr(
                isAr,
                "Paste an article, story, or notes. We'll list candidate words not yet in your dictionary.",
                "الصق مقال أو قصة أو ملاحظات. هنعرض كلمات مرشحة لسه مش في قاموسك."
              )}
            </p>
            <div style={labelStyle}>{tr(isAr, "Text", "النص")}</div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              dir={cfg.wordDir}
              placeholder={tr(isAr, "Paste text here…", "الصق النص هنا…")}
              style={{
                ...inputStyle, borderRadius: 10, minHeight: 140, resize: "vertical",
                fontFamily: cfg.wordFont, fontSize: 15, lineHeight: 1.55,
              }}
            />
            <button
              type="button"
              disabled={text.trim().length < 10}
              onClick={() => setPhase("pick")}
              style={{ ...primaryBtnStyle, opacity: text.trim().length < 10 ? 0.5 : 1 }}
            >
              {tr(isAr, "Find words", "استخرج الكلمات")}
            </button>
          </div>
        )}

        {phase === "pick" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: "var(--muted-strong)" }}>
                {tr(isAr, `${candidates.fresh.length} new · ${selected.size} selected`, `${candidates.fresh.length} جديدة · ${selected.size} محددة`)}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => setPhase("paste")} style={{
                  padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(var(--border-rgb),0.2)",
                  background: "var(--input-bg)", color: INK, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>
                  {tr(isAr, "Edit text", "تعديل النص")}
                </button>
                <button type="button" onClick={selectAllFresh} style={{
                  padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(var(--border-rgb),0.2)",
                  background: "var(--input-bg)", color: INK, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>
                  {tr(isAr, "Select all new", "تحديد الكل الجديد")}
                </button>
              </div>
            </div>

            {candidates.fresh.length === 0 && (
              <div style={{ padding: 14, borderRadius: 10, background: "var(--input-bg)", color: "var(--muted-strong)", fontSize: 14, marginBottom: 12 }}>
                {tr(isAr, "No new words found — try a longer text or another section.", "مفيش كلمات جديدة — جرّب نص أطول أو قسم تاني.")}
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {candidates.fresh.map((w) => {
                const on = selected.has(w);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => toggle(w)}
                    dir={cfg.wordDir}
                    style={{
                      padding: "8px 12px", borderRadius: 20, fontSize: 14, fontWeight: 600, cursor: "pointer",
                      border: on ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.2)",
                      background: on ? "rgba(var(--focus-rgb),0.15)" : "var(--input-bg)",
                      color: INK, fontFamily: cfg.wordFont,
                    }}
                  >
                    {on && <CheckIcon size={12} style={{ marginInlineEnd: 4 }} />}
                    {w}
                  </button>
                );
              })}
            </div>

            {selected.size > 0 && (
              <>
                <div style={labelStyle}>{tr(isAr, "Optional meanings", "معاني اختيارية")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, maxHeight: 180, overflow: "auto" }}>
                  {[...selected].map((w) => (
                    <div key={w} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span dir={cfg.wordDir} style={{ minWidth: 90, fontWeight: 700, fontSize: 14, color: INK, fontFamily: cfg.wordFont }}>{w}</span>
                      <input
                        value={meanings[w] || ""}
                        onChange={(e) => setMeanings((m) => ({ ...m, [w]: e.target.value }))}
                        dir={cfg.meaningDir}
                        placeholder={tr(isAr, "Meaning…", "المعنى…")}
                        style={{ ...inputStyle, flex: 1, margin: 0, borderRadius: 8, padding: "8px 10px", fontSize: 14 }}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {candidates.known.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "var(--muted-strong)", marginBottom: 6 }}>
                  {tr(isAr, "Already in dictionary (skipped)", "موجودة في القاموس (تم تخطيها)")}
                </div>
                <div style={{ fontSize: 13, color: "var(--muted-strong)", lineHeight: 1.5 }}>
                  {candidates.known.slice(0, 20).join(" · ")}
                  {candidates.known.length > 20 ? "…" : ""}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={selected.size === 0 || saving}
              onClick={handleAdd}
              style={{ ...primaryBtnStyle, opacity: selected.size === 0 || saving ? 0.5 : 1 }}
            >
              {saving
                ? tr(isAr, "Adding…", "جاري الإضافة…")
                : tr(isAr, `Add ${selected.size} word(s)`, `أضف ${selected.size} كلمة`)}
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
