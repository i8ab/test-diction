import { useState, useEffect, useRef } from "react";
import { tr } from "../../lib/config/i18n";
import { ACCENT_THEMES } from "../../lib/state/storage";
import {
  UsersIcon, SunIcon, MoonIcon, UserIcon, LogoutIcon, PaletteIcon, MenuIcon, BellIcon, BellOffIcon,
} from "../common/Icons";

export default function HeaderMenu({ theme, onToggleTheme, isAdmin, onOpenAccount, onOpenAdmin, onLogout, isAr, accentTheme, onChangeAccent, remindersOn, remindersBusy, onEnableReminders, onDisableReminders }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

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

  function itemClick(fn) {
    setOpen(false);
    fn();
  }

  const itemStyle = { display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 14px", fontSize: 13.5, fontWeight: 600, color: "var(--ink)", background: "none", border: "none", textAlign: "start", cursor: "pointer" };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} title={tr(isAr, "Menu", "القائمة")} aria-label={tr(isAr, "Menu", "القائمة")} aria-expanded={open} className="lift-hover"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, border: "1px solid rgba(var(--border-rgb),0.25)", background: "none", color: "var(--icon-muted)", borderRadius: 10, cursor: "pointer" }}>
        <MenuIcon size={16} />
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", top: "calc(100% + 8px)", insetInlineEnd: 0, minWidth: 190, background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 10, boxShadow: "0 14px 30px -12px rgba(0,0,0,0.35)", overflowY: "auto", maxHeight: "min(320px, calc(100vh - 90px))", overscrollBehavior: "contain", zIndex: 40, animation: "scaleIn 0.18s cubic-bezier(0.22,1,0.36,1) both", transformOrigin: "top" }}>
          <button role="menuitem" style={itemStyle} onClick={() => itemClick(onToggleTheme)}>
            {theme === "dark" ? <SunIcon size={15} /> : <MoonIcon size={15} />}
            {theme === "dark" ? tr(isAr, "Light Mode", "الوضع الفاتح") : tr(isAr, "Dark Mode", "الوضع الداكن")}
          </button>
          {(onEnableReminders || onDisableReminders) && (
            <button role="menuitem" disabled={remindersBusy} style={{ ...itemStyle, borderTop: "1px solid rgba(var(--border-rgb),0.12)", opacity: remindersBusy ? 0.6 : 1, cursor: remindersBusy ? "default" : "pointer" }}
              onClick={() => { if (remindersBusy) return; itemClick(remindersOn ? onDisableReminders : onEnableReminders); }}>
              {remindersOn ? <BellIcon size={15} /> : <BellOffIcon size={15} />}
              {remindersOn ? tr(isAr, "Reminders: On", "التذكيرات: مفعّلة") : tr(isAr, "Reminders: Off", "التذكيرات: متوقفة")}
            </button>
          )}
          {onChangeAccent && (
            <div style={{ padding: "9px 14px", borderTop: "1px solid rgba(var(--border-rgb),0.12)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: "var(--icon-muted)", marginBottom: 7 }}>
                <PaletteIcon size={13} /> {tr(isAr, "Color theme", "لون الواجهة")}
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {Object.entries(ACCENT_THEMES).map(([key, t]) => {
                  const swatch = (t[theme] || t.light).a1;
                  const active = key === accentTheme;
                  return (
                    <button key={key} type="button" onClick={() => onChangeAccent(key)}
                      title={tr(isAr, t.label.en, t.label.ar)} aria-label={tr(isAr, t.label.en, t.label.ar)}
                      style={{ width: 22, height: 22, borderRadius: "50%", background: swatch, border: active ? "2px solid var(--ink)" : "1px solid rgba(var(--border-rgb),0.3)", cursor: "pointer", padding: 0, boxShadow: active ? "0 0 0 2px var(--card)" : "none" }} />
                  );
                })}
              </div>
            </div>
          )}
          <button role="menuitem" style={{ ...itemStyle, borderTop: "1px solid rgba(var(--border-rgb),0.12)" }} onClick={() => itemClick(onOpenAccount)}>
            <UserIcon size={15} /> {tr(isAr, "My Account", "حسابي")}
          </button>
          {isAdmin && (
            <button role="menuitem" style={{ ...itemStyle, borderTop: "1px solid rgba(var(--border-rgb),0.12)" }} onClick={() => itemClick(onOpenAdmin)}>
              <UsersIcon size={15} /> {tr(isAr, "Admin Panel", "لوحة التحكم")}
            </button>
          )}
          <button role="menuitem" style={{ ...itemStyle, borderTop: "1px solid rgba(var(--border-rgb),0.12)", color: "var(--danger)" }} onClick={() => itemClick(onLogout)}>
            <LogoutIcon size={15} /> {tr(isAr, "Sign Out", "تسجيل الخروج")}
          </button>
        </div>
      )}
    </div>
  );
}
