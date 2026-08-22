import { useState, useEffect, useRef } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, labelStyle, inputStyle, errorStyle, primaryBtnStyle } from "../../lib/config/theme";
import { XIcon, CheckIcon, LoaderIcon, KeyIcon, UserIcon, EyeIcon, EyeOffIcon, EditIcon, CalendarIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { GenderBadge, GenderPicker } from "../common/GenderUI";
import { birthDateInputMin, birthDateInputMax, validateBirthDate } from "../../lib/utils/authUtils";
import {
  BAC_TRACKS,
  BAC_GRADES,
  getSpecialtyOptions,
} from "../../lib/config/baccalaureate";
import {
  loadXp,
  levelFromXp,
  listUnlockedBadges,
  listUnlockedFrames,
  getEquippedBadge,
  getEquippedFrame,
  setEquippedBadge,
  setEquippedFrame,
} from "../../lib/state/xp";

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

function AccountModal({
  account,
  onClose,
  onSave,
  isAr,
  lang,
  onLinkGoogle = null,
  onUnlinkGoogle = null,
  googleLinkBusy = false,
}) {
  const L = lang || (isAr ? "ar" : "en");
  const T = (en, ar, de, fr) => tr(L, en, ar, de, fr);
  const [nameInput, setNameInput] = useState(account.name || "");
  const [avatar, setAvatar] = useState(account.avatar || "");
  const [gender, setGender] = useState(account.gender === "male" || account.gender === "female" ? account.gender : "");
  const [birthDate, setBirthDate] = useState(
    account.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(String(account.birthDate)) ? String(account.birthDate) : ""
  );
  const [bacTrack, setBacTrack] = useState(account.bacTrack || "");
  const [bacGrade, setBacGrade] = useState(account.bacGrade === "2" || account.bacGrade === "3" ? account.bacGrade : "");
  const [bacSpecialty, setBacSpecialty] = useState(account.bacSpecialty || "");
  const [changePassword, setChangePassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw, setShowPw] = useState(true);
  const [showPw2, setShowPw2] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [equipTick, setEquipTick] = useState(0); // force re-read after equip change
  const fileRef = useRef(null);
  const accountCode = account && account.code ? account.code : "anon";

  // Keep local avatar in sync when parent account updates (e.g. after Google link)
  useEffect(() => {
    if (account && account.avatar !== undefined) {
      setAvatar(account.avatar || "");
    }
  }, [account && account.avatar, account && account.authProvider, account && account.socialId]);

  const googleLinked = !!(account && account.authProvider === "google" && account.socialId);
  const googleEmail = (account && account.email) || "";


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
    const bCheck = validateBirthDate(birthDate);
    if (!bCheck.ok) {
      const msg =
        bCheck.error === "Birth date can't be in the future."
          ? T("Birth date can't be in the future.", "تاريخ الميلاد مش ينفع يكون في المستقبل.")
          : bCheck.error === "You must be at least 5 years old."
          ? T("You must be at least 5 years old.", "لازم يكون عمرك ٥ سنين على الأقل.")
          : bCheck.error === "Birth date is too far in the past."
          ? T("Birth date is too far in the past.", "تاريخ الميلاد قديم زيادة.")
          : T("Enter a valid birth date.", "أدخل تاريخ ميلاد صحيح.");
      setError(msg);
      setSaving(false);
      return;
    }
    // Validate bac path if partially filled (students only — teachers have no track/grade)
    const isTeacherAccount = account.role === "teacher";
    if (!isTeacherAccount && (bacTrack || bacGrade)) {
      if (!bacTrack || !BAC_TRACKS.some((t) => t.id === bacTrack)) {
        setError(T("Choose a baccalaureate track.", "اختَر مسار البكالوريا."));
        setSaving(false);
        return;
      }
      if (bacGrade !== "2" && bacGrade !== "3") {
        setError(T("Choose your grade (2nd or 3rd secondary).", "اختَر الصف (الثاني أو الثالث)."));
        setSaving(false);
        return;
      }
      if (bacGrade === "2") {
        const opts = getSpecialtyOptions(bacTrack);
        if (opts.length && !opts.some((o) => o.id === bacSpecialty)) {
          setError(T("Choose your specialty for grade 2.", "اختَر التخصص للصف الثاني."));
          setSaving(false);
          return;
        }
      }
    }
    const result = await onSave({
      name: nameInput,
      password: changePassword && passwordInput ? passwordInput : undefined,
      avatar: avatar || "",
      gender: gender || "",
      birthDate: bCheck.birthDate,
      ...(isTeacherAccount
        ? { bacTrack: "", bacGrade: "", bacSpecialty: "" }
        : {
            bacTrack: bacTrack || "",
            bacGrade: bacGrade || "",
            bacSpecialty: bacGrade === "2" ? (bacSpecialty || "") : "",
          }),
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

  const xpInfo = (() => {
    try {
      const data = loadXp(accountCode);
      return levelFromXp(data.total);
    } catch (_) {
      return levelFromXp(0);
    }
  })();

  const unlockedBadges = listUnlockedBadges(xpInfo.total);
  const unlockedFrames = listUnlockedFrames(xpInfo.total);
  // re-read when equipTick changes
  void equipTick;
  const currentBadge = getEquippedBadge(accountCode);
  const currentFrame = getEquippedFrame(accountCode);

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
        padding: "max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))",
        zIndex: 5000,
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
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8, flexShrink: 0 }}>
          <h2 id="account-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(17px, 3vw, 19px)", fontWeight: 600, color: INK, margin: 0 }}>
            {T("My account", "حسابي")}
          </h2>
          <button onClick={onClose} className="touch-target" aria-label={T("Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", width: 36, height: 36, minWidth: 36, minHeight: 36, padding: 0, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 0 }}>
            <XIcon size={20} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
        {/* Profile block: photo + name (name lives here, not in the header) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 8 }}>
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                overflow: "hidden",
                border: currentFrame?.border || "3px solid color-mix(in srgb, var(--accent-1) 40%, transparent)",
                boxShadow: currentFrame?.glow,
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
            {currentBadge && (
              <span
                style={{
                  position: "absolute",
                  bottom: -2,
                  insetInlineEnd: -2,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#fff",
                  border: `1.5px solid ${currentBadge.color}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                }}
              >
                {currentBadge.emoji}
              </span>
            )}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: INK, textAlign: "center" }}>{nameInput || account.name}</div>
          <div style={{ fontSize: 13, color: "var(--muted-strong)", fontFamily: "ui-monospace, monospace" }} dir="ltr">
            @{account.username || "—"}
          </div>
          <div
            style={{
              marginTop: 6,
              width: "100%",
              maxWidth: 280,
              padding: "10px 12px",
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(var(--focus-rgb),0.14), rgba(var(--focus-rgb),0.05))",
              border: "1px solid rgba(var(--focus-rgb),0.22)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--accent-1)" }}>
              {T(`Level ${xpInfo.level}`, `المستوى ${xpInfo.level}`)}
              {" · "}
              {isAr ? xpInfo.titleAr : xpInfo.titleEn}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: INK, marginTop: 2 }}>
              {xpInfo.total} <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-strong)" }}>XP</span>
            </div>
            <div style={{ marginTop: 8, height: 7, borderRadius: 4, background: "rgba(var(--border-rgb),0.15)", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${xpInfo.pct}%`,
                background: "linear-gradient(90deg, var(--accent-1), var(--accent-2))",
                borderRadius: 4,
              }} />
            </div>
            <div style={{ marginTop: 5, fontSize: 11, color: "var(--muted-strong)" }}>
              {xpInfo.next
                ? T(`${xpInfo.next.xp - xpInfo.total} XP to next level`, `${xpInfo.next.xp - xpInfo.total} نقطة للمستوى التالي`)
                : T("Max level", "أعلى مستوى")}
            </div>
          </div>


          {/* ── Google account link ── */}
          {typeof onLinkGoogle === "function" && (
            <div
              style={{
                width: "100%",
                marginTop: 14,
                padding: "14px 14px 12px",
                borderRadius: 16,
                background: "linear-gradient(145deg, rgba(66,133,244,0.08) 0%, rgba(52,168,83,0.06) 50%, rgba(234,67,53,0.06) 100%)",
                border: "1px solid rgba(66,133,244,0.22)",
                boxShadow: "0 8px 24px rgba(24,35,42,0.06)",
                textAlign: "start",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: "#fff",
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    flexShrink: 0,
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--ink)", letterSpacing: "-0.01em" }}>
                    {T("Google account", "حساب Google")}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-strong)", marginTop: 3, lineHeight: 1.35 }}>
                    {googleLinked
                      ? (googleEmail
                          ? T(`Linked as ${googleEmail}`, `مربوط: ${googleEmail}`)
                          : T("Linked — you can sign in with Google", "مربوط — يمكنك الدخول بـ Google"))
                      : T("Link Google to sign in faster. Your Google photo will be used as avatar.", "اربط Google للدخول أسرع. صورة Google هتطبّق كصورة الملف.")}
                  </div>
                </div>
                {googleLinked && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "#137333",
                      background: "rgba(52,168,83,0.15)",
                      border: "1px solid rgba(52,168,83,0.35)",
                      borderRadius: 999,
                      padding: "4px 9px",
                      flexShrink: 0,
                    }}
                  >
                    {T("Linked", "مربوط")}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!googleLinked ? (
                  <button
                    type="button"
                    disabled={googleLinkBusy}
                    onClick={() => { if (typeof onLinkGoogle === "function") onLinkGoogle(); }}
                    style={{
                      flex: 1,
                      minWidth: 140,
                      minHeight: 44,
                      borderRadius: 12,
                      border: "none",
                      background: "linear-gradient(135deg, #4285F4 0%, #34A853 100%)",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: 13.5,
                      cursor: googleLinkBusy ? "wait" : "pointer",
                      opacity: googleLinkBusy ? 0.7 : 1,
                      boxShadow: "0 6px 16px rgba(66,133,244,0.35)",
                    }}
                  >
                    {googleLinkBusy
                      ? T("Connecting…", "جارٍ الربط…")
                      : T("Link Google", "ربط Google")}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={googleLinkBusy || typeof onUnlinkGoogle !== "function"}
                    onClick={() => { if (typeof onUnlinkGoogle === "function") onUnlinkGoogle(); }}
                    style={{
                      flex: 1,
                      minWidth: 140,
                      minHeight: 44,
                      borderRadius: 12,
                      border: "1px solid rgba(var(--border-rgb),0.28)",
                      background: "var(--card)",
                      color: "var(--danger, #c44)",
                      fontWeight: 700,
                      fontSize: 13.5,
                      cursor: googleLinkBusy ? "wait" : "pointer",
                      opacity: googleLinkBusy ? 0.7 : 1,
                    }}
                  >
                    {googleLinkBusy
                      ? T("Working…", "جارٍ…")
                      : T("Unlink Google", "إلغاء الربط")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current && fileRef.current.click()}
                  style={{
                    minHeight: 44,
                    padding: "0 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(var(--border-rgb),0.28)",
                    background: "var(--card)",
                    color: "var(--ink)",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {T("Change photo", "تغيير الصورة")}
                </button>
              </div>
              {googleLinked && (
                <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--muted)", lineHeight: 1.4 }}>
                  {T(
                    "You can still upload a different profile photo anytime — it won't unlink Google.",
                    "تقدر تغيّر صورة الملف في أي وقت — مش هيلغي ربط Google."
                  )}
                </p>
              )}
            </div>
          )}

          {/* Cosmetic picker — only unlocked items; tiny storage (id strings) */}

          {(unlockedBadges.length > 0 || unlockedFrames.length > 0) && (
            <div
              style={{
                width: "100%",
                marginTop: 10,
                padding: "12px 12px 10px",
                borderRadius: 12,
                background: "var(--input-bg)",
                border: "1px solid rgba(var(--border-rgb),0.14)",
                textAlign: "start",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-strong)", marginBottom: 8, letterSpacing: 0.3 }}>
                {T("Display on avatar", "المعروض على الأفاتار")}
              </div>

              {unlockedBadges.length > 0 && (
                <div style={{ marginBottom: unlockedFrames.length ? 12 : 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: INK, marginBottom: 6 }}>
                    {T("Badge", "الشارة")}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEquippedBadge(accountCode, "");
                        setEquipTick((n) => n + 1);
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: !currentBadge ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.2)",
                        background: !currentBadge ? "rgba(var(--focus-rgb),0.12)" : "var(--card, #fff)",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        color: INK,
                      }}
                    >
                      {T("None", "بدون")}
                    </button>
                    {unlockedBadges.map((b) => {
                      const active = currentBadge && currentBadge.id === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            setEquippedBadge(accountCode, b.id);
                            setEquipTick((n) => n + 1);
                          }}
                          title={isAr ? b.ar : b.en}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.2)",
                            background: active ? "rgba(var(--focus-rgb),0.12)" : "var(--card, #fff)",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                            color: INK,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span>{b.emoji}</span>
                          <span>{isAr ? b.ar : b.en}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {unlockedFrames.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: INK, marginBottom: 6 }}>
                    {T("Frame", "الإطار")}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEquippedFrame(accountCode, "");
                        setEquipTick((n) => n + 1);
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: !currentFrame ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.2)",
                        background: !currentFrame ? "rgba(var(--focus-rgb),0.12)" : "var(--card, #fff)",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        color: INK,
                      }}
                    >
                      {T("None", "بدون")}
                    </button>
                    {unlockedFrames.map((f) => {
                      const active = currentFrame && currentFrame.id === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setEquippedFrame(accountCode, f.id);
                            setEquipTick((n) => n + 1);
                          }}
                          title={isAr ? f.ar : f.en}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: active ? `2px solid var(--accent-1)` : f.border || "1px solid rgba(var(--border-rgb),0.2)",
                            boxShadow: active ? f.glow : undefined,
                            background: active ? "rgba(var(--focus-rgb),0.12)" : "var(--card, #fff)",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            color: INK,
                          }}
                        >
                          {isAr ? f.ar : f.en}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

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

          <label style={{ ...labelStyle, marginTop: 14 }} htmlFor="account-birthdate">
            <CalendarIcon size={12} style={{ marginInlineEnd: 4, verticalAlign: -1 }} />
            {T("Date of birth", "تاريخ الميلاد")}
          </label>
          <input
            id="account-birthdate"
            type="date"
            value={birthDate || ""}
            onChange={(e) => setBirthDate(e.target.value)}
            min={birthDateInputMin()}
            max={birthDateInputMax()}
            style={{ ...inputStyle, borderRadius: 12, fontFamily: "ui-monospace, monospace", direction: "ltr" }}
            dir="ltr"
            autoComplete="bday"
          />
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.4, marginBottom: 4 }}>
            {T("Optional — leave empty to clear.", "اختياري — اتركه فاضي لمسحه.")}
          </div>

          {/* Baccalaureate path — students only; teachers have no track/grade */}
          {account.role !== "teacher" && (
            <>
              <label style={{ ...labelStyle, marginTop: 14 }} htmlFor="account-bac-track">
                {T("Baccalaureate track", "مسار البكالوريا")}
              </label>
              <select
                id="account-bac-track"
                value={bacTrack || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setBacTrack(v);
                  setBacSpecialty("");
                }}
                style={{ ...inputStyle, borderRadius: 12, fontFamily: "inherit" }}
              >
                <option value="">{T("Not set", "غير محدد")}</option>
                {BAC_TRACKS.map((t) => (
                  <option key={t.id} value={t.id}>{isAr ? t.ar : t.en}</option>
                ))}
              </select>
              <label style={{ ...labelStyle, marginTop: 12 }} htmlFor="account-bac-grade">
                {T("Grade", "الصف")}
              </label>
              <select
                id="account-bac-grade"
                value={bacGrade || ""}
                onChange={(e) => {
                  setBacGrade(e.target.value);
                  if (e.target.value !== "2") setBacSpecialty("");
                }}
                style={{ ...inputStyle, borderRadius: 12, fontFamily: "inherit" }}
              >
                <option value="">{T("Not set", "غير محدد")}</option>
                {BAC_GRADES.map((g) => (
                  <option key={g.id} value={g.id}>{isAr ? g.ar : g.en}</option>
                ))}
              </select>
              {bacGrade === "2" && bacTrack && (
                <>
                  <label style={{ ...labelStyle, marginTop: 12 }} htmlFor="account-bac-specialty">
                    {T("Specialty (grade 2)", "التخصص (الصف الثاني)")}
                  </label>
                  <select
                    id="account-bac-specialty"
                    value={bacSpecialty || ""}
                    onChange={(e) => setBacSpecialty(e.target.value)}
                    style={{ ...inputStyle, borderRadius: 12, fontFamily: "inherit" }}
                  >
                    <option value="">{T("Select…", "اختَر…")}</option>
                    {getSpecialtyOptions(bacTrack).map((s) => (
                      <option key={s.id} value={s.id}>{isAr ? s.ar : s.en}</option>
                    ))}
                  </select>
                </>
              )}
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.4, marginBottom: 4 }}>
                {T("Your path is private — only you and admins (when editing your account) can see it.", "مسارك خاص — أنت والأدمن (لما يفتح حسابك) بس يشوفوه.")}
              </div>
            </>
          )}

          {(account.role === "admin" || account.role === "teacher") && (
            <>
              <label style={labelStyle}>{T("Role", "الدور")}</label>
              <div style={{ ...inputStyle, background: account.role === "admin" ? "var(--input-bg)" : "rgba(45,106,79,0.1)", color: account.role === "admin" ? BRASS : "#2d6a4f", fontWeight: 600, borderRadius: 12 }}>
                {account.role === "admin" ? T("Admin", "مسؤول") : T("Teacher", "معلّم")}
              </div>
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
    </div>
  );
}

export default AccountModal;
