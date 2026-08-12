import { createPortal } from "react-dom";
import { tr, UI_LANGS } from "../../lib/config/i18n";
import { EN_ACCENTS, loadEnAccent, saveEnAccent } from "../../lib/utils/speech";
import { ACCENT_THEMES, loadCustomAccentHex, saveCustomAccentHex, applyAccentTheme, saveAccent } from "../../lib/state/storage";
import DevicePicker from "./DevicePicker";
import { XIcon, CheckIcon } from "../common/Icons";
import { useState, useEffect } from "react";

function useT(appLang, isAr) {
  const lang = appLang || (isAr ? "ar" : "en");
  return (en, ar, de, fr) => tr(lang, en, ar, de, fr);
}

/** Device layout picker modal */
export function DeviceModeModal({ open, onClose, isAr, appLang, deviceMode, onChangeDeviceMode }) {
  if (!open || typeof document === "undefined" || typeof onChangeDeviceMode !== "function") return null;
  const T = useT(appLang, isAr);
  return createPortal(
        <div onClick={() => { /* Stay open unless X */ }} className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 3600, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="device-modal-title" style={{ background: "var(--card)", borderRadius: 16, padding: 20, width: "100%", maxWidth: 440, maxHeight: "min(90dvh, 820px)", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px -20px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexShrink: 0 }}>
              <h2 id="device-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700 }}>{T("Device layout", "واجهة الجهاز")}</h2>
              <button type="button" onClick={() => onClose()} aria-label={T("Close", "إغلاق")} style={{ border: "none", background: "var(--input-bg)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "var(--icon-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon size={18} /></button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
            <DevicePicker
              mode={deviceMode}
              onSelect={(id) => { onChangeDeviceMode(id); onClose(); }}
              isAr={isAr}
              compact
            />
            </div>
          </div>
        </div>
    ,
    document.body
  );
}

/** UI language picker */
export function LangModal({ open, onClose, isAr, appLang, onChangeAppLang }) {
  if (!open || typeof document === "undefined") return null;
  const T = useT(appLang, isAr);
  return createPortal(
        <div onClick={() => { /* Stay open unless X */ }} className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 3600, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="lang-modal-title" className="modal-card" style={{ width: "100%", maxWidth: 400, maxHeight: "min(90dvh, 820px)", overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--card)", color: "var(--ink)", borderRadius: 18, padding: 20, boxShadow: "0 24px 50px -12px rgba(0,0,0,0.45)", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexShrink: 0 }}>
              <h2 id="lang-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700 }}>{T("Language", "اللغة")}</h2>
              <button type="button" onClick={() => onClose()} aria-label={T("Close", "إغلاق")} style={{ border: "none", background: "var(--input-bg)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "var(--icon-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon size={18} /></button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
            <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.45 }}>
              {T("Changes menus, settings, and account screens — not dictionary words.", "بتغيّر القوائم والإعدادات والحساب — مش كلمات القاموس.")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {UI_LANGS.map((l) => {
                const active = lang === l.id;
                return (
                  <button key={l.id} type="button" onClick={() => { onChangeAppLang && onChangeAppLang(l.id); onClose(); }} className="touch-target"
                    style={{
                      minHeight: 48, padding: "12px 14px", borderRadius: 12, cursor: "pointer", textAlign: "start",
                      fontSize: 15, fontWeight: 700, color: "var(--ink)",
                      border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                      background: active ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                    <span>{l.native}</span>
                    {active ? <CheckIcon size={16} /> : null}
                  </button>
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

/** Color accent + English pronunciation accent */
export function AccentModal({ open, onClose, isAr, appLang, accentTheme, onChangeAccent }) {
  if (!open || typeof document === "undefined") return null;
  const T = useT(appLang, isAr);
  const [enAccentPref, setEnAccentPref] = useState(loadEnAccent);

  return createPortal(
        <div onClick={() => { /* Stay open unless X */ }} className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 3600, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="accent-modal-title" className="modal-card" style={{ width: "100%", maxWidth: 400, maxHeight: "min(90dvh, 820px)", overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--card)", color: "var(--ink)", borderRadius: 18, padding: 20, boxShadow: "0 24px 50px -12px rgba(0,0,0,0.45)", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexShrink: 0 }}>
              <h2 id="accent-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700 }}>{T("Accent / dialect", "اللهجة / النطق")}</h2>
              <button type="button" onClick={() => onClose()} aria-label={T("Close", "إغلاق")} style={{ border: "none", background: "var(--input-bg)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "var(--icon-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon size={18} /></button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
            <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.45 }}>
              {T("Default Cambridge Dictionary accent for all speaker buttons (including zoom view).", "اللهجة الافتراضية من كامبريدج لكل أزرار السماعة (بما فيها العرض الكبير).")}
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
        </div>
    ,
    document.body
  );
}
