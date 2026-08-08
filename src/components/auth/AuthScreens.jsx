import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
// Full-screen auth flow: intro landing, signup (name + username + password),
// pending-approval screen, restoring-session spinner, and login
// (username + password).
import { tr } from "../../lib/config/i18n";
import { INK, PAPER, BRASS, labelStyle, errorStyle, primaryBtnStyle, authCardStyle, authInputStyle, authBadgeWrapStyle } from "../../lib/config/theme";
import { translateAdminError } from "../../lib/state/logs";
import {
  SearchIcon, PlusIcon, BookIcon, LoginIcon, KeyIcon, CheckIcon,
  ChevronIcon, EditIcon, UsersIcon, SunIcon, MoonIcon, WifiOffIcon, GlobeIcon,
  QuizIcon, StatsIcon, TrophyIcon, FlameIcon, SpeakerIcon, LoaderIcon, ZoomIcon,
  LayersIcon, CalendarIcon, DownloadIcon, UserIcon, EyeIcon, EyeOffIcon, StarIcon,
} from "../common/Icons";
import BrandMark from "../common/BrandMark";
import { Shell, LanguageToggle } from "../layout/Shell";
import DevicePicker from "../layout/DevicePicker";
import { GenderPicker } from "../common/GenderUI";

const MAX_AVATAR_BYTES = 180000;

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


