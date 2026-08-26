import { createPortal } from "react-dom";
import { tr } from "../../lib/config/i18n";
import { Z_INDEX } from "../../lib/config/zIndex";
import { XIcon, BookIcon, QuizIcon, MicIcon, LayersIcon, CheckIcon, FlameIcon, StarIcon } from "../common/Icons";
import { INFO_SECTION_DEFS } from "./headerMenuInfo";

const INFO_ICONS = {
  BookIcon, QuizIcon, MicIcon, LayersIcon, CheckIcon, FlameIcon, StarIcon,
};
const INFO_SECTIONS = INFO_SECTION_DEFS.map((s) => ({
  ...s,
  icon: INFO_ICONS[s.icon] || LayersIcon,
}));

/** In-app help / information panel. */
export default function InfoGuidePanel({
  open,
  onClose,
  isAr = false,
  appLang = "en",
  infoExpanded,
  setInfoExpanded,
}) {
  if (!open || typeof document === "undefined") return null;
  const lang = appLang || (isAr ? "ar" : "en");
  const T = (en, ar, de, fr) => tr(lang, en, ar, de, fr);
  const closeInfoModal = onClose;

  return createPortal(
        <div
          onClick={() => { /* Stay open unless X */ }}
          className="modal-backdrop"
          style={{
            position: "fixed", inset: 0, zIndex: Z_INDEX.INFO_GUIDE,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="info-modal-title"
            className="modal-card"
            style={{
              width: "100%", maxWidth: "min(440px, 100%)",
              maxHeight: "min(90dvh, 820px)", overflow: "hidden", display: "flex", flexDirection: "column",
              background: "var(--card)", color: "var(--ink)",
              border: "1px solid rgba(var(--border-rgb),0.14)",
              borderRadius: 16,
              padding: "clamp(14px, 3vw, 22px)",
              boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexShrink: 0 }}>
              <h2 id="info-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>
                {T("Information", "معلومات")}
              </h2>
              <button
                type="button"
                onClick={closeInfoModal}
                aria-label={T("Close", "إغلاق")}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {INFO_SECTIONS.map((s) => {
                const Icon = s.icon;
                const openSec = infoExpanded === s.id;
                const title = isAr ? s.titleAr : s.titleEn;
                const body = isAr ? s.bodyAr : s.bodyEn;
                return (
                  <div key={s.id} style={{
                    borderRadius: 10,
                    border: "1px solid rgba(var(--border-rgb),0.12)",
                    background: openSec ? "rgba(var(--border-rgb),0.06)" : "transparent",
                    overflow: "hidden",
                  }}>
                    <button
                      type="button"
                      onClick={() => setInfoExpanded(openSec ? null : s.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "10px 12px", border: "none", background: "transparent",
                        cursor: "pointer", color: "var(--ink)", textAlign: "start",
                      }}
                    >
                      <Icon size={14} style={{ color: "var(--accent-1)", flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{title}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{openSec ? "−" : "+"}</span>
                    </button>
                    {openSec && (
                      <ul style={{
                        margin: "0 0 12px", paddingInlineStart: 28, paddingInlineEnd: 12,
                        fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.55,
                      }}>
                        {body.map((line, i) => (
                          <li key={i} style={{ marginBottom: 5 }}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        </div>
    ,
    document.body
  );
}
