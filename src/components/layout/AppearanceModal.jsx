import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { tr } from "../../lib/config/i18n";
import { NavCustomizePanel, loadNavTabKeys, saveNavTabKeys } from "./MobileBottomNav";
import { XIcon, SunIcon, MoonIcon, PlusIcon, GlobeIcon, CheckIcon, ChevronIcon } from "../common/Icons";
import {
  BRAND_PRESETS,
  savePresetId,
  saveCustomGlyph,
} from "../common/BrandMark";
import {
  ACCENT_THEMES,
  SKIN_PRESETS,
  LATIN_FONTS,
  ARABIC_FONTS,
  CARD_SURFACES,
  HEADER_STYLES,
  CARD_CLARITIES,
  MODAL_STYLES,
  MOTION_SPEEDS,
  loadCustomAccentHex,
  saveCustomAccentHex,
  saveAccent,
  applyAccentTheme,
} from "../../lib/state/storage";

const sectionHeaderStyle = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "12px 14px",
  border: "none",
  borderRadius: 12,
  background: "var(--input-bg)",
  color: "var(--ink)",
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "start",
};

/** Stable accordion row — must live outside the modal so React does not
 *  remount every section on each parent render (that was resetting scroll). */
function AppearanceSection({
  id,
  title,
  summary,
  children,
  isOpen,
  onToggle,
  lang,
  sectionRef,
}) {
  return (
    <div
      ref={sectionRef}
      data-section-id={id}
      style={{
        marginBottom: 8,
        borderRadius: 14,
        border: isOpen ? "1px solid rgba(var(--border-rgb),0.18)" : "1px solid transparent",
        background: isOpen ? "color-mix(in srgb, var(--card) 92%, var(--input-bg))" : "transparent",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="touch-target"
        aria-expanded={isOpen}
        style={{
          ...sectionHeaderStyle,
          background: isOpen ? "color-mix(in srgb, var(--accent-1) 8%, var(--input-bg))" : "var(--input-bg)",
          borderRadius: isOpen ? "12px 12px 0 0" : 12,
        }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.02em" }}>{title}</span>
          {summary && !isOpen && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {summary}
            </span>
          )}
        </span>
        <span
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--card)",
            color: "var(--icon-muted)",
            transform: isOpen ? "rotate(90deg)" : (lang === "ar" ? "rotate(180deg)" : "none"),
            transition: "transform 0.15s ease",
          }}
        >
          <ChevronIcon size={16} />
        </span>
      </button>
      {isOpen && (
        <div style={{ padding: "12px 14px 14px" }}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Appearance settings with collapsible sections (accordion).
 * Logo is collapsed by default; only one section open at a time.
 */
export default function AppearanceModal({
  open,
  onClose,
  isAr = false,
  appLang = "en",
  theme,
  onToggleTheme,
  onChangeTheme = null,
  uiScale = 1,
  onChangeUiScale = null,
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
  cardHeight,
  setCardHeight,
  accentTheme = null,
  onChangeAccent = null,
  skin = "classic",
  onChangeSkin = null,
  latinFont = "source-sans",
  onChangeLatinFont = null,
  arabicFont = "amiri",
  onChangeArabicFont = null,
  reducedMotion = false,
  onChangeReducedMotion = null,
  uiSounds = false,
  onChangeUiSounds = null,
  dirOverride = "auto",
  onChangeDirOverride = null,
  cardSurface = "solid",
  onChangeCardSurface = null,
  headerStyle = "glass",
  onChangeHeaderStyle = null,
  cardClarity = "opaque",
  onChangeCardClarity = null,
  modalStyle = "glass",
  onChangeModalStyle = null,
  iconStyle = "outline",
  onChangeIconStyle = null,
  motionSpeed = "normal",
  onChangeMotionSpeed = null,
  examVisual = false,
  onChangeExamVisual = null,
}) {
  // Only one section open at a time. Logo starts closed.
  const [openSection, setOpenSection] = useState("mode");
  const scrollRef = useRef(null);
  const sectionRefs = useRef({});
  const [navKeys, setNavKeys] = useState(() => loadNavTabKeys());
  const [showNavCustomize, setShowNavCustomize] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const d = document.documentElement.getAttribute("data-device");
      if (d === "mobile" || d === "tablet") return true;
    } catch (_) {}
    return window.matchMedia("(max-width: 1023px)").matches;
  });
  useEffect(() => {
    function sync() {
      try {
        const d = document.documentElement.getAttribute("data-device");
        if (d === "mobile" || d === "tablet") {
          setShowNavCustomize(true);
          return;
        }
        if (d === "desktop") {
          setShowNavCustomize(false);
          return;
        }
      } catch (_) {}
      setShowNavCustomize(window.matchMedia("(max-width: 1023px)").matches);
    }
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  // Preserve scroll when expanding/collapsing (height change must not jump to top).
  const toggle = (id) => {
    const container = scrollRef.current;
    const y = container ? container.scrollTop : 0;
    setOpenSection((cur) => (cur === id ? null : id));
    // Restore after React commits the new height
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = y;
        }
      });
    });
  };

  if (!open || typeof document === "undefined") return null;
  const lang = appLang || (isAr ? "ar" : "en");
  const T = (en, ar, de, fr) => tr(lang, en, ar, de, fr);

  // Shared props for stable AppearanceSection (must not be an inner component).
  const sp = (id) => ({
    id,
    isOpen: openSection === id,
    onToggle: () => toggle(id),
    lang,
    sectionRef: (node) => { sectionRefs.current[id] = node; },
  });

  // Summaries when collapsed
  const brandList = Array.isArray(BRAND_PRESETS) ? BRAND_PRESETS : [];
  const activeBrand = brandList.find((p) => p && p.id === brandPresetId);
  const logoSummary = brandPresetId === "custom"
    ? T(`Custom: ${brandCustomGlyph || ""}`, `مخصص: ${brandCustomGlyph || ""}`)
    : (activeBrand
        ? T(activeBrand.en || activeBrand.id, activeBrand.ar || activeBrand.en || activeBrand.id)
        : "—");

  // Accent swatches need concrete light/dark (not "system")
  const accentMode = theme === "dark" ? "dark" : "light";

  const modeSummary =
    theme === "light" ? T("Light", "فاتح") :
    theme === "dark" ? T("Dark", "داكن") :
    T("System", "النظام");

  const skinMeta = SKIN_PRESETS && SKIN_PRESETS[skin];
  const skinSummary = skinMeta && skinMeta.label
    ? T(skinMeta.label.en, skinMeta.label.ar, skinMeta.label.de, skinMeta.label.fr)
    : "Classic";

  const layoutSummary =
    cardHeight === "compact" ? T("Thin", "رفيع") : cardHeight === "comfortable" ? T("Tall", "مرتفع") : T("Normal", "عادي");

  const accentLabel = accentTheme === "custom"
    ? T("Custom", "مخصص")
    : (ACCENT_THEMES[accentTheme]?.label
        ? T(ACCENT_THEMES[accentTheme].label.en, ACCENT_THEMES[accentTheme].label.ar)
        : accentTheme || "—");

  return createPortal(
    <div
      onClick={() => { /* Stay open unless X */ }}
      className="modal-backdrop"
      style={{
        position: "fixed", inset: 0, zIndex: 3600,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="appearance-modal-title"
        className="modal-card"
        style={{
          width: "100%", maxWidth: 400,
          maxHeight: "min(90dvh, 820px)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          background: "var(--card)", color: "var(--ink)",
          borderRadius: 18, padding: 16,
          boxShadow: "0 24px 50px -12px rgba(0,0,0,0.45)",
          border: "1px solid rgba(var(--border-rgb),0.12)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexShrink: 0 }}>
          <h2 id="appearance-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700 }}>
            {T("Appearance", "المظهر")}
          </h2>
          <button
            type="button"
            onClick={() => onClose()}
            aria-label={T("Close", "إغلاق")}
            style={{
              border: "none", background: "var(--input-bg)", borderRadius: 10,
              width: 36, height: 36, cursor: "pointer", color: "var(--icon-muted)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <XIcon size={18} />
          </button>
        </div>

        <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.45 }}>
            {T("Tap a section to expand. Only one stays open at a time.", "اضغط على قسم لفتحه. قسم واحد فقط مفتوح في نفس الوقت.")}
          </p>

          {/* ── Logo ── */}
          <AppearanceSection {...sp("logo")} title={T("Logo mark", "شعار الموقع")} summary={logoSummary}>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.4 }}>
              {T("Pick a mark for the site header. Same animation for all options.", "اختار شكل الشعار في الهيدر. نفس الحركة لكل الخيارات.")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
              {brandList.map((p) => {
                if (!p || !p.id) return null;
                const active = brandPresetId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (typeof setBrandPresetId === "function") setBrandPresetId(p.id);
                      try { savePresetId(p.id); } catch (_) {}
                      if (typeof setBrandAddMode === "function") setBrandAddMode(false);
                    }}
                    title={T(p.en, p.ar)}
                    className="touch-target"
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                      padding: "8px 4px", borderRadius: 12,
                      border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.12)",
                      background: active ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    <span
                      className="brand-mark-badge"
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "linear-gradient(145deg, var(--accent-1), var(--accent-2))",
                        boxShadow: "0 4px 12px -4px color-mix(in srgb, var(--accent-1) 50%, transparent)",
                        position: "relative", fontSize: 16,
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
            <div>
              {!brandAddMode ? (
                <button
                  type="button"
                  onClick={() => setBrandAddMode(true)}
                  className="touch-target"
                  style={{
                    width: "100%", minHeight: 44,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    borderRadius: 12,
                    border: brandPresetId === "custom" ? "2px solid var(--accent-1)" : "1px dashed rgba(var(--border-rgb),0.35)",
                    background: brandPresetId === "custom" ? "color-mix(in srgb, var(--accent-1) 10%, var(--card))" : "transparent",
                    color: "var(--ink)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
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
                      flex: 1, minHeight: 42, borderRadius: 10,
                      border: "1px solid rgba(var(--border-rgb),0.2)",
                      background: "var(--input-bg)", color: "var(--ink)",
                      padding: "8px 12px", fontSize: 16, fontFamily: "inherit",
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      minHeight: 42, padding: "0 14px", borderRadius: 10, border: "none",
                      background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                      color: "var(--on-accent, #fff)", fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <CheckIcon size={14} />
                    {T("Save", "حفظ")}
                  </button>
                </form>
              )}
            </div>
          </AppearanceSection>

          {/* ── Mode ── */}
          <AppearanceSection {...sp("mode")} title={T("Mode", "الوضع")} summary={modeSummary}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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
                  gridColumn: "1 / -1",
                }}>
                <GlobeIcon size={16} /> {T("System", "النظام")}
              </button>
            </div>
          </AppearanceSection>

          {/* ── Mood / Template ── */}
          {onChangeSkin && (
            <AppearanceSection {...sp("mood")} title={T("Mood / Template", "المزاج / القالب")} summary={skinSummary}>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.4 }}>
                {T("Change the whole look to fight boredom during long study sessions.", "غيّر الشكل كامل عشان تقلل الملل في جلسات المذاكرة الطويلة.")}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {Object.values(SKIN_PRESETS || {}).map((s) => {
                  if (!s || !s.id) return null;
                  const active = skin === s.id;
                  const pv = s.preview || { paper: "#FAFDFE", card: "#fff", ink: "#146C94", accent: "#19A7CE" };
                  const overlay = (s.bg && (s.bg.light || s.bg.dark))
                    ? (s.bg.light || s.bg.dark)
                    : `linear-gradient(135deg, ${pv.paper} 0%, ${pv.card} 100%)`;
                  const previewBg = s.bgImage
                    ? `${overlay}, url("${s.bgImage}")`
                    : overlay;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onChangeSkin(s.id)}
                      className="touch-target"
                      title={T(s.desc?.en || s.label.en, s.desc?.ar || s.label.ar)}
                      style={{
                        minHeight: 84, borderRadius: 14, cursor: "pointer",
                        border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.18)",
                        background: active ? "color-mix(in srgb, var(--accent-1) 10%, var(--card))" : "var(--input-bg)",
                        padding: 7,
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                        boxShadow: active ? "0 0 0 1px rgba(var(--focus-rgb),0.25)" : "none",
                      }}
                    >
                      <span
                        style={{
                          width: "100%", height: 36, borderRadius: 9,
                          backgroundImage: previewBg,
                          backgroundSize: "cover, cover",
                          backgroundPosition: "center, center",
                          backgroundColor: pv.paper,
                          border: `1px solid ${pv.ink}28`,
                          position: "relative", overflow: "hidden",
                          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute", bottom: 5, left: 5, right: "38%", height: 10, borderRadius: 4,
                            background: pv.card || "#fff",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                          }}
                        />
                        <span
                          style={{
                            position: "absolute", bottom: 6, right: 5, width: 18, height: 8, borderRadius: 4,
                            background: pv.accent || pv.ink, opacity: 0.95,
                          }}
                        />
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)", textAlign: "center", lineHeight: 1.2 }}>
                        {T(s.label.en, s.label.ar, s.label.de, s.label.fr)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </AppearanceSection>
          )}

          {/* ── Layout (density + card height + scale) ── */}
          <AppearanceSection {...sp("layout")} title={T("Layout & size", "التخطيط والحجم")} summary={layoutSummary}>
            {/* List density fixed to Comfortable — Compact option removed. */}
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
              {T("Card height", "ارتفاع الكارت")}
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.4 }}>
              {T("How tall word cards look (top–bottom padding).", "قد إيه ارتفاع كروت الكلمات (من فوق لتحت).")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[
                { id: "compact", en: "Thin", ar: "رفيع" },
                { id: "normal", en: "Normal", ar: "عادي" },
                { id: "comfortable", en: "Tall", ar: "مرتفع" },
              ].map((opt) => {
                const active = cardHeight === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCardHeight(opt.id)}
                    className="touch-target"
                    style={{
                      minHeight: 44, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13,
                      border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                      background: active ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                      color: "var(--ink)",
                    }}
                  >
                    {T(opt.en, opt.ar)}
                  </button>
                );
              })}
            </div>

            {typeof onChangeUiScale === "function" && (
              <>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                  {T("Text size", "حجم الخط")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
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
          </AppearanceSection>

          {/* ── Modal corners ── */}
          <AppearanceSection {...sp("corners")}
            title={T("Modal corners", "دائرية النوافذ")}
            summary={
              uiRadius === "sharp" ? T("Sharp", "حادّة") :
              uiRadius === "round" ? T("Round", "دائرية") :
              T("Soft", "ناعمة")
            }
          >
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.4 }}>
              {T("How rounded the dialog windows look.", "قد إيه زوايا نوافذ الحوار تكون مدوّرة.")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
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
          </AppearanceSection>

          {/* ── Accent color (removed: accent follows background/skin only) ── */}
          {false && onChangeAccent && (
            <AppearanceSection {...sp("accent")} title={T("Color theme", "لون الواجهة")} summary={accentLabel}>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.4 }}>
                {T("Pick a vibrant palette, or choose any custom color.", "اختار لوحة ألوان زاهية، أو لون مخصص بالكامل.")}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                {Object.entries(ACCENT_THEMES || {}).map(([key, th]) => {
                  if (!th) return null;
                  const palette = th[accentMode] || th.light || th.dark || {};
                  const swatch = palette.a1 || "#19A7CE";
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
            </AppearanceSection>
          )}

          {/* ── Fonts ── */}
          {(onChangeLatinFont || onChangeArabicFont) && (
            <AppearanceSection {...sp("fonts")}
              title={T("Fonts", "الخطوط")}
              summary={[
                LATIN_FONTS[latinFont]?.label ? T(LATIN_FONTS[latinFont].label.en, LATIN_FONTS[latinFont].label.ar) : latinFont,
                ARABIC_FONTS[arabicFont]?.label ? T(ARABIC_FONTS[arabicFont].label.en, ARABIC_FONTS[arabicFont].label.ar) : arabicFont,
              ].join(" · ")}
            >
              {onChangeLatinFont && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                    {T("English / UI font", "خط الإنجليزي / الواجهة")}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                    {Object.values(LATIN_FONTS || {}).map((f) => {
                      if (!f || !f.id) return null;
                      const active = latinFont === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => onChangeLatinFont(f.id)}
                          className="touch-target"
                          style={{
                            minHeight: 48, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13,
                            border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                            background: active ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                            color: "var(--ink)",
                            fontFamily: f.family,
                          }}
                        >
                          {T(f.label.en, f.label.ar)}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {onChangeArabicFont && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                    {T("Arabic font", "الخط العربي")}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {Object.values(ARABIC_FONTS || {}).map((f) => {
                      if (!f || !f.id) return null;
                      const active = arabicFont === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => onChangeArabicFont(f.id)}
                          className="touch-target"
                          style={{
                            minHeight: 52, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 15,
                            border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                            background: active ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                            color: "var(--ink)",
                            fontFamily: f.family,
                            direction: "rtl",
                          }}
                        >
                          {T(f.label.en, f.label.ar)}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </AppearanceSection>
          )}

          {/* Animation speed fixed to normal — setting removed. */}

          {/* Layout direction fixed to auto by language (EN→LTR, AR→RTL). */}

          {/* ── Header style ── */}
          {typeof onChangeHeaderStyle === "function" && (
            <AppearanceSection {...sp("header")}
              title={T("Header bar", "شريط الهيدر")}
              summary={HEADER_STYLES[headerStyle] ? T(HEADER_STYLES[headerStyle].label.en, HEADER_STYLES[headerStyle].label.ar) : headerStyle}
            >
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.45 }}>
                {T("Applies to header, search bar, and word-count strip. Solid = opaque. Glass = light frost. Clear = see-through but readable.", "ينطبق على الهيدر وشريط البحث وشريط عدد الكلمات. صلب = معتم. زجاجي = ضباب خفيف. شفاف = يبين اللي وراه مع بقاء النص واضح.")}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {Object.values(HEADER_STYLES || {}).map((s) => {
                  if (!s || !s.id) return null;
                  const active = headerStyle === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onChangeHeaderStyle(s.id)}
                      className="touch-target"
                      title={T(s.desc?.en || "", s.desc?.ar || "")}
                      style={{
                        minHeight: 56, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 12,
                        border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                        background: active ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                        color: "var(--ink)",
                      }}
                    >
                      {T(s.label.en, s.label.ar)}
                    </button>
                  );
                })}
              </div>
            </AppearanceSection>
          )}

          {/* Card transparency fixed to Clear only. */}

          {/* ── Modal style ── */}
          {typeof onChangeModalStyle === "function" && (
            <AppearanceSection {...sp("modalstyle")}
              title={T("Modal panels", "لوحات النوافذ")}
              summary={MODAL_STYLES[modalStyle] ? T(MODAL_STYLES[modalStyle].label.en, MODAL_STYLES[modalStyle].label.ar) : modalStyle}
            >
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.45 }}>
                {T("Every modal (Appearance, Add word, Account…). Clear = see-through but text stays sharp.", "كل مودال (المظهر، إضافة كلمة، الحساب…). شفاف = يبين اللي وراه والنص يفضل واضح.")}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {Object.values(MODAL_STYLES || {}).map((s) => {
                  if (!s || !s.id) return null;
                  const active = modalStyle === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onChangeModalStyle(s.id)}
                      className="touch-target"
                      title={T(s.desc?.en || "", s.desc?.ar || "")}
                      style={{
                        minHeight: 56, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 12,
                        border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                        background: active ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                        color: "var(--ink)",
                      }}
                    >
                      {T(s.label.en, s.label.ar)}
                    </button>
                  );
                })}
              </div>
            </AppearanceSection>
          )}

          {/* ── Card surface ── */}
          {typeof onChangeCardSurface === "function" && (
            <AppearanceSection {...sp("cardsurface")}
              title={T("Card background", "خلفية الكروت")}
              summary={CARD_SURFACES[cardSurface] ? T(CARD_SURFACES[cardSurface].label.en, CARD_SURFACES[cardSurface].label.ar) : cardSurface}
            >
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.45 }}>
                {T("Ruled / grid adapt to reading direction (EN or AR).", "المسطّر والشبكي بيتأقلموا مع اتجاه القراءة (إنجليزي أو عربي).")}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {Object.values(CARD_SURFACES || {}).map((s) => {
                  if (!s || !s.id) return null;
                  const active = cardSurface === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onChangeCardSurface(s.id)}
                      className="touch-target"
                      style={{
                        minHeight: 56, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 12,
                        border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                        background: active ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                        color: "var(--ink)",
                      }}
                    >
                      {T(s.label.en, s.label.ar)}
                    </button>
                  );
                })}
              </div>
            </AppearanceSection>
          )}

          {/* Icon style fixed to Outline — setting removed. */}

          {/* ── Exam visual ── */}
          {typeof onChangeExamVisual === "function" && (
            {showNavCustomize && (
            <AppearanceSection
              {...sp("bottomnav")}
              title={T("Bottom navigation", "شريط التنقل")}
              summary={T(`${navKeys.length} icons`, `${navKeys.length} أيقونات`)}
            >
              <NavCustomizePanel
                isAr={isAr}
                tabKeys={navKeys}
                onChangeTabKeys={(keys) => {
                  setNavKeys(keys);
                  saveNavTabKeys(keys);
                }}
              />
            </AppearanceSection>
            )}

            <AppearanceSection {...sp("examvisual")}
              title={T("Exam visual mode", "وضع الامتحان البصري")}
              summary={examVisual ? T("On", "تشغيل") : T("Off", "إيقاف")}
            >
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.4 }}>
                {T("Strict black & white interface — no accent colors, fewer distractions.", "واجهة أبيض وأسود صارمة — بدون ألوان تمييز، تشتيت أقل.")}
              </p>
              <button
                type="button"
                onClick={() => onChangeExamVisual(!examVisual)}
                className="touch-target"
                style={{
                  width: "100%", minHeight: 48, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13,
                  border: examVisual ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                  background: examVisual ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                  color: "var(--ink)",
                  display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px",
                }}
              >
                <span>{T("Strict B&W mode", "وضع أبيض وأسود")}</span>
                <span style={{
                  width: 40, height: 24, borderRadius: 12,
                  background: examVisual ? "var(--accent-1)" : "rgba(var(--border-rgb),0.25)",
                  position: "relative",
                }}>
                  <span style={{
                    position: "absolute", top: 3, width: 18, height: 18, borderRadius: "50%",
                    background: "#fff", left: examVisual ? 19 : 3,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                  }} />
                </span>
              </button>
            </AppearanceSection>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
