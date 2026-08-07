import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { tr } from "../../lib/config/i18n";
import { stretchArabicText, hasArabic } from "../../lib/utils/arabicText";
import { XIcon } from "../common/Icons";
import NumberStepper from "../common/NumberStepper";

export default function BannerModal({
  open,
  onClose,
  siteBanner = null,
  onPersistSiteBanner = null,
  lang = "en",
}) {
  const T = (en, ar, de, fr) => tr(lang, en, ar, de, fr);

  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerColor, setBannerColor] = useState("#146C94");
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [bannerShine, setBannerShine] = useState(40);
  const [bannerSpeed, setBannerSpeed] = useState(1);
  const [bannerLetterSpacing, setBannerLetterSpacing] = useState(0);
  const [bannerFlash, setBannerFlash] = useState(false);
  const [bannerRepeats, setBannerRepeats] = useState(4);
  const [bannerDurationAmount, setBannerDurationAmount] = useState(0);
  const [bannerDurationUnit, setBannerDurationUnit] = useState("hours");
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerMsg, setBannerMsg] = useState("");
  const [bannerRemainingLabel, setBannerRemainingLabel] = useState("");

  // Sync form fields when the live banner changes or the section opens
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

  // Countdown for the currently published banner
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
      if (d > 0) return T(`${d}d ${h}h left`, `${d}ي ${h}س متبقية`);
      if (h > 0) return T(`${h}h ${m}m left`, `${h}س ${m}د متبقية`);
      if (m > 0) return T(`${m}m ${s}s left`, `${m}د ${s}ث متبقية`);
      return T(`${s}s left`, `${s}ث متبقية`);
    }

    function tick() {
      const left = endsAt - Date.now();
      setBannerRemainingLabel(formatRemaining(left));
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

  if (!open) return null;

  const node = (
    <div
      onClick={onClose}
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
          maxHeight: "min(90dvh, 820px)", overflowY: "auto",
          background: "var(--card)", color: "var(--ink)",
          border: "1px solid rgba(var(--border-rgb),0.14)",
          borderRadius: 16,
          padding: "clamp(14px, 3vw, 22px)",
          boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 id="banner-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>
            {T("Site banner", "بانر الموقع")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={T("Close", "إغلاق")}
            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Preview */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {T("Live preview", "معاينة حية")}
          </div>
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 10,
              background: bannerColor || "#146C94",
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              padding: "10px 14px",
              boxShadow: bannerShine > 0 ? `inset 0 0 ${bannerShine}px rgba(255,255,255,0.25)` : undefined,
            }}
          >
            {bannerMessage ? (
              <div
                style={{
                  width: "100%",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  direction: hasArabic(bannerMessage) ? "rtl" : "ltr",
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    animation: bannerSpeed > 0
                      ? `banner-scroll ${Math.max(4, 20 / (bannerSpeed || 1))}s linear infinite`
                      : undefined,
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                    letterSpacing: bannerLetterSpacing && !hasArabic(bannerMessage) ? `${bannerLetterSpacing}px` : undefined,
                    textShadow: bannerFlash ? "0 0 8px rgba(255,255,255,0.8)" : undefined,
                  }}
                >
                  {Array.from({ length: Math.max(1, bannerRepeats) }).map((_, i) => {
                    const rtl = hasArabic(bannerMessage);
                    const base = stretchArabicText(bannerMessage.trim(), bannerLetterSpacing);
                    return (
                      <span key={i} style={{ marginInlineEnd: 48 }}>
                        {base}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : (
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{T("Type a message…", "اكتب رسالة…")}</span>
            )}
          </div>
          {bannerRemainingLabel && (
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted-strong)", fontWeight: 600 }}>
              {bannerRemainingLabel}
            </div>
          )}
        </div>

        <form onSubmit={saveBanner}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
            {T("Message", "الرسالة")}
          </label>
          <textarea
            value={bannerMessage}
            onChange={(e) => setBannerMessage(e.target.value)}
            rows={3}
            placeholder={T("Announcement text…", "نص الإعلان…")}
            style={{
              width: "100%", boxSizing: "border-box", resize: "vertical",
              padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(var(--border-rgb),0.25)",
              background: "var(--input-bg)", color: "var(--ink)", fontSize: 14, marginBottom: 12,
              fontFamily: "inherit",
            }}
          />

          <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
            {T("Color", "اللون")}
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <input
              type="color"
              value={bannerColor && /^#[0-9A-Fa-f]{6}$/.test(bannerColor) ? bannerColor : "#146C94"}
              onChange={(e) => setBannerColor(e.target.value)}
              style={{ width: 44, height: 36, border: "1px solid rgba(var(--border-rgb),0.25)", borderRadius: 8, padding: 2, cursor: "pointer", background: "var(--card)" }}
            />
            {["#146C94", "#0d7377", "#b85c38", "#6b4c9a", "#2d6a4f", "#c44536", "#1a1a2e"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBannerColor(c)}
                style={{
                  width: 28, height: 28, borderRadius: 8, background: c, cursor: "pointer",
                  border: bannerColor === c ? "2px solid #fff" : "1px solid rgba(0,0,0,0.2)",
                  boxShadow: bannerColor === c ? `0 0 0 2px ${c}` : "none",
                }}
                aria-label={c}
              />
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{T("Enabled", "مفعّل")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={bannerEnabled}
              onClick={() => setBannerEnabled((v) => !v)}
              style={{
                width: 44, height: 26, borderRadius: 13, border: "none", cursor: "pointer", position: "relative",
                background: bannerEnabled ? "#34c759" : "rgba(var(--border-rgb),0.35)",
                transition: "background 0.2s ease",
              }}
            >
              <span
                style={{
                  position: "absolute", top: 3, width: 20, height: 20, borderRadius: "50%", background: "#fff",
                  insetInlineStart: bannerEnabled ? 18 : 2, transition: "inset-inline-start 0.2s ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </button>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>
                {T("Shine", "اللمعان")} — {bannerShine}%
              </span>
            </div>
            <input
              type="range" min={0} max={100} step={1}
              value={bannerShine}
              onChange={(e) => setBannerShine(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>
                {T("Repeat count", "عدد التكرارات")} — {bannerRepeats}×
              </span>
            </div>
            <NumberStepper
              value={bannerRepeats}
              onChange={setBannerRepeats}
              min={1}
              max={12}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>
                {T("Scroll speed", "سرعة التمرير")}
              </span>
            </div>
            <input
              type="range" min={0.4} max={2} step={0.1}
              value={bannerSpeed}
              onChange={(e) => setBannerSpeed(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>
                {T("Letter spacing", "تباعد الحروف")} — {bannerLetterSpacing}
              </span>
            </div>
            <input
              type="range" min={0} max={30} step={1}
              value={bannerLetterSpacing}
              onChange={(e) => setBannerLetterSpacing(Number(e.target.value))}
              style={{ width: "100%" }}
            />
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)" }}>
              {T("For Arabic this uses tatweel (ـ) instead of letter-spacing.", "للعربي بيستخدم التطويل (ـ) بدل تباعد الحروف.")}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{T("Flash effect", "تأثير الوميض")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={bannerFlash}
              onClick={() => setBannerFlash((v) => !v)}
              style={{
                width: 44, height: 26, borderRadius: 13, border: "none", cursor: "pointer", position: "relative",
                background: bannerFlash ? "#34c759" : "rgba(var(--border-rgb),0.35)",
                transition: "background 0.2s ease",
              }}
            >
              <span
                style={{
                  position: "absolute", top: 3, width: 20, height: 20, borderRadius: "50%", background: "#fff",
                  insetInlineStart: bannerFlash ? 18 : 2, transition: "inset-inline-start 0.2s ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </button>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
              {T("Auto-hide after", "إخفاء تلقائي بعد")}
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <NumberStepper
                value={bannerDurationAmount}
                onChange={setBannerDurationAmount}
                min={0}
                max={bannerDurationUnit === "days" ? 30 : bannerDurationUnit === "hours" ? 720 : 43200}
              />
              <select
                value={bannerDurationUnit}
                onChange={(e) => setBannerDurationUnit(e.target.value)}
                style={{
                  padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(var(--border-rgb),0.25)",
                  background: "var(--input-bg)", color: "var(--ink)", fontSize: 13, fontWeight: 600,
                }}
              >
                <option value="minutes">{T("Minutes", "دقائق")}</option>
                <option value="hours">{T("Hours", "ساعات")}</option>
                <option value="days">{T("Days", "أيام")}</option>
              </select>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)" }}>
              {T("0 = stays until cleared. Max ~30 days.", "0 = يبقى لحد ما يتشال. أقصى ~30 يوم.")}
            </p>
          </div>

          {bannerMsg && (
            <div style={{
              marginBottom: 12, padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: bannerMsg.includes("fail") || bannerMsg.includes("فشل") ? "rgba(179,38,30,0.1)" : "rgba(52,199,89,0.12)",
              color: bannerMsg.includes("fail") || bannerMsg.includes("فشل") ? "var(--danger)" : "#1a7a3a",
            }}>
              {bannerMsg}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={bannerSaving}
              style={{
                flex: 1, minHeight: 44, padding: "10px 14px", borderRadius: 10, cursor: bannerSaving ? "wait" : "pointer",
                fontSize: 14, fontWeight: 700, color: "#fff",
                background: "var(--accent-1)", border: "none",
                opacity: bannerSaving ? 0.7 : 1,
              }}
            >
              {bannerSaving ? T("Saving…", "جارٍ الحفظ…") : T("Save banner", "حفظ البانر")}
            </button>
            <button
              type="button"
              onClick={clearBanner}
              disabled={bannerSaving}
              style={{
                minHeight: 44, padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                fontSize: 13, fontWeight: 700, color: "var(--danger)",
                background: "none", border: "1px solid var(--danger-border, rgba(179,38,30,0.35))",
              }}
            >
              {T("Clear", "إزالة")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
  return (typeof document !== "undefined" ? createPortal(node, document.body) : null);
}