import { useState, useEffect, useCallback } from "react";
import { tr } from "../config/i18n";
import {
  loadSavedAccent,
  saveAccent,
  applyAccentTheme,
  THEME_KEY,
  loadCustomAccentHex,
  loadSavedTheme,
  resolveTheme,
  loadUiScale,
  saveUiScale,
  loadAppLang,
  saveAppLang,
  loadDeviceMode,
  saveDeviceMode,
  applyDeviceModeToDom,
  guessDeviceMode,
  loadSavedSkin,
  saveSkin,
  applySkinTheme,
  loadLatinFont,
  loadArabicFont,
  saveLatinFont,
  saveArabicFont,
  applyFonts,
  loadReducedMotion,
  saveReducedMotion,
  applyReducedMotion,
  loadUiSounds,
  saveUiSounds,
  loadDirOverride,
  saveDirOverride,
  applyDirOverride,
  loadCardSurface,
  saveCardSurface,
  applyCardSurface,
  loadHeaderStyle,
  saveHeaderStyle,
  applyHeaderStyle,
  loadIconStyle,
  saveIconStyle,
  applyIconStyle,
  loadMotionSpeed,
  saveMotionSpeed,
  applyMotionSpeed,
  loadExamVisual,
  saveExamVisual,
  applyExamVisual,
} from "../state/storage";

/**
 * UI preferences that affect the whole app chrome:
 * language, theme (light/dark/system), accent, UI scale, device layout mode.
 * Keeps <html> attributes and CSS variables in sync.
 */
