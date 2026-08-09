import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { EN_ACCENTS, loadEnAccent, saveEnAccent } from "../../lib/utils/speech";
import { tr, UI_LANGS } from "../../lib/config/i18n";
import { ACCENT_THEMES, loadCustomAccentHex, saveCustomAccentHex, applyAccentTheme, saveAccent } from "../../lib/state/storage";

function stretchArabicText(text, amount) {
  if (!text || !amount) return text;
  const isArabicLetter = (ch) => /[\u0600-\u06FF]/.test(ch);
  const isNonConnecting = (ch) => /[ادذرزوآأإؤةء]/.test(ch);
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    result += ch;
    if (i < text.length - 1) {
      const nextCh = text[i + 1];
      if (isArabicLetter(ch) && !isNonConnecting(ch) && isArabicLetter(nextCh) && nextCh !== " " && nextCh !== "ـ") {
        result += "ـ".repeat(amount);
      }
    }
  }
  return result;
}

const hasArabic = (text) => /[\u0600-\u06FF]/.test(text || "");
import {
  UsersIcon, SunIcon, MoonIcon, GlobeIcon, UserIcon, LogoutIcon, PaletteIcon, MenuIcon, BellIcon, BellOffIcon, XIcon, CheckIcon, TrashIcon, LayersIcon, LoaderIcon, SettingsIcon, BookIcon,
  SearchIcon, QuizIcon, ClockIcon, CalendarIcon, FlameIcon, StatsIcon, MicIcon, StarIcon, WandIcon,
} from "../common/Icons";
import DevicePicker from "./DevicePicker";
import NumberStepper from "../common/NumberStepper";
import { useBodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import {
  BRAND_PRESETS,
  loadPresetId,
  loadCustomGlyph,
  savePresetId,
  saveCustomGlyph,
} from "../common/BrandMark";
import { PlusIcon } from "../common/Icons";

const INFO_SECTIONS = [
  {
    id: "basics",
    icon: BookIcon,
    titleEn: "Dictionary basics",
    titleAr: "أساسيات القاموس",
    bodyEn: [
      "Switch EN→AR / AR→AR from the section tabs.",
      "Search by word, meaning, definition, or example. Mic = voice search when available.",
      "Filters: All · Studied · Not studied · Favorites · Due · Weak + POS, date added, and sort.",
      "Star = favorite · Eye = studied · Zoom = big view + practice & recording.",
      "Add word: choose type (noun/verb/…) or “More than one type”.",
    ],
    bodyAr: [
      "بدّل EN→AR / AR→AR من تبويبات القسم.",
      "ابحث بالكلمة أو المعنى أو التعريف أو المثال. الميكروفون = بحث صوتي لو متاح.",
      "الفلاتر: الكل · درست · لسه · مفضلة · مستحقة · ضعيفة + نوع الكلمة وتاريخ الإضافة والترتيب.",
      "نجمة = مفضلة · عين = مُذاكرة · تكبير = عرض كبير + تمرين وتسجيل.",
      "إضافة كلمة: اختار النوع (اسم/فعل/…) أو «أكتر من نوع».",
    ],
  },
  {
    id: "practice",
    icon: QuizIcon,
    titleEn: "Practice & SRS",
    titleAr: "التدريب وSRS",
    bodyEn: [
      "Quiz, flashcards, quick review, random word, dictation — under More ⋯.",
      "SRS uses SM-2: hard words return sooner; customize intervals on the Dashboard.",
      "Due filter and Due-only quiz show words ready for review.",
      "Dashboard: streak, due, weak words, today’s progress, shortcuts.",
    ],
    bodyAr: [
      "اختبار، بطاقات، مراجعة سريعة، كلمة عشوائية، إملاء — من المزيد ⋯.",
      "SRS بنظام SM-2: الكلمات الصعبة ترجع أسرع؛ خصّص الفترات من لوحة القيادة.",
      "فلتر المستحقة واختبار المستحقة فقط يعرضوا الكلمات الجاهزة.",
      "لوحة القيادة: سلسلة، مستحقة، ضعيفة، تقدّم اليوم، واختصارات.",
    ],
  },
  {
    id: "pron",
    icon: MicIcon,
    titleEn: "Pronunciation & recording",
    titleAr: "النطق والتسجيل",
    bodyEn: [
      "Speakers play Cambridge US/UK audio for English words.",
      "Settings → English accent (Cambridge): American or British default.",
      "Zoom: US/UK buttons, mic practice score, and Record & compare your voice.",
    ],
    bodyAr: [
      "السماعة بتشغّل نطق كامبريدج أمريكي/بريطاني للإنجليزي.",
      "الإعدادات → لهجة الإنجليزية (كامبريدج): أمريكي أو بريطاني.",
      "العرض الكبير: أزرار US/UK، تمرين ميكروفون مع درجة، وتسجيل صوتك للمقارنة.",
    ],
  },
  {
    id: "lists",
    icon: LayersIcon,
    titleEn: "Lists, challenges, export",
    titleAr: "قوائم وتحديات وتصدير",
    bodyEn: [
      "Word lists: create lists and share with a code (More ⋯ → Word lists).",
      "Friend challenges: compete on words, quizzes, streak, or minutes (More ⋯ → Challenges).",
      "Export CSV or Anki TSV; Import CSV from More ⋯.",
    ],
    bodyAr: [
      "قوائم الكلمات: أنشئ قوائم وشاركها بكود (المزيد ⋯ → قوائم الكلمات).",
      "تحديات الأصدقاء: تنافس على كلمات أو اختبارات أو سلسلة أو دقائق (المزيد ⋯ → تحديات).",
      "تصدير CSV أو Anki؛ استيراد CSV من المزيد ⋯.",
    ],
  },
  {
    id: "todo",
    icon: CheckIcon,
    titleEn: "To-do list",
    titleAr: "قائمة المهام",
    bodyEn: [
      "Green floating button or More ⋯ (shortcut T).",
      "Start on a task → live timer next to it. One active task at a time.",
      "Pin = floating mini list. Export/Import JSON.",
    ],
    bodyAr: [
      "الزرار الأخضر العائم أو المزيد ⋯ (اختصار T).",
      "ابدأ على مهمة → مؤقت حيّ جنبها. مهمة واحدة شغّالة في نفس الوقت.",
      "تثبيت = قائمة مصغّرة. تصدير/استيراد JSON.",
    ],
  },
  {
    id: "goals",
    icon: FlameIcon,
    titleEn: "Goals, timer, calendar",
    titleAr: "أهداف ومؤقّت وتقويم",
    bodyEn: [
      "Goals: daily words / minutes / weekly challenge (orange button).",
      "Timer: countdown or stopwatch; minutes count toward goals.",
      "Calendar: study map by day. Word of the day on the home list.",
    ],
    bodyAr: [
      "الأهداف: كلمات/دقائق يومية + تحدي أسبوعي (الزرار البرتقالي).",
      "المؤقّت: عدّ تنازلي أو ساعة؛ الدقائق بتتحسب في الأهداف.",
      "التقويم: خريطة المذاكرة باليوم. كلمة اليوم على الصفحة الرئيسية.",
    ],
  },
  {
    id: "achievements",
    icon: StarIcon,
    titleEn: "Achievements",
    titleAr: "الإنجازات",
    bodyEn: [
      "More ⋯ → Achievements: categories with 10 levels each.",
      "Tap a category to see % progress toward the next level.",
    ],
    bodyAr: [
      "المزيد ⋯ → الإنجازات: أقسام وكل قسم ١٠ مستويات.",
      "اضغط قسم عشان تشوف نسبة التقدّم للمستوى الجاي.",
    ],
  },
  {
    id: "more",
    icon: LayersIcon,
    titleEn: "More",
    titleAr: "المزيد",
    bodyEn: [
      "More ⋯ → Focus mode (or F): hides banners for distraction-free study.",
      "Shortcuts: / search · N add · Q quiz · R review · T to-do · F focus.",
      "Gear (⚙) opens Settings: Appearance, language, device layout, accent, reminders.",
      "More ⋯ holds study tools: Quiz, Flashcards, Random word, Leaderboard, CSV/Anki export, etc.",
      "Notifications: optional study reminders when the browser allows (inside Settings).",
    ],
    bodyAr: [
      "المزيد ⋯ → وضع التركيز (أو F): يخفي البنرات للمذاكرة من غير تشتيت.",
      "اختصارات: / بحث · N إضافة · Q اختبار · R مراجعة · T مهام · F تركيز.",
      "الترس (⚙) بيفتح الإعدادات: المظهر، اللغة، واجهة الجهاز، اللهجة، التذكيرات.",
      "المزيد ⋯ فيه أدوات المذاكرة: اختبار، بطاقات، كلمة عشوائية، ترتيب، تصدير CSV/Anki، إلخ.",
      "الإشعارات: تذكيرات مذاكرة اختيارية حسب دعم المتصفح (جوه الإعدادات).",
    ],
  },
];


export default function HeaderMenu({
  theme, onToggleTheme, isAdmin, onOpenAccount, onOpenAdmin, onLogout, isAr,
  appLang = "en", onChangeAppLang,
  deviceMode = null, onChangeDeviceMode = null, uiScale = 1, onChangeUiScale = null,
  accentTheme, onChangeAccent,
  remindersOn, remindersBusy, onEnableReminders, onDisableReminders, onTestReminder,
  reminderTitle, onChangeReminderTitle,
  reminderMessage, onChangeReminderMessage,
  pendingAccounts = [],
  onApproveRequest,
  onRejectRequest,
  // Admin: site-wide banner + broadcast push (live in this menu)
  siteBanner = null,
  onPersistSiteBanner = null,
  onOpenExamSettings = null,
  myAccountCode = null,
  focusMode = false,
  onToggleFocus = null,
  onOpenInfo = null,
  onOpenAchievements = null,
  vaultAccounts = [],
  mainAccountCode = "",
  accountCode = "",
  onSwitchAccount = null,
  onSetMainAccount = null,
  onUnlinkVaultAccount = null,
  onLogoutAll = null,
  onLinkAccount = null,
}) {
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [brandPresetId, setBrandPresetId] = useState(() => loadPresetId());
  const [brandCustomGlyph, setBrandCustomGlyph] = useState(() => loadCustomGlyph());
  const [brandAddMode, setBrandAddMode] = useState(false);
  const [brandDraftCustom, setBrandDraftCustom] = useState("");
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [accentModalOpen, setAccentModalOpen] = useState(false);
  const [appearanceModalOpen, setAppearanceModalOpen] = useState(false);
  const [uiDensity, setUiDensity] = useState(() => {
    try { return localStorage.getItem("tt_ui_density") || "comfortable"; } catch (_) { return "comfortable"; }
  });
  const [uiRadius, setUiRadius] = useState(() => {
    try {
      const v = localStorage.getItem("tt_ui_radius");
      return v === "sharp" || v === "round" || v === "soft" ? v : "soft";
    } catch (_) { return "soft"; }
  });
  const [cardHeight, setCardHeight] = useState(() => {
    try {
      const v = localStorage.getItem("tt_card_height");
      return v === "compact" || v === "comfortable" || v === "normal" ? v : "normal";
    } catch (_) { return "normal"; }
  });
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(null);
  const [busyCode, setBusyCode] = useState(null);
  const ref = useRef(null);

  // Banner form (admin)
  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerColor, setBannerColor] = useState("#146C94");
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [bannerShine, setBannerShine] = useState(40);
  const [bannerSpeed, setBannerSpeed] = useState(1);
  const [bannerLetterSpacing, setBannerLetterSpacing] = useState(0);
  const [bannerFlash, setBannerFlash] = useState(false);
  const [bannerRepeats, setBannerRepeats] = useState(4);
  const [bannerSize, setBannerSize] = useState("md"); // sm | md | lg | xl
  const [bannerDurationAmount, setBannerDurationAmount] = useState(0);
  const [bannerDurationUnit, setBannerDurationUnit] = useState("hours"); // minutes | hours | days
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerMsg, setBannerMsg] = useState("");
  const [enAccentPref, setEnAccentPref] = useState(loadEnAccent);

  useEffect(() => {
    try {
      document.documentElement.dataset.density = uiDensity;
      localStorage.setItem("tt_ui_density", uiDensity);
    } catch (_) {}
  }, [uiDensity]);

  useEffect(() => {
    try {
      document.documentElement.dataset.radius = uiRadius;
      localStorage.setItem("tt_ui_radius", uiRadius);
    } catch (_) {}
  }, [uiRadius]);

  useEffect(() => {
    try {
      document.documentElement.dataset.cardHeight = cardHeight;
      localStorage.setItem("tt_card_height", cardHeight);
    } catch (_) {}
  }, [cardHeight]);
  const [bannerRemainingLabel, setBannerRemainingLabel] = useState("");

  // Broadcast form (admin, under Notifications)
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushSending, setPushSending] = useState(false);
  const [pushResult, setPushResult] = useState("");

  const pendingCount = (pendingAccounts || []).length;
  // UI language for chrome strings (settings / menu). RTL still uses isAr.
  const lang = appLang || (isAr ? "ar" : "en");
  const T = (en, ar, de, fr) => tr(lang, en, ar, de, fr);

  // Sync form fields when the live banner changes or the section opens
  useEffect(() => {
    if (!bannerOpen) return;
    const b = siteBanner || {};
    setBannerMessage(b.message || "");
    setBannerColor(b.color || "#146C94");
    setBannerEnabled(!!b.enabled);
    setBannerShine(typeof b.shine === "number" ? b.shine : 40);
    setBannerSpeed(typeof b.speed === "number" ? b.speed : 1);
    setBannerLetterSpacing(typeof b.letterSpacing === "number" ? b.letterSpacing : 0);
    setBannerFlash(!!b.flash);
    setBannerRepeats(typeof b.repeats === "number" ? Math.max(1, Math.min(12, b.repeats)) : 4);
    setBannerSize(b.size === "sm" || b.size === "lg" || b.size === "xl" ? b.size : "md");
    // Prefer durationMinutes; fall back to legacy durationHours
    let mins = 0;
    if (typeof b.durationMinutes === "number" && b.durationMinutes > 0) mins = b.durationMinutes;
    else if (typeof b.durationHours === "number" && b.durationHours > 0) mins = Math.round(b.durationHours * 60);
    if (mins <= 0) {
      setBannerDurationAmount(0);
      setBannerDurationUnit("hours");
    } else if (mins % (60 * 24) === 0) {
      setBannerDurationAmount(mins / (60 * 24));
      setBannerDurationUnit("days");
    } else if (mins % 60 === 0) {
      setBannerDurationAmount(mins / 60);
      setBannerDurationUnit("hours");
    } else {
      setBannerDurationAmount(mins);
      setBannerDurationUnit("minutes");
    }
    setBannerMsg("");
  }, [bannerOpen, siteBanner]);

  // Countdown for the currently published banner — shown only in admin settings.
  useEffect(() => {
    if (!bannerOpen) {
      setBannerRemainingLabel("");
      return;
    }
    const b = siteBanner;
    if (!b || !b.enabled || !b.updatedAt) {
      setBannerRemainingLabel("");
      return;
    }
    let mins = 0;
    if (typeof b.durationMinutes === "number" && b.durationMinutes > 0) mins = b.durationMinutes;
    else if (typeof b.durationHours === "number" && b.durationHours > 0) mins = Math.round(b.durationHours * 60);
    if (!mins) {
      setBannerRemainingLabel("");
      return;
    }
    const endsAt = b.updatedAt + mins * 60 * 1000;

    function formatRemaining(ms) {
      if (ms <= 0) return T("Ended — will hide on refresh", "انتهى — هيختفي مع التحديث");
      const totalSec = Math.ceil(ms / 1000);
      const d = Math.floor(totalSec / 86400);
      const h = Math.floor((totalSec % 86400) / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      if (d > 0) return T(`${d}d ${h}h ${m}m left`, `${d}ي ${h}س ${m}د متبقية`);
      if (h > 0) return T(`${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s left`, `${h}س ${String(m).padStart(2, "0")}د ${String(s).padStart(2, "0")}ث متبقية`);
      if (m > 0) return T(`${m}m ${String(s).padStart(2, "0")}s left`, `${m}د ${String(s).padStart(2, "0")}ث متبقية`);
      return T(`${s}s left`, `${s}ث متبقية`);
    }

    function tick() {
      setBannerRemainingLabel(formatRemaining(endsAt - Date.now()));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [bannerOpen, siteBanner, lang]);

  function closeMenu() {
    setOpen(false);
    setRequestsOpen(false);
  }

  function openSettings() {
    // Keep the menu open underneath — settings stacks above it
    setSettingsOpen(true);
  }

  function closeSettings() {
    setSettingsOpen(false);
    setNotifOpen(false);
    setBannerOpen(false);
    setInfoOpen(false);
    setInfoExpanded(null);
  }

  function openInfoModal() {
    setNotifOpen(false);
    setBannerOpen(false);
    setInfoExpanded(null);
    // Keep the menu open underneath — info guide stacks above it
    // Prefer the full detailed guide from the parent (InfoGuideModal).
    if (onOpenInfo) {
      onOpenInfo();
      return;
    }
    setInfoOpen(true);
  }

  function closeInfoModal() {
    setInfoOpen(false);
    setInfoExpanded(null);
  }

  function openNotifModal() {
    setInfoOpen(false);
    setBannerOpen(false);
    setNotifOpen(true);
  }

  function closeNotifModal() {
    setNotifOpen(false);
  }

  function openBannerModal() {
    setInfoOpen(false);
    setNotifOpen(false);
    setBannerOpen(true);
  }

  function closeBannerModal() {
    setBannerOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    // Only close via the X button — do not close on outside click or when opening items.
    // Escape still closes for accessibility.
    function onKeyDown(e) { if (e.key === "Escape") closeMenu(); }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!settingsOpen && !notifOpen && !bannerOpen && !infoOpen) return;
    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      if (infoOpen) { closeInfoModal(); return; }
      if (notifOpen) { closeNotifModal(); return; }
      if (bannerOpen) { closeBannerModal(); return; }
      if (settingsOpen) closeSettings();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen, notifOpen, bannerOpen, infoOpen, langModalOpen, accentModalOpen, appearanceModalOpen]);

  // Lock background scroll for any open settings-style modal (click-outside still closes).
  useBodyScrollLock(open || settingsOpen || notifOpen || bannerOpen || infoOpen || langModalOpen || accentModalOpen || appearanceModalOpen);

  function itemClick(fn) { fn(); }

  const itemStyle = { position: "relative", display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", minHeight: 40, fontSize: 13.5, fontWeight: 600, color: "var(--ink)", background: "none", border: "none", borderRadius: 9, textAlign: "start", cursor: "pointer" };
  const iconWrapStyle = (bg) => ({ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 8, background: bg, flexShrink: 0 });

  function Row({ icon, label, onClick, disabled, tint, danger, trailing }) {
    return (
      <button
        role="menuitem"
        disabled={disabled}
        className="header-menu-item touch-target"
        style={{ ...itemStyle, color: danger ? "var(--danger)" : "var(--ink)", opacity: disabled ? 0.55 : 1, cursor: disabled ? "default" : "pointer" }}
        onClick={() => { if (!disabled) itemClick(onClick); }}
      >
        <span style={iconWrapStyle(danger ? "rgba(var(--danger-rgb,220,38,38),0.12)" : `${tint}1c`)}>
          <span style={{ color: danger ? "var(--danger)" : tint, display: "flex" }}>{icon}</span>
        </span>
        <span style={{ flex: 1, textAlign: "start" }}>{label}</span>
        {trailing}
      </button>
    );
  }

  const fieldLabel = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 5 };
  const bannerSection = (en, ar) => (
    <div style={{
      marginTop: 6, marginBottom: 2, paddingTop: 10,
      borderTop: "1px solid rgba(var(--border-rgb),0.12)",
      fontSize: 12, fontWeight: 800, color: "var(--ink)", letterSpacing: "0.02em",
    }}>
      {T(en, ar)}
    </div>
  );
  const fieldInput = {
    width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: 13,
    fontFamily: "inherit", color: "var(--ink)", background: "var(--input-bg)",
    border: "1px solid rgba(var(--border-rgb),0.22)", borderRadius: 8, outline: "none",
  };

  async function approve(code) {
    if (!onApproveRequest) return;
    setBusyCode(code);
    try { await onApproveRequest(code); } finally { setBusyCode(null); }
  }
  async function reject(code) {
    if (!onRejectRequest) return;
    setBusyCode(code);
    try { await onRejectRequest(code); } finally { setBusyCode(null); }
  }

  async function saveBanner(e) {
    e && e.preventDefault();
    if (!onPersistSiteBanner) return;
    setBannerSaving(true);
    setBannerMsg("");
    const msg = (bannerMessage || "").trim();
    const next = {
      id: `banner-${Date.now().toString(36)}`,
      message: msg,
      color: bannerColor || "#146C94",
      enabled: !!bannerEnabled && !!msg,
      updatedAt: Date.now(),
      shine: Math.max(0, Math.min(100, Number(bannerShine) || 0)),
      speed: Math.max(0.4, Math.min(2, Number(bannerSpeed) || 1)),
      letterSpacing: Math.max(0, Math.min(30, Number(bannerLetterSpacing) || 0)),
      flash: !!bannerFlash,
      repeats: Math.max(1, Math.min(12, Math.round(Number(bannerRepeats) || 4))),
      size: bannerSize === "sm" || bannerSize === "lg" || bannerSize === "xl" ? bannerSize : "md",
      durationMinutes: (() => {
        const amt = Math.max(0, Number(bannerDurationAmount) || 0);
        if (!amt) return 0;
        if (bannerDurationUnit === "days") return Math.min(60 * 24 * 30, Math.round(amt * 60 * 24));
        if (bannerDurationUnit === "hours") return Math.min(60 * 24 * 30, Math.round(amt * 60));
        return Math.min(60 * 24 * 30, Math.round(amt)); // minutes, cap ~30 days
      })(),
    };
    // Always mint a fresh id when publishing an enabled banner so any
    // previous dismiss (stored per-id on devices) is ignored and the new
    // announcement replaces the old one immediately for everyone.
    // (Disabled/draft saves keep no special id behaviour.)
    const result = await onPersistSiteBanner(next.enabled ? next : { ...next, enabled: false, message: msg });
    setBannerSaving(false);
    if (result && result.ok === false) {
      setBannerMsg(result.error || T( "Save failed.", "فشل الحفظ."));
      return;
    }
    setBannerMsg(T( "Announcement saved.", "تم حفظ الإعلان."));
  }

  async function clearBanner() {
    if (!onPersistSiteBanner) return;
    setBannerSaving(true);
    setBannerMsg("");
    const result = await onPersistSiteBanner(null);
    setBannerSaving(false);
    if (result && result.ok === false) {
      setBannerMsg(result.error || T( "Save failed.", "فشل الحفظ."));
      return;
    }
    setBannerMessage("");
    setBannerEnabled(false);
    setBannerLetterSpacing(0);
    setBannerFlash(false);
    setBannerRepeats(4);
    setBannerMsg(T( "Announcement cleared.", "تم إزالة الإعلان."));
  }

  async function sendBroadcast(e) {
    e && e.preventDefault();
    if (!myAccountCode) return;
    setPushSending(true);
    setPushResult("");
    try {
      const r = await fetch("/api/push-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminCode: myAccountCode,
          title: pushTitle.trim(),
          body: pushBody.trim(),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setPushResult(data.error || T( "Send failed.", "فشل الإرسال."));
      } else {
        setPushResult(
          tr(
            isAr,
            `Sent to ${data.sent || 0} device(s). Skipped ${data.skipped || 0}, expired ${data.expired || 0}.`,
            `اتبعت لـ ${data.sent || 0} جهاز. تم تخطي ${data.skipped || 0}، منتهي ${data.expired || 0}.`
          )
        );
      }
    } catch (err) {
      setPushResult(T( "Network error — try again.", "خطأ في الشبكة — حاول مرة أخرى."));
    }
    setPushSending(false);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setSettingsOpen(true)}
        title={T("Settings", "الإعدادات")}
        aria-label={T("Settings", "الإعدادات")}
        aria-expanded={settingsOpen}
        className="lift-hover touch-target"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          border: "1px solid rgba(var(--border-rgb),0.25)",
          background: "none",
          color: "var(--icon-muted)",
          borderRadius: 10,
          cursor: "pointer",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <SettingsIcon size={16} />
      </button>

      {settingsOpen && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => { /* Settings stays open unless user presses X */ }}
          className="modal-backdrop"
          style={{
            position: "fixed", inset: 0, zIndex: 3400,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
            className="modal-card"
            style={{
              width: "100%", maxWidth: "min(440px, 100%)",
              maxHeight: "min(90dvh, 820px)", overflowY: "auto",
              background: "var(--card)", color: "var(--ink)",
              border: "1px solid rgba(var(--border-rgb),0.14)",
              borderRadius: 16,
              padding: "clamp(14px, 3vw, 22px)",
              boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 id="settings-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>
                {T( "Settings", "الإعدادات")}
              </h2>
              <button
                type="button"
                onClick={closeSettings}
                aria-label={T( "Close", "إغلاق")}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Row
                tint="#f5a623"
                icon={theme === "dark" ? <SunIcon size={14} /> : <MoonIcon size={14} />}
                label={T("Appearance", "المظهر")}
                onClick={() => {
                  setBrandPresetId(loadPresetId());
                  setBrandCustomGlyph(loadCustomGlyph());
                  setBrandAddMode(false);
                  setBrandDraftCustom("");
                  // Keep settings open underneath — appearance stacks above it
                  setAppearanceModalOpen(true);
                }}
                trailing={
                  <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                    {theme === "dark" ? T("Dark", "داكن") : T("Light", "فاتح")}
                    {isAr ? " ◂" : " ▸"}
                  </span>
                }
              />

                 {onChangeAppLang && (
                <Row
                  tint="#5b8def"
                  icon={<GlobeIcon size={14} />}
                  label={T("Language", "اللغة", "Sprache", "Langue")}
                  onClick={() => setLangModalOpen(true)}
                  trailing={
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                      {(UI_LANGS.find((l) => l.id === lang) || {}).native || "English"}
                      {isAr ? " ◂" : " ▸"}
                    </span>
                  }
                />
              )}

              {typeof onChangeDeviceMode === "function" && (
                <Row
                  tint="#19A7CE"
                  icon={<LayersIcon size={14} />}
                  label={T("Device layout", "واجهة الجهاز")}
                  onClick={() => setDeviceModalOpen(true)}
                  trailing={
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                      {deviceMode === "mobile" ? T("Phone", "موبايل")
                        : deviceMode === "tablet" ? T("Tablet", "تابلت")
                        : deviceMode === "desktop" ? T("Computer", "كمبيوتر")
                        : T("Auto", "تلقائي")}
                      {isAr ? " ◂" : " ▸"}
                    </span>
                  }
                />
              )}

              <Row
                tint="#af52de"
                icon={<MicIcon size={14} />}
                label={T("Accent / dialect", "اللهجة / النطق")}
                onClick={() => setAccentModalOpen(true)}
                trailing={
                  <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                    {enAccentPref === "uk" ? T("British", "بريطاني") : T("American", "أمريكي")}
                    {isAr ? " ◂" : " ▸"}
                  </span>
                }
              />

              <Row
                tint="#5b8def"
                icon={<BookIcon size={14} />}
                label={T("Information", "معلومات")}
                onClick={openInfoModal}
                trailing={
                  <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                    {isAr ? "◂" : "▸"}
                  </span>
                }
              />

              {/* ========== Notifications — opens small modal ========== */}
              {(onEnableReminders || onDisableReminders) && (
                <Row
                  tint={remindersOn ? "#34c759" : "#8e8e93"}
                  icon={remindersOn ? <BellIcon size={14} /> : <BellOffIcon size={14} />}
                  label={T("Notifications", "الإشعارات")}
                  onClick={openNotifModal}
                  trailing={
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                      {isAr ? "◂" : "▸"}
                    </span>
                  }
                />
              )}

              {/* ========== Site banner (admins) — opens small modal ========== */}
              {isAdmin && onPersistSiteBanner && (
                <div style={{ marginTop: 0 }}>
                  <Row
                    tint="#146C94"
                    icon={<LayersIcon size={14} />}
                    label={T( "Site banner", "بانر الموقع")}
                    onClick={openBannerModal}
                    trailing={
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {siteBanner && siteBanner.enabled && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: "#fff", background: "#34c759",
                            borderRadius: 8, padding: "2px 6px",
                          }}>
                            {T( "ON", "مفعّل")}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                          {isAr ? "◂" : "▸"}
                        </span>
                      </span>
                    }
                  />
                </div>
              )}


              {isAdmin && typeof onOpenExamSettings === "function" && (
                <Row
                  tint="#e85d04"
                  icon={<FlameIcon size={14} />}
                  label={T("Exam countdown", "عدّاد الامتحان")}
                  onClick={() => { setOpen(false); onOpenExamSettings(); }}
                  trailing={
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                      {isAr ? "◂" : "▸"}
                    </span>
                  }
                />
              )}

              {isAdmin && typeof onOpenAdmin === "function" && (
                <Row
                  tint="#af52de"
                  icon={<UsersIcon size={14} />}
                  label={T("Admin Panel", "لوحة التحكم")}
                  onClick={onOpenAdmin}
                />
              )}

              {/* Saved accounts — moved into Settings */}
              {Array.isArray(vaultAccounts) && vaultAccounts.length > 0 && (
                <div style={{ padding: "10px 4px 4px", marginTop: 4, borderTop: "1px solid rgba(var(--border-rgb),0.12)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-strong)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6, paddingInline: 6 }}>
                    {T("Saved accounts", "الحسابات المحفوظة")}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {vaultAccounts.map((va) => {
                      const active = va.code === accountCode;
                      const isMain = va.code === mainAccountCode;
                      return (
                        <div
                          key={va.code}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: active ? "1px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                            background: active ? "var(--accent-1-soft)" : "var(--input-bg)",
                          }}
                        >
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              overflow: "hidden",
                              flexShrink: 0,
                              background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                              color: "#fff",
                              fontWeight: 800,
                              fontSize: 12,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {va.avatar ? (
                              <img src={va.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              String(va.name || "?").slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!active && typeof onSwitchAccount === "function") {
                                onSwitchAccount(va.code);
                              }
                            }}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              border: "none",
                              background: "none",
                              textAlign: "start",
                              cursor: active ? "default" : "pointer",
                              padding: 0,
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {va.name || va.username}
                              {isMain ? (
                                <span style={{ marginInlineStart: 6, fontSize: 10, fontWeight: 700, color: "var(--accent-1)" }}>
                                  · {T("Main", "أساسي")}
                                </span>
                              ) : null}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted-strong)", fontFamily: "ui-monospace, monospace" }} dir="ltr">
                              @{va.username || "—"}
                            </div>
                          </button>
                          {isAdmin && !isMain && typeof onSetMainAccount === "function" && (
                            <button
                              type="button"
                              title={T("Set as main account", "تعيين كحساب أساسي")}
                              onClick={() => onSetMainAccount(va.code)}
                              style={{
                                border: "none",
                                background: "none",
                                color: "var(--muted-strong)",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                padding: "4px 6px",
                                flexShrink: 0,
                              }}
                            >
                              {T("Main", "أساسي")}
                            </button>
                          )}
                          {typeof onUnlinkVaultAccount === "function" && (
                            <button
                              type="button"
                              title={T("Remove from this device", "إزالة من هذا الجهاز")}
                              aria-label={T("Remove from this device", "إزالة من هذا الجهاز")}
                              onClick={(e) => {
                                e.stopPropagation();
                                const label = va.name || va.username || va.code;
                                const ok = window.confirm(
                                  T(
                                    `Remove "${label}" from the switch list on this device only? The account stays in the database — you can sign in again anytime.`,
                                    `تشيل "${label}" من قائمة التبديل على الجهاز ده بس؟ الحساب مش هيتشال من قاعدة البيانات — تقدر تسجّل دخول بيه في أي وقت.`
                                  )
                                );
                                if (!ok) return;
                                onUnlinkVaultAccount(va.code);
                              }}
                              style={{
                                border: "none",
                                background: "none",
                                color: "var(--danger)",
                                cursor: "pointer",
                                padding: "4px 6px",
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 8,
                              }}
                            >
                              <TrashIcon size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {isAdmin && typeof onLinkAccount === "function" && (
                    <button
                      type="button"
                      onClick={() => { onLinkAccount(); }}
                      style={{
                        marginTop: 8,
                        width: "100%",
                        minHeight: 40,
                        borderRadius: 10,
                        border: "1px dashed rgba(var(--border-rgb),0.35)",
                        background: "transparent",
                        color: "var(--accent-1)",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      + {T("Add another account", "إضافة حساب آخر")}
                    </button>
                  )}
                  {!isAdmin && (
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.4, paddingInline: 6 }}>
                      {T(
                        "Standard accounts can save only one login on this device.",
                        "الحساب العادي يحفظ تسجيل دخول واحد فقط على هذا الجهاز."
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: 8, borderTop: "1px solid rgba(var(--border-rgb),0.12)", paddingTop: 6 }}>
                <Row danger tint="var(--danger)" icon={<LogoutIcon size={14} />} label={T("Sign Out", "تسجيل الخروج")} onClick={onLogout} />
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Information modal — same style as Settings, sized to content */}
      {infoOpen && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => { /* Stay open unless X */ }}
          className="modal-backdrop"
          style={{
            position: "fixed", inset: 0, zIndex: 3600,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="info-modal-title"
            className="modal-card"
            style={{
              width: "100%", maxWidth: "min(440px, 100%)",
              maxHeight: "min(90dvh, 820px)", overflowY: "auto",
              background: "var(--card)", color: "var(--ink)",
              border: "1px solid rgba(var(--border-rgb),0.14)",
              borderRadius: 16,
              padding: "clamp(14px, 3vw, 22px)",
              boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 id="info-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>
                {T("Information", "معلومات")}
              </h2>
              <button
                type="button"
                onClick={closeInfoModal}
                aria-label={T("Close", "إغلاق")}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <XIcon size={20} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {INFO_SECTIONS.map((s) => {
                const Icon = s.icon;
                const openSec = infoExpanded === s.id;
                const title = isAr ? s.titleAr : s.titleEn;
                const body = isAr ? s.bodyAr : s.bodyEn;
                return (
                  <div key={s.id} style={{
                    borderRadius: 10,
                    border: "1px solid rgba(var(--border-rgb),0.12)",
                    background: openSec ? "rgba(var(--border-rgb),0.06)" : "transparent",
                    overflow: "hidden",
                  }}>
                    <button
                      type="button"
                      onClick={() => setInfoExpanded(openSec ? null : s.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "10px 12px", border: "none", background: "transparent",
                        cursor: "pointer", color: "var(--ink)", textAlign: "start",
                      }}
                    >
                      <Icon size={14} style={{ color: "var(--accent-1)", flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{title}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{openSec ? "−" : "+"}</span>
                    </button>
                    {openSec && (
                      <ul style={{
                        margin: "0 0 12px", paddingInlineStart: 28, paddingInlineEnd: 12,
                        fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.55,
                      }}>
                        {body.map((line, i) => (
                          <li key={i} style={{ marginBottom: 5 }}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Notifications modal — same style as Settings */}
      {notifOpen && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => { /* Stay open unless X */ }}
          className="modal-backdrop"
          style={{
            position: "fixed", inset: 0, zIndex: 3600,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notif-modal-title"
            className="modal-card"
            style={{
              width: "100%", maxWidth: "min(440px, 100%)",
              maxHeight: "min(90dvh, 820px)", overflowY: "auto",
              background: "var(--card)", color: "var(--ink)",
              border: "1px solid rgba(var(--border-rgb),0.14)",
              borderRadius: 16,
              padding: "clamp(14px, 3vw, 22px)",
              boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 id="notif-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>
                {T( "Notifications", "الإشعارات")}
              </h2>
              <button
                type="button"
                onClick={closeNotifModal}
                aria-label={T( "Close", "إغلاق")}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <XIcon size={20} />
              </button>
            </div>
            <div
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{ padding: "6px 10px 12px", display: "flex", flexDirection: "column", gap: 10 }}
                    >
                      <button
                        type="button"
                        disabled={remindersBusy}
                        className="touch-target"
                        onClick={() => { if (remindersOn) onDisableReminders(); else onEnableReminders(); }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          width: "100%", padding: "9px 12px", minHeight: 44, borderRadius: 10, cursor: remindersBusy ? "default" : "pointer",
                          border: "1px solid rgba(var(--border-rgb),0.18)", background: "var(--input-bg)",
                          fontSize: 13, fontWeight: 600, color: "var(--ink)",
                        }}
                      >
                        <span>{remindersOn ? T( "Reminders: On", "التذكيرات: مفعّلة") : T( "Reminders: Off", "التذكيرات: متوقفة")}</span>
                        <span style={{
                          width: 36, height: 20, borderRadius: 10, position: "relative", flexShrink: 0,
                          background: remindersOn ? "#34c759" : "rgba(var(--border-rgb),0.35)",
                          transition: "background 0.2s ease",
                        }}>
                          <span style={{
                            position: "absolute", top: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff",
                            insetInlineStart: remindersOn ? 18 : 2, transition: "inset-inline-start 0.2s ease",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                          }} />
                        </span>
                      </button>

                      <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4, padding: "0 2px" }}>
                        {T(
                          "Daily reminder at 5:00 AM (Egypt time), even if you studied.",
                          "تذكير يومي الساعة 5:00 صباحًا (توقيت مصر)، حتى لو ذاكرت.")}
                      </div>

                      <div>
                        <label style={fieldLabel}>{T( "Notification title", "عنوان الإشعار")}</label>
                        <input
                          type="text"
                          value={reminderTitle || ""}
                          onChange={(e) => onChangeReminderTitle && onChangeReminderTitle(e.target.value)}
                          placeholder={T( "Time to review!", "وقت المراجعة!")}
                          maxLength={120}
                          style={fieldInput}
                          dir="auto"
                        />
                      </div>

                      <div>
                        <label style={fieldLabel}>{T( "Notification message", "نص الإشعار")}</label>
                        <textarea
                          value={reminderMessage || ""}
                          onChange={(e) => onChangeReminderMessage && onChangeReminderMessage(e.target.value)}
                          placeholder={tr(
                            isAr,
                            "It's been a while since you studied — time for a quick review.",
                            "عدّى وقت من غير ما تراجع — يلا نراجع شوية."
                          )}
                          maxLength={300}
                          rows={3}
                          style={{ ...fieldInput, resize: "vertical", minHeight: 64, lineHeight: 1.4 }}
                          dir="auto"
                        />
                        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3, textAlign: "end" }}>
                          {(reminderMessage || "").length}/300
                        </div>
                      </div>

                      <div style={{
                        border: "1px solid rgba(var(--border-rgb),0.18)", borderRadius: 10,
                        padding: "10px 12px", background: "var(--paper)",
                      }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>
                          {T( "Preview", "معاينة")}
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 3, lineHeight: 1.3 }} dir="auto">
                          {(reminderTitle && reminderTitle.trim()) || T( "Time to review!", "وقت المراجعة!")}
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.4 }} dir="auto">
                          {(reminderMessage && reminderMessage.trim()) || tr(
                            isAr,
                            "It's been a while since you studied — time for a quick review.",
                            "عدّى وقت من غير ما تراجع — يلا نراجع شوية."
                          )}
                        </div>
                      </div>

                      {onTestReminder && (
                        <button
                          type="button"
                          onClick={onTestReminder}
                          className="touch-target"
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            width: "100%", padding: "10px 12px", minHeight: 44, borderRadius: 10, cursor: "pointer",
                            border: "none", fontSize: 13, fontWeight: 700, color: "#fff",
                            background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                          }}
                        >
                          <BellIcon size={14} />
                          {T( "Send test notification", "ابعت إشعار تجريبي")}
                        </button>
                      )}

                      {/* Admin: broadcast push to every subscribed user */}
                      {isAdmin && myAccountCode && (
                        <div style={{
                          marginTop: 4, paddingTop: 12,
                          borderTop: "1px dashed rgba(var(--border-rgb),0.22)",
                          display: "flex", flexDirection: "column", gap: 10,
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted)" }}>
                            {T( "Notify everyone", "إشعار للجميع")}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
                            {T(
                              "Sends a real push to every user who turned reminders on.",
                              "بيبعت إشعار حقيقي لكل مستخدم فعّل التذكيرات.")}
                          </div>
                          <div>
                            <label style={fieldLabel}>{T( "Title", "العنوان")}</label>
                            <input
                              type="text"
                              value={pushTitle}
                              onChange={(e) => setPushTitle(e.target.value)}
                              placeholder={T( "e.g. New words added", "مثال: كلمات جديدة اتضافت")}
                              maxLength={120}
                              style={fieldInput}
                              dir="auto"
                            />
                          </div>
                          <div>
                            <label style={fieldLabel}>{T( "Message", "الرسالة")}</label>
                            <textarea
                              value={pushBody}
                              onChange={(e) => setPushBody(e.target.value)}
                              placeholder={T( "Optional body text…", "نص اختياري…")}
                              maxLength={300}
                              rows={2}
                              style={{ ...fieldInput, resize: "vertical", minHeight: 52, lineHeight: 1.4 }}
                              dir="auto"
                            />
                          </div>
                          {pushResult && (
                            <div style={{
                              fontSize: 12, lineHeight: 1.4,
                              color: /fail|فشل|error|خطأ|authorized|Unauthorized/i.test(pushResult) ? "var(--danger)" : "var(--success)",
                            }}>
                              {pushResult}
                            </div>
                          )}
                          <button
                            type="button"
                            disabled={pushSending || (!pushTitle.trim() && !pushBody.trim())}
                            className="touch-target"
                            onClick={sendBroadcast}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                              width: "100%", padding: "10px 12px", minHeight: 44, borderRadius: 10,
                              cursor: pushSending || (!pushTitle.trim() && !pushBody.trim()) ? "default" : "pointer",
                              border: "none", fontSize: 13, fontWeight: 700, color: "#fff",
                              background: "linear-gradient(135deg, #af52de, #5b8def)",
                              opacity: pushSending || (!pushTitle.trim() && !pushBody.trim()) ? 0.6 : 1,
                            }}
                          >
                            {pushSending ? <LoaderIcon size={14} /> : <BellIcon size={14} />}
                            {T( "Send to everyone", "إرسال للجميع")}
                          </button>
                        </div>
                      )}
                    </div>
          </div>
        </div>,
        document.body
      )}

      {/* Site banner modal — same style as Settings */}
      {bannerOpen && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => { /* Stay open unless X */ }}
          className="modal-backdrop"
          style={{
            position: "fixed", inset: 0, zIndex: 3600,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="banner-modal-title"
            className="modal-card"
            style={{
              width: "100%", maxWidth: "min(440px, 100%)",
              maxHeight: "min(90dvh, 820px)", overflowY: "auto",
              background: "var(--card)", color: "var(--ink)",
              border: "1px solid rgba(var(--border-rgb),0.14)",
              borderRadius: 16,
              padding: "clamp(14px, 3vw, 22px)",
              boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 id="banner-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>
                {T( "Site banner", "بانر الموقع")}
              </h2>
              <button
                type="button"
                onClick={closeBannerModal}
                aria-label={T( "Close", "إغلاق")}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <XIcon size={20} />
              </button>
            </div>
            <div
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{ padding: "6px 10px 12px", display: "flex", flexDirection: "column", gap: 10 }}
                    >
                      <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
                        {T(
                          "Banner appears at the very top for every signed-in user. They can dismiss it; a new message shows again.",
                          "البانر يظهر في أعلى الموقع لكل المسجّلين. يقدروا يقفلوه؛ رسالة جديدة هتظهر تاني.")}
                      </div>
                      {bannerSection("1 · Content", "١ · المحتوى")}
                      <div>
                        <label style={fieldLabel}>{T( "Message", "الرسالة")}</label>
                        <textarea
                          value={bannerMessage}
                          onChange={(e) => setBannerMessage(e.target.value)}
                          rows={3}
                          placeholder={T( "e.g. Maintenance tonight at 10pm", "مثال: صيانة الليلة الساعة ١٠")}
                          style={{ ...fieldInput, resize: "vertical", minHeight: 64, lineHeight: 1.4 }}
                          dir="auto"
                        />
                      </div>
                      {bannerSection("2 · Appearance", "٢ · المظهر")}
                      <div>
                        <label style={fieldLabel}>{T( "Banner color", "لون الشريط")}</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <input
                            type="color"
                            value={bannerColor && /^#[0-9A-Fa-f]{6}$/.test(bannerColor) ? bannerColor : "#146C94"}
                            onChange={(e) => setBannerColor(e.target.value)}
                            style={{ width: 40, height: 32, border: "1px solid rgba(var(--border-rgb),0.25)", borderRadius: 6, padding: 2, cursor: "pointer", background: "var(--card)" }}
                          />
                          {[
                            "#146C94", "#B3261E", "#2E7D32", "#D98B2B", "#6E3D96", "#1B1B1B",
                          ].map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setBannerColor(c)}
                              style={{
                                width: 24, height: 24, borderRadius: 6,
                                border: bannerColor === c ? "2px solid #fff" : "1px solid rgba(0,0,0,0.2)",
                                boxShadow: bannerColor === c ? `0 0 0 2px ${c}` : "none",
                                background: c, cursor: "pointer", padding: 0,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={fieldLabel}>{T("Banner size", "حجم الشريط")}</label>
                        <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.4 }}>
                          {T("How much vertical space the banner takes on screen.", "قد إيه من الشاشة الشريط هياخد (ارتفاع).")}
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                          {[
                            { id: "sm", en: "S", ar: "صغير", h: 28 },
                            { id: "md", en: "M", ar: "وسط", h: 40 },
                            { id: "lg", en: "L", ar: "كبير", h: 52 },
                            { id: "xl", en: "XL", ar: "أكبر", h: 64 },
                          ].map((opt) => {
                            const active = bannerSize === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setBannerSize(opt.id)}
                                className="touch-target"
                                style={{
                                  minHeight: 44, borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 12,
                                  border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                                  background: active ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                                  color: "var(--ink)",
                                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                                }}
                              >
                                <span style={{ width: "70%", height: Math.max(6, opt.h / 8), borderRadius: 3, background: active ? "var(--accent-1)" : "rgba(var(--border-rgb),0.35)" }} />
                                {T(opt.en, opt.ar)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="touch-target"
                        onClick={() => setBannerEnabled((v) => !v)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          width: "100%", padding: "9px 12px", minHeight: 44, borderRadius: 10, cursor: "pointer",
                          border: "1px solid rgba(var(--border-rgb),0.18)", background: "var(--input-bg)",
                          fontSize: 13, fontWeight: 600, color: "var(--ink)",
                        }}
                      >
                        <span>{T( "Show on site", "إظهار على الموقع")}</span>
                        <span style={{
                          width: 36, height: 20, borderRadius: 10, position: "relative", flexShrink: 0,
                          background: bannerEnabled ? "#34c759" : "rgba(var(--border-rgb),0.35)",
                          transition: "background 0.2s ease",
                        }}>
                          <span style={{
                            position: "absolute", top: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff",
                            insetInlineStart: bannerEnabled ? 18 : 2, transition: "inset-inline-start 0.2s ease",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                          }} />
                        </span>
                      </button>

                      {bannerSection("3 · Motion & text", "٣ · الحركة والنص")}
                      <div>
                        <label style={fieldLabel}>
                          {T( "Shine", "اللمعان")} — {bannerShine}%
                        </label>
                        <input
                          type="range" min={0} max={100} step={5}
                          value={bannerShine}
                          onChange={(e) => setBannerShine(Number(e.target.value))}
                          style={{ width: "100%", accentColor: "var(--accent-1)" }}
                        />
                        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                          {T( "Sweeping highlight + soft text glow", "لمعة متحركة + توهج خفيف للنص")}
                        </div>
                      </div>
                      <div>
                        <label style={fieldLabel}>
                          {T( "Repeat count", "عدد التكرارات")} — {bannerRepeats}×
                        </label>
                        <input
                          type="range" min={1} max={12} step={1}
                          value={bannerRepeats}
                          onChange={(e) => setBannerRepeats(Number(e.target.value))}
                          style={{ width: "100%", accentColor: "var(--accent-1)" }}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                          <span>{T( "Once", "مرة واحدة")}</span>
                          <span>{T( "12×", "١٢×")}</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                          {T( "How many times the message is chained in the ticker", "كام مرة الجملة تتكرر ورا بعض في شريط الأخبار")}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="touch-target"
                        onClick={() => setBannerFlash((v) => !v)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          width: "100%", padding: "9px 12px", minHeight: 44, borderRadius: 10, cursor: "pointer",
                          border: "1px solid rgba(var(--border-rgb),0.18)", background: "var(--input-bg)",
                          fontSize: 13, fontWeight: 600, color: "var(--ink)",
                        }}
                      >
                        <span>
                          {T( "Ambulance flash", "وميض إسعاف")}
                          <span style={{ display: "block", fontSize: 10.5, fontWeight: 500, color: "var(--muted)", marginTop: 2 }}>
                            {T( "Red / blue strobes + brightness pulse", "وميض أحمر/أزرق + نبض سطوع")}
                          </span>
                        </span>
                        <span style={{
                          width: 36, height: 20, borderRadius: 10, position: "relative", flexShrink: 0,
                          background: bannerFlash ? "#34c759" : "rgba(var(--border-rgb),0.35)",
                          transition: "background 0.2s ease",
                        }}>
                          <span style={{
                            position: "absolute", top: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff",
                            insetInlineStart: bannerFlash ? 18 : 2, transition: "inset-inline-start 0.2s ease",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                          }} />
                        </span>
                      </button>
                      <div>
                        <label style={fieldLabel}>
                          {T( "Motion speed", "سرعة الحركة")} — {bannerSpeed.toFixed(1)}×
                        </label>
                        <input
                          type="range" min={0.4} max={2} step={0.1}
                          value={bannerSpeed}
                          onChange={(e) => setBannerSpeed(Number(e.target.value))}
                          style={{ width: "100%", accentColor: "var(--accent-1)" }}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                          <span>{T( "Slow", "بطيء")}</span>
                          <span>{T( "Fast", "سريع")}</span>
                        </div>
                      </div>
                      <div>
                        <label style={fieldLabel}>
                          {T( "Text extension", "امتداد الجملة أو الكلمة")} — {bannerLetterSpacing}
                        </label>
                        <input
                          type="range" min={0} max={10} step={1}
                          value={bannerLetterSpacing}
                          onChange={(e) => setBannerLetterSpacing(Number(e.target.value))}
                          style={{ width: "100%", accentColor: "var(--accent-1)" }}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                          <span>{T( "Normal", "طبيعي")}</span>
                          <span>{T( "Stretched", "ممتد")}</span>
                        </div>
                      </div>
                      {bannerSection("4 · Duration", "٤ · المدة")}
                      <div>
                        <label style={fieldLabel}>
                          {T( "Stay on site", "مدة الظهور")}
                        </label>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <NumberStepper
                            min={0}
                            max={9999}
                            value={bannerDurationAmount}
                            onChange={(v) => setBannerDurationAmount(v)}
                            width={120}
                            aria-label={T("Stay on site", "مدة الظهور")}
                          />
                          <select
                            value={bannerDurationUnit}
                            onChange={(e) => setBannerDurationUnit(e.target.value)}
                            style={{ ...fieldInput, width: "auto", flex: "1 1 120px", cursor: "pointer" }}
                          >
                            <option value="minutes">{T( "Minutes", "دقائق")}</option>
                            <option value="hours">{T( "Hours", "ساعات")}</option>
                            <option value="days">{T( "Days", "أيام")}</option>
                          </select>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.4 }}>
                          {bannerDurationAmount > 0
                            ? T(
                                "Banner auto-hides after this time. No dismiss (X) button.",
                                "البانر هيختفي تلقائي بعد المدة دي. زر الإغلاق (X) مش هيظهر.")
                            : T(
                                "0 = stays until you turn it off. Users can dismiss with X.",
                                "٠ = يفضل ظاهر لحد ما تقفله. المستخدم يقدر يقفله بـ X.")}
                        </div>
                        {bannerRemainingLabel && (
                          <div
                            style={{
                              marginTop: 10,
                              padding: "10px 12px",
                              borderRadius: 10,
                              background: "rgba(var(--accent-rgb, 25,167,206), 0.12)",
                              border: "1px solid rgba(var(--accent-rgb, 25,167,206), 0.35)",
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden="true">⏱</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-1)", marginBottom: 2 }}>
                                {T("Live banner timer", "مؤقت البانر الحالي")}
                              </div>
                              <div style={{
                                fontFamily: "ui-monospace, 'Source Sans 3', monospace",
                                fontSize: 15,
                                fontWeight: 800,
                                color: "var(--ink)",
                                letterSpacing: "0.02em",
                              }}>
                                {bannerRemainingLabel}
                              </div>
                              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                                {T("Until the published banner auto-removes", "لحد ما البانر المنشور يتشال لوحده")}
                              </div>
                            </div>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                          {[
                            { a: 0, u: "hours", label: T( "Forever", "دائم") },
                            { a: 30, u: "minutes", label: T( "30m", "٣٠د") },
                            { a: 1, u: "hours", label: T( "1h", "١س") },
                            { a: 6, u: "hours", label: T( "6h", "٦س") },
                            { a: 1, u: "days", label: T( "1d", "يوم") },
                            { a: 7, u: "days", label: T( "7d", "أسبوع") },
                          ].map((q) => (
                            <button
                              key={q.label}
                              type="button"
                              onClick={() => { setBannerDurationAmount(q.a); setBannerDurationUnit(q.u); }}
                              style={{
                                padding: "4px 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                                border: "1px solid rgba(var(--border-rgb),0.2)",
                                background: bannerDurationAmount === q.a && bannerDurationUnit === q.u ? "var(--accent-1)" : "var(--input-bg)",
                                color: bannerDurationAmount === q.a && bannerDurationUnit === q.u ? "#fff" : "var(--ink)",
                              }}
                            >
                              {q.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {bannerSection("5 · Preview & publish", "٥ · معاينة ونشر")}
                      {/* Live preview — shine + optional ambulance flash */}
                      <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid rgba(var(--border-rgb),0.15)", position: "relative" }}>
                        <div
                          className={bannerFlash ? "site-banner--flash" : undefined}
                          style={{
                            background: bannerColor || "#146C94", color: "#fff",
                            padding: "10px 12px", fontSize: 14, fontWeight: 700,
                            display: "flex", alignItems: "center", gap: 8, textAlign: "center",
                            position: "relative", overflow: "hidden",
                            direction: hasArabic(bannerMessage) ? "rtl" : "ltr",
                            unicodeBidi: "isolate",
                            boxShadow: bannerShine > 0
                              ? `inset 0 0 ${8 + bannerShine * 0.18}px rgba(255,255,255,${(bannerShine / 100) * 0.22})`
                              : undefined,
                          }}
                        >
                          {bannerShine > 0 && (
                            <span aria-hidden="true" style={{
                              position: "absolute", inset: 0, pointerEvents: "none",
                              background: `linear-gradient(105deg, transparent 30%, rgba(255,255,255,${Math.min(0.65, (bannerShine / 100) * 0.6)}) 50%, transparent 70%)`,
                              backgroundSize: "220% 100%",
                              animation: `siteBannerShimmer ${(5 / Math.max(0.4, bannerSpeed)).toFixed(2)}s ease-in-out infinite`,
                            }} />
                          )}
                          {bannerFlash && (
                            <>
                              <span aria-hidden="true" className="site-banner-strobe site-banner-strobe--left" />
                              <span aria-hidden="true" className="site-banner-strobe site-banner-strobe--right" />
                              <span aria-hidden="true" className="site-banner-flash-pulse" />
                            </>
                          )}
                          <span style={{ width: 18, flexShrink: 0, position: "relative", zIndex: 2 }} />
                          <span style={{
                            flex: 1,
                            textAlign: "center",
                            fontWeight: 700,
                            position: "relative",
                            zIndex: 2,
                            unicodeBidi: "isolate",
                            letterSpacing: bannerLetterSpacing && !hasArabic(bannerMessage) ? `${bannerLetterSpacing}px` : undefined,
                            textShadow: bannerShine > 30
                              ? `0 0 ${Math.round(bannerShine / 12)}px rgba(255,255,255,${(bannerShine / 100) * 0.45})`
                              : undefined,
                          }}>
                            {bannerMessage.trim()
                              ? (() => {
                                  const rtl = hasArabic(bannerMessage);
                                  const base = stretchArabicText(bannerMessage.trim(), bannerLetterSpacing);
                                  const fixed = rtl
                                    ? base.replace(/([.!?…]+)\s*$/u, "$1\u200F")
                                    : base.replace(/([.!?…]+)\s*$/u, "$1\u200E");
                                  if (bannerRepeats <= 1) return fixed;
                                  const sep = "        ";
                                  return Array(Math.min(3, bannerRepeats)).fill(fixed).join(sep)
                                    + (bannerRepeats > 3 ? sep + "…" : "");
                                })()
                              : T( "Preview…", "معاينة…")}
                          </span>
                          <span style={{ opacity: 0.7, width: 18, textAlign: "center", position: "relative", zIndex: 2 }}>×</span>
                        </div>
                      </div>
                      {bannerMsg && (
                        <div style={{
                          fontSize: 12,
                          color: /fail|فشل/i.test(bannerMsg) ? "var(--danger)" : "var(--success)",
                        }}>
                          {bannerMsg}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          disabled={bannerSaving}
                          className="touch-target"
                          onClick={saveBanner}
                          style={{
                            flex: 1, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            padding: "10px 12px", borderRadius: 10, border: "none", cursor: bannerSaving ? "default" : "pointer",
                            fontSize: 13, fontWeight: 700, color: "#fff",
                            background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                            opacity: bannerSaving ? 0.7 : 1,
                          }}
                        >
                          {bannerSaving ? <LoaderIcon size={14} /> : null}
                          {T( "Save banner", "حفظ البانر")}
                        </button>
                        <button
                          type="button"
                          disabled={bannerSaving}
                          className="touch-target"
                          onClick={clearBanner}
                          style={{
                            minHeight: 44, padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                            fontSize: 13, fontWeight: 700, color: "var(--danger)",
                            background: "none", border: "1px solid var(--danger-border, rgba(179,38,30,0.35))",
                          }}
                        >
                          {T( "Clear", "إزالة")}
                        </button>
                      </div>
                    </div>
          </div>
        </div>,
        document.body
      )}


      {deviceModalOpen && typeof onChangeDeviceMode === "function" && typeof document !== "undefined" && createPortal(
        <div onClick={() => { /* Stay open unless X */ }} className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 3600, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="device-modal-title" style={{ background: "var(--card)", borderRadius: 16, padding: 20, width: "100%", maxWidth: 440, boxShadow: "0 24px 60px -20px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 id="device-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700 }}>{T("Device layout", "واجهة الجهاز")}</h2>
              <button type="button" onClick={() => setDeviceModalOpen(false)} aria-label={T("Close", "إغلاق")} style={{ border: "none", background: "var(--input-bg)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "var(--icon-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon size={18} /></button>
            </div>
            <DevicePicker
              mode={deviceMode}
              onSelect={(id) => { onChangeDeviceMode(id); setDeviceModalOpen(false); }}
              isAr={isAr}
              compact
            />
          </div>
        </div>,
        document.body
      )}

      {/* Language settings — dedicated modal */}
      {langModalOpen && typeof document !== "undefined" && createPortal(
        <div onClick={() => { /* Stay open unless X */ }} className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 3600, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="lang-modal-title" className="modal-card" style={{ width: "100%", maxWidth: 400, maxHeight: "min(90dvh, 820px)", overflowY: "auto", background: "var(--card)", color: "var(--ink)", borderRadius: 18, padding: 20, boxShadow: "0 24px 50px -12px rgba(0,0,0,0.45)", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 id="lang-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700 }}>{T("Language", "اللغة")}</h2>
              <button type="button" onClick={() => setLangModalOpen(false)} aria-label={T("Close", "إغلاق")} style={{ border: "none", background: "var(--input-bg)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "var(--icon-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon size={18} /></button>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.45 }}>
              {T("Changes menus, settings, and account screens — not dictionary words.", "بتغيّر القوائم والإعدادات والحساب — مش كلمات القاموس.")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {UI_LANGS.map((l) => {
                const active = lang === l.id;
                return (
                  <button key={l.id} type="button" onClick={() => { onChangeAppLang && onChangeAppLang(l.id); setLangModalOpen(false); }} className="touch-target"
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
        </div>,
        document.body
      )}

      {/* Accent / dialect — dedicated modal */}
      {accentModalOpen && typeof document !== "undefined" && createPortal(
        <div onClick={() => { /* Stay open unless X */ }} className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 3600, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="accent-modal-title" className="modal-card" style={{ width: "100%", maxWidth: 400, maxHeight: "min(90dvh, 820px)", overflowY: "auto", background: "var(--card)", color: "var(--ink)", borderRadius: 18, padding: 20, boxShadow: "0 24px 50px -12px rgba(0,0,0,0.45)", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 id="accent-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700 }}>{T("Accent / dialect", "اللهجة / النطق")}</h2>
              <button type="button" onClick={() => setAccentModalOpen(false)} aria-label={T("Close", "إغلاق")} style={{ border: "none", background: "var(--input-bg)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "var(--icon-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon size={18} /></button>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.45 }}>
              {T("Default Cambridge Dictionary accent for all speaker buttons (including zoom view).", "اللهجة الافتراضية من كامبريدج لكل أزرار السماعة (بما فيها العرض الكبير).")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {EN_ACCENTS.map((a) => {
                const active = enAccentPref === a.code;
                return (
                  <button key={a.code} type="button" onClick={() => { setEnAccentPref(a.code); saveEnAccent(a.code); setAccentModalOpen(false); }} className="touch-target"
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
        </div>,
        document.body
      )}

      {/* Appearance — theme + color scheme */}
      {appearanceModalOpen && typeof document !== "undefined" && createPortal(
        <div onClick={() => { /* Stay open unless X */ }} className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 3600, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="appearance-modal-title" className="modal-card" style={{ width: "100%", maxWidth: 400, maxHeight: "min(90dvh, 820px)", overflowY: "auto", background: "var(--card)", color: "var(--ink)", borderRadius: 18, padding: 20, boxShadow: "0 24px 50px -12px rgba(0,0,0,0.45)", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 id="appearance-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700 }}>{T("Appearance", "المظهر")}</h2>
              <button type="button" onClick={() => setAppearanceModalOpen(false)} aria-label={T("Close", "إغلاق")} style={{ border: "none", background: "var(--input-bg)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "var(--icon-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon size={18} /></button>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.45 }}>
              {T("Customize logo, light/dark mode, and the accent color of the interface.", "خصّص الشعار والوضع الفاتح/الداكن ولون الواجهة.")}
            </p>

            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
              {T("Logo mark", "شعار الموقع")}
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.4 }}>
              {T("Pick a mark for the site header. Same animation for all options.", "اختار شكل الشعار في الهيدر. نفس الحركة لكل الخيارات.")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
              {BRAND_PRESETS.map((p) => {
                const active = brandPresetId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setBrandPresetId(p.id);
                      savePresetId(p.id);
                      setBrandAddMode(false);
                    }}
                    title={T(p.en, p.ar)}
                    className="touch-target"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      padding: "8px 4px",
                      borderRadius: 12,
                      border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.12)",
                      background: active ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <span
                      className="brand-mark-badge"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "linear-gradient(145deg, var(--accent-1), var(--accent-2))",
                        boxShadow: "0 4px 12px -4px color-mix(in srgb, var(--accent-1) 50%, transparent)",
                        position: "relative",
                        fontSize: 16,
                      }}
                    >
                      <span className="brand-mark-badge-shine" style={{ position: "absolute", inset: 0, borderRadius: "inherit", overflow: "hidden" }} />
                      <span className="brand-mark-glyph" style={{ position: "relative", zIndex: 1 }}>{p.glyph}</span>
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-strong)", textAlign: "center", lineHeight: 1.2 }}>
                      {T(p.en, p.ar)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ marginBottom: 18 }}>
              {!brandAddMode ? (
                <button
                  type="button"
                  onClick={() => setBrandAddMode(true)}
                  className="touch-target"
                  style={{
                    width: "100%",
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderRadius: 12,
                    border: brandPresetId === "custom" ? "2px solid var(--accent-1)" : "1px dashed rgba(var(--border-rgb),0.35)",
                    background: brandPresetId === "custom" ? "color-mix(in srgb, var(--accent-1) 10%, var(--card))" : "transparent",
                    color: "var(--ink)",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <PlusIcon size={16} />
                  {brandPresetId === "custom"
                    ? T(`Custom: ${brandCustomGlyph}`, `مخصص: ${brandCustomGlyph}`)
                    : T("Add your own mark", "أضف شعارك الخاص")}
                </button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const g = (brandDraftCustom || "").trim().slice(0, 4);
                    if (!g) return;
                    setBrandCustomGlyph(g);
                    saveCustomGlyph(g);
                    setBrandPresetId("custom");
                    savePresetId("custom");
                    setBrandAddMode(false);
                    setBrandDraftCustom("");
                  }}
                  style={{ display: "flex", gap: 8, alignItems: "center" }}
                >
                  <input
                    value={brandDraftCustom}
                    onChange={(e) => setBrandDraftCustom(e.target.value.slice(0, 4))}
                    placeholder={T("Emoji or letter", "إيموجي أو حرف")}
                    autoFocus
                    style={{
                      flex: 1,
                      minHeight: 42,
                      borderRadius: 10,
                      border: "1px solid rgba(var(--border-rgb),0.2)",
                      background: "var(--input-bg)",
                      color: "var(--ink)",
                      padding: "8px 12px",
                      fontSize: 16,
                      fontFamily: "inherit",
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      minHeight: 42,
                      padding: "0 14px",
                      borderRadius: 10,
                      border: "none",
                      background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <CheckIcon size={14} />
                    {T("Save", "حفظ")}
                  </button>
                </form>
              )}
            </div>

            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
              {T("Mode", "الوضع")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
              <button type="button" onClick={() => onChangeTheme ? onChangeTheme("light") : onToggleTheme()} className="touch-target"
                style={{
                  minHeight: 48, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13,
                  border: theme === "light" ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                  background: theme === "light" ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                  color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                <SunIcon size={16} /> {T("Light", "فاتح")}
              </button>
              <button type="button" onClick={() => onChangeTheme ? onChangeTheme("dark") : onToggleTheme()} className="touch-target"
                style={{
                  minHeight: 48, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13,
                  border: theme === "dark" ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                  background: theme === "dark" ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                  color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                <MoonIcon size={16} /> {T("Dark", "داكن")}
              </button>
              <button type="button" onClick={() => onChangeTheme && onChangeTheme("system")} className="touch-target"
                style={{
                  minHeight: 48, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13,
                  border: theme === "system" ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                  background: theme === "system" ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                  color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                <GlobeIcon size={16} /> {T("System", "النظام")}
              </button>
            </div>

            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8, marginTop: 4 }}>
              {T("List density", "كثافة القائمة")}
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.4 }}>
              {T("Comfortable = more space. Compact = tighter cards and lists.", "مريح = مسافات أكبر. مضغوط = كروت وقوائم أضيق.")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
              <button type="button" onClick={() => setUiDensity("comfortable")} className="touch-target"
                style={{
                  minHeight: 44, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13,
                  border: uiDensity === "comfortable" ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                  background: uiDensity === "comfortable" ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                  color: "var(--ink)",
                }}>
                {T("Comfortable", "مريح")}
              </button>
              <button type="button" onClick={() => setUiDensity("compact")} className="touch-target"
                style={{
                  minHeight: 44, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13,
                  border: uiDensity === "compact" ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                  background: uiDensity === "compact" ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                  color: "var(--ink)",
                }}>
                {T("Compact", "مضغوط")}
              </button>
            </div>

            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
              {T("Card height", "ارتفاع الكارت")}
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.4 }}>
              {T("How tall word cards look (top–bottom padding).", "قد إيه ارتفاع كروت الكلمات (من فوق لتحت).")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
              {[
                { id: "compact", en: "Thin", ar: "رفيع" },
                { id: "normal", en: "Normal", ar: "عادي" },
                { id: "comfortable", en: "Tall", ar: "مرتفع" },
              ].map((opt) => {
                const active = cardHeight === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCardHeight(opt.id)}
                    className="touch-target"
                    style={{
                      minHeight: 44, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13,
                      border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                      background: active ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                      color: "var(--ink)",
                    }}
                  >
                    {T(opt.en, opt.ar)}
                  </button>
                );
              })}
            </div>

            {typeof onChangeUiScale === "function" && (
              <>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted-strong)", margin: "14px 0 8px" }}>
                  {T("Text size", "حجم الخط")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
                  {[0.9, 1, 1.1, 1.2].map((s) => (
                    <button key={s} type="button" onClick={() => onChangeUiScale(s)} className="touch-target"
                      style={{
                        minHeight: 44, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13,
                        border: uiScale === s ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                        background: uiScale === s ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                        color: "var(--ink)",
                      }}>
                      {s === 0.9 ? "S" : s === 1 ? "M" : s === 1.1 ? "L" : "XL"}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
              {T("Modal corners", "دائرية النوافذ")}
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.4 }}>
              {T("How rounded the dialog windows look.", "قد إيه زوايا نوافذ الحوار تكون مدوّرة.")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
              {[
                { id: "sharp", en: "Sharp", ar: "حادّة", r: 6 },
                { id: "soft", en: "Soft", ar: "ناعمة", r: 16 },
                { id: "round", en: "Round", ar: "دائرية", r: 28 },
              ].map((opt) => {
                const active = uiRadius === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setUiRadius(opt.id)}
                    className="touch-target"
                    style={{
                      minHeight: 52, borderRadius: opt.r, cursor: "pointer", fontWeight: 700, fontSize: 12,
                      border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                      background: active ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                      color: "var(--ink)",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                    }}
                  >
                    <span style={{
                      width: 28, height: 18,
                      border: "2px solid var(--accent-1)",
                      borderRadius: opt.r > 20 ? 10 : opt.r > 10 ? 6 : 2,
                      background: "color-mix(in srgb, var(--accent-1) 20%, transparent)",
                    }} />
                    {T(opt.en, opt.ar)}
                  </button>
                );
              })}
            </div>

            {onChangeAccent && (
              <>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
                  {T("Color theme", "لون الواجهة")}
                </div>
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.4 }}>
                  {T("Pick a vibrant palette, or choose any custom color.", "اختار لوحة ألوان زاهية، أو لون مخصص بالكامل.")}
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                  {Object.entries(ACCENT_THEMES).map(([key, th]) => {
                    const swatch = (th[theme] || th.light).a1;
                    const active = key === accentTheme;
                    const lab = th.label && typeof th.label === "object" ? T(th.label.en, th.label.ar) : (th.label || key);
                    return (
                      <button key={key} type="button" onClick={() => onChangeAccent(key)}
                        title={lab} aria-label={lab}
                        className="header-menu-swatch touch-target"
                        style={{
                          width: 36, height: 36, borderRadius: "50%", background: swatch, cursor: "pointer", padding: 0,
                          border: active ? "2px solid var(--ink)" : "1px solid rgba(var(--border-rgb),0.3)",
                          boxShadow: active ? `0 0 0 3px var(--card), 0 0 0 5px ${swatch}66` : "none",
                        }}
                      />
                    );
                  })}
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                  padding: "10px 12px", borderRadius: 12, background: "var(--input-bg)",
                  border: accentTheme === "custom" ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.12)",
                }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", flex: 1 }}>
                    {T("Custom color", "لون مخصص")}
                  </label>
                  <input
                    type="color"
                    defaultValue={typeof loadCustomAccentHex === "function" ? loadCustomAccentHex() : "#19A7CE"}
                    onChange={(e) => {
                      const hex = e.target.value;
                      try { saveCustomAccentHex(hex); } catch (_) {}
                      try { saveAccent("custom"); } catch (_) {}
                      if (onChangeAccent) onChangeAccent("custom");
                      try { applyAccentTheme("custom", theme, hex); } catch (_) {}
                    }}
                    style={{
                      width: 44, height: 36, border: "1px solid rgba(var(--border-rgb),0.25)",
                      borderRadius: 8, padding: 2, cursor: "pointer", background: "var(--card)",
                    }}
                    aria-label={T("Pick custom color", "اختيار لون مخصص")}
                  />
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}


    </div>
  );
}
