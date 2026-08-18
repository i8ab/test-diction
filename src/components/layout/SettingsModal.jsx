import { createPortal } from "react-dom";
import { tr, UI_LANGS } from "../../lib/config/i18n";
import {
  XIcon, SunIcon, MoonIcon, GlobeIcon, PaletteIcon, BellIcon, BellOffIcon,
  UserIcon, LogoutIcon, UsersIcon, MenuIcon, LayersIcon, SettingsIcon, BookIcon,
  CheckIcon, TrashIcon, LoaderIcon, FlameIcon, StarIcon, MicIcon,
} from "../common/Icons";
import { loadEnAccent } from "../../lib/utils/speech";
import { preloadAdminModal, preloadExamSettingsModal, preloadInfoGuideModal } from "../modals/lazyModals";
import {
  BRAND_PRESETS,
  loadPresetId,
  loadCustomGlyph,
  savePresetId,
  saveCustomGlyph,
} from "../common/BrandMark";

/**
 * Main Settings sheet opened from the gear button.
 * Sub-modals (language, accent, appearance, device) stay controlled by HeaderMenu.
 */
export default function SettingsModal({
  open,
  onClose,
  isAr = false,
  appLang = "en",
  theme,
  onToggleTheme,
  isAdmin,
  onOpenAccount,
  onOpenAdmin,
  onLogout,
  onOpenNotif,
  onOpenBanner,
  onOpenInfo,
  onOpenExamSettings = null,
  onOpenAchievements = null,
  onEnableReminders = null,
  onDisableReminders = null,
  onPersistSiteBanner = null,
  siteBanner = null,
  remindersOn = false,
  pendingCount = 0,
  onOpenLang,
  onOpenDevice,
  onOpenAccent,
  onOpenAppearance,
  deviceMode = null,
  brandPresetId,
  setBrandPresetId,
  brandCustomGlyph,
  setBrandCustomGlyph,
  brandAddMode,
  setBrandAddMode,
  brandDraftCustom,
  setBrandDraftCustom,
  vaultAccounts = [],
  mainAccountCode = "",
  onSwitchAccount,
  onSetMainAccount,
  onUnlinkVaultAccount,
  onLogoutAll,
  onLinkAccount,
  myAccountCode = null,
}) {
  if (!open || typeof document === "undefined") return null;
  const lang = appLang || (isAr ? "ar" : "en");
  const T = (en, ar, de, fr) => tr(lang, en, ar, de, fr);
  const enAccentPref = loadEnAccent();
  const closeSettings = onClose;

  function itemClick(fn) {
    if (typeof fn === "function") fn();
  }

  function Section({ title }) {
    return (
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--muted-strong)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          padding: "12px 12px 4px",
          opacity: 0.9,
        }}
      >
        {title}
      </div>
    );
  }

  function Row({ icon, label, onClick, disabled, tint, danger, trailing, onPointerDown, onMouseEnter }) {
    const color = danger ? "var(--danger, #c44)" : (tint || "var(--ink)");
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onMouseEnter={onMouseEnter}
        className="settings-menu-item"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "9px 10px",
          border: "none",
          background: "transparent",
          color: "var(--ink)",
          fontSize: 13.5,
          fontWeight: 600,
          fontFamily: "inherit",
          textAlign: "start",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          borderRadius: 10,
          minHeight: 42,
          transition: "background 0.12s ease",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 9,
            background: danger ? "rgba(196,68,68,0.12)" : `${tint || "#888"}18`,
            color: color,
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <span style={{ flex: 1, lineHeight: 1.3 }}>{label}</span>
        {trailing}
      </button>
    );
  }

  return createPortal(
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
              width: "100%", maxWidth: "min(420px, 100%)",
              maxHeight: "min(92dvh, 820px)", overflow: "hidden", display: "flex", flexDirection: "column",
              background: "var(--card)", color: "var(--ink)",
              border: "1px solid rgba(var(--border-rgb),0.15)",
              borderRadius: 16,
              padding: 0,
              boxShadow: "0 24px 60px -12px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 14px 12px",
              borderBottom: "1px solid rgba(var(--border-rgb),0.12)",
              background: "var(--card)",
              flexShrink: 0,
              borderRadius: "16px 16px 0 0",
            }}>
              <span id="settings-modal-title" style={{
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--muted-strong)",
              }}>
                {T("Settings", "الإعدادات")}
              </span>
              <button
                type="button"
                onClick={closeSettings}
                aria-label={T("Close", "إغلاق")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: "none",
                  background: "var(--input-bg)",
                  color: "var(--icon-muted)",
                  cursor: "pointer",
                }}
              >
                <XIcon size={16} />
              </button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", padding: "8px 12px 20px" }}>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Section title={T("Preferences", "التفضيلات")} />
              <Row
                tint="#f5a623"
                icon={theme === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
                label={T("Appearance", "المظهر")}
                onClick={() => {
                  setBrandPresetId(loadPresetId());
                  setBrandCustomGlyph(loadCustomGlyph());
                  setBrandAddMode(false);
                  setBrandDraftCustom("");
                  // Keep settings open underneath — appearance stacks above it
                  onOpenAppearance && onOpenAppearance();
                }}
                trailing={
                  <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                    {theme === "dark" ? T("Dark", "داكن") : T("Light", "فاتح")}
                    {isAr ? " ◂" : " ▸"}
                  </span>
                }
              />

              {onOpenLang && (
                <Row
                  tint="#5b8def"
                  icon={<GlobeIcon size={16} />}
                  label={T("Language", "اللغة", "Sprache", "Langue")}
                  onClick={() => onOpenLang && onOpenLang()}
                  trailing={
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                      {(UI_LANGS.find((l) => l.id === lang) || {}).native || "English"}
                      {isAr ? " ◂" : " ▸"}
                    </span>
                  }
                />
              )}

              {typeof onOpenDevice === "function" && (
                <Row
                  tint="#19A7CE"
                  icon={<LayersIcon size={16} />}
                  label={T("Device layout", "واجهة الجهاز")}
                  onClick={() => onOpenDevice && onOpenDevice()}
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
                icon={<MicIcon size={16} />}
                label={T("Accent / dialect", "اللهجة / النطق")}
                onClick={() => onOpenAccent && onOpenAccent()}
                trailing={
                  <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                    {enAccentPref === "uk" ? T("British", "بريطاني") : T("American", "أمريكي")}
                    {isAr ? " ◂" : " ▸"}
                  </span>
                }
              />

              <Row
                tint="#5b8def"
                icon={<BookIcon size={16} />}
                label={T("Information", "معلومات")}
                onClick={() => onOpenInfo && onOpenInfo()} onPointerDown={() => { try { preloadInfoGuideModal(); } catch (_) {} }}
                trailing={
                  <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                    {isAr ? "◂" : "▸"}
                  </span>
                }
              />

              <Section title={T("System", "النظام")} />
              {/* App update / hard refresh — only useful in installed PWA (browser already has refresh) */}
              {(() => {
                let isPwa = false;
                try {
                  isPwa = !!(
                    (typeof window !== "undefined" && window.navigator && window.navigator.standalone) ||
                    (typeof window !== "undefined" &&
                      window.matchMedia &&
                      window.matchMedia("(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)").matches) ||
                    (typeof document !== "undefined" &&
                      document.documentElement.getAttribute("data-pwa-standalone") === "1")
                  );
                } catch (_) {
                  isPwa = false;
                }
                if (!isPwa) return null;
                return (
                  <Row
                    tint="#19A7CE"
                    icon={
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="23 4 23 10 17 10" />
                        <polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                      </svg>
                    }
                    label={T("Sync / refresh app", "مزامنة / تحديث التطبيق")}
                    onClick={async () => {
                      try {
                        if (typeof window.__forceAppRefresh === "function") {
                          await window.__forceAppRefresh();
                          return;
                        }
                        if ("serviceWorker" in navigator) {
                          try {
                            const reg = await navigator.serviceWorker.getRegistration();
                            if (reg) {
                              await reg.update();
                              if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
                            }
                          } catch (_) {}
                        }
                        const u = new URL(window.location.href);
                        u.searchParams.set("_r", String(Date.now()));
                        window.location.replace(u.toString());
                      } catch (_) {
                        try { window.location.reload(); } catch (__) {}
                      }
                    }}
                    trailing={
                      <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                        {T("Update", "تحديث")}
                      </span>
                    }
                  />
                );
              })()}
              {/* ========== Notifications — opens small modal ========== */}
              {(onEnableReminders || onDisableReminders) && (
                <Row
                  tint={remindersOn ? "#34c759" : "#8e8e93"}
                  icon={remindersOn ? <BellIcon size={16} /> : <BellOffIcon size={16} />}
                  label={T("Notifications", "الإشعارات")}
                  onClick={() => onOpenNotif && onOpenNotif()}
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
                    icon={<LayersIcon size={16} />}
                    label={T( "Site banner", "بانر الموقع")}
                    onClick={() => onOpenBanner && onOpenBanner()}
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


              {isAdmin && (typeof onOpenExamSettings === "function" || typeof onOpenAdmin === "function") && (
                <Section title={T("Admin", "الإدارة")} />
              )}
              {isAdmin && typeof onOpenExamSettings === "function" && (
                <Row
                  tint="#e85d04"
                  icon={<FlameIcon size={16} />}
                  label={T("Exam countdown", "عدّاد الامتحان")}
                  onClick={() => { onClose(); onOpenExamSettings && onOpenExamSettings(); }} onPointerDown={() => { try { preloadExamSettingsModal(); } catch (_) {} }}
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
                  icon={<UsersIcon size={16} />}
                  label={T("Admin Panel", "لوحة التحكم")}
                  onClick={onOpenAdmin}
                  onPointerDown={() => { try { preloadAdminModal(); } catch (_) {} }}
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
                      const active = va.code === myAccountCode;
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
                              <TrashIcon size={16} />
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
                <Row danger tint="var(--danger)" icon={<LogoutIcon size={16} />} label={T("Sign Out", "تسجيل الخروج")} onClick={onLogout} />
              </div>

            </div>
            </div>
          </div>
        </div>
    ,
    document.body
  );
}
