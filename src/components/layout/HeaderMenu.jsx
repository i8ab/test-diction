import { useState, useEffect, useRef } from "react";
import { tr } from "../../lib/config/i18n";
import { ACCENT_THEMES } from "../../lib/state/storage";
import {
  UsersIcon, SunIcon, MoonIcon, UserIcon, LogoutIcon, PaletteIcon, MenuIcon, BellIcon, BellOffIcon, XIcon, CheckIcon,
} from "../common/Icons";

export default function HeaderMenu({ theme, onToggleTheme, isAdmin, onOpenAccount, onOpenAdmin, onLogout, isAr, accentTheme, onChangeAccent, remindersOn, remindersBusy, onEnableReminders, onDisableReminders }) {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(null);
  const ref = useRef(null);
  const pulseTimer = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    function onKeyDown(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(pulseTimer.current), []);

  // Actions fire immediately but the menu stays open — it only closes via
  // the X button, a click outside, or Escape. A brief check-mark pulse on
  // the row's icon is the only feedback that the tap landed.
  function itemClick(key, fn) {
    fn();
    setPulse(key);
    window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setPulse((p) => (p === key ? null : p)), 900);
  }

  const itemStyle = { position: "relative", display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", fontSize: 13.5, fontWeight: 600, color: "var(--ink)", background: "none", border: "none", borderRadius: 9, textAlign: "start", cursor: "pointer", overflow: "hidden" };
  const iconWrapStyle = (bg) => ({ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 8, background: bg, flexShrink: 0, position: "relative", zIndex: 1 });

  function Row({ menuKey, icon, doneIcon, label, onClick, disabled, tint, danger }) {
    const done = pulse === menuKey;
    return (
      <button
        role="menuitem"
        disabled={disabled}
        className="header-menu-item"
        style={{ ...itemStyle, color: danger ? "var(--danger)" : "var(--ink)", opacity: disabled ? 0.55 : 1, cursor: disabled ? "default" : "pointer" }}
        onClick={() => { if (!disabled) itemClick(menuKey, onClick); }}
      >
        <span className="header-menu-item-sheen" />
        <span style={iconWrapStyle(done ? "rgba(52,199,89,0.16)" : danger ? "rgba(var(--danger-rgb,220,38,38),0.12)" : `${tint}1c`)}>
          <span className="header-menu-icon-flip" style={{ color: done ? "#34c759" : danger ? "var(--danger)" : tint }}>
            {done ? <CheckIcon size={14} /> : (doneIcon !== undefined ? doneIcon : icon)}
          </span>
        </span>
        <span style={{ position: "relative", zIndex: 1, flex: 1, textAlign: "start" }}>{label}</span>
      </button>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} title={tr(isAr, "Menu", "القائمة")} aria-label={tr(isAr, "Menu", "القائمة")} aria-expanded={open} className="lift-hover"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, border: "1px solid rgba(var(--border-rgb),0.25)", background: "none", color: "var(--icon-muted)", borderRadius: 10, cursor: "pointer" }}>
        <MenuIcon size={16} />
      </button>
      {open && (
        <>
          <style>{`
            @keyframes headerMenuGlow { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
            @keyframes headerMenuPop { from { opacity: 0; transform: scale(0.9) translateY(-8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            @keyframes swatchPulse { 0% { box-shadow: 0 0 0 0 var(--accent-1-soft); } 70% { box-shadow: 0 0 0 6px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
            .header-menu-item { transition: background 0.18s ease; }
            .header-menu-item:hover:not(:disabled) { background: var(--input-bg); }
            .header-menu-item:active:not(:disabled) .header-menu-icon-flip { transform: scale(0.85) rotate(-6deg); }
            .header-menu-icon-flip { display: flex; transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1); }
            .header-menu-item:hover:not(:disabled) .header-menu-icon-flip { transform: scale(1.12) rotate(6deg); }
            .header-menu-item-sheen { position: absolute; inset: 0; background: linear-gradient(100deg, transparent 20%, rgba(255,255,255,0.14) 45%, transparent 65%); transform: translateX(-120%); pointer-events: none; }
            .header-menu-item:hover:not(:disabled) .header-menu-item-sheen { transform: translateX(120%); transition: transform 0.6s ease; }
            .header-menu-swatch { transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease; }
            .header-menu-swatch:hover { transform: scale(1.18) translateY(-1px); }
            .header-menu-swatch.is-active { animation: swatchPulse 1.6s ease-out; }
            .header-menu-panel::before { content: ""; position: absolute; inset: -1px; border-radius: 17px; padding: 1px; background: conic-gradient(from var(--hm-angle,0deg), var(--accent-1), var(--accent-2), var(--accent-1)); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; opacity: 0.35; animation: headerMenuGlow 3s ease-in-out infinite; pointer-events: none; }
          `}</style>
          <div className="header-menu-panel" role="menu" style={{ position: "absolute", top: "calc(100% + 8px)", insetInlineEnd: 0, minWidth: 210, background: "var(--card)", borderRadius: 17, boxShadow: "0 22px 48px -18px rgba(0,0,0,0.42), 0 2px 8px -2px rgba(0,0,0,0.15)", overflow: "hidden", zIndex: 40, animation: "headerMenuPop 0.2s cubic-bezier(0.22,1,0.36,1) both", transformOrigin: "top", backdropFilter: "blur(20px)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px 8px" }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted)" }}>
                {tr(isAr, "Menu", "القائمة")}
              </span>
              <button
                type="button"
                aria-label={tr(isAr, "Close", "إغلاق")}
                onClick={() => setOpen(false)}
                className="lift-hover"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", color: "var(--icon-muted)", background: "var(--input-bg)", border: "none", cursor: "pointer" }}
              >
                <XIcon size={12} />
              </button>
            </div>
            <div style={{ overflowY: "auto", maxHeight: "min(360px, calc(100vh - 100px))", overscrollBehavior: "contain", padding: "0 6px 6px", display: "flex", flexDirection: "column", gap: 1 }}>
              <Row
                menuKey="theme"
                tint="#f5a623"
                icon={theme === "dark" ? <SunIcon size={14} /> : <MoonIcon size={14} />}
                doneIcon={theme === "dark" ? <SunIcon size={14} /> : <MoonIcon size={14} />}
                label={theme === "dark" ? tr(isAr, "Light Mode", "الوضع الفاتح") : tr(isAr, "Dark Mode", "الوضع الداكن")}
                onClick={onToggleTheme}
              />
              {(onEnableReminders || onDisableReminders) && (
                <Row
                  menuKey="reminders"
                  tint={remindersOn ? "#34c759" : "#8e8e93"}
                  icon={remindersOn ? <BellIcon size={14} /> : <BellOffIcon size={14} />}
                  doneIcon={remindersOn ? <BellIcon size={14} /> : <BellOffIcon size={14} />}
                  label={remindersOn ? tr(isAr, "Reminders: On", "التذكيرات: مفعّلة") : tr(isAr, "Reminders: Off", "التذكيرات: متوقفة")}
                  onClick={remindersOn ? onDisableReminders : onEnableReminders}
                  disabled={remindersBusy}
                />
              )}
              {onChangeAccent && (
                <div style={{ padding: "10px 12px", marginTop: 2, borderTop: "1px solid rgba(var(--border-rgb),0.12)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: "var(--icon-muted)", marginBottom: 9 }}>
                    <PaletteIcon size={13} /> {tr(isAr, "Color theme", "لون الواجهة")}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {Object.entries(ACCENT_THEMES).map(([key, t]) => {
                      const swatch = (t[theme] || t.light).a1;
                      const active = key === accentTheme;
                      return (
                        <button key={key} type="button" onClick={() => onChangeAccent(key)}
                          title={tr(isAr, t.label.en, t.label.ar)} aria-label={tr(isAr, t.label.en, t.label.ar)}
                          className={`header-menu-swatch${active ? " is-active" : ""}`}
                          style={{ width: 24, height: 24, borderRadius: "50%", background: swatch, border: active ? "2px solid var(--ink)" : "1px solid rgba(var(--border-rgb),0.3)", cursor: "pointer", padding: 0, boxShadow: active ? "0 0 0 3px var(--card), 0 0 0 4px " + swatch + "55" : "none" }} />
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ borderTop: "1px solid rgba(var(--border-rgb),0.12)", marginTop: 2, paddingTop: 1 }}>
                <Row menuKey="account" tint="#5b8def" icon={<UserIcon size={14} />} label={tr(isAr, "My Account", "حسابي")} onClick={onOpenAccount} />
                {isAdmin && (
                  <Row menuKey="admin" tint="#af52de" icon={<UsersIcon size={14} />} label={tr(isAr, "Admin Panel", "لوحة التحكم")} onClick={onOpenAdmin} />
                )}
                <Row menuKey="logout" danger tint="var(--danger)" icon={<LogoutIcon size={14} />} label={tr(isAr, "Sign Out", "تسجيل الخروج")} onClick={onLogout} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
