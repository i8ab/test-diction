import { useState, useEffect, useCallback, useRef } from "react";
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
  loadCardClarity,
  saveCardClarity,
  applyCardClarity,
  loadModalStyle,
  saveModalStyle,
  applyModalStyle,
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
    if (lang !== "en" && lang !== "ar") return;
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

  // --- Theme (light / dark / system) ---
  const [theme, setTheme] = useState(loadSavedTheme);

  useEffect(() => {
    const resolved = resolveTheme(theme);
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.setAttribute("data-theme-pref", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (_) {}
    // Match Android/iOS system status bar to the bottom toolbar (not brass beige).
    // Dark → deep paper; light → soft paper. Prevents the tan "balloon" strip.
    try {
      const dark = resolved === "dark";
      const color = dark ? "#0E1A20" : "#FAFDFE";
      let meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "theme-color");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", color);
      let apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      if (!apple) {
        apple = document.createElement("meta");
        apple.setAttribute("name", "apple-mobile-web-app-status-bar-style");
        document.head.appendChild(apple);
      }
      apple.setAttribute("content", dark ? "black-translucent" : "default");
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
      const resolved = resolveTheme("system");
      document.documentElement.setAttribute("data-theme", resolved);
      try {
        const dark = resolved === "dark";
        const color = dark ? "#0E1A20" : "#FAFDFE";
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", color);
        const apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
        if (apple) apple.setAttribute("content", dark ? "black-translucent" : "default");
      } catch (_) {}
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

  // --- Fonts ---
  const [latinFont, setLatinFontState] = useState(loadLatinFont);
  const [arabicFont, setArabicFontState] = useState(loadArabicFont);

  const setLatinFont = useCallback((id) => {
    if (!id) return;
    setLatinFontState(id);
    saveLatinFont(id);
    applyFonts(id, arabicFont);
  }, [arabicFont]);

  const setArabicFont = useCallback((id) => {
    if (!id) return;
    setArabicFontState(id);
    saveArabicFont(id);
    applyFonts(latinFont, id);
  }, [latinFont]);

  // --- Reduced motion ---
  const [reducedMotion, setReducedMotionState] = useState(loadReducedMotion);

  const setReducedMotion = useCallback((on) => {
    const v = !!on;
    setReducedMotionState(v);
    saveReducedMotion(v);
    applyReducedMotion(v);
  }, []);

  // --- UI sounds ---
  const [uiSounds, setUiSoundsState] = useState(loadUiSounds);
  const setUiSounds = useCallback((on) => {
    const v = !!on;
    setUiSoundsState(v);
    saveUiSounds(v);
  }, []);

  // --- Direction: always auto from language (EN→LTR, AR→RTL). Choice removed. ---
  const dirOverride = "auto";
  const setDirOverride = useCallback(() => {
    saveDirOverride("auto");
  }, []);

  useEffect(() => {
    applyDirOverride("auto", appLang);
  }, [appLang]);

  // --- Card surface ---
  const [cardSurface, setCardSurfaceState] = useState(loadCardSurface);
  const setCardSurface = useCallback((id) => {
    setCardSurfaceState(id);
    saveCardSurface(id);
    applyCardSurface(id);
  }, []);

  // --- Header style (solid / glass / clear) ---
  const [headerStyle, setHeaderStyleState] = useState(loadHeaderStyle);
  const setHeaderStyle = useCallback((id) => {
    setHeaderStyleState(id);
    saveHeaderStyle(id);
    applyHeaderStyle(id);
  }, []);

  // --- Card clarity: fixed to Clear (high transparency). Choice removed. ---
  const cardClarity = "clear";
  const setCardClarity = useCallback(() => {
    saveCardClarity("clear");
    applyCardClarity("clear");
  }, []);

  // --- Modal style ---
  const [modalStyle, setModalStyleState] = useState(loadModalStyle);
  const setModalStyle = useCallback((id) => {
    setModalStyleState(id);
    saveModalStyle(id);
    applyModalStyle(id);
  }, []);

  // --- Icon style: fixed to outline. Choice removed. ---
  const iconStyle = "outline";
  const setIconStyle = useCallback(() => {
    saveIconStyle("outline");
    applyIconStyle("outline");
  }, []);

  // --- Motion speed: fixed to normal. Setting removed. ---
  const motionSpeed = "normal";
  const setMotionSpeed = useCallback(() => {
    saveMotionSpeed("normal");
    applyMotionSpeed("normal");
  }, []);

  // --- Exam visual ---
  const [examVisual, setExamVisualState] = useState(loadExamVisual);
  const setExamVisual = useCallback((on) => {
    const v = !!on;
    setExamVisualState(v);
    saveExamVisual(v);
    applyExamVisual(v);
  }, []);

  // ── Batched initial DOM paint ──────────────────────────────────────────
  // Apply ALL cosmetic preferences in a single rAF so the browser does ONE
  // style recalculation instead of 10+ separate ones on mount.
  const initialPaintDone = useRef(false);
  useEffect(() => {
    if (initialPaintDone.current) return;
    initialPaintDone.current = true;
    requestAnimationFrame(() => {
      applyCardSurface(cardSurface);
      applyHeaderStyle(headerStyle);
      applyCardClarity("clear");
      applyModalStyle(modalStyle);
      applyIconStyle("outline");
      applyMotionSpeed("normal");
      applyExamVisual(examVisual);
      applyReducedMotion(reducedMotion);
      applyFonts(latinFont, arabicFont);
      applyDeviceModeToDom(deviceMode || guessDeviceMode());
      try {
        document.documentElement.style.setProperty("--ui-scale", String(uiScale));
      } catch (_) {}
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    cardClarity,
    setCardClarity,
    modalStyle,
    setModalStyle,
    iconStyle,
    setIconStyle,
    motionSpeed,
    setMotionSpeed,
    examVisual,
    setExamVisual,
  };
}
