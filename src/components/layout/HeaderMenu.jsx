import { useState, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { loadEnAccent } from "../../lib/utils/speech";
import { tr } from "../../lib/config/i18n";

import {
  UsersIcon, LogoutIcon, MenuIcon, XIcon, CheckIcon, TrashIcon, LayersIcon, SettingsIcon, StarIcon,
} from "../common/Icons";
import { useBodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import {
  loadPresetId,
  loadCustomGlyph,
  savePresetId,
  saveCustomGlyph,
} from "../common/BrandMark";
import BannerModal from "./BannerModal";
import NotificationsModal from "./NotificationsModal";
import AppearanceModal from "./AppearanceModal";
import SettingsModal from "./SettingsModal";
import InfoModal from "./InfoModal";
import DeviceModal from "./DeviceModal";
import LangModal from "./LangModal";
import AccentModal from "./AccentModal";


function HeaderMenu({
  theme, onToggleTheme, onChangeTheme = null, isAdmin, onOpenAccount, onOpenAdmin, onLogout, isAr,
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
  const [infoOpen, setInfoOpen] = useState(false);
  const [busyCode, setBusyCode] = useState(null);
  const ref = useRef(null);

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

  // Broadcast form (admin, under Notifications)
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushSending, setPushSending] = useState(false);
  const [pushResult, setPushResult] = useState("");

  const pendingCount = (pendingAccounts || []).length;
  // UI language for chrome strings (settings / menu). RTL still uses isAr.
  const lang = appLang || (isAr ? "ar" : "en");
  const T = (en, ar, de, fr) => tr(lang, en, ar, de, fr);



  function closeMenu() {
    setOpen(false);
    setRequestsOpen(false);
  }

  function openSettings() {
    setSettingsOpen(true);
  }

  function closeSettings() {
    setSettingsOpen(false);
    setNotifOpen(false);
    setBannerOpen(false);
    setInfoOpen(false);
  }

  function openInfoModal() {
    setNotifOpen(false);
    setBannerOpen(false);
    // Prefer the full detailed guide from the parent (InfoGuideModal).
    if (onOpenInfo) {
      onOpenInfo();
      return;
    }
    setInfoOpen(true);
  }

  function closeInfoModal() {
    setInfoOpen(false);
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
    function onDocClick(e) {
      if (ref.current && ref.current.contains(e.target)) return;
      const panel = document.getElementById("header-menu-modal");
      if (panel && panel.contains(e.target)) return;
      // Don't close menu when interacting with a child overlay on top (Admin, Settings, …)
      const t = e.target;
      if (t && typeof t.closest === "function") {
        const other = t.closest('.modal-backdrop, .modal-card, [role="dialog"], [aria-modal="true"]');
        if (other && other !== panel && !(panel && panel.contains(other))) return;
      }
      closeMenu();
    }
    function onKeyDown(e) { if (e.key === "Escape") closeMenu(); }
    document.addEventListener("pointerdown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocClick);
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
      {open && typeof document !== "undefined" && createPortal(
        <>
          <style>{`
            .header-menu-item { transition: background 0.12s ease; }
            .header-menu-item:hover:not(:disabled) { background: var(--input-bg); }
            .header-menu-item:active:not(:disabled) { background: var(--input-bg); opacity: 0.9; }
            .header-menu-swatch { transition: box-shadow 0.12s ease; }
            .header-menu-backdrop {
              position: fixed; inset: 0; z-index: 3200;
              background: rgba(0,0,0,0.55);
              display: flex; align-items: center; justify-content: center;
              padding: max(12px, env(safe-area-inset-top)) 16px max(12px, env(safe-area-inset-bottom));
            }
            .header-menu-panel {
              position: relative;
              width: 100%;
              max-width: 420px;
              min-width: 0;
              background: var(--card); border: 1px solid rgba(var(--border-rgb),0.14);
              border-radius: 16px;
              box-shadow: 0 24px 60px -12px rgba(0,0,0,0.4);
              overflow: hidden;
              z-index: 3201;
              display: flex;
              flex-direction: column;
              max-height: min(92dvh, 92vh);
            }
          `}</style>
          <div
            id="header-menu-modal"
            className="header-menu-backdrop modal-backdrop"
            role="presentation"
            onClick={(e) => { if (e.target === e.currentTarget) closeMenu(); }}
          >
          <div className="header-menu-panel modal-card" role="dialog" aria-modal="true" aria-label={T("Menu", "القائمة")} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px 10px", flexShrink: 0, borderBottom: "1px solid rgba(var(--border-rgb),0.1)", position: "sticky", top: 0, zIndex: 2, background: "color-mix(in srgb, var(--card) 94%, transparent)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted-strong)" }}>
                {T( "Menu", "القائمة")}
              </span>
              <button
                type="button"
                aria-label={T( "Close", "إغلاق")}
                className="touch-target"
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); closeMenu(); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", color: "var(--icon-muted)", background: "var(--input-bg)", border: "none", cursor: "pointer" }}
              >
                <XIcon size={14} />
              </button>
            </div>
            <div style={{ overflowY: "auto", overflowX: "hidden", flex: "1 1 auto", minHeight: 0, overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", padding: "8px 8px 16px", display: "flex", flexDirection: "column", gap: 1 }}>
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
                  onClick={() => { onToggleFocus && onToggleFocus(); }}
                />
              )}
{/* ========== New account requests (admins) ========== */}
              {isAdmin && (
                <div style={{ marginTop: 0 }}>
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
                            <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
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
                {typeof onOpenAchievements === "function" && (
                  <Row
                    tint="#f4a261"
                    icon={<StarIcon size={14} />}
                    label={T("Achievements", "الإنجازات")}
                    onClick={() => { onOpenAchievements && onOpenAchievements(); }}
                  />
                )}
                {isAdmin && (
                  <Row tint="#af52de" icon={<UsersIcon size={14} />} label={T( "Admin Panel", "لوحة التحكم")} onClick={() => { onOpenAdmin && onOpenAdmin(); }} />
                )}

                {/* تبديل الحسابات المحفوظة — تعدد الحسابات للأدمن */}
                {Array.isArray(vaultAccounts) && vaultAccounts.length > 0 && (
                  <div style={{ padding: "8px 10px 4px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-strong)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
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
                                  setOpen(false);
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
                                  if (va.code === accountCode) setOpen(false);
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
                        onClick={() => { setOpen(false); onLinkAccount(); }}
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
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.4 }}>
                        {T(
                          "Standard accounts can save only one login on this device.",
                          "الحساب العادي يحفظ تسجيل دخول واحد فقط على هذا الجهاز."
                        )}
                      </div>
                    )}
                  </div>
                )}

                <Row danger tint="var(--danger)" icon={<LogoutIcon size={14} />} label={T( "Sign Out", "تسجيل الخروج")} onClick={() => { setOpen(false); onLogout && onLogout(); }} />
                {typeof onLogoutAll === "function" && vaultAccounts.length > 0 && (
                  <Row
                    danger
                    tint="var(--danger)"
                    icon={<LogoutIcon size={14} />}
                    label={T("Sign out & clear saved", "خروج ومسح المحفوظات")}
                    onClick={() => { setOpen(false); onLogoutAll(); }}
                  />
                )}
              </div>
            </div>
          </div>
          </div>
        </>,
        document.body
      )}

      {/* Settings modal extracted */}
      <SettingsModal
        open={settingsOpen}
        onClose={closeSettings}
        T={T}
        isAr={isAr}
        isAdmin={isAdmin}
        theme={theme}
        onToggleTheme={onToggleTheme}
        appLang={appLang}
        deviceMode={deviceMode}
        uiScale={uiScale}
        onChangeUiScale={onChangeUiScale}
        enAccentPref={enAccentPref}
        setEnAccentPref={setEnAccentPref}
        setLangModalOpen={setLangModalOpen}
        setDeviceModalOpen={setDeviceModalOpen}
        setAccentModalOpen={setAccentModalOpen}
        setAppearanceModalOpen={setAppearanceModalOpen}
        openInfoModal={openInfoModal}
        openNotifModal={openNotifModal}
        openBannerModal={openBannerModal}
        onOpenAccount={() => { onOpenAccount && onOpenAccount(); }}
        onOpenAdmin={() => { onOpenAdmin && onOpenAdmin(); }}
        onLogout={() => { closeSettings(); setOpen(false); onLogout && onLogout(); }}
        focusMode={focusMode}
        onToggleFocus={onToggleFocus}
        remindersOn={remindersOn}
        onEnableReminders={onEnableReminders}
        onDisableReminders={onDisableReminders}
        siteBanner={siteBanner}
        onPersistSiteBanner={onPersistSiteBanner}
        setBrandPresetId={setBrandPresetId}
        setBrandCustomGlyph={setBrandCustomGlyph}
        setBrandAddMode={setBrandAddMode}
        setBrandDraftCustom={setBrandDraftCustom}
        vaultAccounts={vaultAccounts}
        mainAccountCode={mainAccountCode}
        accountCode={accountCode}
        onSwitchAccount={onSwitchAccount}
        onSetMainAccount={onSetMainAccount}
        onUnlinkVaultAccount={onUnlinkVaultAccount}
        onLogoutAll={onLogoutAll}
        onLinkAccount={onLinkAccount}
      />



      {/* Information modal — same style as Settings, sized to content */}
      {/* Info modal extracted */}
      <InfoModal
        open={infoOpen}
        onClose={closeInfoModal}
        T={T}
        isAr={isAr}
      />



      {/* Notifications modal — same style as Settings */}
      {/* Notifications modal extracted */}
      <NotificationsModal
        open={notifOpen}
        onClose={closeNotifModal}
        T={T}
        isAr={isAr}
        isAdmin={isAdmin}
        myAccountCode={myAccountCode}
        remindersOn={remindersOn}
        remindersBusy={remindersBusy}
        onEnableReminders={onEnableReminders}
        onDisableReminders={onDisableReminders}
        onTestReminder={onTestReminder}
        reminderTitle={reminderTitle}
        onChangeReminderTitle={onChangeReminderTitle}
        reminderMessage={reminderMessage}
        onChangeReminderMessage={onChangeReminderMessage}
        pushTitle={pushTitle}
        setPushTitle={setPushTitle}
        pushBody={pushBody}
        setPushBody={setPushBody}
        pushSending={pushSending}
        pushResult={pushResult}
        onSendBroadcast={sendBroadcast}
      />

      {/* Banner modal extracted */}
      <BannerModal
        open={bannerOpen}
        onClose={closeBannerModal}
        siteBanner={siteBanner}
        onPersistSiteBanner={onPersistSiteBanner}
        lang={lang}
      />


      <DeviceModal
        open={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
        T={T}
        isAr={isAr}
        deviceMode={deviceMode}
        onChangeDeviceMode={(id) => { onChangeDeviceMode(id); setDeviceModalOpen(false); setOpen(false); }}
      />



      {/* Language settings — dedicated modal */}
      <LangModal
        open={langModalOpen}
        onClose={() => setLangModalOpen(false)}
        T={T}
        appLang={appLang}
        onChangeAppLang={(l) => { onChangeAppLang && onChangeAppLang(l); setLangModalOpen(false); }}
      />



      {/* Accent / dialect — dedicated modal */}
      <AccentModal
        open={accentModalOpen}
        onClose={() => setAccentModalOpen(false)}
        T={T}
        enAccentPref={enAccentPref}
        setEnAccentPref={setEnAccentPref}
      />



      {/* Appearance — theme + color scheme */}
      {/* Appearance modal extracted */}
      <AppearanceModal
        open={appearanceModalOpen}
        onClose={() => setAppearanceModalOpen(false)}
        T={T}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onChangeTheme={onChangeTheme}
        accentTheme={accentTheme}
        onChangeAccent={onChangeAccent}
        brandPresetId={brandPresetId}
        setBrandPresetId={setBrandPresetId}
        brandCustomGlyph={brandCustomGlyph}
        setBrandCustomGlyph={setBrandCustomGlyph}
        brandAddMode={brandAddMode}
        setBrandAddMode={setBrandAddMode}
        brandDraftCustom={brandDraftCustom}
        setBrandDraftCustom={setBrandDraftCustom}
        uiDensity={uiDensity}
        setUiDensity={setUiDensity}
        uiRadius={uiRadius}
        setUiRadius={setUiRadius}
      />



    </div>
  );
}

export default memo(HeaderMenu);
