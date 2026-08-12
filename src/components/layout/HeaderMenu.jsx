import { useState, useEffect, useRef } from "react";
import { tr } from "../../lib/config/i18n";
import SiteBannerAdminModal from "./SiteBannerAdminModal";
import NotificationsModal from "./NotificationsModal";
import SettingsModal from "./SettingsModal";
import AppearanceModal from "./AppearanceModal";
import InfoGuidePanel from "./InfoGuidePanel";
import { DeviceModeModal, LangModal, AccentModal } from "./PreferenceModals";

import { SettingsIcon } from "../common/Icons";
import { useBodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import {
  loadPresetId,
  loadCustomGlyph,
} from "../common/BrandMark";

export default function HeaderMenu({
  theme, onToggleTheme, onChangeTheme, isAdmin, onOpenAccount, onOpenAdmin, onLogout, isAr,
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
  const ref = useRef(null);


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
  const pendingCount = (pendingAccounts || []).length;
  // UI language for chrome strings (settings / menu). RTL still uses isAr.
  const lang = appLang || (isAr ? "ar" : "en");
  const T = (en, ar, de, fr) => tr(lang, en, ar, de, fr);

  function closeMenu() {
    setOpen(false);
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
    setSettingsOpen(false);
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
    setSettingsOpen(false);
    setNotifOpen(true);
  }

  function closeNotifModal() {
    setNotifOpen(false);
  }

  function openBannerModal() {
    setInfoOpen(false);
    setNotifOpen(false);
    setSettingsOpen(false);
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
    if (!settingsOpen && !notifOpen && !bannerOpen && !infoOpen && !langModalOpen && !deviceModalOpen && !accentModalOpen && !appearanceModalOpen) return;
    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      // Close topmost modal first
      if (appearanceModalOpen) { setAppearanceModalOpen(false); return; }
      if (accentModalOpen) { setAccentModalOpen(false); return; }
      if (deviceModalOpen) { setDeviceModalOpen(false); return; }
      if (langModalOpen) { setLangModalOpen(false); return; }
      if (infoOpen) { closeInfoModal(); return; }
      if (notifOpen) { closeNotifModal(); return; }
      if (bannerOpen) { closeBannerModal(); return; }
      if (settingsOpen) closeSettings();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen, notifOpen, bannerOpen, infoOpen, langModalOpen, deviceModalOpen, accentModalOpen, appearanceModalOpen]);

  // Lock background scroll for any open settings-style modal (click-outside still closes).
  useBodyScrollLock(open || settingsOpen || notifOpen || bannerOpen || infoOpen || langModalOpen || accentModalOpen || appearanceModalOpen);

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

      <SettingsModal
        open={settingsOpen}
        onClose={closeSettings}
        isAr={isAr}
        appLang={appLang}
        theme={theme}
        onToggleTheme={onToggleTheme}
        isAdmin={isAdmin}
        onOpenAccount={onOpenAccount}
        onOpenAdmin={onOpenAdmin}
        onLogout={onLogout}
        onOpenNotif={openNotifModal}
        onOpenBanner={openBannerModal}
        onOpenInfo={openInfoModal}
        onOpenExamSettings={onOpenExamSettings}
        onOpenAchievements={onOpenAchievements}
        onEnableReminders={onEnableReminders}
        onDisableReminders={onDisableReminders}
        onPersistSiteBanner={onPersistSiteBanner}
        siteBanner={siteBanner}
        remindersOn={remindersOn}
        pendingCount={pendingCount}
        focusMode={focusMode}
        onToggleFocus={onToggleFocus}
        onOpenLang={() => { setSettingsOpen(false); setLangModalOpen(true); }}
        onOpenDevice={() => { setSettingsOpen(false); setDeviceModalOpen(true); }}
        onOpenAccent={() => { setSettingsOpen(false); setAccentModalOpen(true); }}
        onOpenAppearance={() => { setSettingsOpen(false); setAppearanceModalOpen(true); }}
        deviceMode={deviceMode}
        brandPresetId={brandPresetId}
        setBrandPresetId={setBrandPresetId}
        brandCustomGlyph={brandCustomGlyph}
        setBrandCustomGlyph={setBrandCustomGlyph}
        brandAddMode={brandAddMode}
        setBrandAddMode={setBrandAddMode}
        brandDraftCustom={brandDraftCustom}
        setBrandDraftCustom={setBrandDraftCustom}
        vaultAccounts={vaultAccounts}
        mainAccountCode={mainAccountCode}
        onSwitchAccount={onSwitchAccount}
        onSetMainAccount={onSetMainAccount}
        onUnlinkVaultAccount={onUnlinkVaultAccount}
        onLogoutAll={onLogoutAll}
        onLinkAccount={onLinkAccount}
        myAccountCode={myAccountCode}
      />

      {/* Information modal — same style as Settings, sized to content */}
      <InfoGuidePanel
        open={infoOpen}
        onClose={closeInfoModal}
        isAr={isAr}
        appLang={appLang}
        infoExpanded={infoExpanded}
        setInfoExpanded={setInfoExpanded}
      />

      <DeviceModeModal
        open={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
        isAr={isAr}
        appLang={appLang}
        deviceMode={deviceMode}
        onChangeDeviceMode={onChangeDeviceMode}
      />
      <LangModal
        open={langModalOpen}
        onClose={() => setLangModalOpen(false)}
        isAr={isAr}
        appLang={appLang}
        onChangeAppLang={onChangeAppLang}
      />
      <AccentModal
        open={accentModalOpen}
        onClose={() => setAccentModalOpen(false)}
        isAr={isAr}
        appLang={appLang}
        accentTheme={accentTheme}
        onChangeAccent={onChangeAccent}
      />

      <NotificationsModal
        open={notifOpen}
        onClose={closeNotifModal}
        isAr={isAr}
        appLang={appLang}
        remindersOn={remindersOn}
        remindersBusy={remindersBusy}
        onEnableReminders={onEnableReminders}
        onDisableReminders={onDisableReminders}
        onTestReminder={onTestReminder}
        reminderTitle={reminderTitle}
        onChangeReminderTitle={onChangeReminderTitle}
        reminderMessage={reminderMessage}
        onChangeReminderMessage={onChangeReminderMessage}
        isAdmin={isAdmin}
        myAccountCode={myAccountCode}
      />

      <SiteBannerAdminModal
        open={bannerOpen}
        onClose={closeBannerModal}
        siteBanner={siteBanner}
        onPersistSiteBanner={onPersistSiteBanner}
        isAr={isAr}
        appLang={appLang}
      />

      {/* Language settings — dedicated modal */}
      {/* Accent / dialect — dedicated modal */}
      {/* Appearance — theme + color scheme */}
      <AppearanceModal
        open={appearanceModalOpen}
        onClose={() => setAppearanceModalOpen(false)}
        isAr={isAr}
        appLang={appLang}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onChangeTheme={onChangeTheme}
        uiScale={uiScale}
        onChangeUiScale={onChangeUiScale}
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
        cardHeight={cardHeight}
        setCardHeight={setCardHeight}
      />

    </div>
  );
}
