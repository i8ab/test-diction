// Signed-in user's own account settings modal (name, role, personal code).
import { useState, useEffect } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, labelStyle, inputStyle, errorStyle, primaryBtnStyle } from "../../lib/config/theme";
import { XIcon, CopyIcon, CheckIcon, LoaderIcon } from "../common/Icons";

function AccountModal({ account, onClose, onSave, isAr }) {
  const [nameInput, setNameInput] = useState(account.name);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(account.code);
    } catch (err) {
      const ta = document.createElement("textarea");
      ta.value = account.code;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e2) {}
      document.body.removeChild(ta);
    }
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1800);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const result = await onSave(nameInput);
    setSaving(false);
    if (result && result.error) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 2000 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="account-modal-title" style={{ width: "100%", maxWidth: 440, background: CARD, borderRadius: 4, padding: "24px 24px 22px", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 id="account-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0 }}>{tr(isAr, "My account", "حسابي")}</h2>
          <button onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)" }}><XIcon size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          <label style={labelStyle} htmlFor="account-name">{tr(isAr, "Name", "الاسم")}</label>
          {account.role === "admin" ? (
            <input id="account-name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} style={inputStyle} autoFocus autoCapitalize="off" autoCorrect="off" />
          ) : (
            <div id="account-name" style={{ ...inputStyle, background: "var(--input-bg)", color: "var(--muted-strong)", fontWeight: 600 }}>
              {account.name}
            </div>
          )}

          {account.role === "admin" && (
            <>
              <label style={labelStyle}>{tr(isAr, "Role", "الدور")}</label>
              <div style={{ ...inputStyle, background: "var(--input-bg)", color: BRASS, fontWeight: 600 }}>
                {tr(isAr, "Admin", "مسؤول")}
              </div>
            </>
          )}

          <label style={labelStyle}>{tr(isAr, "Personal code", "الرمز الشخصي")}</label>
          <div
            onClick={handleCopyCode}
            title={tr(isAr, "Click to copy", "اضغط للنسخ")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCopyCode(); } }}
            style={{ ...inputStyle, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", background: codeCopied ? "var(--success-bg)" : "var(--input-bg)", userSelect: "none" }}>
            <span style={{ letterSpacing: "0.06em" }}>{account.code}</span>
            {codeCopied ? <CheckIcon size={14} color="var(--success)" /> : <CopyIcon size={14} color="var(--icon-muted)" />}
          </div>

          {error && <div style={errorStyle} role="alert" aria-live="assertive">{tr(isAr, error, error === "Enter your name." ? "أدخل اسمك." : error === "That name is already taken." ? "هذا الاسم مستخدم بالفعل." : error)}</div>}
          {account.role === "admin" && (
            <button type="submit" disabled={saving} style={primaryBtnStyle}>
              {saving ? <LoaderIcon size={16} /> : <CheckIcon size={16} />} {tr(isAr, "Save changes", "حفظ التغييرات")}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

export default AccountModal;
