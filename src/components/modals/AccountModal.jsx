import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, labelStyle, inputStyle, errorStyle, primaryBtnStyle } from "../../lib/config/theme";
import { XIcon, CheckIcon, LoaderIcon, KeyIcon, UserIcon, EyeIcon, EyeOffIcon, EditIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { GenderBadge, GenderPicker } from "../common/GenderUI";

const MAX_AVATAR_BYTES = 180000; // ~180KB after compress

function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("img"));
      img.onload = () => {
        const maxSide = 256;
        let w = img.width;
        let h = img.height;
        const scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        let quality = 0.85;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length > MAX_AVATAR_BYTES && quality > 0.4) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        if (dataUrl.length > MAX_AVATAR_BYTES * 1.2) {
          reject(new Error("too_large"));
          return;
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function AccountModal({ account, onClose, onSave, isAr, lang }) {
  const safeAccount = account || {};
  account = safeAccount; // null-safe for the rest of the component
  const L = lang || (isAr ? "ar" : "en");
  const T = (en, ar, de, fr) => tr(L, en, ar, de, fr);
  const [nameInput, setNameInput] = useState(safeAccount.name || "");
  const [avatar, setAvatar] = useState(safeAccount.avatar || "");
  const [gender, setGender] = useState(safeAccount.gender === "male" || safeAccount.gender === "female" ? safeAccount.gender : "");
  const [changePassword, setChangePassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw, setShowPw] = useState(true);
  const [showPw2, setShowPw2] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function onPickPhoto(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(T("Choose an image file.", "اختار ملف صورة."));
      return;
    }
    try {
      const dataUrl = await compressImageFile(file);
      setAvatar(dataUrl);
      setError("");
    } catch (_) {
      setError(T("Could not process that image — try a smaller photo.", "تعذر معالجة الصورة — جرّب صورة أصغر."));
    }
  }

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
      avatar: avatar || "",
      gender: gender || "",
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
  const initials = (() => {
    const n = String(nameInput || account.name || "?").trim();
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  })();

  const node = (
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
        padding: "max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))",
        zIndex: 3600,
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
          borderRadius: "var(--modal-radius, 16px)",
          padding: "clamp(16px, 3vw, 24px)",
          boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
          maxHeight: "90dvh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8 }}>
          <h2 id="account-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(17px, 3vw, 19px)", fontWeight: 600, color: INK, margin: 0 }}>
            {T("My account", "حسابي")}
          </h2>
          <button onClick={onClose} className="touch-target" aria-label={T("Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", minWidth: 40, minHeight: 40 }}>
            <XIcon size={20} />
          </button>
        </div>

        {/* Profile block: photo + name (name lives here, not in the header) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 8 }}>
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                overflow: "hidden",
                border: "3px solid color-mix(in srgb, var(--accent-1) 40%, transparent)",
                background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                color: "#fff",
                fontWeight: 800,
                fontSize: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {avatar ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
            </div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: INK, textAlign: "center" }}>{nameInput || account.name}</div>
          <div style={{ fontSize: 13, color: "var(--muted-strong)", fontFamily: "ui-monospace, monospace" }} dir="ltr">
            @{account.username || "—"}
          </div>
          {gender ? (
            <div style={{ marginTop: 2 }}>
              <GenderBadge gender={gender} isAr={isAr} />
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => fileRef.current && fileRef.current.click()}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid rgba(var(--border-rgb),0.2)",
                background: "var(--input-bg)",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                color: INK,
              }}
            >
              {T("Add profile photo", "إضافة صورة الملف")}
            </button>
            {avatar ? (
              <button
                type="button"
                onClick={() => setAvatar("")}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(var(--border-rgb),0.2)",
                  background: "transparent",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  color: "var(--danger)",
                }}
              >
                {T("Remove photo", "إزالة الصورة")}
              </button>
            ) : null}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPickPhoto} />
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 10 }}>
          <label style={labelStyle} htmlFor="account-name">{T("Display name", "الاسم الظاهر")}</label>
          <input
            id="account-name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            style={{ ...inputStyle, borderRadius: 12 }}
            autoCapitalize="off"
            autoCorrect="off"
          />

          <label style={{ ...labelStyle, marginTop: 14 }}>{T("Gender", "الجنس")}</label>
          <div style={{ marginTop: 8, marginBottom: 6 }}>
            <GenderPicker value={gender} onChange={setGender} isAr={isAr} />
          </div>

          {account.role === "admin" && (
            <>
              <label style={labelStyle}>{T("Role", "الدور")}</label>
              <div style={{ ...inputStyle, background: "var(--input-bg)", color: BRASS, fontWeight: 600, borderRadius: 12 }}>{T("Admin", "مسؤول")}</div>
            </>
          )}

          <label style={labelStyle}>
            <KeyIcon size={12} style={{ marginInlineEnd: 4, verticalAlign: -1 }} />
            {T("Password", "كلمة المرور")}
          </label>
          <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
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
                }
              }}
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

          {changePassword && (
            <div style={{ marginTop: 14, padding: "14px 12px 10px", borderRadius: 14, border: "1px solid rgba(var(--accent-rgb, 25,167,206), 0.25)", background: "color-mix(in srgb, var(--accent-1) 6%, var(--input-bg))" }}>
              <label style={labelStyle} htmlFor="account-password">{T("New password", "كلمة المرور الجديدة")}</label>
              <div style={{ position: "relative" }}>
                <input id="account-password" type={showPw ? "text" : "password"} value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder={T("At least 6 characters", "٦ أحرف على الأقل")} style={pwInputStyle} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPw((v) => !v)} style={{ position: "absolute", insetInlineEnd: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", padding: 6, display: "flex" }}>
                  {showPw ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
              <label style={labelStyle} htmlFor="account-password2">{T("Confirm new password", "تأكيد كلمة المرور الجديدة")}</label>
              <div style={{ position: "relative" }}>
                <input id="account-password2" type={showPw2 ? "text" : "password"} value={password2} onChange={(e) => setPassword2(e.target.value)} style={pwInputStyle} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPw2((v) => !v)} style={{ position: "absolute", insetInlineEnd: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", padding: 6, display: "flex" }}>
                  {showPw2 ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
            </div>
          )}

          {error && <div style={errorStyle} role="alert">{error}</div>}
          <button type="submit" disabled={saving} className="touch-target" style={{ ...primaryBtnStyle, minHeight: 48, borderRadius: 12, background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))" }}>
            {saving ? <LoaderIcon size={16} /> : <CheckIcon size={16} />} {T("Save changes", "حفظ التغييرات")}
          </button>
        </form>
      </div>
    </div>
  );
  return (typeof document !== "undefined" ? createPortal(node, document.body) : null);
}

export default AccountModal;