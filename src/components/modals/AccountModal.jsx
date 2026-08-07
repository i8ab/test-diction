// Signed-in user's own account settings (display name + password change).
// Password is stored hashed — we show a mask + Change button (cannot reveal real password).
import { useState, useEffect } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, labelStyle, inputStyle, errorStyle, primaryBtnStyle } from "../../lib/config/theme";
import { XIcon, CheckIcon, LoaderIcon, KeyIcon, UserIcon, EyeIcon, EyeOffIcon, EditIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

function AccountModal({ account, onClose, onSave, isAr, lang }) {
  const L = lang || (isAr ? "ar" : "en");
  const T = (en, ar, de, fr) => tr(L, en, ar, de, fr);
  const [nameInput, setNameInput] = useState(account.name);
  const [changePassword, setChangePassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [password2, setPassword2] = useState("");
  // New password fields shown as plain text by default (user asked for normal display while changing)
  const [showPw, setShowPw] = useState(true);
  const [showPw2, setShowPw2] = useState(true);
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
      if (passwordInput.length < 6) {
        setError(T("Password must be at least 6 characters.", "كلمة المرور ٦ أحرف على الأقل."));
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

  const pwInputStyle = { ...inputStyle, paddingInlineEnd: 44, borderRadius: 12 };
  const hasPassword = !!(account && account.passwordHash);

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
          borderRadius: 16,
          padding: "clamp(16px, 3vw, 24px)",
          boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
          maxHeight: "90dvh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8 }}>
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
            style={{ ...inputStyle, borderRadius: 12 }}
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
              borderRadius: 12,
            }}
            dir="ltr"
          >
            @{account.username || "—"}
          </div>

          {account.role === "admin" && (
            <>
              <label style={labelStyle}>{T("Role", "الدور")}</label>
              <div style={{ ...inputStyle, background: "var(--input-bg)", color: BRASS, fontWeight: 600, borderRadius: 12 }}>
                {T("Admin", "مسؤول")}
              </div>
            </>
          )}

          {/* Password: always visible row + Change beside it */}
          <label style={labelStyle}>
            <KeyIcon size={12} style={{ marginInlineEnd: 4, verticalAlign: -1 }} />
            {T("Password", "كلمة المرور")}
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <div
              style={{
                ...inputStyle,
                flex: 1,
                margin: 0,
                borderRadius: 12,
                background: "var(--input-bg)",
                color: INK,
                fontFamily: "ui-monospace, monospace",
                fontWeight: 700,
                letterSpacing: "0.12em",
                display: "flex",
                alignItems: "center",
              }}
              dir="ltr"
              title={T(
                "Password is stored encrypted and cannot be shown. Use Change to set a new one.",
                "كلمة المرور مشفّرة ومش ممكن نعرضها. استخدم تغيير لتعيين واحدة جديدة."
              )}
            >
              {hasPassword ? "••••••••" : T("Not set", "غير معيّنة")}
            </div>
            <button
              type="button"
              onClick={() => {
                setChangePassword((v) => !v);
                if (changePassword) {
                  setPasswordInput("");
                  setPassword2("");
                } else {
                  setShowPw(true);
                  setShowPw2(true);
                }
              }}
              className="touch-target"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "0 14px",
                minHeight: 44,
                borderRadius: 12,
                border: "1px solid rgba(var(--border-rgb),0.2)",
                background: changePassword ? "var(--accent-1-soft)" : CARD,
                color: changePassword ? "var(--accent-1)" : INK,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <EditIcon size={14} />
              {changePassword ? T("Cancel", "إلغاء") : T("Change", "تغيير")}
            </button>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--muted)", lineHeight: 1.4 }}>
            {T(
              "For security the real password is never shown. Tap Change to set a new one.",
              "للأمان كلمة المرور الحقيقية مش بتتعرض. دوس تغيير عشان تعيّن واحدة جديدة."
            )}
          </p>

          {changePassword && (
            <div
              style={{
                marginTop: 14,
                padding: "14px 12px 10px",
                borderRadius: 14,
                border: "1px solid rgba(var(--accent-rgb, 25,167,206), 0.25)",
                background: "color-mix(in srgb, var(--accent-1) 6%, var(--input-bg))",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: INK, marginBottom: 8 }}>
                {T("Set a new password", "عيّن كلمة مرور جديدة")}
              </div>

              <label style={labelStyle} htmlFor="account-password">
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
                  autoFocus
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
              <div style={{ position: "relative", marginBottom: 4 }}>
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
            style={{
              ...primaryBtnStyle,
              minHeight: 48,
              borderRadius: 12,
              background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
            }}
          >
            {saving ? <LoaderIcon size={16} /> : <CheckIcon size={16} />} {T("Save changes", "حفظ التغييرات")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AccountModal;
