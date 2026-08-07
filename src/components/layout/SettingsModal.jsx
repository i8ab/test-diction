import { XIcon, SettingsIcon, GlobeIcon, PaletteIcon, UserIcon, LogoutIcon, BellIcon, BellOffIcon, BookIcon, LayersIcon, SunIcon, MoonIcon, MicIcon } from "../common/Icons";
import { UI_LANGS } from "../../lib/config/i18n";
import { EN_ACCENTS } from "../../lib/utils/speech";

export default function SettingsModal({
  open,
  onClose,
  T,
  isAr,
  isAdmin,
  theme,
  onToggleTheme,
  appLang,
  deviceMode,
  uiScale,
  onChangeUiScale,
  enAccentPref,
  setEnAccentPref,
  setLangModalOpen,
  setDeviceModalOpen,
  setAccentModalOpen,
  setAppearanceModalOpen,
  openInfoModal,
  onOpenAccount,
  onOpenAdmin,
  onLogout,
  focusMode,
  onToggleFocus,
  remindersOn,
  // vault
  vaultAccounts = [],
  mainAccountCode = "",
  accountCode = "",
  onSwitchAccount,
  onSetMainAccount,
  onUnlinkVaultAccount,
  onLogoutAll,
  onLinkAccount,
}) {
  if (!open) return null;
  const itemStyle = { position: "relative", display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", minHeight: 40, fontSize: 13.5, fontWeight: 600, color: "var(--ink)", background: "none", border: "none", borderRadius: 9, textAlign: "start", cursor: "pointer" };
  const iconWrapStyle = (bg) => ({ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 8, background: bg, flexShrink: 0 });
  function itemClick(fn) { if (fn) fn(); }
  function Row({ icon, label, onClick, disabled, tint, danger, trailing }) {
    return (
      <button
        role="menuitem"
        disabled={disabled}
        className="header-menu-item touch-target"
        style={{ ...itemStyle, color: danger ? "var(--danger)" : "var(--ink)", opacity: disabled ? 0.55 : 1, cursor: disabled ? "default" : "pointer" }}
        onClick={() => { if (!disabled) itemClick(onClick); }}
      >
        <span style={iconWrapStyle(danger ? "rgba(var(--danger-rgb,220,38,38),0.12)" : `${tint || "var(--accent-1)"}1c`)}>
          <span style={{ color: danger ? "var(--danger)" : (tint || "var(--accent-1)"), display: "flex" }}>{icon}</span>
        </span>
        <span style={{ flex: 1, textAlign: "start" }}>{label}</span>
        {trailing}
      </button>
    );
  }

  return (
        <div
          onClick={onClose}
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
                onClick={onClose}
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
                  // Close settings first so only one modal paints (was stacking → lag)
                  onClose();
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

              

            </div>
          </div>
        </div>
  );
}
