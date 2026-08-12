// Interactive device-mode picker (mobile / tablet / desktop).
// Preference is stored per-browser so a large phone is not forced into tablet
// layout just because of width heuristics.
import { tr } from "../../lib/config/i18n";

const MODES = [
  {
    id: "mobile",
    titleEn: "Phone",
    titleAr: "موبايل",
    descEn: "App-like vertical layout · bottom-friendly controls",
    descAr: "واجهة عمودية زي التطبيق · أزرار مريحة للمس",
  },
  {
    id: "tablet",
    titleEn: "Tablet",
    titleAr: "تابلت",
    descEn: "Split-friendly layout · roomy touch targets",
    descAr: "مساحة أوسع · أهداف لمس مريحة · عرض أوضح",
  },
  {
    id: "desktop",
    titleEn: "Computer",
    titleAr: "كمبيوتر",
    descEn: "Full desktop UI · sticky A–Z rail · wide tools",
    descAr: "واجهة سطح المكتب الكاملة · قائمة حروف ثابتة",
  },
];

function PhoneSvg() {
  return (
    <svg viewBox="0 0 88 88" width="72" height="72" fill="none" aria-hidden="true">
      <rect x="26" y="8" width="36" height="72" rx="8" fill="var(--accent-1-soft)" stroke="var(--accent-1)" strokeWidth="2.5" />
      <rect x="30" y="16" width="28" height="48" rx="2" fill="var(--card)" />
      <circle cx="44" cy="72" r="3.5" fill="var(--accent-1)" />
      <rect x="38" y="11" width="12" height="3" rx="1.5" fill="rgba(var(--border-rgb),0.35)" />
      <path d="M34 28h20M34 36h14M34 44h18" stroke="var(--accent-1)" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

function TabletSvg() {
  return (
    <svg viewBox="0 0 88 88" width="72" height="72" fill="none" aria-hidden="true">
      <rect x="14" y="16" width="60" height="56" rx="6" fill="var(--accent-1-soft)" stroke="var(--accent-2)" strokeWidth="2.5" />
      <rect x="18" y="22" width="22" height="44" rx="2" fill="var(--accent-2-soft)" />
      <rect x="44" y="22" width="26" height="44" rx="2" fill="var(--card)" />
      <circle cx="44" cy="70" r="2" fill="var(--accent-2)" />
    </svg>
  );
}

function DesktopSvg() {
  return (
    <svg viewBox="0 0 88 88" width="72" height="72" fill="none" aria-hidden="true">
      <rect x="10" y="14" width="68" height="46" rx="4" fill="var(--accent-1-soft)" stroke="var(--accent-1)" strokeWidth="2.5" />
      <rect x="14" y="18" width="60" height="34" rx="2" fill="var(--card)" />
      <path d="M34 66h20" stroke="var(--accent-2)" strokeWidth="3" strokeLinecap="round" />
      <path d="M28 72h32" stroke="rgba(var(--border-rgb),0.35)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

const ICONS = { mobile: PhoneSvg, tablet: TabletSvg, desktop: DesktopSvg };

/**
 * @param {{ mode: string|null, onSelect: (id: string) => void, isAr?: boolean, compact?: boolean, title?: string }} props
 */
export default function DevicePicker({ mode, onSelect, isAr = false, compact = false, title }) {
  const heading = title || tr(isAr, "Choose your device layout", "اختر واجهة جهازك");
  return (
    <div className="device-picker" style={{ width: "100%" }}>
      <div style={{ textAlign: "center", marginBottom: compact ? 12 : 18 }}>
        <div style={{ fontSize: compact ? 14 : 16, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
          {heading}
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.5 }}>
          {tr(
            isAr,
            "Saved on this browser only — so a large phone is not treated as a tablet by mistake.",
            "يُحفظ على هذا المتصفح فقط — عشان الموبايل الكبير ما يتفتحش كأنه تابلت بالغلط."
          )}
        </p>
      </div>
      <div
        className="device-picker-grid"
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr" : "repeat(3, minmax(0, 1fr))",
          gap: compact ? 10 : 12,
        }}
      >
        {MODES.map((m) => {
          const Icon = ICONS[m.id];
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              className={`device-picker-card${active ? " is-active" : ""}`}
              onClick={() => onSelect(m.id)}
              aria-pressed={active}
              style={{
                display: "flex",
                flexDirection: compact ? "row" : "column",
                alignItems: "center",
                gap: compact ? 12 : 8,
                textAlign: compact ? "start" : "center",
                padding: compact ? "12px 14px" : "16px 12px",
                borderRadius: 16,
                border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.16)",
                background: active ? "var(--accent-1-soft)" : "var(--card)",
                cursor: "pointer",
                boxShadow: active ? "0 8px 24px -12px rgba(var(--focus-rgb),0.45)" : "0 2px 0 rgba(0,0,0,0.03)",
                transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
              }}
            >
              <span style={{ flexShrink: 0, lineHeight: 0 }}><Icon /></span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
                  {tr(isAr, m.titleEn, m.titleAr)}
                </span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--muted-strong)", lineHeight: 1.4, marginTop: 2 }}>
                  {tr(isAr, m.descEn, m.descAr)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