export function useAppPreferences() {
  // --- Language ---
  const [appLang, setAppLangState] = useState(() => loadAppLang());
  const appIsAr = appLang === "ar";
  const atr = useCallback(
    (en, ar, de, fr) => tr(appLang, en, ar, de, fr),
    [appLang]
  );

  const setAppLang = useCallback((lang) => {
    if (lang !== "en" && lang !== "ar" && lang !== "de" && lang !== "fr") return;
    setAppLangState(lang);
    saveAppLang(lang);
    try {
      document.documentElement.lang = lang;
    } catch (_) {}
  }, []);

  const toggleAppLang = useCallback(() => {
    // Legacy two-way flip used on older auth toggle — cycles en <-> ar
    setAppLang(appLang === "ar" ? "en" : "ar");
  }, [appLang, setAppLang]);

  // Keep <html lang> in sync (dir is handled by dirOverride effect)
  useEffect(() => {
    try {
      document.documentElement.lang = appLang;
    } catch (_) {}
  }, [appLang]);

  // --- Device layout mode ---
  const [deviceMode, setDeviceModeState] = useState(() => loadDeviceMode());

  const setDeviceMode = useCallback((mode) => {
    if (mode !== "mobile" && mode !== "tablet" && mode !== "desktop") return;
    setDeviceModeState(mode);
    saveDeviceMode(mode);
    applyDeviceModeToDom(mode);
  }, []);

  useEffect(() => {
    const effective = deviceMode || guessDeviceMode();
    applyDeviceModeToDom(effective);
  }, [deviceMode]);

  // --- Theme (light / dark / system) ---
  const [theme, setTheme] = useState(loadSavedTheme);

  useEffect(() => {
    const resolved = resolveTheme(theme);
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.setAttribute("data-theme-pref", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (_) {}
  }, [theme]);

  // Follow OS dark/light when preference is "system"
  useEffect(() => {
    if (theme !== "system") return undefined;
    let mq;
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
    } catch (_) {
      return undefined;
    }
    const apply = () => {
      document.documentElement.setAttribute("data-theme", resolveTheme("system"));
    };
    apply();
    try {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    } catch (_) {
      try {
        mq.addListener(apply);
        return () => mq.removeListener(apply);
      } catch (__) {}
    }
    return undefined;
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      // cycle light → dark → system → light
      if (t === "light") return "dark";
      if (t === "dark") return "system";
      return "light";
    });
  }, []);

  // --- Accent ---
  const [accentTheme, setAccentTheme] = useState(loadSavedAccent);

  useEffect(() => {
    applyAccentTheme(
      accentTheme,
      resolveTheme(theme),
      accentTheme === "custom" ? loadCustomAccentHex() : null
    );
    saveAccent(accentTheme);
  }, [accentTheme, theme]);

  // --- Skin / Mood template ---
  const [skin, setSkinState] = useState(loadSavedSkin);

  const setSkin = useCallback((id) => {
    if (!id) return;
    setSkinState(id);
    saveSkin(id);
  }, []);

  useEffect(() => {
    applySkinTheme(skin, resolveTheme(theme));
  }, [skin, theme]);

  // --- UI scale ---
  const [uiScale, setUiScaleState] = useState(() => loadUiScale());

  const setUiScale = useCallback((scale) => {
    setUiScaleState(scale);
    saveUiScale(scale);
    try {
      document.documentElement.style.setProperty("--ui-scale", String(scale));
    } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      document.documentElement.style.setProperty("--ui-scale", String(uiScale));
    } catch (_) {}
  }, [uiScale]);

  // --- Fonts ---
  const [latinFont, setLatinFontState] = useState(loadLatinFont);
  const [arabicFont, setArabicFontState] = useState(loadArabicFont);

  const setLatinFont = useCallback((id) => {
    if (!id) return;
    setLatinFontState(id);
    saveLatinFont(id);
  }, []);

  const setArabicFont = useCallback((id) => {
    if (!id) return;
    setArabicFontState(id);
    saveArabicFont(id);
  }, []);

  useEffect(() => {
    applyFonts(latinFont, arabicFont);
  }, [latinFont, arabicFont]);

  // --- Reduced motion ---
  const [reducedMotion, setReducedMotionState] = useState(loadReducedMotion);

  const setReducedMotion = useCallback((on) => {
    const v = !!on;
    setReducedMotionState(v);
    saveReducedMotion(v);
    applyReducedMotion(v);
  }, []);

  useEffect(() => {
    applyReducedMotion(reducedMotion);
  }, [reducedMotion]);

  // --- UI sounds ---
  const [uiSounds, setUiSoundsState] = useState(loadUiSounds);
  const setUiSounds = useCallback((on) => {
    const v = !!on;
    setUiSoundsState(v);
    saveUiSounds(v);
  }, []);

  // --- Direction override ---
  const [dirOverride, setDirOverrideState] = useState(loadDirOverride);
  const setDirOverride = useCallback((v) => {
    if (v !== "auto" && v !== "ltr" && v !== "rtl") return;
    setDirOverrideState(v);
    saveDirOverride(v);
  }, []);

  useEffect(() => {
    applyDirOverride(dirOverride, appLang);
  }, [dirOverride, appLang]);

  // --- Card surface ---
  const [cardSurface, setCardSurfaceState] = useState(loadCardSurface);
  const setCardSurface = useCallback((id) => {
    setCardSurfaceState(id);
    saveCardSurface(id);
    applyCardSurface(id);
  }, []);
  useEffect(() => { applyCardSurface(cardSurface); }, [cardSurface]);

  // --- Header style (solid / glass / clear) ---
  const [headerStyle, setHeaderStyleState] = useState(loadHeaderStyle);
  const setHeaderStyle = useCallback((id) => {
    setHeaderStyleState(id);
    saveHeaderStyle(id);
    applyHeaderStyle(id);
  }, []);
  useEffect(() => { applyHeaderStyle(headerStyle); }, [headerStyle]);

  // --- Icon style ---
  const [iconStyle, setIconStyleState] = useState(loadIconStyle);
  const setIconStyle = useCallback((id) => {
    setIconStyleState(id);
    saveIconStyle(id);
    applyIconStyle(id);
  }, []);
  useEffect(() => { applyIconStyle(iconStyle); }, [iconStyle]);

  // --- Motion speed ---
  const [motionSpeed, setMotionSpeedState] = useState(loadMotionSpeed);
  const setMotionSpeed = useCallback((id) => {
    setMotionSpeedState(id);
    saveMotionSpeed(id);
    applyMotionSpeed(id);
    if (id === "off") {
      setReducedMotionState(true);
      saveReducedMotion(true);
    }
  }, []);
  useEffect(() => { applyMotionSpeed(motionSpeed); }, [motionSpeed]);

  // --- Exam visual ---
  const [examVisual, setExamVisualState] = useState(loadExamVisual);
  const setExamVisual = useCallback((on) => {
    const v = !!on;
    setExamVisualState(v);
    saveExamVisual(v);
    applyExamVisual(v);
  }, []);
  useEffect(() => { applyExamVisual(examVisual); }, [examVisual]);

  return {
    appLang,
    setAppLang,
    toggleAppLang,
    appIsAr,
    atr,
    deviceMode,
    setDeviceMode,
    theme,
    setTheme,
    toggleTheme,
    accentTheme,
    setAccentTheme,
    uiScale,
    setUiScale,
    skin,
    setSkin,
    latinFont,
    setLatinFont,
    arabicFont,
    setArabicFont,
    reducedMotion,
    setReducedMotion,
    uiSounds,
    setUiSounds,
    dirOverride,
    setDirOverride,
    cardSurface,
    setCardSurface,
    headerStyle,
    setHeaderStyle,
    iconStyle,
    setIconStyle,
    motionSpeed,
    setMotionSpeed,
    examVisual,
    setExamVisual,
  };
}
