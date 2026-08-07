/**
 * Site brand: Bacaloria Community — logo badge + title.
 * Badge content is a selectable preset (or custom glyph). All presets share
 * the same badge shell + CSS animations (pulse, shine, ring).
 */
import { useEffect, useState, useRef } from "react";
import { tr } from "../../lib/config/i18n";
import { XIcon, CheckIcon, PlusIcon } from "./Icons";

const STORAGE_KEY = "tt_brand_mark_id";
const CUSTOM_KEY = "tt_brand_mark_custom";

/** 18+ diverse presets — content differs, animation shell is identical */
export const BRAND_PRESETS = [
  { id: "book", en: "Book", ar: "كتاب", glyph: "📖" },
  { id: "grad", en: "Graduation", ar: "تخرج", glyph: "🎓" },
  { id: "globe", en: "Globe", ar: "عالم", glyph: "🌍" },
  { id: "star", en: "Star", ar: "نجمة", glyph: "⭐" },
  { id: "flame", en: "Flame", ar: "شعلة", glyph: "🔥" },
  { id: "light", en: "Idea", ar: "فكرة", glyph: "💡" },
  { id: "pencil", en: "Pencil", ar: "قلم", glyph: "✏️" },
  { id: "brain", en: "Brain", ar: "عقل", glyph: "🧠" },
  { id: "speech", en: "Chat", ar: "حوار", glyph: "💬" },
  { id: "rocket", en: "Rocket", ar: "صاروخ", glyph: "🚀" },
  { id: "trophy", en: "Trophy", ar: "كأس", glyph: "🏆" },
  { id: "target", en: "Target", ar: "هدف", glyph: "🎯" },
  { id: "spark", en: "Sparkles", ar: "لمعان", glyph: "✨" },
  { id: "leaf", en: "Growth", ar: "نمو", glyph: "🌱" },
  { id: "music", en: "Music", ar: "موسيقى", glyph: "🎵" },
  { id: "compass", en: "Compass", ar: "بوصلة", glyph: "🧭" },
  { id: "shield", en: "Shield", ar: "درع", glyph: "🛡️" },
  { id: "key", en: "Key", ar: "مفتاح", glyph: "🔑" },
  { id: "moon", en: "Moon", ar: "قمر", glyph: "🌙" },
  { id: "sun", en: "Sun", ar: "شمس", glyph: "☀️" },
  { id: "heart", en: "Heart", ar: "قلب", glyph: "💙" },
  { id: "puzzle", en: "Puzzle", ar: "أحجية", glyph: "🧩" },
  { id: "timer", en: "Timer", ar: "مؤقت", glyph: "⏱️" },
  { id: "flag", en: "Flag", ar: "علم", glyph: "🚩" },
];

function loadPresetId() {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    if (id === "custom") return "custom";
    if (id && BRAND_PRESETS.some((p) => p.id === id)) return id;
  } catch (_) {}
  return "book";
}

function loadCustomGlyph() {
  try {
    const g = localStorage.getItem(CUSTOM_KEY);
    if (g && g.trim()) return g.trim().slice(0, 4);
  } catch (_) {}
  return "✨";
}

function savePresetId(id) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch (_) {}
}

function saveCustomGlyph(g) {
  try { localStorage.setItem(CUSTOM_KEY, g); } catch (_) {}
}

function BadgeShell({ sizeCfg, children, interactive, onClick, title }) {
  return (
    <button
      type="button"
      className="brand-mark-badge"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={!interactive}
      style={{
        width: sizeCfg.badge,
        height: sizeCfg.badge,
        borderRadius: sizeCfg.radius,
        position: "relative",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(145deg, var(--accent-1), var(--accent-2))",
        color: "#fff",
        boxShadow: "0 6px 16px -6px color-mix(in srgb, var(--accent-1) 55%, transparent)",
        border: "none",
        padding: 0,
        cursor: interactive ? "pointer" : "default",
        font: "inherit",
      }}
    >
      <span className="brand-mark-badge-shine" style={{ position: "absolute", inset: 0, borderRadius: "inherit", overflow: "hidden", pointerEvents: "none" }} />
      <span
        className="brand-mark-glyph"
        style={{
          position: "relative",
          zIndex: 1,
          fontSize: sizeCfg.letter,
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "brandGlyphPop 0.35s ease both",
        }}
      >
        {children}
      </span>
      <span
        className="brand-mark-ring"
        style={{
          position: "absolute",
          inset: -4,
          borderRadius: sizeCfg.radius + 4,
          border: "1.5px solid color-mix(in srgb, var(--accent-1) 40%, transparent)",
          pointerEvents: "none",
        }}
      />
    </button>
  );
}

