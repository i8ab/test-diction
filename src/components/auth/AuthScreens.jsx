import { useState, useRef, useEffect } from "react";
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
  authStage, appIsAr, appLang = "en", atr, theme, toggleTheme, toggleAppLang, onChangeAppLang,
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
  authError, setAuthError, loggingIn, handleLogin, onGuest,
}) {
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showSignupPw2, setShowSignupPw2] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const loginPwWrapRef = useRef(null);
  const signupFileRef = useRef(null);

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
    const introFeatures = [
      { icon: SearchIcon, title: atr("Instant search", "بحث فوري"), desc: atr("Look up any word between English and Arabic in a heartbeat.", "ابحث عن أي كلمة بين الإنجليزية والعربية في لحظة.") },
      { icon: SpeakerIcon, title: atr("Cambridge pronunciation", "نطق كامبريدج"), desc: atr("American and British audio from Cambridge Dictionary, plus practice scoring.", "نطق أمريكي وبريطاني من قاموس كامبريدج مع تمرين وتقييم.") },
      { icon: QuizIcon, title: atr("Practice quizzes", "اختبارات تدريبية"), desc: atr("Quizzes, flashcards, random word, and dictation — with multi-type words labeled clearly.", "اختبارات وبطاقات وكلمة عشوائية وإملاء — مع توضيح نوع الكلمة لو ليها أكتر من معنى.") },
      { icon: EditIcon, title: atr("Grow the dictionary", "أضِف كلمات جديدة"), desc: atr("Add words with types, multiple senses, auto-fill definitions and examples.", "أضف كلمات بأنواع ومعاني متعددة وتعبئة تلقائية للتعريف والأمثلة.") },
      { icon: UsersIcon, title: atr("Shared with your group", "مشترك مع مجموعتك"), desc: atr("One dictionary for everyone, with each person's progress tracked separately.", "قاموس واحد للجميع، وتقدّم كل شخص محفوظ بشكل منفصل.") },
      { icon: GlobeIcon, title: atr("Fully bilingual", "ثنائي اللغة بالكامل"), desc: atr("Switch the whole app between English and Arabic anytime.", "بدّل الموقع بالكامل بين الإنجليزية والعربية في أي وقت.") },
      { icon: StarIcon, title: atr("Achievements by category", "إنجازات بالأقسام"), desc: atr("Ten levels per track — studying, streaks, quizzes, focus time, and more — with live % progress.", "عشر مستويات لكل مسار — مذاكرة وسلاسل واختبارات ووقت تركيز وغيرها — مع نسبة تقدّم حية.") },
      { icon: TrophyIcon, title: atr("Leaderboard", "لوحة الصدارة"), desc: atr("See how you stack up against the rest of your group.", "شوف ترتيبك مقارنة بباقي أفراد مجموعتك.") },
      { icon: StatsIcon, title: atr("Smart review (SRS)", "مراجعة ذكية"), desc: atr("Spaced-repetition brings words back right before you'd forget them.", "التكرار المتباعد بيرجّع الكلمات قبل ما تنساها.") },
      { icon: CheckIcon, title: atr("To-do with work timer", "مهام مع مؤقت شغل"), desc: atr("Start a task and watch a live timer track how long you've been on it.", "ابدأ مهمة وشوف مؤقت حيّ بيحسب وقت شغلك عليها.") },
      { icon: WifiOffIcon, title: atr("Works offline", "يعمل بدون إنترنت"), desc: atr("Your saved words stay with you even without a connection.", "كلماتك المحفوظة تفضل معاك حتى من غير اتصال بالإنترنت.") },
      { icon: LayersIcon, title: atr("Flashcards mode", "وضع البطاقات التعليمية"), desc: atr("Flip through your words as flashcards for quick, focused review sessions.", "قلّب كلماتك كبطاقات تعليمية لمراجعة سريعة ومركزة.") },
      { icon: CalendarIcon, title: atr("Word of the day", "كلمة اليوم"), desc: atr("A fresh word from your dictionary highlighted for you every single day.", "كلمة جديدة من قاموسك تُعرض لك كل يوم.") },
      { icon: DownloadIcon, title: atr("Backup & CSV import/export", "نسخ احتياطي واستيراد/تصدير CSV"), desc: atr("Export your whole dictionary to CSV, or import one — your data is always yours to keep.", "صدّر قاموسك بالكامل كملف CSV أو استورد واحدًا — بياناتك ملكك دائمًا.") },
    ];
    return (
      <div
        dir={appIsAr ? "rtl" : "ltr"}
        className="auth-page"
        style={{ position: "relative", minHeight: "100dvh", background: PAPER, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(var(--border-rgb),0.06) 1px, transparent 0)", backgroundSize: "18px 18px", overflowX: "hidden" }}>
        <div className="auth-orb" style={{ width: 420, height: 420, top: "-14%", insetInlineStart: "-10%", background: "radial-gradient(circle, var(--accent-1) 0%, transparent 70%)", animationDuration: "15s" }} />
        <div className="auth-orb" style={{ width: 360, height: 360, top: "14%", insetInlineEnd: "-12%", background: "radial-gradient(circle, var(--accent-2) 0%, transparent 70%)", animationDuration: "17s", animationDelay: "-5s" }} />
        <div className="auth-orb" style={{ width: 240, height: 240, bottom: "-6%", insetInlineStart: "22%", background: "radial-gradient(circle, var(--focus-rgb,25,167,206), transparent 70%)", opacity: 0.25, animationDuration: "11s", animationDelay: "-3s" }} />

        <div className="auth-intro-inner" style={{ position: "relative", zIndex: 1, maxWidth: "min(1080px, 100%)", margin: "0 auto", padding: "clamp(16px, 3vw, 28px) clamp(14px, 4vw, 32px) clamp(40px, 6vw, 72px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "clamp(28px, 6vw, 84px)", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <BrandMark size="sm" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" onClick={toggleTheme} className="lift-hover touch-target" aria-label={atr("Toggle theme", "تبديل المظهر")}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", color: "var(--icon-muted)", background: "var(--input-bg)", border: "1px solid rgba(var(--border-rgb),0.2)" }}>
                {theme === "dark" ? <SunIcon size={15} /> : <MoonIcon size={15} />}
              </button>
              <LanguageToggle lang={appLang} onChangeLang={onChangeAppLang} isAr={appIsAr} onToggle={toggleAppLang} floating={false} />
            </div>
          </div>

          <div className="auth-field-1" style={{ textAlign: "center", maxWidth: 680, margin: "0 auto" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: BRASS, background: "var(--accent-1-soft)", padding: "6px 14px", borderRadius: 20, marginBottom: 18 }}>
              <GlobeIcon size={12} /> {atr("English ⇄ Arabic dictionary", "قاموس إنجليزي ⇄ عربي")}
            </div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(28px, 5.5vw, 52px)", fontWeight: 600, color: INK, margin: "0 0 16px", lineHeight: 1.15 }}>
              {atr("Learn words that stick, together.", "تعلّم كلمات تثبت في ذاكرتك… مع فريقك.")}
            </h1>
            <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: "clamp(14px, 2vw, 18px)", color: "var(--muted-strong)", margin: "0 auto 30px", maxWidth: 560, lineHeight: 1.65 }}>
              {atr("A shared bilingual dictionary with pronunciation, quick quizzes and progress tracking — built for you and your study group.", "قاموس مشترك ثنائي اللغة فيه نطق واختبارات سريعة ومتابعة للتقدّم — مصمَّم لك ولمجموعتك.")}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <button type="button" onClick={() => { setAuthError(""); goToStage("login"); }} className="btn-shine touch-target" style={{ ...primaryBtnStyle, width: "auto", marginTop: 0, padding: "14px 28px", minHeight: 48 }}>
                <LoginIcon size={16} /> {atr("Sign in", "تسجيل الدخول")}
              </button>
              <button type="button" onClick={() => { setSignupError(""); goToStage("signup"); }} className="lift-hover touch-target"
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 26px", minHeight: 48, fontFamily: "'Source Sans 3', sans-serif", fontSize: 15, fontWeight: 700, color: INK, background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 8, cursor: "pointer" }}>
                <PlusIcon size={16} /> {atr("Create account", "إنشاء حساب")}
              </button>
              {typeof onGuest === "function" && (
                <button type="button" onClick={onGuest} className="lift-hover touch-target"
                  style={{ padding: "12px 20px", minHeight: 44, borderRadius: 10, border: "1px dashed rgba(var(--border-rgb),0.35)", background: "transparent", color: "var(--muted-strong)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                  {atr("Browse as guest", "تصفح كضيف")}
                </button>
              )}
            </div>
          </div>

          <style>{`
            .bento-grid { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 122px; gap: 14px; grid-auto-flow: dense; margin-top: clamp(40px, 6vw, 68px); }
            .bento-item { position: relative; overflow: hidden; background: var(--card); border: 1px solid rgba(var(--border-rgb),0.14); border-radius: 16px; padding: 20px; box-shadow: 0 2px 0 rgba(0,0,0,0.04), 0 16px 40px -24px rgba(var(--border-rgb),0.4); transition: transform 0.35s cubic-bezier(0.22,1,0.36,1), box-shadow 0.35s ease, border-color 0.3s ease; display: flex; flex-direction: column; justify-content: flex-end; }
            .bento-item:hover { transform: translateY(-5px) scale(1.015); box-shadow: 0 24px 50px -20px rgba(var(--border-rgb),0.5); border-color: rgba(var(--focus-rgb),0.4); }
            .bento-num { position: absolute; top: 6px; inset-inline-end: 12px; font-family: 'Fraunces', serif; font-size: 58px; font-weight: 600; color: var(--ink); opacity: 0.06; line-height: 1; pointer-events: none; transition: opacity 0.35s ease, transform 0.35s ease; }
            .bento-item:hover .bento-num { opacity: 0.11; transform: scale(1.08); }
            .bento-icon { width: 38px; height: 38px; border-radius: 11px; display: flex; align-items: center; justify-content: center; background: var(--accent-1-soft); color: var(--accent-1); margin-bottom: 12px; transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1); }
            .bento-item:hover .bento-icon { transform: rotate(-8deg) scale(1.1); }
            .bento-big { grid-column: span 2; grid-row: span 2; }
            .bento-big .bento-icon { width: 44px; height: 44px; border-radius: 13px; }
            .bento-big .bento-num { font-size: 78px; }
            .bento-wide { grid-column: span 2; grid-row: span 1; }
            .bento-solo { grid-column: span 1; grid-row: span 1; }
            .bento-more { grid-column: span 2; grid-row: span 1; border-style: dashed; border-width: 1.5px; align-items: center; justify-content: center; text-align: center; color: var(--muted); cursor: pointer; height: auto; }
            .bento-more:hover { border-color: rgba(var(--focus-rgb),0.5); color: var(--ink); }
            .bento-more .bento-more-chevron { transition: transform 0.3s cubic-bezier(0.22,1,0.36,1); margin-inline-start: 4px; transform: rotate(90deg); }
            .bento-more.is-open .bento-more-chevron { transform: rotate(270deg); }
            .bento-more-peek { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.35s cubic-bezier(0.22,1,0.36,1); width: 100%; }
            .bento-more.is-open .bento-more-peek { grid-template-rows: 1fr; }
            .bento-more-peek-inner { overflow: hidden; min-height: 0; }
            @media (max-width: 900px) {
              .bento-grid { grid-template-columns: repeat(2, 1fr); grid-auto-rows: 140px; }
              .bento-big, .bento-wide, .bento-more { grid-column: span 2; grid-row: span 1; }
            }
            @media (max-width: 480px) {
              .bento-grid { grid-template-columns: 1fr; grid-auto-rows: minmax(120px, auto); }
              .bento-big, .bento-wide, .bento-solo, .bento-more { grid-column: span 1; }
            }
            @media (min-width: 1400px) {
              .bento-grid { grid-template-columns: repeat(4, 1fr); grid-auto-rows: 140px; gap: 18px; }
            }
          `}</style>
          <div className="bento-grid">
            {introFeatures.map((f, i) => {
              const shape = [ "bento-big", "bento-wide", "bento-solo", "bento-solo", "bento-wide", "bento-solo", "bento-wide", "bento-solo", "bento-solo", "bento-wide" ][i] || "bento-solo";
              return (
                <div key={f.title} className={`bento-item auth-field-1 ${shape}`} style={{ animationDelay: `${0.08 + i * 0.05}s` }}>
                  <span className="bento-num">{String(i + 1).padStart(2, "0")}</span>
                  <div className="bento-icon"><f.icon size={shape === "bento-big" ? 20 : 18} /></div>
                  <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: shape === "bento-big" ? 19 : 16, fontWeight: 600, color: INK, margin: "0 0 6px" }}>{f.title}</h3>
                  <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13.5, color: "var(--muted-strong)", margin: 0, lineHeight: 1.55 }}>{f.desc}</p>
                </div>
              );
            })}
            <div
              className={`bento-item bento-more auth-field-1${moreFeaturesOpen ? " is-open" : ""}`}
              style={{ animationDelay: `${0.08 + introFeatures.length * 0.05}s` }}
              role="button"
              tabIndex={0}
              aria-expanded={moreFeaturesOpen}
              onClick={() => setMoreFeaturesOpen((o) => !o)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMoreFeaturesOpen((o) => !o); } }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <PlusIcon size={18} style={{ opacity: 0.6 }} />
                <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, margin: 0 }}>{atr("More features on the way", "المزيد من المميزات قريبًا")}</p>
                <ChevronIcon size={13} className="bento-more-chevron" />
              </div>
              <div className="bento-more-peek">
                <div className="bento-more-peek-inner">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12, marginTop: 12, borderTop: "1px dashed rgba(var(--border-rgb),0.3)", opacity: 0.75 }}>
                    <FlameIcon size={16} />
                    <span style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 12.5 }}>
                      {atr("Daily streaks and study challenges", "سلاسل يومية وتحديات مذاكرة")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (authStage === "signup") {
    return (
      <Shell>
        <div className="auth-card" style={{ ...authCardStyle, maxWidth: "min(420px, 100%)" }} dir={appIsAr ? "rtl" : "ltr"}>
          <LanguageToggle lang={appLang} onChangeLang={onChangeAppLang} isAr={appIsAr} onToggle={toggleAppLang} />
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
            <BrandMark size="lg" showUnderline />
          </div>
          <p style={{ fontFamily: "'Source Sans 3', sans-serif", color: "var(--muted-strong)", fontSize: 14, margin: "16px 0 18px" }}>
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
        {/* ستارة سوداء + ضوء كشاف أصفر على كلمة المرور */}
        {/* ستارة سودة كاملة — تتقفل فقط من أيقونة العين، مش من الضغط برا */}
        {showLoginPw && (
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 5000,
              background: "#000000",
              opacity: 0.97,
              pointerEvents: "none",
            }}
          />
        )}
        <div
          className="auth-card"
          style={{
            ...authCardStyle,
            maxWidth: "min(420px, 100%)",
            position: "relative",
            zIndex: "auto",
          }}
          dir={appIsAr ? "rtl" : "ltr"}
        >
          <LanguageToggle lang={appLang} onChangeLang={onChangeAppLang} isAr={appIsAr} onToggle={toggleAppLang} />
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
            <BrandMark size="lg" showUnderline />
          </div>
          <p style={{ fontFamily: "'Source Sans 3', sans-serif", color: "var(--muted-strong)", fontSize: 14, margin: "16px 0 22px" }}>
            {atr(
              "Enter your username and password.",
              "أدخل اسم المستخدم وكلمة المرور."
            )}
          </p>
          <form onSubmit={handleLogin}>
            <div className="auth-field-1">
              <label style={labelStyle} htmlFor="login-username"><UserIcon size={13} style={{ marginInlineEnd: 5, verticalAlign: -2 }} />{atr("Username", "اسم المستخدم")}</label>
              <input id="login-username" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value.replace(/\s/g, "").toLowerCase())} placeholder={atr("Your username", "اسم المستخدم")} style={{ ...authInputStyle, fontFamily: "ui-monospace, monospace" }} autoFocus autoCapitalize="off" autoCorrect="off" autoComplete="username" spellCheck={false} dir="ltr" />
            </div>
            <div className="auth-field-2" ref={loginPwWrapRef}
              style={{
                position: "relative",
                zIndex: showLoginPw ? 5002 : "auto",
                ...(showLoginPw
                  ? {
                      padding: "14px 14px 12px",
                      marginInline: -4,
                      borderRadius: 14,
                      background: "linear-gradient(180deg, #2a2200 0%, #1a1400 100%)",
                      border: "1px solid rgba(255, 200, 40, 0.55)",
                      boxShadow:
                        "0 0 0 1px rgba(255, 210, 60, 0.25), 0 0 24px rgba(255, 190, 0, 0.55), 0 0 48px rgba(255, 170, 0, 0.25)",
                    }
                  : {}),
              }}
            >
              <label
                style={{
                  ...labelStyle,
                  ...(showLoginPw ? { color: "#ffd54a", textShadow: "0 0 10px rgba(255, 200, 0, 0.7)" } : {}),
                }}
                htmlFor="login-password"
              >
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
                  style={{
                    ...authInputStyle,
                    paddingInlineEnd: 44,
                    ...(showLoginPw
                      ? {
                          color: "#ffe566",
                          caretColor: "#ffd54a",
                          background: "#1a1400",
                          borderColor: "#e6b800",
                          boxShadow: "0 0 0 2px rgba(255, 200, 0, 0.25), 0 0 28px rgba(255, 190, 0, 0.45)",
                          textShadow: "0 0 8px rgba(255, 220, 80, 0.55)",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                        }
                      : {}),
                  }}
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
                    color: showLoginPw ? "#ffd54a" : "var(--icon-muted)",
                    padding: 6,
                    display: "flex",
                    zIndex: 1,
                    filter: showLoginPw ? "drop-shadow(0 0 6px rgba(255,200,0,0.8))" : "none",
                  }}
                >
                  {showLoginPw ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
              <div style={{ fontSize: 11, color: showLoginPw ? "rgba(255,220,100,0.7)" : "var(--muted)", marginTop: 4, lineHeight: 1.4 }}>
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
