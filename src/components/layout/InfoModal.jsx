import { XIcon } from "../common/Icons";
import { INFO_SECTIONS } from "../../lib/config/infoSections";
import { useState } from "react";

export default function InfoModal({
  open,
  onClose,
  T,
  isAr,
}) {
  const [expanded, setExpanded] = useState(null);
  if (!open) return null;
  return (
        <div
          onClick={onClose}
          className="modal-backdrop"
          style={{
            position: "fixed", inset: 0, zIndex: 2600,
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
              maxHeight: "min(90dvh, 820px)", overflowY: "auto",
              background: "var(--card)", color: "var(--ink)",
              border: "1px solid rgba(var(--border-rgb),0.14)",
              borderRadius: 16,
              padding: "clamp(14px, 3vw, 22px)",
              boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 id="info-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>
                {T("Information", "معلومات")}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={T("Close", "إغلاق")}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <XIcon size={20} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {INFO_SECTIONS.map((s) => {
                const Icon = s.icon;
                const openSec = expanded === s.id;
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
                      onClick={() => setExpanded(openSec ? null : s.id)}
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
  );
}