export default function BrandMark({ size = "md", showUnderline = false, isAr = false, editable = true }) {
  const sizeCfg = {
    sm: { badge: 32, font: 16, gap: 8, radius: 10, letter: 16 },
    md: { badge: 38, font: 18, gap: 10, radius: 11, letter: 18 },
    lg: { badge: 48, font: 22, gap: 12, radius: 14, letter: 22 },
  }[size] || { badge: 38, font: 18, gap: 10, radius: 11, letter: 18 };

  const [presetId, setPresetId] = useState(loadPresetId);
  const [customGlyph, setCustomGlyph] = useState(loadCustomGlyph);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [draftCustom, setDraftCustom] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setPickerOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") {
        setAddMode(false);
        setPickerOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  const activePreset = BRAND_PRESETS.find((p) => p.id === presetId);
  const glyph =
    presetId === "custom"
      ? customGlyph
      : (activePreset ? activePreset.glyph : BRAND_PRESETS[0].glyph);

  function selectPreset(id) {
    setPresetId(id);
    savePresetId(id);
    setAddMode(false);
    setPickerOpen(false);
  }

  function submitCustom(e) {
    e.preventDefault();
    const g = (draftCustom || "").trim().slice(0, 4);
    if (!g) return;
    setCustomGlyph(g);
    saveCustomGlyph(g);
    setPresetId("custom");
    savePresetId("custom");
    setAddMode(false);
    setDraftCustom("");
    setPickerOpen(false);
  }

  return (
    <div ref={wrapRef} className="brand-mark" style={{ display: "inline-flex", alignItems: "center", gap: sizeCfg.gap, position: "relative" }}>
      <BadgeShell
        sizeCfg={sizeCfg}
        interactive={editable}
        onClick={editable ? () => { setPickerOpen((o) => !o); setAddMode(false); } : undefined}
        title={tr(isAr, "Change logo mark", "تغيير شعار الموقع")}
      >
        {glyph}
      </BadgeShell>

      <div style={{ minWidth: 0 }}>
        <div
          className="brand-mark-title"
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: sizeCfg.font,
            fontWeight: 600,
            color: "var(--ink)",
            margin: 0,
            lineHeight: 1.15,
            whiteSpace: "nowrap",
            WebkitTextFillColor: "transparent",
          }}
        >
          Bacaloria{" "}
          <span className="brand-mark-accent">Community</span>
        </div>
        {showUnderline && (
          <div
            className="brand-mark-underline"
            style={{
              width: 36,
              height: 3,
              borderRadius: 2,
              background: "linear-gradient(90deg, var(--accent-1), var(--accent-2))",
              marginTop: 6,
            }}
          />
        )}
      </div>

      {editable && pickerOpen && (
        <div
          role="dialog"
          aria-label={tr(isAr, "Logo presets", "قوالب الشعار")}
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            insetInlineStart: 0,
            zIndex: 1500,
            width: "min(320px, 92vw)",
            maxHeight: "min(70vh, 420px)",
            overflowY: "auto",
            background: "var(--card)",
            color: "var(--ink)",
            borderRadius: "var(--modal-radius, 14px)",
            border: "1px solid rgba(var(--border-rgb),0.14)",
            boxShadow: "0 16px 40px -12px rgba(0,0,0,0.4)",
            padding: 12,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{tr(isAr, "Choose a mark", "اختار شكل الشعار")}</div>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              style={{ border: "none", background: "var(--input-bg)", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <XIcon size={14} />
            </button>
          </div>

          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.4 }}>
            {tr(isAr, "All options use the same pulse & shine animation.", "كل الخيارات بنفس حركة النبض واللمعان.")}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {BRAND_PRESETS.map((p) => {
              const active = presetId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPreset(p.id)}
                  title={tr(isAr, p.en, p.ar)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    padding: "8px 4px",
                    borderRadius: 12,
                    border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.12)",
                    background: active ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <span
                    className="brand-mark-badge"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 11,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(145deg, var(--accent-1), var(--accent-2))",
                      boxShadow: "0 4px 12px -4px color-mix(in srgb, var(--accent-1) 50%, transparent)",
                      position: "relative",
                      fontSize: 18,
                    }}
                  >
                    <span className="brand-mark-badge-shine" style={{ position: "absolute", inset: 0, borderRadius: "inherit", overflow: "hidden" }} />
                    <span className="brand-mark-glyph" style={{ position: "relative", zIndex: 1, animation: "brandGlyphPop 0.35s ease both" }}>{p.glyph}</span>
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-strong)", textAlign: "center", lineHeight: 1.2 }}>
                    {tr(isAr, p.en, p.ar)}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 12, borderTop: "1px solid rgba(var(--border-rgb),0.1)", paddingTop: 12 }}>
            {!addMode ? (
              <button
                type="button"
                onClick={() => setAddMode(true)}
                style={{
                  width: "100%",
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderRadius: 12,
                  border: "1px dashed rgba(var(--border-rgb),0.35)",
                  background: "transparent",
                  color: "var(--ink)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <PlusIcon size={16} />
                {tr(isAr, "Add your own mark here", "ميزة إضافة حاجة هنا")}
              </button>
            ) : (
              <form onSubmit={submitCustom} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={draftCustom}
                  onChange={(e) => setDraftCustom(e.target.value.slice(0, 4))}
                  placeholder={tr(isAr, "Emoji or letter", "إيموجي أو حرف")}
                  autoFocus
                  style={{
                    flex: 1,
                    minHeight: 42,
                    borderRadius: 10,
                    border: "1px solid rgba(var(--border-rgb),0.2)",
                    background: "var(--input-bg)",
                    color: "var(--ink)",
                    padding: "8px 12px",
                    fontSize: 16,
                    fontFamily: "inherit",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    minHeight: 42,
                    padding: "0 14px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <CheckIcon size={14} />
                  {tr(isAr, "Save", "حفظ")}
                </button>
              </form>
            )}
            {presetId === "custom" && !addMode && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted-strong)", textAlign: "center" }}>
                {tr(isAr, `Current custom: ${customGlyph}`, `الحالي المخصص: ${customGlyph}`)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
