import { useState, useEffect, useRef } from "react";
import { tr } from "../../lib/config/i18n";
import { ACCENT_THEMES } from "../../lib/state/storage";
import {
  UsersIcon, SunIcon, MoonIcon, UserIcon, LogoutIcon, PaletteIcon, MenuIcon, BellIcon, BellOffIcon, XIcon, CheckIcon, TrashIcon,
} from "../common/Icons";

export default function HeaderMenu({
  theme, onToggleTheme, isAdmin, onOpenAccount, onOpenAdmin, onLogout, isAr,
  accentTheme, onChangeAccent,
  remindersOn, remindersBusy, onEnableReminders, onDisableReminders, onTestReminder,
  reminderTitle, onChangeReminderTitle,
  reminderMessage, onChangeReminderMessage,
  pendingAccounts = [],
  onApproveRequest,
  onRejectRequest,
}) {
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [busyCode, setBusyCode] = useState(null);
  const ref = useRef(null);

  const pendingCount = (pendingAccounts || []).length;

  function closeMenu() {
    setOpen(false);
    setNotifOpen(false);
    setRequestsOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) closeMenu(); }
    function onKeyDown(e) { if (e.key === "Escape") closeMenu(); }
    document.addEventListener("pointerdown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function itemClick(fn) { fn(); }

  const itemStyle = { position: "relative", display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 12px", minHeight: 44, fontSize: 13.5, fontWeight: 600, color: "var(--ink)", background: "none", border: "none", borderRadius: 9, textAlign: "start", cursor: "pointer" };
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

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} title={tr(isAr, "Menu", "القائمة")} aria-label={tr(isAr, "Menu", "القائمة")} aria-expanded={open} className="lift-hover touch-target"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, border: "1px solid rgba(var(--border-rgb),0.25)", background: "none", color: "var(--icon-muted)", borderRadius: 10, cursor: "pointer", position: "relative" }}>
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
      {open && (
        <>
          <style>{`
            .header-menu-item { transition: background 0.12s ease; }
            .header-menu-item:hover:not(:disabled) { background: var(--input-bg); }
            .header-menu-item:active:not(:disabled) { background: var(--input-bg); opacity: 0.9; }
            .header-menu-swatch { transition: box-shadow 0.12s ease; }
            .header-menu-panel {
              position: absolute; top: calc(100% + 8px); inset-inline-end: 0;
              min-width: min(280px, calc(100vw - 24px)); max-width: min(320px, calc(100vw - 16px));
              background: var(--card); border: 1px solid rgba(var(--border-rgb),0.14);
              border-radius: 17px;
              box-shadow: 0 22px 48px -18px rgba(0,0,0,0.42), 0 2px 8px -2px rgba(0,0,0,0.15);
              overflow: hidden; z-index: 40;
            }
            @media (max-width: 480px) {
              .header-menu-panel {
                position: fixed; top: auto; bottom: 0; inset-inline: 0;
                max-width: none; min-width: 0; width: 100%;
                border-radius: 18px 18px 0 0;
                max-height: min(85dvh, 640px);
              }
            }
          `}</style>
          <div className="header-menu-panel" role="menu">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px 8px" }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted)" }}>
                {tr(isAr, "Menu", "القائمة")}
              </span>
              <button
                type="button"
                aria-label={tr(isAr, "Close", "إغلاق")}
                className="touch-target"
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); closeMenu(); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", color: "var(--icon-muted)", background: "var(--input-bg)", border: "none", cursor: "pointer" }}
              >
                <XIcon size={12} />
              </button>
            </div>
            <div style={{ overflowY: "auto", overflowX: "hidden", maxHeight: "min(480px, calc(100dvh - 100px))", overscrollBehavior: "contain", padding: "0 6px 6px", display: "flex", flexDirection: "column", gap: 1 }}>
              <Row
                tint="#f5a623"
                icon={theme === "dark" ? <SunIcon size={14} /> : <MoonIcon size={14} />}
                label={theme === "dark" ? tr(isAr, "Light Mode", "الوضع الفاتح") : tr(isAr, "Dark Mode", "الوضع الداكن")}
                onClick={onToggleTheme}
              />

              {/* ========== New account requests (admins) ========== */}
              {isAdmin && (
                <div style={{ borderTop: "1px solid rgba(var(--border-rgb),0.12)", marginTop: 4, paddingTop: 4 }}>
                  <Row
                    tint="#af52de"
                    icon={<UsersIcon size={14} />}
                    label={tr(isAr, "New requests", "طلبات جديدة")}
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
                          {tr(isAr, "No pending account requests.", "لا توجد طلبات حساب معلّقة.")}
                        </div>
                      ) : (
                        pendingAccounts.map((a) => (
                          <div key={a.code} style={{
                            border: "1px solid rgba(var(--border-rgb),0.16)", borderRadius: 10,
                            padding: "10px 10px", background: "var(--input-bg)",
                          }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{a.name}</div>
                            <div style={{ fontSize: 12, color: "var(--muted-strong)", fontFamily: "ui-monospace, monospace", marginTop: 2 }} dir="ltr">@{a.username || "—"}</div>
                            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
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
                                <CheckIcon size={13} /> {tr(isAr, "Approve", "موافقة")}
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
                                <TrashIcon size={13} /> {tr(isAr, "Reject", "رفض")}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ========== Notifications section ========== */}
              {(onEnableReminders || onDisableReminders) && (
                <div style={{ borderTop: "1px solid rgba(var(--border-rgb),0.12)", marginTop: 4, paddingTop: 4 }}>
                  <Row
                    tint={remindersOn ? "#34c759" : "#8e8e93"}
                    icon={remindersOn ? <BellIcon size={14} /> : <BellOffIcon size={14} />}
                    label={tr(isAr, "Notifications", "الإشعارات")}
                    onClick={() => setNotifOpen((v) => !v)}
                    trailing={
                      <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                        {notifOpen ? "▾" : (isAr ? "◂" : "▸")}
                      </span>
                    }
                  />
                  {notifOpen && (
                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{ padding: "6px 10px 12px", display: "flex", flexDirection: "column", gap: 10 }}
                    >
                      <button
                        type="button"
                        disabled={remindersBusy}
                        className="touch-target"
                        onClick={() => { if (remindersOn) onDisableReminders(); else onEnableReminders(); }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          width: "100%", padding: "9px 12px", minHeight: 44, borderRadius: 10, cursor: remindersBusy ? "default" : "pointer",
                          border: "1px solid rgba(var(--border-rgb),0.18)", background: "var(--input-bg)",
                          fontSize: 13, fontWeight: 600, color: "var(--ink)",
                        }}
                      >
                        <span>{remindersOn ? tr(isAr, "Reminders: On", "التذكيرات: مفعّلة") : tr(isAr, "Reminders: Off", "التذكيرات: متوقفة")}</span>
                        <span style={{
                          width: 36, height: 20, borderRadius: 10, position: "relative", flexShrink: 0,
                          background: remindersOn ? "#34c759" : "rgba(var(--border-rgb),0.35)",
                          transition: "background 0.2s ease",
                        }}>
                          <span style={{
                            position: "absolute", top: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff",
                            insetInlineStart: remindersOn ? 18 : 2, transition: "inset-inline-start 0.2s ease",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                          }} />
                        </span>
                      </button>

                      <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4, padding: "0 2px" }}>
                        {tr(isAr,
                          "Daily reminder at 5:00 AM (Egypt time), even if you studied.",
                          "تذكير يومي الساعة 5:00 صباحًا (توقيت مصر)، حتى لو ذاكرت.")}
                      </div>

                      <div>
                        <label style={fieldLabel}>{tr(isAr, "Notification title", "عنوان الإشعار")}</label>
                        <input
                          type="text"
                          value={reminderTitle || ""}
                          onChange={(e) => onChangeReminderTitle && onChangeReminderTitle(e.target.value)}
                          placeholder={tr(isAr, "Time to review!", "وقت المراجعة!")}
                          maxLength={120}
                          style={fieldInput}
                          dir="auto"
                        />
                      </div>

                      <div>
                        <label style={fieldLabel}>{tr(isAr, "Notification message", "نص الإشعار")}</label>
                        <textarea
                          value={reminderMessage || ""}
                          onChange={(e) => onChangeReminderMessage && onChangeReminderMessage(e.target.value)}
                          placeholder={tr(
                            isAr,
                            "It's been a while since you studied — time for a quick review.",
                            "عدّى وقت من غير ما تراجع — يلا نراجع شوية."
                          )}
                          maxLength={300}
                          rows={3}
                          style={{ ...fieldInput, resize: "vertical", minHeight: 64, lineHeight: 1.4 }}
                          dir="auto"
                        />
                        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3, textAlign: "end" }}>
                          {(reminderMessage || "").length}/300
                        </div>
                      </div>

                      <div style={{
                        border: "1px solid rgba(var(--border-rgb),0.18)", borderRadius: 10,
                        padding: "10px 12px", background: "var(--paper)",
                      }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>
                          {tr(isAr, "Preview", "معاينة")}
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 3, lineHeight: 1.3 }} dir="auto">
                          {(reminderTitle && reminderTitle.trim()) || tr(isAr, "Time to review!", "وقت المراجعة!")}
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.4 }} dir="auto">
                          {(reminderMessage && reminderMessage.trim()) || tr(
                            isAr,
                            "It's been a while since you studied — time for a quick review.",
                            "عدّى وقت من غير ما تراجع — يلا نراجع شوية."
                          )}
                        </div>
                      </div>

                      {onTestReminder && (
                        <button
                          type="button"
                          onClick={onTestReminder}
                          className="touch-target"
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            width: "100%", padding: "10px 12px", minHeight: 44, borderRadius: 10, cursor: "pointer",
                            border: "none", fontSize: 13, fontWeight: 700, color: "#fff",
                            background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                          }}
                        >
                          <BellIcon size={14} />
                          {tr(isAr, "Send test notification", "ابعت إشعار تجريبي")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
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
                          className="header-menu-swatch touch-target"
                          style={{ width: 28, height: 28, borderRadius: "50%", background: swatch, border: active ? "2px solid var(--ink)" : "1px solid rgba(var(--border-rgb),0.3)", cursor: "pointer", padding: 0, boxShadow: active ? "0 0 0 3px var(--card), 0 0 0 4px " + swatch + "55" : "none" }} />
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
