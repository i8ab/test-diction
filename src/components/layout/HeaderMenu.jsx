import { useState, useEffect, useRef } from "react";
import { tr, UI_LANGS } from "../../lib/config/i18n";
import { ACCENT_THEMES } from "../../lib/state/storage";

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
  UsersIcon, SunIcon, MoonIcon, UserIcon, LogoutIcon, PaletteIcon, MenuIcon, BellIcon, BellOffIcon, XIcon, CheckIcon, TrashIcon, LayersIcon, LoaderIcon, SettingsIcon, BookIcon,
} from "../common/Icons";

export default function HeaderMenu({
  theme, onToggleTheme, isAdmin, onOpenAccount, onOpenAdmin, onLogout, isAr,
  appLang = "en", onChangeAppLang,
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
  myAccountCode = null,
  focusMode = false,
  onToggleFocus = null,
  onOpenInfo = null,
}) {
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const [bannerDurationAmount, setBannerDurationAmount] = useState(0);
  const [bannerDurationUnit, setBannerDurationUnit] = useState("hours"); // minutes | hours | days
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerMsg, setBannerMsg] = useState("");

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

  function closeMenu() {
    setOpen(false);
    setRequestsOpen(false);
  }

  function openSettings() {
    closeMenu();
    setSettingsOpen(true);
  }

  function closeSettings() {
    setSettingsOpen(false);
    setNotifOpen(false);
    setBannerOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) closeMenu(); }
    function onKeyDown(e) { if (e.key === "Escape") closeMenu(); }
    document.addEventListener("pointerdown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!settingsOpen) return;
    function onKeyDown(e) { if (e.key === "Escape") closeSettings(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen]);

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
      <button onClick={() => setOpen((o) => !o)} title={T( "Menu", "القائمة")} aria-label={T( "Menu", "القائمة")} aria-expanded={open} className="lift-hover touch-target"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, border: "1px solid rgba(var(--border-rgb),0.25)", background: "none", color: "var(--icon-muted)", borderRadius: 10, cursor: "pointer", position: "relative", flexShrink: 0 }}>
        <MenuIcon size={16} />
        {isAdmin && pendingCount > 0 && (
          <span style={{
            position: "absolute", top: -3, insetInlineEnd: -3, minWidth: 16, height: 16, borderRadius: 8,
            background: "var(--danger)", color: "#fff", fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
            boxShadow: "0 0 0 2px var(--card)",
          }}>{pendingCount > 9 ? "9+" : pendingCount}</span>
        )}
      </button>
      {open && (
        <>
          <style>{`
            .header-menu-item { transition: background 0.12s ease; }
            .header-menu-item:hover:not(:disabled) { background: var(--input-bg); }
            .header-menu-item:active:not(:disabled) { background: var(--input-bg); opacity: 0.9; }
            .header-menu-swatch { transition: box-shadow 0.12s ease; }
            .header-menu-panel {
              position: absolute; top: calc(100% + 8px); inset-inline-end: 0;
              min-width: min(280px, calc(100vw - 24px)); max-width: min(320px, calc(100vw - 16px));
              background: var(--card); border: 1px solid rgba(var(--border-rgb),0.14);
              border-radius: 17px;
              box-shadow: 0 22px 48px -18px rgba(0,0,0,0.42), 0 2px 8px -2px rgba(0,0,0,0.15);
              overflow: hidden; z-index: 40;
            }
            @media (max-width: 480px) {
              .header-menu-panel {
                position: fixed; top: auto; bottom: 0; inset-inline: 0;
                max-width: none; min-width: 0; width: 100%;
                border-radius: 18px 18px 0 0;
                max-height: min(85dvh, 640px);
              }
            }
          `}</style>
          <div className="header-menu-panel" role="menu">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px 8px" }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted)" }}>
                {T( "Menu", "القائمة")}
              </span>
              <button
                type="button"
                aria-label={T( "Close", "إغلاق")}
                className="touch-target"
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); closeMenu(); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", color: "var(--icon-muted)", background: "var(--input-bg)", border: "none", cursor: "pointer" }}
              >
                <XIcon size={12} />
              </button>
            </div>
            <div style={{ overflowY: "auto", overflowX: "hidden", maxHeight: "min(480px, calc(100dvh - 100px))", overscrollBehavior: "contain", padding: "0 6px 6px", display: "flex", flexDirection: "column", gap: 1 }}>
              <Row
                tint="#64748b"
                icon={<SettingsIcon size={14} />}
                label={T( "Settings", "الإعدادات")}
                onClick={openSettings}
              />
              {typeof onToggleFocus === "function" && (
                <Row
                  tint={focusMode ? "#fff" : "#6366f1"}
                  icon={<LayersIcon size={14} />}
                  label={focusMode ? T( "Exit focus mode", "إغلاق وضع التركيز") : T( "Focus mode", "وضع التركيز")}
                  onClick={onToggleFocus}
                />
              )}
{/* ========== New account requests (admins) ========== */}
              {isAdmin && (
                <div style={{ borderTop: "1px solid rgba(var(--border-rgb),0.12)", marginTop: 4, paddingTop: 4 }}>
                  <Row
                    tint="#af52de"
                    icon={<UsersIcon size={14} />}
                    label={T( "New requests", "طلبات جديدة")}
                    onClick={() => setRequestsOpen((v) => !v)}
                    trailing={
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {pendingCount > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "var(--danger)", borderRadius: 10, padding: "2px 7px" }}>
                            {pendingCount}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{requestsOpen ? "▾" : (isAr ? "◂" : "▸")}</span>
                      </span>
                    }
                  />
                  {requestsOpen && (
                    <div onPointerDown={(e) => e.stopPropagation()} style={{ padding: "6px 8px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                      {pendingCount === 0 ? (
                        <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "8px 6px", lineHeight: 1.45 }}>
                          {T( "No pending account requests.", "لا توجد طلبات حساب معلّقة.")}
                        </div>
                      ) : (
                        pendingAccounts.map((a) => (
                          <div key={a.code} style={{
                            border: "1px solid rgba(var(--border-rgb),0.16)", borderRadius: 10,
                            padding: "10px 10px", background: "var(--input-bg)",
                          }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{a.name}</div>
                            <div style={{ fontSize: 12, color: "var(--muted-strong)", fontFamily: "ui-monospace, monospace", marginTop: 2 }} dir="ltr">@{a.username || "—"}</div>
                            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                disabled={busyCode === a.code}
                                className="touch-target"
                                onClick={() => approve(a.code)}
                                style={{
                                  flex: 1, minHeight: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                  padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                                  fontSize: 12.5, fontWeight: 700, color: "#fff", background: "var(--success)",
                                }}
                              >
                                <CheckIcon size={13} /> {T( "Approve", "موافقة")}
                              </button>
                              <button
                                type="button"
                                disabled={busyCode === a.code}
                                className="touch-target"
                                onClick={() => reject(a.code)}
                                style={{
                                  flex: 1, minHeight: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                  padding: "8px 10px", borderRadius: 8, border: "1px solid var(--danger)", cursor: "pointer",
                                  fontSize: 12.5, fontWeight: 700, color: "var(--danger)", background: "transparent",
                                }}
                              >
                                <TrashIcon size={13} /> {T( "Reject", "رفض")}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={{ borderTop: "1px solid rgba(var(--border-rgb),0.12)", marginTop: 2, paddingTop: 1 }}>
                <Row tint="#5b8def" icon={<UserIcon size={14} />} label={T( "My Account", "حسابي")} onClick={onOpenAccount} />
                {isAdmin && (
                  <Row tint="#af52de" icon={<UsersIcon size={14} />} label={T( "Admin Panel", "لوحة التحكم")} onClick={onOpenAdmin} />
                )}
                <Row danger tint="var(--danger)" icon={<LogoutIcon size={14} />} label={T( "Sign Out", "تسجيل الخروج")} onClick={onLogout} />
              </div>
            </div>
          </div>
        </>
      )}

      {settingsOpen && (
        <div
          onClick={closeSettings}
          className="modal-backdrop"
          style={{
            position: "fixed", inset: 0, zIndex: 2500,
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

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {typeof onOpenInfo === "function" && (
                <Row
                  tint="#5b8def"
                  icon={<BookIcon size={14} />}
                  label={T( "Information", "معلومات")}
                  onClick={() => { closeSettings(); onOpenInfo(); }}
                />
              )}
              <Row
                tint="#f5a623"
                icon={theme === "dark" ? <SunIcon size={14} /> : <MoonIcon size={14} />}
                label={theme === "dark" ? T( "Light Mode", "الوضع الفاتح") : T( "Dark Mode", "الوضع الداكن")}
                onClick={onToggleTheme}
              />

              {/* Site language (chrome only — not dictionary content) */}
              {onChangeAppLang && (
                <div style={{ padding: "8px 10px 12px", borderBottom: "1px solid rgba(var(--border-rgb),0.1)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--icon-muted)", marginBottom: 8 }}>
                    {T("Site language", "لغة الموقع", "Sprache der Website", "Langue du site")}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {UI_LANGS.map((l) => {
                      const active = lang === l.id;
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => onChangeAppLang(l.id)}
                          className="touch-target"
                          style={{
                            minHeight: 42, padding: "8px 10px", borderRadius: 10, cursor: "pointer",
                            fontSize: 13, fontWeight: 700,
                            border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.18)",
                            background: active ? "color-mix(in srgb, var(--accent-1) 14%, var(--card))" : "var(--input-bg)",
                            color: "var(--ink)",
                          }}
                        >
                          {l.native}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.4 }}>
                    {T(
                      "Changes menus, settings, and account screens — not dictionary words.",
                      "بتغيّر القوائم والإعدادات والحساب — مش كلمات القاموس.",
                      "Ändert Menüs, Einstellungen und Konto — nicht die Wörterbuchinhalte.",
                      "Change les menus, réglages et compte — pas le contenu du dictionnaire."
                    )}
                  </div>
                </div>
              )}

              {/* ========== Notifications section ========== */}
              {(onEnableReminders || onDisableReminders) && (
                <div style={{ borderTop: "1px solid rgba(var(--border-rgb),0.12)", marginTop: 4, paddingTop: 4 }}>
                  <Row
                    tint={remindersOn ? "#34c759" : "#8e8e93"}
                    icon={remindersOn ? <BellIcon size={14} /> : <BellOffIcon size={14} />}
                    label={T( "Notifications", "الإشعارات")}
                    onClick={() => setNotifOpen((v) => !v)}
                    trailing={
                      <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                        {notifOpen ? "▾" : (isAr ? "◂" : "▸")}
                      </span>
                    }
                  />
                  {notifOpen && (
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
                  )}
                </div>
              )}

              {/* ========== Site banner (admins) ========== */}
              {isAdmin && onPersistSiteBanner && (
                <div style={{ borderTop: "1px solid rgba(var(--border-rgb),0.12)", marginTop: 4, paddingTop: 4 }}>
                  <Row
                    tint="#146C94"
                    icon={<LayersIcon size={14} />}
                    label={T( "Site banner", "بانر الموقع")}
                    onClick={() => setBannerOpen((v) => !v)}
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
                          {bannerOpen ? "▾" : (isAr ? "◂" : "▸")}
                        </span>
                      </span>
                    }
                  />
                  {bannerOpen && (
                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{ padding: "6px 10px 12px", display: "flex", flexDirection: "column", gap: 10 }}
                    >
                      <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
                        {T(
                          "Banner appears at the very top for every signed-in user. They can dismiss it; a new message shows again.",
                          "البانر يظهر في أعلى الموقع لكل المسجّلين. يقدروا يقفلوه؛ رسالة جديدة هتظهر تاني.")}
                      </div>
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
                      <div>
                        <label style={fieldLabel}>
                          {T( "Stay on site", "مدة الظهور")}
                        </label>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <input
                            type="number"
                            min={0}
                            max={9999}
                            step={1}
                            value={bannerDurationAmount}
                            onChange={(e) => setBannerDurationAmount(Math.max(0, Number(e.target.value) || 0))}
                            placeholder="0"
                            style={{ ...fieldInput, width: 90, flex: "0 0 auto" }}
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
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
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
                  )}
                </div>
              )}

              {onChangeAccent && (
                <div style={{ padding: "10px 12px", marginTop: 2, borderTop: "1px solid rgba(var(--border-rgb),0.12)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: "var(--icon-muted)", marginBottom: 9 }}>
                    <PaletteIcon size={13} /> {T( "Color theme", "لون الواجهة")}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {Object.entries(ACCENT_THEMES).map(([key, t]) => {
                      const swatch = (t[theme] || t.light).a1;
                      const active = key === accentTheme;
                      return (
                        <button key={key} type="button" onClick={() => onChangeAccent(key)}
                          title={T( t.label.en, t.label.ar)} aria-label={T( t.label.en, t.label.ar)}
                          className="header-menu-swatch touch-target"
                          style={{ width: 28, height: 28, borderRadius: "50%", background: swatch, border: active ? "2px solid var(--ink)" : "1px solid rgba(var(--border-rgb),0.3)", cursor: "pointer", padding: 0, boxShadow: active ? "0 0 0 3px var(--card), 0 0 0 4px " + swatch + "55" : "none" }} />
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
