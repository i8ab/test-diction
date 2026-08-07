import { useState, useEffect } from "react";
import {
  loadSavedAccent, saveAccent, applyAccentTheme, THEME_KEY,
  loadCustomAccentHex,
  loadSavedTheme, resolveTheme, loadUiScale, saveUiScale,
} from "../state/storage";

/**
 * Theme, accent color, and UI scale — extracted from App.jsx.
 */
export function useAppTheme() {
  const [theme, setTheme] = useState(loadSavedTheme);
  const [accentTheme, setAccentTheme] = useState(loadSavedAccent);
  const [uiScale, setUiScaleState] = useState(() => loadUiScale());

  useEffect(() => {
    const resolved = resolveTheme(theme);
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.setAttribute("data-theme-pref", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return undefined;
    let mq;
    try { mq = window.matchMedia("(prefers-color-scheme: dark)"); } catch (_) { return undefined; }
    const apply = () => {
      document.documentElement.setAttribute("data-theme", resolveTheme("system"));
    };
    apply();
    try { mq.addEventListener("change", apply); return () => mq.removeEventListener("change", apply); }
    catch (_) {
      try { mq.addListener(apply); return () => mq.removeListener(apply); } catch (__) {}
    }
    return undefined;
  }, [theme]);

  function setUiScale(scale) {
    setUiScaleState(scale);
    saveUiScale(scale);
    try { document.documentElement.style.setProperty("--ui-scale", String(scale)); } catch (_) {}
  }
  useEffect(() => {
    try { document.documentElement.style.setProperty("--ui-scale", String(uiScale)); } catch (_) {}
  }, [uiScale]);

  useEffect(() => {
    applyAccentTheme(accentTheme, resolveTheme(theme), accentTheme === "custom" ? loadCustomAccentHex() : null);
    saveAccent(accentTheme);
  }, [accentTheme, theme]);

  function toggleTheme() {
    setTheme((t) => {
      if (t === "light") return "dark";
      if (t === "dark") return "system";
      return "light";
    });
  }

  return {
    theme,
    setTheme,
    toggleTheme,
    accentTheme,
    setAccentTheme,
    uiScale,
    setUiScale,
  };
}
