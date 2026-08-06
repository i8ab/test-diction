// Signed-in user's own account settings (display name + optional password change).
import { useState, useEffect } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, labelStyle, inputStyle, errorStyle, primaryBtnStyle } from "../../lib/config/theme";
import { XIcon, CheckIcon, LoaderIcon, KeyIcon, UserIcon, EyeIcon, EyeOffIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

function AccountModal({ account, onClose, onSave, isAr, lang }) {
  const L = lang || (isAr ? "ar" : "en");
  const T = (en, ar, de, fr) => tr(L, en, ar, de, fr);
  const [nameInput, setNameInput] = useState(account.name);
  const [changePassword, setChangePassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    if (changePassword && (passwordInput || password2)) {
      if (!passwordInput) {
        setError(T("Enter a password.", "أدخل كلمة مرور."));
        setSaving(false);
        return;
      }
      if (passwordInput !== password2) {
        setError(T("Passwords do not match.", "كلمتا المرور غير متطابقتين."));
        setSaving(false);
        return;
      }
    }
    const result = await onSave({
      name: nameInput,
      password: changePassword && passwordInput ? passwordInput : undefined,
    });
    setSaving(false);
    if (result && result.error) {
      setError(result.error);
      return;
    }
    onClose();
  }

  const pwInputStyle = { ...inputStyle, paddingInlineEnd: 44 };

  return (
    <div
      onClick={onClose}
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding:
          "max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))",
        zIndex: 2000,
      }}
    >
      <BodyScrollLock />
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-card responsive-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
        style={{
          width: "100%",
          maxWidth: 440,
          background: CARD,
          borderRadius: 12,
          padding: "clamp(16px, 3vw, 24px)",
          boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
          maxHeight: "90dvh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
            gap: 8,
          }}
        >
          <h2
            id="account-modal-title"
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "clamp(17px, 3vw, 19px)",
              fontWeight: 600,
              color: INK,
              margin: 0,
            }}
          >
            {T("My account", "حسابي")}
          </h2>
          <button
            onClick={onClose}
            className="touch-target"
            aria-label={T("Close", "إغلاق")}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              color: "var(--icon-muted)",
              minWidth: 40,
              minHeight: 40,
            }}
          >
            <XIcon size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          <label style={labelStyle} htmlFor="account-name">
            {T("Display name", "الاسم الظاهر")}
          </label>
          <input
            id="account-name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            style={inputStyle}
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
          />

          <label style={labelStyle}>
            <UserIcon size={12} style={{ marginInlineEnd: 4, verticalAlign: -1 }} />
            {T("Username", "اسم المستخدم")}
          </label>
          <div
            style={{
              ...inputStyle,
              background: "var(--input-bg)",
              color: "var(--muted-strong)",
              fontFamily: "ui-monospace, monospace",
              fontWeight: 600,
            }}
            dir="ltr"
          >
            @{account.username || "—"}
          </div>

          {account.role === "admin" && (
            <>
              <label style={labelStyle}>{T("Role", "الدور")}</label>
              <div style={{ ...inputStyle, background: "var(--input-bg)", color: BRASS, fontWeight: 600 }}>
                {T("Admin", "مسؤول")}
              </div>
            </>
          )}

          {/* Password change is collapsed by default — never shown open */}
          {!changePassword ? (
            <button
              type="button"
              onClick={() => setChangePassword(true)}
              className="touch-target"
              style={{
                marginTop: 16,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                minHeight: 44,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(var(--border-rgb),0.2)",
                background: "var(--input-bg)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
                color: INK,
              }}
            >
              <KeyIcon size={15} />
              {T("Change password", "تغيير كلمة المرور")}
            </button>
          ) : (
            <div
              style={{
                marginTop: 14,
                padding: "12px 12px 4px",
                borderRadius: 10,
                border: "1px solid rgba(var(--border-rgb),0.15)",
                background: "var(--input-bg)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>
                  {T("Change password", "تغيير كلمة المرور")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setChangePassword(false);
                    setPasswordInput("");
                    setPassword2("");
                    setShowPw(false);
                    setShowPw2(false);
                  }}
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    color: "var(--muted)",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: 6,
                  }}
                >
                  {T("Cancel", "إلغاء")}
                </button>
              </div>

              <label style={labelStyle} htmlFor="account-password">
                <KeyIcon size={12} style={{ marginInlineEnd: 4, verticalAlign: -1 }} />
                {T("New password", "كلمة المرور الجديدة")}
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="account-password"
                  type={showPw ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder={T("At least 6 characters", "٦ أحرف على الأقل")}
                  style={pwInputStyle}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? T("Hide", "إخفاء") : T("Show", "إظهار")}
                  style={{
                    position: "absolute",
                    insetInlineEnd: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    color: "var(--icon-muted)",
                    padding: 6,
                    display: "flex",
                  }}
                >
                  {showPw ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>

              <label style={labelStyle} htmlFor="account-password2">
                {T("Confirm new password", "تأكيد كلمة المرور الجديدة")}
              </label>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input
                  id="account-password2"
                  type={showPw2 ? "text" : "password"}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  style={pwInputStyle}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw2((v) => !v)}
                  aria-label={showPw2 ? T("Hide", "إخفاء") : T("Show", "إظهار")}
                  style={{
                    position: "absolute",
                    insetInlineEnd: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    color: "var(--icon-muted)",
                    padding: 6,
                    display: "flex",
                  }}
                >
                  {showPw2 ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div style={errorStyle} role="alert" aria-live="assertive">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="touch-target"
            style={{ ...primaryBtnStyle, minHeight: 48 }}
          >
            {saving ? <LoaderIcon size={16} /> : <CheckIcon size={16} />}{" "}
            {T("Save changes", "حفظ التغييرات")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AccountModal;
