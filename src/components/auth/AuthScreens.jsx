import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import "./auth.css";
// Full-screen auth flow: intro landing, signup (name + username + password),
// pending-approval screen, restoring-session spinner, and login
// (username + password).
import { tr } from "../../lib/config/i18n";
import { INK, PAPER, BRASS, labelStyle, errorStyle, primaryBtnStyle, authCardStyle, authInputStyle, authBadgeWrapStyle, socialBtnStyle } from "../../lib/config/theme";
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
import { birthDateInputMin, birthDateInputMax } from "../../lib/utils/authUtils";
import { BAC_TRACKS, BAC_GRADES, getSpecialtyOptions } from "../../lib/config/baccalaureate";

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


function GoogleGIcon() {
  // Official multicolor Google "G" mark (simplified SVG for crisp UI)
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function FacebookFIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.79-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z"
      />
    </svg>
  );
}

function SocialButtons({ atr, handleSocialLogin, busy, setBusy }) {
  if (typeof handleSocialLogin !== "function") return null;
  async function go(provider) {
    if (busy) return;
    setBusy(provider);
    try {
      await handleSocialLogin(provider);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div style={{ margin: "18px 0 6px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 14px" }}>
        <div style={{ flex: 1, height: 1, background: "rgba(var(--border-rgb),0.16)" }} />
        <span style={{ fontFamily: "var(--font-latin)", fontSize: 11.5, color: "var(--muted)", letterSpacing: "0.04em" }}>
          {atr("or continue with", "أو تابع عن طريق")}
        </span>
        <div style={{ flex: 1, height: 1, background: "rgba(var(--border-rgb),0.16)" }} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => go("google")}
          disabled={!!busy}
          style={{
            ...socialBtnStyle,
            flex: "1 1 140px",
            opacity: busy && busy !== "google" ? 0.55 : 1,
          }}
        >
          <GoogleGIcon />
          {busy === "google" ? atr("Connecting…", "جارٍ الاتصال…") : "Google"}
        </button>
        {/* Facebook sign-in removed */}
      </div>
    </div>
  );
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
  signupBirthDate = "", setSignupBirthDate,
  signupBacTrack = "", setSignupBacTrack,
  signupBacGrade = "", setSignupBacGrade,
  signupBacSpecialty = "", setSignupBacSpecialty,
  signupRole = "user", setSignupRole,
  signupError, setSignupError, signupSaving, handleSignup,
  usernameInput, setUsernameInput,
  passwordInput, setPasswordInput,
  authError, setAuthError, loggingIn, handleLogin,
  handleSocialLogin,
  linkMode = false, onCancelLink = null,
  socialDraft = null,
}) {
  const isSocialSignup = !!(socialDraft && socialDraft.provider && socialDraft.providerId);
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [lampOn, setLampOn] = useState(false);
  /** Secure login visual phases: idle | credentials | security | auth | done */
  const [loginAuthPhase, setLoginAuthPhase] = useState("idle");
  const [cordPull, setCordPull] = useState(0); // px dragged down
  const [showCordFallback, setShowCordFallback] = useState(false);
  const lampIdleTimerRef = useRef(null);
  const cordDragRef = useRef({ active: false, startY: 0, pulled: false });

  // After 80s idle with lamp still off, show a simple tap fallback
  useEffect(() => {
    if (lampOn) {
      setShowCordFallback(false);
      if (lampIdleTimerRef.current) {
        clearTimeout(lampIdleTimerRef.current);
        lampIdleTimerRef.current = null;
      }
      return undefined;
    }
    if (lampIdleTimerRef.current) clearTimeout(lampIdleTimerRef.current);
    lampIdleTimerRef.current = setTimeout(() => {
      setShowCordFallback(true);
    }, 80000);
    return () => {
      if (lampIdleTimerRef.current) clearTimeout(lampIdleTimerRef.current);
    };
  }, [lampOn]);

  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showSignupPw2, setShowSignupPw2] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [pwRect, setPwRect] = useState(null);
  // حالة نافذة اختيار الدور الموحدة (طالب / معلّم)
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [socialBusy, setSocialBusy] = useState(null);
  const loginPwWrapRef = useRef(null);
  const signupFileRef = useRef(null);
  // Local fallback so Teacher toggle works even if parent forgot to pass setSignupRole
  const [localSignupRole, setLocalSignupRole] = useState(signupRole || "user");
  // Prefer localSignupRole for instant UI feedback on click
  const effectiveRole = localSignupRole || signupRole || "user";
  const pickRole = (role) => {
    setLocalSignupRole(role);
    if (typeof setSignupRole === "function") setSignupRole(role);
  };
  useEffect(() => {
    if (typeof setSignupRole === "function" && signupRole) {
      setLocalSignupRole(signupRole);
    }
  }, [signupRole, setSignupRole]);


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
    function onKeyDown(e) {
      // Escape closes the spotlight — expected phone/desktop behavior
      if (e.key === "Escape") {
        e.preventDefault();
        setShowLoginPw(false);
      }
    }
    measure();
    // إعادة القياس بعد فريم عشان الـ layout يستقر
    const id = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("keydown", onKeyDown);
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
        style={{ position: "relative", minHeight: "100dvh", background: PAPER, overflowX: "hidden" }}>
        {/* Soft ink-wash blooms — heavily blurred, low opacity, like watercolor bleeding into paper rather than a glowing UI orb */}
        <div className="auth-orb auth-orb-static" style={{ width: 460, height: 460, top: "-16%", insetInlineStart: "-12%", filter: "blur(60px)", opacity: 0.35, background: "radial-gradient(circle, color-mix(in srgb, var(--accent-1) 40%, transparent) 0%, transparent 72%)" }} />
        <div className="auth-orb auth-orb-static" style={{ width: 360, height: 360, top: "22%", insetInlineEnd: "-14%", filter: "blur(60px)", opacity: 0.28, background: "radial-gradient(circle, color-mix(in srgb, var(--accent-2) 35%, transparent) 0%, transparent 72%)" }} />

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

            {/* زر تسجيل الدخول الموحد — يفتح نافذة اختيار الدور */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <button
                type="button"
                onClick={() => { setAuthError(""); setShowRoleModal(true); }}
                className="btn-shine touch-target"
                style={{ ...primaryBtnStyle, width: "auto", marginTop: 0, padding: "14px 32px", minHeight: 48 }}
              >
                <LoginIcon size={16} /> {atr("Login", "تسجيل الدخول")}
              </button>
              <button
                type="button"
                onClick={() => { setSignupError(""); pickRole("user"); goToStage("signup"); }}
                className="lift-hover touch-target"
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 26px", minHeight: 48, fontFamily: "'Source Sans 3', sans-serif", fontSize: 15, fontWeight: 700, color: INK, background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 10, cursor: "pointer" }}
              >
                <PlusIcon size={16} /> {atr("Create account", "إنشاء حساب")}
              </button>
            </div>

            {/* نافذة منبثقة لاختيار الدور (طالب أو معلّم) */}
            {showRoleModal && typeof document !== "undefined" && createPortal(
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="role-modal-title"
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 9999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.55)",
                  padding: 16,
                }}
                onClick={(e) => { if (e.target === e.currentTarget) setShowRoleModal(false); }}
              >
                <div
                  style={{
                    background: "var(--card)",
                    borderRadius: 16,
                    padding: "28px 24px",
                    maxWidth: 360,
                    width: "100%",
                    boxShadow: "0 20px 40px -12px rgba(0,0,0,0.35)",
                    border: "1px solid rgba(var(--border-rgb),0.15)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 id="role-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, color: INK, margin: "0 0 8px", textAlign: "center" }}>
                    {atr("Choose your role", "اختر دورك")}
                  </h2>
                  <p style={{ fontSize: 14, color: "var(--muted-strong)", margin: "0 0 20px", textAlign: "center", lineHeight: 1.5 }}>
                    {atr("Are you a student or a teacher?", "هل أنت طالب أم معلّم؟")}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <button
                      type="button"
                      className="btn-shine touch-target"
                      onClick={() => {
                        pickRole("user");
                        setShowRoleModal(false);
                        setAuthError("");
                        goToStage("login");
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        padding: "14px 20px",
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#fff",
                        background: "var(--accent-1)",
                        border: "none",
                        borderRadius: 12,
                        cursor: "pointer",
                      }}
                    >
                      <UserIcon size={18} /> {atr("Student", "طالب")}
                    </button>
                    <button
                      type="button"
                      className="lift-hover touch-target"
                      onClick={() => {
                        pickRole("teacher");
                        setShowRoleModal(false);
                        setAuthError("");
                        goToStage("login");
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        padding: "14px 20px",
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#fff",
                        background: "linear-gradient(135deg, #2d6a4f, #40916c)",
                        border: "none",
                        borderRadius: 12,
                        cursor: "pointer",
                        boxShadow: "0 4px 14px -4px rgba(45,106,79,0.45)",
                      }}
                    >
                      <UsersIcon size={18} /> {atr("Teacher", "معلّم")}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRoleModal(false)}
                    style={{
                      display: "block",
                      width: "100%",
                      marginTop: 16,
                      padding: "10px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--muted-strong)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {atr("Cancel", "إلغاء")}
                  </button>
                </div>
              </div>,
              document.body
            )}
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

  // Google onboarding: only missing required fields (separate from full signup)
  if (authStage === "completeProfile") {
    return (
      <Shell>
        <div className="auth-card" style={{ ...authCardStyle, maxWidth: "min(420px, 100%)", padding: "22px 26px 26px" }} dir={appIsAr ? "rtl" : "ltr"}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <LanguageToggle lang={appLang} onChangeLang={onChangeAppLang} isAr={appIsAr} onToggle={toggleAppLang} floating={false} />
          </div>
          <div style={{ marginBottom: 4 }}>
            <BrandMark size="md" showUnderline />
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(18px, 4vw, 22px)", fontWeight: 600, color: INK, margin: "10px 0 6px" }}>
            {atr("Complete your profile", "أكمل بياناتك")}
          </h1>
          <p style={{ fontFamily: "'Source Sans 3', sans-serif", color: "var(--muted-strong)", fontSize: 14, margin: "0 0 12px", lineHeight: 1.55 }}>
            {atr(
              `You signed in with ${socialDraft?.provider === "facebook" ? "Facebook" : "Google"}. Confirm your name and username, then fill the required fields below. You can change your name later in account settings.`,
              `سجّلت الدخول بـ ${socialDraft?.provider === "facebook" ? "Facebook" : "Google"}. أكّد الاسم واسم المستخدم، ثم أكمل الحقول المطلوبة. تقدر تغيّر اسمك لاحقًا من الإعدادات.`
            )}
          </p>
          {typeof goToStage === "function" && (
            <button
              type="button"
              onClick={() => goToStage("login")}
              style={{
                width: "100%",
                marginBottom: 14,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(24,119,242,0.35)",
                background: "rgba(24,119,242,0.08)",
                color: "var(--ink)",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                textAlign: "center",
                lineHeight: 1.4,
              }}
            >
              {atr(
                `Already have an account? Sign in to link ${socialDraft?.provider === "facebook" ? "Facebook" : "Google"}`,
                `عندك حساب بالفعل؟ سجّل دخولك لربط ${socialDraft?.provider === "facebook" ? "Facebook" : "Google"}`
              )}
            </button>
          )}
          <form
            onSubmit={(e) => {
              if (typeof setSignupRole === "function") setSignupRole(effectiveRole);
              return handleSignup(e, effectiveRole);
            }}
          >
            <div className="auth-field-1" style={{ marginBottom: 12 }}>
              <label style={labelStyle} htmlFor="cp-name">{atr("Display name", "الاسم الظاهر")}</label>
              <input id="cp-name" value={name} onChange={(e) => setName(e.target.value)} style={authInputStyle} autoCapitalize="words" />
            </div>
            <div className="auth-field-1" style={{ marginBottom: 12 }}>
              <label style={labelStyle} htmlFor="cp-username">{atr("Username", "اسم المستخدم")}</label>
              <input
                id="cp-username"
                value={signupUsername}
                onChange={(e) => { const v = e.target.value.replace(/\s/g, "").toLowerCase(); setSignupUsername(v); if (typeof setName === "function") setName(v); }}
                style={{ ...authInputStyle, fontFamily: "ui-monospace, monospace" }}
                dir="ltr"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div className="auth-field-1" style={{ marginTop: 12, marginBottom: 4 }}>
              <label style={labelStyle}>{atr("Gender", "الجنس")} *</label>
              <div style={{ marginTop: 8 }}>
                <GenderPicker value={signupGender} onChange={(g) => setSignupGender && setSignupGender(g)} isAr={appIsAr} atr={atr} />
              </div>
            </div>
            <div className="auth-field-1" style={{ marginTop: 14, marginBottom: 4 }}>
              <label style={labelStyle} htmlFor="cp-birth">{atr("Date of birth (optional)", "تاريخ الميلاد (اختياري)")}</label>
              <input
                id="cp-birth"
                type="date"
                value={signupBirthDate || ""}
                onChange={(e) => setSignupBirthDate && setSignupBirthDate(e.target.value)}
                min={birthDateInputMin()}
                max={birthDateInputMax()}
                style={{ ...authInputStyle, fontFamily: "ui-monospace, monospace", direction: "ltr" }}
                dir="ltr"
              />
            </div>
            {effectiveRole !== "teacher" && (
              <>
                <div className="auth-field-1" style={{ marginTop: 14, marginBottom: 4 }}>
                  <label style={labelStyle} htmlFor="cp-bac-track">{atr("Baccalaureate track", "مسار البكالوريا")}</label>
                  <select
                    id="cp-bac-track"
                    value={signupBacTrack || ""}
                    onChange={(e) => {
                      setSignupBacTrack && setSignupBacTrack(e.target.value);
                      setSignupBacSpecialty && setSignupBacSpecialty("");
                    }}
                    style={{ ...authInputStyle, cursor: "pointer" }}
                  >
                    <option value="">{atr("Select track…", "اختَر المسار…")}</option>
                    {BAC_TRACKS.map((tr_) => (
                      <option key={tr_.id} value={tr_.id}>{appIsAr ? tr_.ar : tr_.en}</option>
                    ))}
                  </select>
                </div>
                <div className="auth-field-1" style={{ marginTop: 12, marginBottom: 4 }}>
                  <label style={labelStyle} htmlFor="cp-bac-grade">{atr("Grade", "الصف")}</label>
                  <select
                    id="cp-bac-grade"
                    value={signupBacGrade || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSignupBacGrade && setSignupBacGrade(v);
                      if (v !== "2") setSignupBacSpecialty && setSignupBacSpecialty("");
                    }}
                    style={{ ...authInputStyle, cursor: "pointer" }}
                  >
                    <option value="">{atr("Select grade…", "اختَر الصف…")}</option>
                    {BAC_GRADES.map((g) => (
                      <option key={g.id} value={g.id}>{appIsAr ? g.ar : g.en}</option>
                    ))}
                  </select>
                </div>
                {signupBacGrade === "2" && signupBacTrack && (
                  <div className="auth-field-1" style={{ marginTop: 12, marginBottom: 4 }}>
                    <label style={labelStyle} htmlFor="cp-bac-spec">{atr("Specialized subject", "المادة التخصصية")}</label>
                    <select
                      id="cp-bac-spec"
                      value={signupBacSpecialty || ""}
                      onChange={(e) => setSignupBacSpecialty && setSignupBacSpecialty(e.target.value)}
                      style={{ ...authInputStyle, cursor: "pointer" }}
                    >
                      <option value="">{atr("Select subject…", "اختَر المادة…")}</option>
                      {getSpecialtyOptions(signupBacTrack).map((s) => (
                        <option key={s.id} value={s.id}>{appIsAr ? s.ar : s.en}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
            {signupError && <div style={errorStyle} role="alert" aria-live="assertive">{translateAdminError(signupError, appIsAr)}</div>}
            <button type="submit" disabled={signupSaving} className="btn-shine touch-target" style={{ ...primaryBtnStyle, minHeight: 48 }}>
              {signupSaving ? <LoaderIcon size={16} /> : <PlusIcon size={16} />} {atr("Submit request", "إرسال الطلب")}
            </button>
          </form>
          <p style={{ fontSize: 13, color: "var(--muted-strong)", textAlign: "center", marginTop: 16 }}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                goToStage("intro");
              }}
              className="link-underline"
              style={{ color: BRASS, fontWeight: 600, textDecoration: "none" }}
            >
              {atr("Back", "رجوع")}
            </a>
          </p>
        </div>
      </Shell>
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
            {effectiveRole === "teacher"
              ? atr(
                  "Create a teacher account. An admin must approve your request before you can sign in.",
                  "أنشئ حساب معلّم. لازم الأدمن يوافق على طلبك قبل ما تقدر تسجّل دخول."
                )
              : atr(
                  "Choose account type, a username, and a password. An admin must approve your request. Extra profile details come after your first login.",
                  "اختَر نوع الحساب واسم المستخدم وكلمة المرور. الأدمن يوافق على الطلب. باقي البيانات بعد أول دخول."
                )}
          </p>
          <form onSubmit={(e) => {
              // Always submit with the role the user actually selected
              if (typeof setSignupRole === "function") setSignupRole(effectiveRole);
              return handleSignup(e, effectiveRole);
            }}>
            <div className="auth-field-1" style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{atr("Account type", "نوع الحساب")}</label>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => pickRole("user")}
                  className="touch-target"
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    minHeight: 44,
                    borderRadius: 12,
                    border: effectiveRole !== "teacher" ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.2)",
                    background: effectiveRole !== "teacher" ? "var(--accent-1-soft)" : "var(--input-bg)",
                    color: INK,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {atr("Student", "طالب")}
                </button>
                <button
                  type="button"
                  onClick={() => pickRole("teacher")}
                  className="touch-target"
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    minHeight: 44,
                    borderRadius: 12,
                    border: effectiveRole === "teacher" ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.2)",
                    background: effectiveRole === "teacher" ? "var(--accent-1-soft)" : "var(--input-bg)",
                    color: INK,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {atr("Teacher", "معلّم")}
                </button>
              </div>
            </div>
            {/* Streamlined: display name auto-filled from username at submit */}
            {/* Extra profile fields hidden for standard signup */}

{isSocialSignup && (
            <>
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

            <div className="auth-field-1" style={{ marginTop: 16, marginBottom: 4 }}>
              <label style={labelStyle} htmlFor="signup-birthdate">
                <CalendarIcon size={13} style={{ marginInlineEnd: 5, verticalAlign: -2 }} />
                {atr("Date of birth (optional)", "تاريخ الميلاد (اختياري)")}
              </label>
              <input
                id="signup-birthdate"
                type="date"
                value={signupBirthDate || ""}
                onChange={(e) => setSignupBirthDate && setSignupBirthDate(e.target.value)}
                min={birthDateInputMin()}
                max={birthDateInputMax()}
                style={{ ...authInputStyle, fontFamily: "ui-monospace, monospace", direction: "ltr" }}
                dir="ltr"
                autoComplete="bday"
              />
            </div>


            {/* مسار البكالوريا + الصف + المادة التخصصية — للطلاب فقط */}
            {effectiveRole !== "teacher" && (
              <>
            <div className="auth-field-1" style={{ marginTop: 16, marginBottom: 4 }}>
              <label style={labelStyle} htmlFor="signup-bac-track">
                {atr("Baccalaureate track", "مسار البكالوريا")}
              </label>
              <select
                id="signup-bac-track"
                value={signupBacTrack || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setSignupBacTrack && setSignupBacTrack(v);
                  setSignupBacSpecialty && setSignupBacSpecialty("");
                }}
                style={{ ...authInputStyle, cursor: "pointer" }}
              >
                <option value="">{atr("Select track…", "اختَر المسار…")}</option>
                {BAC_TRACKS.map((tr_) => (
                  <option key={tr_.id} value={tr_.id}>{appIsAr ? tr_.ar : tr_.en}</option>
                ))}
              </select>
            </div>

            <div className="auth-field-1" style={{ marginTop: 14, marginBottom: 4 }}>
              <label style={labelStyle} htmlFor="signup-bac-grade">
                {atr("Grade", "الصف")}
              </label>
              <select
                id="signup-bac-grade"
                value={signupBacGrade || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setSignupBacGrade && setSignupBacGrade(v);
                  if (v !== "2") setSignupBacSpecialty && setSignupBacSpecialty("");
                }}
                style={{ ...authInputStyle, cursor: "pointer" }}
              >
                <option value="">{atr("Select grade…", "اختَر الصف…")}</option>
                {BAC_GRADES.map((g) => (
                  <option key={g.id} value={g.id}>{appIsAr ? g.ar : g.en}</option>
                ))}
              </select>
            </div>

            {signupBacGrade === "2" && signupBacTrack && (
              <div className="auth-field-1" style={{ marginTop: 14, marginBottom: 4 }}>
                <label style={labelStyle} htmlFor="signup-bac-specialty">
                  {atr("Specialized subject", "المادة التخصصية")}
                </label>
                <select
                  id="signup-bac-specialty"
                  value={signupBacSpecialty || ""}
                  onChange={(e) => setSignupBacSpecialty && setSignupBacSpecialty(e.target.value)}
                  style={{ ...authInputStyle, cursor: "pointer" }}
                >
                  <option value="">{atr("Select subject…", "اختَر المادة…")}</option>
                  {getSpecialtyOptions(signupBacTrack).map((s) => (
                    <option key={s.id} value={s.id}>{appIsAr ? s.ar : s.en}</option>
                  ))}
                </select>
              </div>
            )}

            {signupBacGrade === "3" && signupBacTrack && (() => {
              const track = BAC_TRACKS.find((x) => x.id === signupBacTrack);
              if (!track) return null;
              return (
                <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, background: "var(--input-bg)", border: "1px solid rgba(var(--border-rgb),0.12)", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{atr("Year-3 subjects (fixed)", "مواد الصف الثالث (ثابتة)")}</div>
                  {(track.grade3Subjects || []).map((s) => (appIsAr ? s.ar : s.en)).join(appIsAr ? " · " : " · ")}
                </div>
              );
            })()}

              </>
            )}
            {effectiveRole === "teacher" && (
              <div style={{ marginTop: 14, marginBottom: 8, padding: "12px 14px", borderRadius: 12, background: "rgba(45,106,79,0.08)", border: "1px solid rgba(45,106,79,0.2)", fontSize: 13, color: "var(--muted-strong)", lineHeight: 1.55 }}>
                {atr(
                  "Teacher accounts skip student baccalaureate fields. After approval you'll have Teacher mode tools.",
                  "حسابات المعلّمين لا تحتاج حقول البكالوريا. بعد الموافقة ستتوفر لك أدوات وضع المعلّم."
                )}
              </div>
            )}

            </>
            )}

            <div className="auth-field-2">
              <label style={labelStyle} htmlFor="signup-username"><UserIcon size={13} style={{ marginInlineEnd: 5, verticalAlign: -2 }} />{atr("Username", "اسم المستخدم")}</label>
              <input id="signup-username" value={signupUsername} onChange={(e) => { const v = e.target.value.replace(/\s/g, "").toLowerCase(); setSignupUsername(v); if (typeof setName === "function") setName(v); }} placeholder={atr("e.g. omar_23", "مثال: omar_23")} style={{ ...authInputStyle, fontFamily: "ui-monospace, monospace", letterSpacing: "0.02em" }} autoCapitalize="off" autoCorrect="off" autoComplete="username" spellCheck={false} dir="ltr" />
            </div>
            {!isSocialSignup && (
              <>
                <div className="auth-field-3">
                  <label style={labelStyle} htmlFor="signup-password"><KeyIcon size={13} style={{ marginInlineEnd: 5, verticalAlign: -2 }} />{atr("Password", "كلمة المرور")}</label>
                  <input id="signup-password" type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} placeholder={atr("At least 6 characters", "٦ أحرف على الأقل")} style={authInputStyle} autoComplete="new-password" />
                </div>
                {isSocialSignup && (
                <div>
                  <label style={labelStyle} htmlFor="signup-password2">{atr("Confirm password", "تأكيد كلمة المرور")}</label>
                  <input id="signup-password2" type="password" value={signupPassword2} onChange={(e) => setSignupPassword2(e.target.value)} placeholder={atr("Repeat password", "أعد كتابة كلمة المرور")} style={authInputStyle} autoComplete="new-password" />
                </div>
                )}
              </>
            )}
            {isSocialSignup && (
              <div style={{ marginTop: 8, marginBottom: 4, padding: "10px 12px", borderRadius: 10, background: "rgba(66,133,244,0.1)", border: "1px solid rgba(66,133,244,0.25)", fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.45 }}>
                {atr(
                  `Signed in with ${socialDraft?.provider === "facebook" ? "Facebook" : "Google"} — name and username are prefilled. Complete gender, date of birth, and baccalaureate fields below. You can edit your name anytime later.`,
                  `تم الدخول بـ ${socialDraft?.provider === "facebook" ? "Facebook" : "Google"} — الاسم واسم المستخدم معبّيان مسبقًا. أكمل الجنس وتاريخ الميلاد ومسار البكالوريا. تقدر تعدّل اسمك لاحقًا من الحساب.`
                )}
              </div>
            )}
            {signupError && <div style={errorStyle} role="alert" aria-live="assertive">{translateAdminError(signupError, appIsAr)}</div>}
            <button type="submit" disabled={signupSaving} className="btn-shine touch-target" style={{ ...primaryBtnStyle, minHeight: 48 }}>
              {signupSaving ? <LoaderIcon size={16} /> : <PlusIcon size={16} />} {atr("Send my request", "ابعت الطلب")}
            </button>
          </form>
          {!isSocialSignup && (
            <SocialButtons atr={atr} handleSocialLogin={handleSocialLogin} busy={socialBusy} setBusy={setSocialBusy} />
          )}
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
            <div className="auth-badge" style={{ ...authBadgeWrapStyle, animation: "floatY 4.5s ease-in-out infinite" }}>
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
          <LoaderIcon size={18} /><span>{atr("One moment — signing you in…", "لحظة واحدة — بنسجّلك دخول…")}</span>
        </div>
      </Shell>
    );
  }

  if (authStage === "login") {
    return (
      <Shell>
        {/* Password spotlight (when revealed): full black curtain, only the password field stays lit */}
        {showLoginPw && typeof document !== "undefined" && createPortal(
          <>
            <div
              aria-hidden="true"
              role="presentation"
              onClick={() => setShowLoginPw(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 20000,
                // Nearly solid black so the rest of the site disappears;
                // only the lit password box above remains visible.
                background: "rgba(0, 0, 0, 0.94)",
                pointerEvents: "auto",
                cursor: "default",
              }}
            />
            {pwRect && (
              <div
                onClick={(e) => e.stopPropagation()}
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
                    "0 0 0 1px rgba(255, 220, 80, 0.35), 0 0 28px rgba(255, 200, 0, 0.55), 0 0 60px rgba(255, 180, 0, 0.3), 0 0 120px rgba(255, 180, 0, 0.18)",
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
          {/* Lamp toggle — lights up the login form (responsive) */}
          <div className="lamp-login-root" aria-hidden="false">
            <span className="lamp-login-hint">{atr("Pull the cord to open login", "اسحب الحبل لفتح الدخول")}</span>
            <div
              className={"lamp-btn" + (lampOn ? " is-on" : "")}
              role="img"
              aria-label={lampOn
                ? atr("Lamp is on — pull cord to turn off", "اللمبة شغالة — اسحب الحبل للإطفاء")
                : atr("Lamp is off — pull cord to show login", "اللمبة مطفأة — اسحب الحبل لإظهار الدخول")}
            >
              <span className="lamp-shade" />
              <span className="lamp-glow-disc" />
              <span className="lamp-beam" />
              <span className="lamp-pole" />
              <span className="lamp-base" />
              <span
                className={"lamp-pull" + (cordPull > 0 ? " is-dragging" : "")}
                style={{
                  height: 36 + cordPull,
                  transition: cordDragRef.current.active ? "none" : "height 0.35s cubic-bezier(0.22,1,0.36,1)",
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
                  cordDragRef.current = { active: true, startY: e.clientY, pulled: false };
                }}
                onPointerMove={(e) => {
                  if (!cordDragRef.current.active) return;
                  // Lower threshold on coarse pointers (touch)
                  const dy = Math.max(0, Math.min(64, e.clientY - cordDragRef.current.startY));
                  setCordPull(dy);
                  const need = (e.pointerType === "touch" || e.pointerType === "pen") ? 24 : 32;
                  if (dy >= need) cordDragRef.current.pulled = true;
                }}
                onPointerUp={(e) => {
                  if (!cordDragRef.current.active) return;
                  const need = (e.pointerType === "touch" || e.pointerType === "pen") ? 24 : 32;
                  const didPull = cordDragRef.current.pulled || cordPull >= need;
                  cordDragRef.current = { active: false, startY: 0, pulled: false };
                  setCordPull(0);
                  if (didPull) setLampOn((on) => !on);
                }}
                onPointerCancel={() => {
                  cordDragRef.current = { active: false, startY: 0, pulled: false };
                  setCordPull(0);
                }}
              >
                <span className="lamp-pull-knob" />
              </span>
            </div>
            {/* Touch / tablet: big tap target — same toggle as a successful cord pull */}
            {showCordFallback && !lampOn && (
            <button
              type="button"
              className="lamp-touch-bar is-fallback"
              onClick={() => setLampOn(true)}
              aria-label={atr("Turn lamp on to sign in", "تشغيل اللمبة لتسجيل الدخول")}
            >
              {atr("Having trouble? Tap here to open login", "مش شغال؟ اضغط هنا لفتح الدخول")}
            </button>
            )}
            <div className={"lamp-form-wrap " + (lampOn ? "is-visible" : "is-hidden")}>
            <div className="lamp-form-card lamp-form-secure">
            <div className="lamp-secure-left">
            <h3>{atr("Welcome Back", "مرحبًا بعودتك")}</h3>
            <p className="lamp-secure-sub">{atr("Sign in to continue to your account.", "سجّل دخول عشان تكمل لحسابك.")}</p>

          <form onSubmit={async (e) => {
              e.preventDefault();
              if (loggingIn || loginAuthPhase !== "idle" && loginAuthPhase !== "done") return;
              setLoginAuthPhase("credentials");
              await new Promise((r) => setTimeout(r, 450));
              setLoginAuthPhase("security");
              await new Promise((r) => setTimeout(r, 500));
              setLoginAuthPhase("auth");
              try {
                await handleLogin(e);
              } finally {
                setLoginAuthPhase((p) => (p === "auth" ? "done" : p));
                setTimeout(() => setLoginAuthPhase("idle"), 1200);
              }
            }}>
            <div className="auth-field-1">
              <label style={labelStyle} htmlFor="login-username"><UserIcon size={13} style={{ marginInlineEnd: 5, verticalAlign: -2 }} />{atr("Username", "اسم المستخدم")}</label>
              <input id="login-username" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value.replace(/\s/g, "").toLowerCase())} placeholder={atr("Your username", "اسم المستخدم")} style={{ ...authInputStyle, fontFamily: "ui-monospace, monospace" }} autoCapitalize="off" autoCorrect="off" autoComplete="username" spellCheck={false} dir="ltr" />
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
            </div>
            {authError && <div style={errorStyle} role="alert" aria-live="assertive">{translateAdminError(authError, appIsAr)}</div>}
            <button
              type="submit"
              disabled={loggingIn || (loginAuthPhase !== "idle" && loginAuthPhase !== "done")}
              className="lamp-submit auth-field-3 touch-target"
            >
              {loginAuthPhase === "credentials" || loginAuthPhase === "security" || loginAuthPhase === "auth"
                ? (<>🔒 {atr("Authenticating…", "جارٍ التحقق…")}</>)
                : loginAuthPhase === "done"
                ? (<>✓ {atr("Signed in", "تم الدخول")}</>)
                : (<>{atr("Login", "دخول")}</>)}
            </button>
          </form>
            </div>
            <div className="lamp-secure-right" aria-hidden="true">
              <div className={"lamp-secure-icon " + (
                loginAuthPhase === "done" ? "is-ok" :
                loginAuthPhase === "auth" || loginAuthPhase === "security" ? "is-lock" :
                loginAuthPhase === "credentials" ? "is-scan" : "is-idle"
              )}>
                {loginAuthPhase === "done" ? "✓" : loginAuthPhase === "idle" ? "◎" : "🔒"}
              </div>
              <ul className="lamp-secure-steps">
                <li className={["credentials","security","auth","done"].includes(loginAuthPhase) ? "done" : ""}>
                  <span className="dot" /> {atr("Credentials", "بيانات الدخول")}
                </li>
                <li className={["security","auth","done"].includes(loginAuthPhase) ? "done" : ""}>
                  <span className="dot" /> {atr("Security Check", "فحص الأمان")}
                </li>
                <li className={["auth","done"].includes(loginAuthPhase) ? "done" : loginAuthPhase === "auth" ? "active" : ""}>
                  <span className="dot" /> {atr("Authentication", "المصادقة")}
                </li>
              </ul>
            </div>
          <SocialButtons atr={atr} handleSocialLogin={handleSocialLogin} busy={socialBusy} setBusy={setSocialBusy} />
          <p className="auth-field-3" style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: "var(--muted-strong)", textAlign: "center", marginTop: 18 }}>
            {atr("Don't have an account?", "ليس لديك حساب؟")}{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); setSignupError(""); goToStage("signup"); }} className="link-underline" style={{ color: BRASS, fontWeight: 600, textDecoration: "none" }}>
              {atr("Request one", "اطلب حسابًا")}
            </a>
          </p>
            </div>
          </div>
          </div>
        </div>
      </Shell>
    );
  }
  return null;
}

export default AuthScreens;
