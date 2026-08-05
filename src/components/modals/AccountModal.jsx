// Signed-in user's own account settings (display name + password change).
import { useState, useEffect } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, labelStyle, inputStyle, errorStyle, primaryBtnStyle } from "../../lib/config/theme";
import { XIcon, CheckIcon, LoaderIcon, KeyIcon, UserIcon } from "../common/Icons";

function AccountModal({ account, onClose, onSave, isAr }) {
  const [nameInput, setNameInput] = useState(account.name);
  const [passwordInput, setPasswordInput] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    if (passwordInput || password2) {
      if (passwordInput !== password2) {
        setError(tr(isAr, "Passwords do not match.", "كلمتا المرور غير متطابقتين."));
        setSaving(false);
        return;
      }
    }
    const result = await onSave({
      name: nameInput,
      password: passwordInput || undefined,
    });
    setSaving(false);
    if (result && result.error) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))", zIndex: 2000 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card responsive-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title" style={{ width: "100%", maxWidth: 440, background: CARD, borderRadius: 12, padding: "clamp(16px, 3vw, 24px)", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)", maxHeight: "90dvh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8 }}>
          <h2 id="account-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(17px, 3vw, 19px)", fontWeight: 600, color: INK, margin: 0 }}>{tr(isAr, "My account", "حسابي")}</h2>
          <button onClick={onClose} className="touch-target" aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", minWidth: 40, minHeight: 40 }}><XIcon size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          <label style={labelStyle} htmlFor="account-name">{tr(isAr, "Display name", "الاسم الظاهر")}</label>
          <input id="account-name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} style={inputStyle} autoFocus autoCapitalize="off" autoCorrect="off" />

          <label style={labelStyle}><UserIcon size={12} style={{ marginInlineEnd: 4, verticalAlign: -1 }} />{tr(isAr, "Username", "اسم المستخدم")}</label>
          <div style={{ ...inputStyle, background: "var(--input-bg)", color: "var(--muted-strong)", fontFamily: "ui-monospace, monospace", fontWeight: 600 }} dir="ltr">
            @{account.username || "—"}
          </div>

          {account.role === "admin" && (
            <>
              <label style={labelStyle}>{tr(isAr, "Role", "الدور")}</label>
              <div style={{ ...inputStyle, background: "var(--input-bg)", color: BRASS, fontWeight: 600 }}>
                {tr(isAr, "Admin", "مسؤول")}
              </div>
            </>
          )}

          <label style={labelStyle} htmlFor="account-password"><KeyIcon size={12} style={{ marginInlineEnd: 4, verticalAlign: -1 }} />{tr(isAr, "New password (optional)", "كلمة مرور جديدة (اختياري)")}</label>
          <input id="account-password" type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder={tr(isAr, "Leave blank to keep current", "اتركه فارغًا للإبقاء على الحالية")} style={inputStyle} autoComplete="new-password" />
          <label style={labelStyle} htmlFor="account-password2">{tr(isAr, "Confirm new password", "تأكيد كلمة المرور الجديدة")}</label>
          <input id="account-password2" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} style={inputStyle} autoComplete="new-password" />

          {error && <div style={errorStyle} role="alert" aria-live="assertive">{error}</div>}
          <button type="submit" disabled={saving} className="touch-target" style={{ ...primaryBtnStyle, minHeight: 48 }}>
            {saving ? <LoaderIcon size={16} /> : <CheckIcon size={16} />} {tr(isAr, "Save changes", "حفظ التغييرات")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AccountModal;
