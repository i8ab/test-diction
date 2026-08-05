import { useState, useEffect, useRef } from "react";
import { tr } from "../../lib/config/i18n";
import { ACCENT_THEMES } from "../../lib/state/storage";
import {
  UsersIcon, SunIcon, MoonIcon, UserIcon, LogoutIcon, PaletteIcon, MenuIcon, BellIcon, BellOffIcon, XIcon,
} from "../common/Icons";

export default function HeaderMenu({ theme, onToggleTheme, isAdmin, onOpenAccount, onOpenAdmin, onLogout, isAr, accentTheme, onChangeAccent, remindersOn, remindersBusy, onEnableReminders, onDisableReminders, onTestReminder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close instantly — no exit animation, no transition delay.
  function closeMenu() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) closeMenu(); }
    function onKeyDown(e) { if (e.key === "Escape") closeMenu(); }
    // pointerdown fires earlier than click, so outside-close feels instant.
    document.addEventListener("pointerdown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Actions fire immediately but the menu stays open — it only closes via
  // the X button, a click outside, or Escape.
  function itemClick(fn) { fn(); }

  const itemStyle = { position: "relative", display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", fontSize: 13.5, fontWeight: 600, color: "var(--ink)", background: "none", border: "none", borderRadius: 9, textAlign: "start", cursor: "pointer" };
  const iconWrapStyle = (bg) => ({ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 8, background: bg, flexShrink: 0 });

  function Row({ icon, label, onClick, disabled, tint, danger }) {
    return (
      <button
        role="menuitem"
        disabled={disabled}
        className="header-menu-item"
        style={{ ...itemStyle, color: danger ? "var(--danger)" : "var(--ink)", opacity: disabled ? 0.55 : 1, cursor: disabled ? "default" : "pointer" }}
        onClick={() => { if (!disabled) itemClick(onClick); }}
      >
        <span style={iconWrapStyle(danger ? "rgba(var(--danger-rgb,220,38,38),0.12)" : `${tint}1c`)}>
          <span style={{ color: danger ? "var(--danger)" : tint, display: "flex" }}>{icon}</span>
        </span>
        <span style={{ flex: 1, textAlign: "start" }}>{label}</span>
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
            .header-menu-item { transition: background 0.12s ease; }
            .header-menu-item:hover:not(:disabled) { background: var(--input-bg); }
            .header-menu-item:active:not(:disabled) { background: var(--input-bg); opacity: 0.9; }
            .header-menu-swatch { transition: box-shadow 0.12s ease; }
          `}</style>
          {/* No entrance/exit animation — panel appears and disappears instantly for a snappy close on X. */}
          <div className="header-menu-panel" role="menu" style={{ position: "absolute", top: "calc(100% + 8px)", insetInlineEnd: 0, minWidth: 210, background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.14)", borderRadius: 17, boxShadow: "0 22px 48px -18px rgba(0,0,0,0.42), 0 2px 8px -2px rgba(0,0,0,0.15)", overflow: "hidden", zIndex: 40 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px 8px" }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted)" }}>
                {tr(isAr, "Menu", "القائمة")}
              </span>
              <button
                type="button"
                aria-label={tr(isAr, "Close", "إغلاق")}
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); closeMenu(); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", color: "var(--icon-muted)", background: "var(--input-bg)", border: "none", cursor: "pointer", transition: "none" }}
              >
                <XIcon size={12} />
              </button>
            </div>
            <div style={{ overflowY: "auto", overflowX: "hidden", maxHeight: "min(360px, calc(100vh - 100px))", overscrollBehavior: "contain", padding: "0 6px 6px", display: "flex", flexDirection: "column", gap: 1 }}>
              <Row
                tint="#f5a623"
                icon={theme === "dark" ? <SunIcon size={14} /> : <MoonIcon size={14} />}
                label={theme === "dark" ? tr(isAr, "Light Mode", "الوضع الفاتح") : tr(isAr, "Dark Mode", "الوضع الداكن")}
                onClick={onToggleTheme}
              />
              {(onEnableReminders || onDisableReminders) && (
                <Row
                  tint={remindersOn ? "#34c759" : "#8e8e93"}
                  icon={remindersOn ? <BellIcon size={14} /> : <BellOffIcon size={14} />}
                  label={remindersOn ? tr(isAr, "Reminders: On", "التذكيرات: مفعّلة") : tr(isAr, "Reminders: Off", "التذكيرات: متوقفة")}
                  onClick={remindersOn ? onDisableReminders : onEnableReminders}
                />
              )}
              {/* TEMPORARY test button — remove with api/push-test.js after testing */}
              {onTestReminder && (
                <Row
                  tint="#ff9f0a"
                  icon={<BellIcon size={14} />}
                  label={tr(isAr, "Send test notification", "ابعت إشعار تجريبي")}
                  onClick={onTestReminder}
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
                          className="header-menu-swatch"
                          style={{ width: 24, height: 24, borderRadius: "50%", background: swatch, border: active ? "2px solid var(--ink)" : "1px solid rgba(var(--border-rgb),0.3)", cursor: "pointer", padding: 0, boxShadow: active ? "0 0 0 3px var(--card), 0 0 0 4px " + swatch + "55" : "none" }} />
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ borderTop: "1px solid rgba(var(--border-rgb),0.12)", marginTop: 2, paddingTop: 1 }}>
                <Row tint="#5b8def" icon={<UserIcon size={14} />} label={tr(isAr, "My Account", "حسابي")} onClick={onOpenAccount} />
                {isAdmin && (
                  <Row tint="#af52de" icon={<UsersIcon size={14} />} label={tr(isAr, "Admin Panel", "لوحة التحكم")} onClick={onOpenAdmin} />
                )}
                <Row danger tint="var(--danger)" icon={<LogoutIcon size={14} />} label={tr(isAr, "Sign Out", "تسجيل الخروج")} onClick={onLogout} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
