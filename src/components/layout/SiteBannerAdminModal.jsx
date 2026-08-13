import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { tr } from "../../lib/config/i18n";
import { stretchArabicText, hasArabic } from "../../lib/utils/arabicStretch";
import NumberStepper from "../common/NumberStepper";
import { XIcon, LoaderIcon } from "../common/Icons";

/**
 * Admin modal to configure the site-wide announcement banner.
 */
export default function SiteBannerAdminModal({
  open,
  onClose,
  siteBanner = null,
  onPersistSiteBanner = null,
  isAr = false,
  appLang = "en",
}) {
  const lang = appLang || (isAr ? "ar" : "en");
  const T = (en, ar, de, fr) => tr(lang, en, ar, de, fr);

  const fieldLabel = {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "var(--muted-strong)",
    marginBottom: 6,
  };
  const fieldInput = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(var(--border-rgb),0.2)",
    background: "var(--input-bg)",
    color: "var(--ink)",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
  };

  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerColor, setBannerColor] = useState("#146C94");
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [bannerShine, setBannerShine] = useState(40);
  const [bannerSpeed, setBannerSpeed] = useState(1);
  const [bannerLetterSpacing, setBannerLetterSpacing] = useState(0);
  const [bannerFlash, setBannerFlash] = useState(false);
  const [bannerRepeats, setBannerRepeats] = useState(4);
  const [bannerSize, setBannerSize] = useState("md");
  const [bannerDurationAmount, setBannerDurationAmount] = useState(0);
  const [bannerDurationUnit, setBannerDurationUnit] = useState("hours");
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerMsg, setBannerMsg] = useState("");
  const [bannerRemainingLabel, setBannerRemainingLabel] = useState("");

  useEffect(() => {
    if (!open) return;
    const b = siteBanner || {};
    setBannerMessage(b.message || "");
    setBannerColor(b.color || "#146C94");
    setBannerEnabled(!!b.enabled);
    setBannerShine(typeof b.shine === "number" ? b.shine : 40);
    setBannerSpeed(typeof b.speed === "number" ? b.speed : 1);
    setBannerLetterSpacing(typeof b.letterSpacing === "number" ? b.letterSpacing : 0);
    setBannerFlash(!!b.flash);
    setBannerRepeats(typeof b.repeats === "number" ? Math.max(1, Math.min(12, b.repeats)) : 4);
    setBannerSize(b.size === "sm" || b.size === "lg" || b.size === "xl" ? b.size : "md");
    let mins = 0;
    if (typeof b.durationMinutes === "number" && b.durationMinutes > 0) mins = b.durationMinutes;
    else if (typeof b.durationHours === "number" && b.durationHours > 0) mins = Math.round(b.durationHours * 60);
    if (mins <= 0) {
      setBannerDurationAmount(0);
      setBannerDurationUnit("hours");
    } else if (mins % (60 * 24) === 0) {
      setBannerDurationAmount(mins / (60 * 24));
      setBannerDurationUnit("days");
    } else if (mins % 60 === 0) {
      setBannerDurationAmount(mins / 60);
      setBannerDurationUnit("hours");
    } else {
      setBannerDurationAmount(mins);
      setBannerDurationUnit("minutes");
    }
    setBannerMsg("");
  }, [open, siteBanner]);

  useEffect(() => {
    if (!open) {
      setBannerRemainingLabel("");
      return;
    }
    const b = siteBanner;
    if (!b || !b.enabled || !b.updatedAt) {
      setBannerRemainingLabel("");
      return;
    }
    let mins = 0;
    if (typeof b.durationMinutes === "number" && b.durationMinutes > 0) mins = b.durationMinutes;
    else if (typeof b.durationHours === "number" && b.durationHours > 0) mins = Math.round(b.durationHours * 60);
    if (!mins) {
      setBannerRemainingLabel("");
      return;
    }
    const endsAt = b.updatedAt + mins * 60 * 1000;

    function formatRemaining(ms) {
      if (ms <= 0) return T("Ended — will hide on refresh", "انتهى — هيختفي مع التحديث");
      const totalSec = Math.ceil(ms / 1000);
      const d = Math.floor(totalSec / 86400);
      const h = Math.floor((totalSec % 86400) / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      if (d > 0) return T(`${d}d ${h}h ${m}m left`, `${d}ي ${h}س ${m}د متبقية`);
      if (h > 0) return T(`${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s left`, `${h}س ${String(m).padStart(2, "0")}د ${String(s).padStart(2, "0")}ث متبقية`);
      if (m > 0) return T(`${m}m ${String(s).padStart(2, "0")}s left`, `${m}د ${String(s).padStart(2, "0")}ث متبقية`);
      return T(`${s}s left`, `${s}ث متبقية`);
    }

    function tick() {
      setBannerRemainingLabel(formatRemaining(endsAt - Date.now()));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [open, siteBanner, lang]);

  async function saveBanner(e) {
    e && e.preventDefault();
    if (!onPersistSiteBanner) return;
    setBannerSaving(true);
    setBannerMsg("");
    const msg = (bannerMessage || "").trim();
    const next = {
      id: `banner-${Date.now().toString(36)}`,
      message: msg,
      color: bannerColor || "#146C94",
      enabled: !!bannerEnabled && !!msg,
      updatedAt: Date.now(),
      shine: Math.max(0, Math.min(100, Number(bannerShine) || 0)),
      speed: Math.max(0.4, Math.min(2, Number(bannerSpeed) || 1)),
      letterSpacing: Math.max(0, Math.min(30, Number(bannerLetterSpacing) || 0)),
      flash: !!bannerFlash,
      repeats: Math.max(1, Math.min(12, Math.round(Number(bannerRepeats) || 4))),
      size: bannerSize === "sm" || bannerSize === "lg" || bannerSize === "xl" ? bannerSize : "md",
      durationMinutes: (() => {
        const amt = Math.max(0, Number(bannerDurationAmount) || 0);
        if (!amt) return 0;
        if (bannerDurationUnit === "days") return Math.min(60 * 24 * 30, Math.round(amt * 60 * 24));
        if (bannerDurationUnit === "hours") return Math.min(60 * 24 * 30, Math.round(amt * 60));
        return Math.min(60 * 24 * 30, Math.round(amt));
      })(),
    };
    const result = await onPersistSiteBanner(next.enabled ? next : { ...next, enabled: false, message: msg });
    setBannerSaving(false);
    if (result && result.ok === false) {
      setBannerMsg(result.error || T("Save failed.", "فشل الحفظ."));
      return;
    }
    setBannerMsg(T("Announcement saved.", "تم حفظ الإعلان."));
  }

  async function clearBanner() {
    if (!onPersistSiteBanner) return;
    setBannerSaving(true);
    setBannerMsg("");
    const result = await onPersistSiteBanner(null);
    setBannerSaving(false);
    if (result && result.ok === false) {
      setBannerMsg(result.error || T("Save failed.", "فشل الحفظ."));
      return;
    }
    setBannerMessage("");
    setBannerEnabled(false);
    setBannerLetterSpacing(0);
    setBannerFlash(false);
    setBannerRepeats(4);
    setBannerMsg(T("Announcement cleared.", "تم إزالة الإعلان."));
  }

  if (!open || typeof document === "undefined") return null;

  const closeBannerModal = onClose;

  return createPortal(
        <div
          onClick={() => { /* Stay open unless X */ }}
          className="modal-backdrop"
          style={{
            position: "fixed", inset: 0, zIndex: 3600,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="banner-modal-title"
            className="modal-card"
            style={{
              width: "100%", maxWidth: "min(440px, 100%)",
              maxHeight: "min(90dvh, 820px)", overflow: "hidden", display: "flex", flexDirection: "column",
              background: "var(--card)", color: "var(--ink)",
              border: "1px solid rgba(var(--border-rgb),0.14)",
              borderRadius: 16,
              padding: "clamp(14px, 3vw, 22px)",
              boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexShrink: 0 }}>
              <h2 id="banner-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>
                {T( "Site banner", "بانر الموقع")}
              </h2>
              <button
                type="button"
                onClick={closeBannerModal}
                aria-label={T( "Close", "إغلاق")}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
            <div
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{ padding: "6px 10px 12px", display: "flex", flexDirection: "column", gap: 10 }}
                    >
                      <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
                        {T(
                          "Banner appears at the very top for every signed-in user. They can dismiss it; a new message shows again.",
                          "البانر يظهر في أعلى الموقع لكل المسجّلين. يقدروا يقفلوه؛ رسالة جديدة هتظهر تاني.")}
                      </div>
                      {bannerSection("1 · Content", "١ · المحتوى")}
                      <div>
                        <label style={fieldLabel}>{T( "Message", "الرسالة")}</label>
                        <textarea
                          value={bannerMessage}
                          onChange={(e) => setBannerMessage(e.target.value)}
                          rows={3}
                          placeholder={T( "e.g. Maintenance tonight at 10pm", "مثال: صيانة الليلة الساعة ١٠")}
                          style={{ ...fieldInput, resize: "vertical", minHeight: 64, lineHeight: 1.4 }}
                          dir="auto"
                        />
                      </div>
                      {bannerSection("2 · Appearance", "٢ · المظهر")}
                      <div>
                        <label style={fieldLabel}>{T( "Banner color", "لون الشريط")}</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <input
                            type="color"
                            value={bannerColor && /^#[0-9A-Fa-f]{6}$/.test(bannerColor) ? bannerColor : "#146C94"}
                            onChange={(e) => setBannerColor(e.target.value)}
                            style={{ width: 40, height: 32, border: "1px solid rgba(var(--border-rgb),0.25)", borderRadius: 6, padding: 2, cursor: "pointer", background: "var(--card)" }}
                          />
                          {[
                            "#146C94", "#B3261E", "#2E7D32", "#D98B2B", "#6E3D96", "#1B1B1B",
                          ].map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setBannerColor(c)}
                              style={{
                                width: 24, height: 24, borderRadius: 6,
                                border: bannerColor === c ? "2px solid #fff" : "1px solid rgba(0,0,0,0.2)",
                                boxShadow: bannerColor === c ? `0 0 0 2px ${c}` : "none",
                                background: c, cursor: "pointer", padding: 0,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={fieldLabel}>{T("Banner size", "حجم الشريط")}</label>
                        <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.4 }}>
                          {T("How much vertical space the banner takes on screen.", "قد إيه من الشاشة الشريط هياخد (ارتفاع).")}
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                          {[
                            { id: "sm", en: "S", ar: "صغير", h: 28 },
                            { id: "md", en: "M", ar: "وسط", h: 40 },
                            { id: "lg", en: "L", ar: "كبير", h: 52 },
                            { id: "xl", en: "XL", ar: "أكبر", h: 64 },
                          ].map((opt) => {
                            const active = bannerSize === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setBannerSize(opt.id)}
                                className="touch-target"
                                style={{
                                  minHeight: 44, borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 12,
                                  border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.14)",
                                  background: active ? "color-mix(in srgb, var(--accent-1) 12%, var(--card))" : "var(--input-bg)",
                                  color: "var(--ink)",
                                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                                }}
                              >
                                <span style={{ width: "70%", height: Math.max(6, opt.h / 8), borderRadius: 3, background: active ? "var(--accent-1)" : "rgba(var(--border-rgb),0.35)" }} />
                                {T(opt.en, opt.ar)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="touch-target"
                        onClick={() => setBannerEnabled((v) => !v)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          width: "100%", padding: "9px 12px", minHeight: 44, borderRadius: 10, cursor: "pointer",
                          border: "1px solid rgba(var(--border-rgb),0.18)", background: "var(--input-bg)",
                          fontSize: 13, fontWeight: 600, color: "var(--ink)",
                        }}
                      >
                        <span>{T( "Show on site", "إظهار على الموقع")}</span>
                        <span style={{
                          width: 36, height: 20, borderRadius: 10, position: "relative", flexShrink: 0,
                          background: bannerEnabled ? "#34c759" : "rgba(var(--border-rgb),0.35)",
                          transition: "background 0.2s ease",
                        }}>
                          <span style={{
                            position: "absolute", top: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff",
                            insetInlineStart: bannerEnabled ? 18 : 2, transition: "inset-inline-start 0.2s ease",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                          }} />
                        </span>
                      </button>

                      {bannerSection("3 · Motion & text", "٣ · الحركة والنص")}
                      <div>
                        <label style={fieldLabel}>
                          {T( "Shine", "اللمعان")} — {bannerShine}%
                        </label>
                        <input
                          type="range" min={0} max={100} step={5}
                          value={bannerShine}
                          onChange={(e) => setBannerShine(Number(e.target.value))}
                          style={{ width: "100%", accentColor: "var(--accent-1)" }}
                        />
                        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                          {T( "Sweeping highlight + soft text glow", "لمعة متحركة + توهج خفيف للنص")}
                        </div>
                      </div>
                      <div>
                        <label style={fieldLabel}>
                          {T( "Repeat count", "عدد التكرارات")} — {bannerRepeats}×
                        </label>
                        <input
                          type="range" min={1} max={12} step={1}
                          value={bannerRepeats}
                          onChange={(e) => setBannerRepeats(Number(e.target.value))}
                          style={{ width: "100%", accentColor: "var(--accent-1)" }}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                          <span>{T( "Once", "مرة واحدة")}</span>
                          <span>{T( "12×", "١٢×")}</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                          {T( "How many times the message is chained in the ticker", "كام مرة الجملة تتكرر ورا بعض في شريط الأخبار")}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="touch-target"
                        onClick={() => setBannerFlash((v) => !v)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          width: "100%", padding: "9px 12px", minHeight: 44, borderRadius: 10, cursor: "pointer",
                          border: "1px solid rgba(var(--border-rgb),0.18)", background: "var(--input-bg)",
                          fontSize: 13, fontWeight: 600, color: "var(--ink)",
                        }}
                      >
                        <span>
                          {T( "Ambulance flash", "وميض إسعاف")}
                          <span style={{ display: "block", fontSize: 10.5, fontWeight: 500, color: "var(--muted)", marginTop: 2 }}>
                            {T( "Red / blue strobes + brightness pulse", "وميض أحمر/أزرق + نبض سطوع")}
                          </span>
                        </span>
                        <span style={{
                          width: 36, height: 20, borderRadius: 10, position: "relative", flexShrink: 0,
                          background: bannerFlash ? "#34c759" : "rgba(var(--border-rgb),0.35)",
                          transition: "background 0.2s ease",
                        }}>
                          <span style={{
                            position: "absolute", top: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff",
                            insetInlineStart: bannerFlash ? 18 : 2, transition: "inset-inline-start 0.2s ease",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                          }} />
                        </span>
                      </button>
                      <div>
                        <label style={fieldLabel}>
                          {T( "Motion speed", "سرعة الحركة")} — {bannerSpeed.toFixed(1)}×
                        </label>
                        <input
                          type="range" min={0.4} max={2} step={0.1}
                          value={bannerSpeed}
                          onChange={(e) => setBannerSpeed(Number(e.target.value))}
                          style={{ width: "100%", accentColor: "var(--accent-1)" }}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                          <span>{T( "Slow", "بطيء")}</span>
                          <span>{T( "Fast", "سريع")}</span>
                        </div>
                      </div>
                      <div>
                        <label style={fieldLabel}>
                          {T( "Text extension", "امتداد الجملة أو الكلمة")} — {bannerLetterSpacing}
                        </label>
                        <input
                          type="range" min={0} max={10} step={1}
                          value={bannerLetterSpacing}
                          onChange={(e) => setBannerLetterSpacing(Number(e.target.value))}
                          style={{ width: "100%", accentColor: "var(--accent-1)" }}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                          <span>{T( "Normal", "طبيعي")}</span>
                          <span>{T( "Stretched", "ممتد")}</span>
                        </div>
                      </div>
                      {bannerSection("4 · Duration", "٤ · المدة")}
                      <div>
                        <label style={fieldLabel}>
                          {T( "Stay on site", "مدة الظهور")}
                        </label>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <NumberStepper
                            min={0}
                            max={9999}
                            value={bannerDurationAmount}
                            onChange={(v) => setBannerDurationAmount(v)}
                            width={120}
                            aria-label={T("Stay on site", "مدة الظهور")}
                          />
                          <select
                            value={bannerDurationUnit}
                            onChange={(e) => setBannerDurationUnit(e.target.value)}
                            style={{ ...fieldInput, width: "auto", flex: "1 1 120px", cursor: "pointer" }}
                          >
                            <option value="minutes">{T( "Minutes", "دقائق")}</option>
                            <option value="hours">{T( "Hours", "ساعات")}</option>
                            <option value="days">{T( "Days", "أيام")}</option>
                          </select>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.4 }}>
                          {bannerDurationAmount > 0
                            ? T(
                                "Banner auto-hides after this time. No dismiss (X) button.",
                                "البانر هيختفي تلقائي بعد المدة دي. زر الإغلاق (X) مش هيظهر.")
                            : T(
                                "0 = stays until you turn it off. Users can dismiss with X.",
                                "٠ = يفضل ظاهر لحد ما تقفله. المستخدم يقدر يقفله بـ X.")}
                        </div>
                        {bannerRemainingLabel && (
                          <div
                            style={{
                              marginTop: 10,
                              padding: "10px 12px",
                              borderRadius: 10,
                              background: "rgba(var(--accent-rgb, 25,167,206), 0.12)",
                              border: "1px solid rgba(var(--accent-rgb, 25,167,206), 0.35)",
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden="true">⏱</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-1)", marginBottom: 2 }}>
                                {T("Live banner timer", "مؤقت البانر الحالي")}
                              </div>
                              <div style={{
                                fontFamily: "ui-monospace, 'Source Sans 3', monospace",
                                fontSize: 15,
                                fontWeight: 800,
                                color: "var(--ink)",
                                letterSpacing: "0.02em",
                              }}>
                                {bannerRemainingLabel}
                              </div>
                              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                                {T("Until the published banner auto-removes", "لحد ما البانر المنشور يتشال لوحده")}
                              </div>
                            </div>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                          {[
                            { a: 0, u: "hours", label: T( "Forever", "دائم") },
                            { a: 30, u: "minutes", label: T( "30m", "٣٠د") },
                            { a: 1, u: "hours", label: T( "1h", "١س") },
                            { a: 6, u: "hours", label: T( "6h", "٦س") },
                            { a: 1, u: "days", label: T( "1d", "يوم") },
                            { a: 7, u: "days", label: T( "7d", "أسبوع") },
                          ].map((q) => (
                            <button
                              key={q.label}
                              type="button"
                              onClick={() => { setBannerDurationAmount(q.a); setBannerDurationUnit(q.u); }}
                              style={{
                                padding: "4px 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                                border: "1px solid rgba(var(--border-rgb),0.2)",
                                background: bannerDurationAmount === q.a && bannerDurationUnit === q.u ? "var(--accent-1)" : "var(--input-bg)",
                                color: bannerDurationAmount === q.a && bannerDurationUnit === q.u ? "#fff" : "var(--ink)",
                              }}
                            >
                              {q.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {bannerSection("5 · Preview & publish", "٥ · معاينة ونشر")}
                      {/* Live preview — shine + optional ambulance flash */}
                      <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid rgba(var(--border-rgb),0.15)", position: "relative" }}>
                        <div
                          className={bannerFlash ? "site-banner--flash" : undefined}
                          style={{
                            background: bannerColor || "#146C94", color: "#fff",
                            padding: "10px 12px", fontSize: 14, fontWeight: 700,
                            display: "flex", alignItems: "center", gap: 8, textAlign: "center",
                            position: "relative", overflow: "hidden",
                            direction: hasArabic(bannerMessage) ? "rtl" : "ltr",
                            unicodeBidi: "isolate",
                            boxShadow: bannerShine > 0
                              ? `inset 0 0 ${8 + bannerShine * 0.18}px rgba(255,255,255,${(bannerShine / 100) * 0.22})`
                              : undefined,
                          }}
                        >
                          {bannerShine > 0 && (
                            <span aria-hidden="true" style={{
                              position: "absolute", inset: 0, pointerEvents: "none",
                              background: `linear-gradient(105deg, transparent 30%, rgba(255,255,255,${Math.min(0.65, (bannerShine / 100) * 0.6)}) 50%, transparent 70%)`,
                              backgroundSize: "220% 100%",
                              animation: `siteBannerShimmer ${(5 / Math.max(0.4, bannerSpeed)).toFixed(2)}s ease-in-out infinite`,
                            }} />
                          )}
                          {bannerFlash && (
                            <>
                              <span aria-hidden="true" className="site-banner-strobe site-banner-strobe--left" />
                              <span aria-hidden="true" className="site-banner-strobe site-banner-strobe--right" />
                              <span aria-hidden="true" className="site-banner-flash-pulse" />
                            </>
                          )}
                          <span style={{ width: 18, flexShrink: 0, position: "relative", zIndex: 2 }} />
                          <span style={{
                            flex: 1,
                            textAlign: "center",
                            fontWeight: 700,
                            position: "relative",
                            zIndex: 2,
                            unicodeBidi: "isolate",
                            letterSpacing: bannerLetterSpacing && !hasArabic(bannerMessage) ? `${bannerLetterSpacing}px` : undefined,
                            textShadow: bannerShine > 30
                              ? `0 0 ${Math.round(bannerShine / 12)}px rgba(255,255,255,${(bannerShine / 100) * 0.45})`
                              : undefined,
                          }}>
                            {bannerMessage.trim()
                              ? (() => {
                                  const rtl = hasArabic(bannerMessage);
                                  const base = stretchArabicText(bannerMessage.trim(), bannerLetterSpacing);
                                  const fixed = rtl
                                    ? base.replace(/([.!?…]+)\s*$/u, "$1\u200F")
                                    : base.replace(/([.!?…]+)\s*$/u, "$1\u200E");
                                  if (bannerRepeats <= 1) return fixed;
                                  const sep = "        ";
                                  return Array(Math.min(3, bannerRepeats)).fill(fixed).join(sep)
                                    + (bannerRepeats > 3 ? sep + "…" : "");
                                })()
                              : T( "Preview…", "معاينة…")}
                          </span>
                          <span style={{ opacity: 0.7, width: 18, textAlign: "center", position: "relative", zIndex: 2 }}>×</span>
                        </div>
                      </div>
                      {bannerMsg && (
                        <div style={{
                          fontSize: 12,
                          color: /fail|فشل/i.test(bannerMsg) ? "var(--danger)" : "var(--success)",
                        }}>
                          {bannerMsg}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          disabled={bannerSaving}
                          className="touch-target"
                          onClick={saveBanner}
                          style={{
                            flex: 1, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            padding: "10px 12px", borderRadius: 10, border: "none", cursor: bannerSaving ? "default" : "pointer",
                            fontSize: 13, fontWeight: 700, color: "#fff",
                            background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                            opacity: bannerSaving ? 0.7 : 1,
                          }}
                        >
                          {bannerSaving ? <LoaderIcon size={14} /> : null}
                          {T( "Save banner", "حفظ البانر")}
                        </button>
                        <button
                          type="button"
                          disabled={bannerSaving}
                          className="touch-target"
                          onClick={clearBanner}
                          style={{
                            minHeight: 44, padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                            fontSize: 13, fontWeight: 700, color: "var(--danger)",
                            background: "none", border: "1px solid var(--danger-border, rgba(179,38,30,0.35))",
                          }}
                        >
                          {T( "Clear", "إزالة")}
                        </button>
                      </div>
                    </div>
            </div>
          </div>
        </div>
    ,
    document.body
  );
}
