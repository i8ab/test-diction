import { XIcon, CheckIcon } from "../common/Icons";
import { EN_ACCENTS, saveEnAccent } from "../../lib/utils/speech";

export default function AccentModal({ open, onClose, T, enAccentPref, setEnAccentPref }) {
  if (!open) return null;
  return (
        <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 3600, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="accent-modal-title" className="modal-card" style={{ width: "100%", maxWidth: 400, maxHeight: "min(90dvh, 820px)", overflowY: "auto", background: "var(--card)", color: "var(--ink)", borderRadius: 18, padding: 20, boxShadow: "0 24px 50px -12px rgba(0,0,0,0.45)", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 id="accent-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700 }}>{T("Accent / dialect", "اللهجة / النطق")}</h2>
              <button type="button" onClick={onClose} aria-label={T("Close", "إغلاق")} style={{ border: "none", background: "var(--input-bg)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "var(--icon-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon size={18} /></button>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.45 }}>
              {T("Default Cambridge Dictionary accent for speaker buttons. In zoom view you can still pick US or UK per word.", "اللهجة الافتراضية من كامبريدج لأزرار السماعة. في العرض الكبير تقدر تختار أمريكي أو بريطاني لكل كلمة.")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {EN_ACCENTS.map((a) => {
                const active = enAccentPref === a.code;
                return (
                  <button key={a.code} type="button" onClick={() => { setEnAccentPref(a.code); saveEnAccent(a.code); onClose(); }} className="touch-target"
                    style={{
                      minHeight: 48, padding: "12px 14px", borderRadius: 12, cursor: "pointer", textAlign: "start",
                      fontSize: 15, fontWeight: 700, color: "var(--ink)",
                      border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                      background: active ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                    <span>{T(a.en, a.ar)}</span>
                    {active ? <CheckIcon size={16} /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
  );
}