function AuthScreens({
  authStage, appIsAr, appLang = "en", atr, theme, toggleTheme, toggleAppLang, onChangeAppLang, deviceMode = null, onChangeDeviceMode,
  moreFeaturesOpen, setMoreFeaturesOpen, goToStage,
  name, setName,
  signupUsername, setSignupUsername,
  signupPassword, setSignupPassword,
  signupPassword2, setSignupPassword2,
  signupAvatar = "", setSignupAvatar,
  signupGender = "", setSignupGender,
  signupError, setSignupError, signupSaving, handleSignup,
  usernameInput, setUsernameInput,
  passwordInput, setPasswordInput,
  authError, setAuthError, loggingIn, handleLogin,
  linkMode = false, onCancelLink = null,
}) {
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showSignupPw2, setShowSignupPw2] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [pwRect, setPwRect] = useState(null);
  const loginPwWrapRef = useRef(null);
  const signupFileRef = useRef(null);

  // قياس موضع حقل الباسورد لعرضه فوق الستارة السودة (Portal)
  useEffect(() => {
    if (!showLoginPw) {
      setPwRect(null);
      return undefined;
    }
    function measure() {
      const el = loginPwWrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPwRect({
        top: r.top,
        left: r.left,
        width: Math.max(r.width, 200),
        height: r.height,
      });
    }
    measure();
    // إعادة القياس بعد فريم عشان الـ layout يستقر
    const id = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [showLoginPw, passwordInput, appIsAr]);

  async function onPickSignupPhoto(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file || !setSignupAvatar) return;
    if (!file.type.startsWith("image/")) {
      setSignupError(atr("Choose an image file.", "اختار ملف صورة."));
      return;
    }
    setAvatarBusy(true);
    try {
      const dataUrl = await compressImageFile(file);
      setSignupAvatar(dataUrl);
      setSignupError("");
    } catch (_) {
      setSignupError(atr("Could not process that image — try a smaller photo.", "تعذر معالجة الصورة — جرّب صورة أصغر."));
    } finally {
      setAvatarBusy(false);
    }
  }

  if (authStage === "intro") {
    // Keep the feature list focused — fewer cards = less paint work and a cleaner look
    const introFeatures = [
      { icon: SearchIcon, title: atr("Instant search", "بحث فوري"), desc: atr("Look up any word between English and Arabic in a heartbeat.", "ابحث عن أي كلمة بين الإنجليزية والعربية في لحظة.") },
      { icon: SpeakerIcon, title: atr("Cambridge pronunciation", "نطق كامبريدج"), desc: atr("American and British audio from Cambridge Dictionary, plus practice scoring.", "نطق أمريكي وبريطاني من قاموس كامبريدج مع تمرين وتقييم.") },
      { icon: QuizIcon, title: atr("Practice quizzes", "اختبارات تدريبية"), desc: atr("Quizzes, flashcards, random word, and dictation — with multi-type words labeled clearly.", "اختبارات وبطاقات وكلمة عشوائية وإملاء — مع توضيح نوع الكلمة لو ليها أكتر من معنى.") },
      { icon: EditIcon, title: atr("Grow the dictionary", "أضِف كلمات جديدة"), desc: atr("Add words with types, multiple senses, auto-fill definitions and examples.", "أضف كلمات بأنواع ومعاني متعددة وتعبئة تلقائية للتعريف والأمثلة.") },
      { icon: UsersIcon, title: atr("Shared with your group", "مشترك مع مجموعتك"), desc: atr("One dictionary for everyone, with each person's progress tracked separately.", "قاموس واحد للجميع، وتقدّم كل شخص محفوظ بشكل منفصل.") },
      { icon: StatsIcon, title: atr("Smart review (SRS)", "مراجعة ذكية"), desc: atr("Spaced-repetition brings words back right before you'd forget them.", "التكرار المتباعد بيرجّع الكلمات قبل ما تنساها.") },
      { icon: TrophyIcon, title: atr("Leaderboard", "لوحة الصدارة"), desc: atr("See how you stack up against the rest of your group.", "شوف ترتيبك مقارنة بباقي أفراد مجموعتك.") },
      { icon: WifiOffIcon, title: atr("Works offline", "يعمل بدون إنترنت"), desc: atr("Your saved words stay with you even without a connection.", "كلماتك المحفوظة تفضل معاك حتى من غير اتصال بالإنترنت.") },
    ];
    return (
      <div
        dir={appIsAr ? "rtl" : "ltr"}
        className="auth-page"
        style={{ position: "relative", minHeight: "100dvh", background: PAPER, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(var(--border-rgb),0.05) 1px, transparent 0)", backgroundSize: "20px 20px", overflowX: "hidden" }}>
        {/* Soft static wash — no continuous GPU animation on large orbs */}
        <div className="auth-orb auth-orb-static" style={{ width: 380, height: 380, top: "-12%", insetInlineStart: "-8%", background: "radial-gradient(circle, color-mix(in srgb, var(--accent-1) 55%, transparent) 0%, transparent 70%)" }} />
        <div className="auth-orb auth-orb-static" style={{ width: 300, height: 300, top: "18%", insetInlineEnd: "-10%", background: "radial-gradient(circle, color-mix(in srgb, var(--accent-2) 45%, transparent) 0%, transparent 70%)" }} />

        <div className="auth-intro-inner" style={{ position: "relative", zIndex: 1, maxWidth: "min(960px, 100%)", margin: "0 auto", padding: "clamp(16px, 3vw, 28px) clamp(14px, 4vw, 32px) clamp(40px, 6vw, 64px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "clamp(24px, 5vw, 56px)", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <BrandMark size="sm" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <button type="button" onClick={toggleTheme} className="lift-hover touch-target" aria-label={atr("Toggle theme", "تبديل المظهر")}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", color: "var(--icon-muted)", background: "var(--input-bg)", border: "1px solid rgba(var(--border-rgb),0.2)" }}>
                {theme === "dark" ? <SunIcon size={15} /> : <MoonIcon size={15} />}
              </button>
              <LanguageToggle lang={appLang} onChangeLang={onChangeAppLang} isAr={appIsAr} onToggle={toggleAppLang} floating={false} />
            </div>
          </div>

          <div className="auth-field-1" style={{ textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 650, letterSpacing: "0.04em", color: BRASS, background: "var(--accent-1-soft)", padding: "5px 12px", borderRadius: 999, marginBottom: 16 }}>
              <GlobeIcon size={12} /> {atr("English ⇄ Arabic dictionary", "قاموس إنجليزي ⇄ عربي")}
            </div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(26px, 5vw, 44px)", fontWeight: 600, color: INK, margin: "0 0 14px", lineHeight: 1.2, letterSpacing: "-0.01em" }}>
              {atr("Learn words that stick, together.", "تعلّم كلمات تثبت في ذاكرتك… مع فريقك.")}
            </h1>
            <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: "clamp(14px, 2vw, 17px)", color: "var(--muted-strong)", margin: "0 auto 26px", maxWidth: 520, lineHeight: 1.6 }}>
              {atr("A shared bilingual dictionary with pronunciation, quick quizzes and progress tracking — built for you and your study group.", "قاموس مشترك ثنائي اللغة فيه نطق واختبارات سريعة ومتابعة للتقدّم — مصمَّم لك ولمجموعتك.")}
            </p>
            <div style={{ maxWidth: 640, margin: "0 auto 24px" }}>
              <DevicePicker
                mode={deviceMode}
                onSelect={(id) => typeof onChangeDeviceMode === "function" && onChangeDeviceMode(id)}
                isAr={appIsAr}
              />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <button type="button" onClick={() => { setAuthError(""); goToStage("login"); }} className="btn-shine touch-target" style={{ ...primaryBtnStyle, width: "auto", marginTop: 0, padding: "14px 28px", minHeight: 48 }}>
                <LoginIcon size={16} /> {atr("Sign in", "تسجيل الدخول")}
              </button>
              <button type="button" onClick={() => { setSignupError(""); goToStage("signup"); }} className="lift-hover touch-target"
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 26px", minHeight: 48, fontFamily: "'Source Sans 3', sans-serif", fontSize: 15, fontWeight: 700, color: INK, background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 10, cursor: "pointer" }}>
                <PlusIcon size={16} /> {atr("Create account", "إنشاء حساب")}
              </button>
            </div>
          </div>

          <style>{`
            .auth-orb-static { animation: none !important; will-change: auto; opacity: 0.4; }
            .bento-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: clamp(36px, 5vw, 56px); }
            .bento-item { position: relative; overflow: hidden; background: var(--card); border: 1px solid rgba(var(--border-rgb),0.12); border-radius: 14px; padding: 18px 18px 16px; box-shadow: 0 1px 0 rgba(0,0,0,0.03); transition: border-color 0.2s ease, box-shadow 0.2s ease; display: flex; flex-direction: column; gap: 6px; }
            @media (hover: hover) and (pointer: fine) {
              .bento-item:hover { border-color: rgba(var(--focus-rgb),0.35); box-shadow: 0 8px 24px -16px rgba(var(--border-rgb),0.45); }
              .bento-item:hover .bento-icon { background: color-mix(in srgb, var(--accent-1) 18%, var(--accent-1-soft)); }
            }
            .bento-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: var(--accent-1-soft); color: var(--accent-1); margin-bottom: 4px; transition: background 0.2s ease; }
            @media (min-width: 720px) {
              .bento-grid { grid-template-columns: repeat(4, 1fr); gap: 14px; }
            }
            @media (max-width: 480px) {
              .bento-grid { grid-template-columns: 1fr; }
            }
          `}</style>
          <div className="bento-grid">
            {introFeatures.map((f) => (
              <div key={f.title} className="bento-item">
                <div className="bento-icon"><f.icon size={17} /></div>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: INK, margin: 0 }}>{f.title}</h3>
                <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: "var(--muted-strong)", margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (authStage === "signup") {
    return (
      <Shell>
        <div className="auth-card" style={{ ...authCardStyle, maxWidth: "min(400px, 100%)", padding: "22px 26px 26px" }} dir={appIsAr ? "rtl" : "ltr"}>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              marginBottom: 16,
              marginInline: -4,
            }}
          >
            <LanguageToggle lang={appLang} onChangeLang={onChangeAppLang} isAr={appIsAr} onToggle={toggleAppLang} floating={false} />
          </div>
          <div style={{ marginBottom: 2 }}>
            <BrandMark size="md" showUnderline />
          </div>
          <p style={{ fontFamily: "'Source Sans 3', sans-serif", color: "var(--muted-strong)", fontSize: 14, margin: "14px 0 18px", lineHeight: 1.55 }}>
            {atr(
              "Pick a display name, a unique username, and a password. An admin must approve your request before you can sign in.",
              "اختَر اسمًا ظاهرًا ويوزرنيم فريدًا وكلمة مرور. لازم الأدمن يوافق على طلبك قبل ما تقدر تسجّل دخول."
            )}
          </p>
          <form onSubmit={handleSignup}>
            <div className="auth-field-1">
              <label style={labelStyle} htmlFor="signup-name">{atr("Display name", "الاسم الظاهر")}</label>
              <input id="signup-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={atr("e.g. Omar", "مثال: عمر")} style={authInputStyle} autoFocus autoCapitalize="words" autoCorrect="off" />
            </div>

            {/* صورة الحساب (اختياري) */}
            <div className="auth-field-1" style={{ marginTop: 14, marginBottom: 4 }}>
              <label style={labelStyle}>{atr("Profile photo (optional)", "صورة الحساب (اختياري)")}</label>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    overflow: "hidden",
                    background: "var(--input-bg)",
                    border: "2px solid rgba(var(--border-rgb),0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: "var(--muted)",
                    fontWeight: 700,
                    fontSize: 18,
                  }}
                >
                  {signupAvatar ? (
                    <img src={signupAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    (name || "?").trim().charAt(0).toUpperCase()
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    type="button"
                    disabled={avatarBusy}
                    onClick={() => signupFileRef.current && signupFileRef.current.click()}
                    style={{
                      padding: "9px 14px",
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 10,
                      border: "1px solid rgba(var(--border-rgb),0.25)",
                      background: "var(--input-bg)",
                      color: INK,
                      cursor: avatarBusy ? "default" : "pointer",
                      minHeight: 40,
                    }}
                  >
                    {avatarBusy
                      ? atr("Processing…", "جارٍ المعالجة…")
                      : signupAvatar
                      ? atr("Change photo", "تغيير الصورة")
                      : atr("Add photo", "إضافة صورة")}
                  </button>
                  {signupAvatar && (
                    <button
                      type="button"
                      onClick={() => setSignupAvatar && setSignupAvatar("")}
                      style={{
                        border: "none",
                        background: "none",
                        color: "var(--danger)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: 0,
                        textAlign: "start",
                      }}
                    >
                      {atr("Remove photo", "إزالة الصورة")}
                    </button>
                  )}
                </div>
                <input
                  ref={signupFileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={onPickSignupPhoto}
                />
              </div>
            </div>

            <div className="auth-field-1" style={{ marginTop: 16, marginBottom: 4 }}>
              <label style={labelStyle}>{atr("Gender", "الجنس")} *</label>
              <div style={{ marginTop: 8 }}>
                <GenderPicker
                  value={signupGender}
                  onChange={(g) => setSignupGender && setSignupGender(g)}
                  isAr={appIsAr}
                  atr={atr}
                />
              </div>
            </div>

            <div className="auth-field-2">
              <label style={labelStyle} htmlFor="signup-username"><UserIcon size={13} style={{ marginInlineEnd: 5, verticalAlign: -2 }} />{atr("Username", "اسم المستخدم")}</label>
              <input id="signup-username" value={signupUsername} onChange={(e) => setSignupUsername(e.target.value.replace(/\s/g, "").toLowerCase())} placeholder={atr("e.g. omar_23", "مثال: omar_23")} style={{ ...authInputStyle, fontFamily: "ui-monospace, monospace", letterSpacing: "0.02em" }} autoCapitalize="off" autoCorrect="off" autoComplete="username" spellCheck={false} dir="ltr" />
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.4 }}>
                {atr("3–30 chars · letters, numbers, _ and . · like Instagram", "٣–٣٠ حرف · حروف وأرقام و _ و . · زي إنستغرام")}
              </div>
            </div>
            <div className="auth-field-3">
              <label style={labelStyle} htmlFor="signup-password"><KeyIcon size={13} style={{ marginInlineEnd: 5, verticalAlign: -2 }} />{atr("Password", "كلمة المرور")}</label>
              <input id="signup-password" type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} placeholder={atr("At least 6 characters", "٦ أحرف على الأقل")} style={authInputStyle} autoComplete="new-password" />
            </div>
            <div>
              <label style={labelStyle} htmlFor="signup-password2">{atr("Confirm password", "تأكيد كلمة المرور")}</label>
              <input id="signup-password2" type="password" value={signupPassword2} onChange={(e) => setSignupPassword2(e.target.value)} placeholder={atr("Repeat password", "أعد كتابة كلمة المرور")} style={authInputStyle} autoComplete="new-password" />
            </div>
            {signupError && <div style={errorStyle} role="alert" aria-live="assertive">{translateAdminError(signupError, appIsAr)}</div>}
            <button type="submit" disabled={signupSaving} className="btn-shine touch-target" style={{ ...primaryBtnStyle, minHeight: 48 }}>
              {signupSaving ? <LoaderIcon size={16} /> : <PlusIcon size={16} />} {atr("Request account", "طلب إنشاء حساب")}
            </button>
          </form>
          <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: "var(--muted-strong)", textAlign: "center", marginTop: 18 }}>
            {atr("Already have an account?", "عندك حساب بالفعل؟")}{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); setAuthError(""); goToStage("login"); }} className="link-underline" style={{ color: BRASS, fontWeight: 600, textDecoration: "none" }}>
              {atr("Sign in", "تسجيل الدخول")}
            </a>
          </p>
        </div>
      </Shell>
    );
  }

  if (authStage === "pendingShown") {
    return (
      <Shell>
        <div className="auth-card" style={{ ...authCardStyle, maxWidth: "min(420px, 100%)" }} dir={appIsAr ? "rtl" : "ltr"}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
            <div className="auth-badge" style={{ ...authBadgeWrapStyle, animation: "floatY 4.5s ease-in-out infinite, pulseGlow 2.2s ease-in-out infinite" }}>
              <CheckIcon size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(18px, 4vw, 22px)", fontWeight: 600, color: INK, margin: 0 }}>
                {atr("Request sent", "تم إرسال الطلب")}
              </h1>
              <div style={{ width: 34, height: 3, borderRadius: 2, background: "linear-gradient(90deg, var(--accent-1), var(--accent-2))", marginTop: 6 }} />
            </div>
          </div>
          <p style={{ fontFamily: "'Source Sans 3', sans-serif", color: "var(--muted-strong)", fontSize: 14, margin: "16px 0 18px", lineHeight: 1.7 }}>
            {atr(
              "Please wait for your request to be reviewed — up to 24 hours. Your details will be verified before activation.",
              "يُرجى انتظار مراجعة طلبك لمدة تصل إلى ٢٤ ساعة. سيتم التحقق من بياناتك قبل تفعيل الحساب."
            )}
          </p>
          <div style={{
            background: "var(--input-bg)",
            border: "1px solid rgba(var(--border-rgb),0.15)",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "var(--muted-strong)",
            lineHeight: 1.55,
          }}>
            {atr(
              "You will be able to sign in with your username and password once an admin approves your request.",
              "هتقدر تسجّل دخول باليوزرنيم وكلمة المرور بعد موافقة الأدمن على الطلب."
            )}
          </div>
          <button
            onClick={() => { setAuthError(""); goToStage("login"); }}
            className="btn-shine touch-target"
            style={{ ...primaryBtnStyle, minHeight: 48 }}>
            <LoginIcon size={16} />{atr("Go to sign in", "الذهاب لتسجيل الدخول")}
          </button>
        </div>
      </Shell>
    );
  }

  if (authStage === "restoring") {
    return (
      <Shell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--muted-strong)", animation: "fadeIn 0.4s ease" }}>
          <LoaderIcon size={18} /><span>{atr("Signing you in…", "جارٍ تسجيل الدخول…")}</span>
        </div>
      </Shell>
    );
  }

  if (authStage === "login") {
    return (
      <Shell>
        {/* Password spotlight (when revealed) */}
        {showLoginPw && typeof document !== "undefined" && createPortal(
          <>
            <div
              aria-hidden="true"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 20000,
                background: "rgba(0,0,0,0.72)",
                pointerEvents: "none",
              }}
            />
            {pwRect && (
              <div
                style={{
                  position: "fixed",
                  top: pwRect.top - 8,
                  left: pwRect.left - 8,
                  width: pwRect.width + 16,
                  zIndex: 20001,
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: "linear-gradient(165deg, #3d3200 0%, #1f1800 100%)",
                  border: "1.5px solid rgba(255, 210, 60, 0.75)",
                  boxShadow:
                    "0 0 0 1px rgba(255, 220, 80, 0.35), 0 0 28px rgba(255, 200, 0, 0.55), 0 0 60px rgba(255, 180, 0, 0.3)",
                  pointerEvents: "auto",
                }}
              >
                <label
                  style={{
                    ...labelStyle,
                    color: "#ffd54a",
                    textShadow: "0 0 10px rgba(255, 200, 0, 0.7)",
                    marginBottom: 6,
                    display: "block",
                  }}
                  htmlFor="login-password-lit"
                >
                  <KeyIcon size={13} style={{ marginInlineEnd: 5, verticalAlign: -2 }} />
                  {atr("Password", "كلمة المرور")}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="login-password-lit"
                    type="text"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder={atr("Your password", "كلمة المرور")}
                    style={{
                      ...authInputStyle,
                      paddingInlineEnd: 44,
                      width: "100%",
                      color: "#ffe566",
                      caretColor: "#ffd54a",
                      background: "#0d0a00",
                      borderColor: "#e6b800",
                      boxShadow: "0 0 0 2px rgba(255, 200, 0, 0.25)",
                      textShadow: "0 0 8px rgba(255, 220, 80, 0.45)",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                    }}
                    autoComplete="current-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPw(false)}
                    aria-label={atr("Hide", "إخفاء")}
                    style={{
                      position: "absolute",
                      insetInlineEnd: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      color: "#ffd54a",
                      padding: 6,
                      display: "flex",
                      filter: "drop-shadow(0 0 6px rgba(255,200,0,0.8))",
                    }}
                  >
                    <EyeOffIcon size={18} />
                  </button>
                </div>
              </div>
            )}
          </>,
          document.body
        )}
        <div
          className="auth-card"
          style={{
            ...authCardStyle,
            maxWidth: "min(400px, 100%)",
            position: "relative",
            zIndex: "auto",
            padding: "22px 26px 26px",
          }}
          dir={appIsAr ? "rtl" : "ltr"}
        >
          {/* Language alone on its own row — never beside the title */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              marginBottom: 16,
              marginInline: -4,
            }}
          >
            <LanguageToggle lang={appLang} onChangeLang={onChangeAppLang} isAr={appIsAr} onToggle={toggleAppLang} floating={false} />
          </div>

          {/* Brand on a separate full-width row */}
          <div style={{ marginBottom: 2 }}>
            <BrandMark size="md" showUnderline />
          </div>

          {!deviceMode && typeof onChangeDeviceMode === "function" && (
            <div style={{ margin: "12px 0 6px" }}>
              <DevicePicker
                mode={deviceMode}
                onSelect={onChangeDeviceMode}
                isAr={appIsAr}
                compact
              />
            </div>
          )}

          {linkMode ? (
            <div style={{
              margin: "14px 0 18px",
              padding: "12px 14px",
              borderRadius: 12,
              background: "var(--accent-1-soft)",
              border: "1px solid color-mix(in srgb, var(--accent-1) 35%, transparent)",
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--ink)",
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {atr("Link another account", "ربط حساب إضافي")}
              </div>
              {atr(
                "Sign in with the account you want to add. Your saved accounts stay on this device.",
                "سجّل دخول بالحساب اللي عايز تضيفه. الحسابات المحفوظة هتفضل على الجهاز."
              )}
              {typeof onCancelLink === "function" && (
                <button
                  type="button"
                  onClick={onCancelLink}
                  style={{
                    marginTop: 10,
                    border: "none",
                    background: "none",
                    color: "var(--accent-1)",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 13,
                  }}
                >
                  {atr("Cancel & return", "إلغاء والرجوع")}
                </button>
              )}
            </div>
          ) : (
            <p style={{ fontFamily: "'Source Sans 3', sans-serif", color: "var(--muted-strong)", fontSize: 14, margin: "14px 0 18px", lineHeight: 1.5 }}>
              {atr(
                "Enter your username and password.",
                "أدخل اسم المستخدم وكلمة المرور."
              )}
            </p>
          )}
          <form onSubmit={handleLogin}>
            <div className="auth-field-1">
              <label style={labelStyle} htmlFor="login-username"><UserIcon size={13} style={{ marginInlineEnd: 5, verticalAlign: -2 }} />{atr("Username", "اسم المستخدم")}</label>
              <input id="login-username" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value.replace(/\s/g, "").toLowerCase())} placeholder={atr("Your username", "اسم المستخدم")} style={{ ...authInputStyle, fontFamily: "ui-monospace, monospace" }} autoFocus autoCapitalize="off" autoCorrect="off" autoComplete="username" spellCheck={false} dir="ltr" />
            </div>
            <div
              className="auth-field-2"
              ref={loginPwWrapRef}
              style={{
                position: "relative",
                visibility: showLoginPw ? "hidden" : "visible",
              }}
            >
              <label style={labelStyle} htmlFor="login-password">
                <KeyIcon size={13} style={{ marginInlineEnd: 5, verticalAlign: -2 }} />
                {atr("Password", "كلمة المرور")}
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="login-password"
                  type={showLoginPw ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder={atr("Your password", "كلمة المرور")}
                  style={{ ...authInputStyle, paddingInlineEnd: 44 }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPw((v) => !v)}
                  aria-label={showLoginPw ? atr("Hide", "إخفاء") : atr("Show", "إظهار")}
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
                  {showLoginPw ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.4 }}>
                {atr("Legacy accounts: use your old personal code as the password once.", "الحسابات القديمة: استخدم الرمز الشخصي السابق ككلمة مرور مرة واحدة.")}
              </div>
            </div>
            {authError && <div style={errorStyle} role="alert" aria-live="assertive">{translateAdminError(authError, appIsAr)}</div>}
            <button type="submit" disabled={loggingIn} className="btn-shine auth-field-3 touch-target" style={{ ...primaryBtnStyle, minHeight: 48 }}>
              {loggingIn ? <LoaderIcon size={16} /> : <LoginIcon size={16} />} {atr("Enter", "دخول")}
            </button>
          </form>
          <p className="auth-field-3" style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: "var(--muted-strong)", textAlign: "center", marginTop: 18 }}>
            {atr("Don't have an account?", "ليس لديك حساب؟")}{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); setSignupError(""); goToStage("signup"); }} className="link-underline" style={{ color: BRASS, fontWeight: 600, textDecoration: "none" }}>
              {atr("Request one", "اطلب حسابًا")}
            </a>
          </p>
        </div>
      </Shell>
    );
  }
  return null;
}

export default AuthScreens;
