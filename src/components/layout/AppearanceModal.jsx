import { createPortal } from "react-dom";
import { XIcon, CheckIcon, SunIcon, MoonIcon, PaletteIcon } from "../common/Icons";
import {
  BRAND_PRESETS,
  loadPresetId,
  loadCustomGlyph,
  savePresetId,
  saveCustomGlyph,
} from "../common/BrandMark";
import { ACCENT_THEMES, loadCustomAccentHex, saveCustomAccentHex, applyAccentTheme, saveAccent } from "../../lib/state/storage";

export default function AppearanceModal({
  open,
  onClose,
  T,
  theme,
  onToggleTheme,
  onChangeTheme = null,
  accentTheme,
  onChangeAccent,
  brandPresetId,
  setBrandPresetId,
  brandCustomGlyph,
  setBrandCustomGlyph,
  brandAddMode,
  setBrandAddMode,
  brandDraftCustom,
  setBrandDraftCustom,
  uiDensity,
  setUiDensity,
  uiRadius,
  setUiRadius,
  onChangeUiScale = null,
  uiScale = 1,
}) {
  if (!open) return null;
  const node = (
        <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 3600, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="appearance-modal-title" className="modal-card" style={{ width: "100%", maxWidth: 400, maxHeight: "min(90dvh, 820px)", overflowY: "auto", background: "var(--card)", color: "var(--ink)", borderRadius: 18, padding: 20, boxShadow: "0 24px 50px -12px rgba(0,0,0,0.45)", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 id="appearance-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700 }}>{T("Appearance", "المظهر")}</h2>
              <button type="button" onClick={onClose} aria-label={T("Close", "إغلاق")} style={{ border: "none", background: "var(--input-bg)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "var(--icon-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon size={18} /></button>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.45 }}>
              {T("Customize logo, light/dark mode, and the accent color of the interface.", "خصّص الشعار والوضع الفاتح/الداكن ولون الواجهة.")}
            </p>

            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
              {T("Logo mark", "شعار الموقع")}
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.4 }}>
              {T("Pick a mark for the site header. Same animation for all options.", "اختار شكل الشعار في الهيدر. نفس الحركة لكل الخيارات.")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
              {BRAND_PRESETS.map((p) => {
                const active = brandPresetId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setBrandPresetId(p.id);
                      savePresetId(p.id);
                      setBrandAddMode(false);
                    }}
                    title={T(p.en, p.ar)}
                    className="touch-target"
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
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "linear-gradient(145deg, var(--accent-1), var(--accent-2))",
                        boxShadow: "0 4px 12px -4px color-mix(in srgb, var(--accent-1) 50%, transparent)",
                        position: "relative",
                        fontSize: 16,
                      }}
                    >
                      <span className="brand-mark-badge-shine" style={{ position: "absolute", inset: 0, borderRadius: "inherit", overflow: "hidden" }} />
                      <span className="brand-mark-glyph" style={{ position: "relative", zIndex: 1 }}>{p.glyph}</span>
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-strong)", textAlign: "center", lineHeight: 1.2 }}>
                      {T(p.en, p.ar)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ marginBottom: 18 }}>
              {!brandAddMode ? (
                <button
                  type="button"
                  onClick={() => setBrandAddMode(true)}
                  className="touch-target"
                  style={{
                    width: "100%",
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderRadius: 12,
                    border: brandPresetId === "custom" ? "2px solid var(--accent-1)" : "1px dashed rgba(var(--border-rgb),0.35)",
                    background: brandPresetId === "custom" ? "color-mix(in srgb, var(--accent-1) 10%, var(--card))" : "transparent",
                    color: "var(--ink)",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <PlusIcon size={16} />
                  {brandPresetId === "custom"
                    ? T(`Custom: ${brandCustomGlyph}`, `مخصص: ${brandCustomGlyph}`)
                    : T("Add your own mark", "أضف شعارك الخاص")}
                </button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const g = (brandDraftCustom || "").trim().slice(0, 4);
                    if (!g) return;
                    setBrandCustomGlyph(g);
                    saveCustomGlyph(g);
                    setBrandPresetId("custom");
                    savePresetId("custom");
                    setBrandAddMode(false);
                    setBrandDraftCustom("");
                  }}
                  style={{ display: "flex", gap: 8, alignItems: "center" }}
                >
                  <input
                    value={brandDraftCustom}
                    onChange={(e) => setBrandDraftCustom(e.target.value.slice(0, 4))}
                    placeholder={T("Emoji or letter", "إيموجي أو حرف")}
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
                    {T("Save", "حفظ")}
                  </button>
                </form>
              )}
            </div>

            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
              {T("Mode", "الوضع")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
              <button type="button" onClick={() => onChangeTheme ? onChangeTheme("light") : onToggleTheme()} className="touch-target"
                style={{
                  minHeight: 48, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13,
                  border: theme === "light" ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                  background: theme === "light" ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                  color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                <SunIcon size={16} /> {T("Light", "فاتح")}
              </button>
              <button type="button" onClick={() => onChangeTheme ? onChangeTheme("dark") : onToggleTheme()} className="touch-target"
                style={{
                  minHeight: 48, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13,
                  border: theme === "dark" ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                  background: theme === "dark" ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                  color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                <MoonIcon size={16} /> {T("Dark", "داكن")}
              </button>
              <button type="button" onClick={() => onChangeTheme && onChangeTheme("system")} className="touch-target"
                style={{
                  minHeight: 48, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13,
                  border: theme === "system" ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                  background: theme === "system" ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                  color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                <GlobeIcon size={16} /> {T("System", "النظام")}
              </button>
            </div>

            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8, marginTop: 4 }}>
              {T("List density", "كثافة القائمة")}
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.4 }}>
              {T("Comfortable = more space. Compact = tighter cards and lists.", "مريح = مسافات أكبر. مضغوط = كروت وقوائم أضيق.")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
              <button type="button" onClick={() => setUiDensity("comfortable")} className="touch-target"
                style={{
                  minHeight: 44, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13,
                  border: uiDensity === "comfortable" ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                  background: uiDensity === "comfortable" ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                  color: "var(--ink)",
                }}>
                {T("Comfortable", "مريح")}
              </button>
              <button type="button" onClick={() => setUiDensity("compact")} className="touch-target"
                style={{
                  minHeight: 44, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13,
                  border: uiDensity === "compact" ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                  background: uiDensity === "compact" ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                  color: "var(--ink)",
                }}>
                {T("Compact", "مضغوط")}
              </button>
            </div>

            {typeof onChangeUiScale === "function" && (
              <>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted-strong)", margin: "14px 0 8px" }}>
                  {T("Text size", "حجم الخط")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
                  {[0.9, 1, 1.1, 1.2].map((s) => (
                    <button key={s} type="button" onClick={() => onChangeUiScale(s)} className="touch-target"
                      style={{
                        minHeight: 44, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13,
                        border: uiScale === s ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                        background: uiScale === s ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                        color: "var(--ink)",
                      }}>
                      {s === 0.9 ? "S" : s === 1 ? "M" : s === 1.1 ? "L" : "XL"}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
              {T("Modal corners", "دائرية النوافذ")}
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.4 }}>
              {T("How rounded the dialog windows look.", "قد إيه زوايا نوافذ الحوار تكون مدوّرة.")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
              {[
                { id: "sharp", en: "Sharp", ar: "حادّة", r: 6 },
                { id: "soft", en: "Soft", ar: "ناعمة", r: 16 },
                { id: "round", en: "Round", ar: "دائرية", r: 28 },
              ].map((opt) => {
                const active = uiRadius === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setUiRadius(opt.id)}
                    className="touch-target"
                    style={{
                      minHeight: 52, borderRadius: opt.r, cursor: "pointer", fontWeight: 700, fontSize: 12,
                      border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                      background: active ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                      color: "var(--ink)",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                    }}
                  >
                    <span style={{
                      width: 28, height: 18,
                      border: "2px solid var(--accent-1)",
                      borderRadius: opt.r > 20 ? 10 : opt.r > 10 ? 6 : 2,
                      background: "color-mix(in srgb, var(--accent-1) 20%, transparent)",
                    }} />
                    {T(opt.en, opt.ar)}
                  </button>
                );
              })}
            </div>

            {onChangeAccent && (
              <>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
                  {T("Color theme", "لون الواجهة")}
                </div>
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.4 }}>
                  {T("Pick a vibrant palette, or choose any custom color.", "اختار لوحة ألوان زاهية، أو لون مخصص بالكامل.")}
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                  {Object.entries(ACCENT_THEMES).map(([key, th]) => {
                    const swatch = (th[theme] || th.light).a1;
                    const active = key === accentTheme;
                    const lab = th.label && typeof th.label === "object" ? T(th.label.en, th.label.ar) : (th.label || key);
                    return (
                      <button key={key} type="button" onClick={() => onChangeAccent(key)}
                        title={lab} aria-label={lab}
                        className="header-menu-swatch touch-target"
                        style={{
                          width: 36, height: 36, borderRadius: "50%", background: swatch, cursor: "pointer", padding: 0,
                          border: active ? "2px solid var(--ink)" : "1px solid rgba(var(--border-rgb),0.3)",
                          boxShadow: active ? `0 0 0 3px var(--card), 0 0 0 5px ${swatch}66` : "none",
                        }}
                      />
                    );
                  })}
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                  padding: "10px 12px", borderRadius: 12, background: "var(--input-bg)",
                  border: accentTheme === "custom" ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.12)",
                }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", flex: 1 }}>
                    {T("Custom color", "لون مخصص")}
                  </label>
                  <input
                    type="color"
                    defaultValue={typeof loadCustomAccentHex === "function" ? loadCustomAccentHex() : "#19A7CE"}
                    onChange={(e) => {
                      const hex = e.target.value;
                      try { saveCustomAccentHex(hex); } catch (_) {}
                      try { saveAccent("custom"); } catch (_) {}
                      if (onChangeAccent) onChangeAccent("custom");
                      try { applyAccentTheme("custom", theme, hex); } catch (_) {}
                    }}
                    style={{
                      width: 44, height: 36, border: "1px solid rgba(var(--border-rgb),0.25)",
                      borderRadius: 8, padding: 2, cursor: "pointer", background: "var(--card)",
                    }}
                    aria-label={T("Pick custom color", "اختيار لون مخصص")}
                  />
                </div>
              </>
            )}
          </div>
        </div>
  );
  return (typeof document !== "undefined" ? createPortal(node, document.body) : null);
}