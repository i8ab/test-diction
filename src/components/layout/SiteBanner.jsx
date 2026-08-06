import { useState, useEffect, useRef } from "react";
import { XIcon } from "../common/Icons";

function stretchArabicText(text, amount) {
  if (!text || !amount) return text;
  const isArabicLetter = (ch) => /[\u0600-\u06FF]/.test(ch);
  const isNonConnecting = (ch) => /[ادذرزوآأإؤةء]/.test(ch);
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    result += ch;
    if (i < text.length - 1) {
      const nextCh = text[i + 1];
      if (isArabicLetter(ch) && !isNonConnecting(ch) && isArabicLetter(nextCh) && nextCh !== " " && nextCh !== "ـ") {
        result += "ـ".repeat(amount);
      }
    }
  }
  return result;
}

const hasArabic = (text) => /[\u0600-\u06FF]/.test(text || "");

/* Keep trailing . ? ! at the logical END of RTL text. */
function fixBidiPunctuation(text, rtl) {
  if (!text) return text;
  if (rtl) {
    return text.replace(/([.!?…]+)\s*$/u, "$1\u200F");
  }
  return text.replace(/([.!?…]+)\s*$/u, "$1\u200E");
}

/** Build continuous news-ticker content: message repeated `times`.
 *  Separator is plain wide spaces only (no stars/bullets). */
function buildTickerMessage(raw, letterSpacing, rtl, times) {
  const base = fixBidiPunctuation(
    stretchArabicText((raw || "").trim(), letterSpacing),
    rtl
  );
  if (!base) return "";
  const n = Math.max(1, Math.min(12, Math.round(Number(times) || 1)));
  if (n === 1) return base;
  const sep = "        "; // 8 nbsp gaps
  return Array(n).fill(base).join(sep);
}

const DISMISS_KEY = "twoTongues.siteBannerDismissedId";

function loadDismissedId() {
  try {
    return localStorage.getItem(DISMISS_KEY) || "";
  } catch (e) {
    return "";
  }
}

function saveDismissedId(id) {
  try {
    if (id) localStorage.setItem(DISMISS_KEY, id);
    else localStorage.removeItem(DISMISS_KEY);
  } catch (e) {}
}

function contrastFor(bg) {
  if (!bg || typeof bg !== "string") {
    return { text: "#1B1B1B", muted: "rgba(0,0,0,0.55)", border: "rgba(0,0,0,0.12)" };
  }
  const hex = bg.replace("#", "").trim();
  let r = 0, g = 0, b = 0;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  }
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum > 0.55) {
    return { text: "#1B1B1B", muted: "rgba(0,0,0,0.55)", border: "rgba(0,0,0,0.12)" };
  }
  return { text: "#fff", muted: "rgba(255,255,255,0.8)", border: "rgba(255,255,255,0.22)" };
}

function durationMinutesOf(banner) {
  if (!banner) return 0;
  if (typeof banner.durationMinutes === "number" && banner.durationMinutes > 0) {
    return banner.durationMinutes;
  }
  if (typeof banner.durationHours === "number" && banner.durationHours > 0) {
    return Math.round(banner.durationHours * 60);
  }
  return 0;
}

function isExpired(banner) {
  const mins = durationMinutesOf(banner);
  if (!mins) return false;
  const from = (banner && banner.updatedAt) || 0;
  if (!from) return false;
  return Date.now() > from + mins * 60 * 1000;
}

export default function SiteBanner({ banner, isAr }) {
  const [dismissedId, setDismissedId] = useState(loadDismissedId);
  const [live, setLive] = useState(true);
  const trackRef = useRef(null);
  const tickRef = useRef(null);
  const rafRef = useRef(0);
  const progressRef = useRef(0);
  const hideTimer = useRef(null);

  const hasTimedDuration = durationMinutesOf(banner) > 0;

  const shouldShow =
    live &&
    banner &&
    banner.enabled &&
    banner.message &&
    banner.message.trim() &&
    !(banner.id && dismissedId === banner.id) &&
    !isExpired(banner);

  const msgRtl = banner && banner.message
    ? hasArabic(banner.message) || !!isAr
    : !!isAr;

  useEffect(() => {
    // New banner id → always show it (ignore dismiss of the previous one).
    const stored = loadDismissedId();
    if (banner && banner.id && stored && stored === banner.id) {
      setDismissedId(stored);
    } else {
      setDismissedId("");
    }
    setLive(true);
  }, [banner && banner.id]);

  useEffect(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (!shouldShow || !banner) return;
    const mins = durationMinutesOf(banner);
    if (!mins || !banner.updatedAt) return;
    const endsAt = banner.updatedAt + mins * 60 * 1000;
    const wait = endsAt - Date.now();
    if (wait <= 0) {
      setLive(false);
      return;
    }
    hideTimer.current = setTimeout(() => setLive(false), wait);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [shouldShow, banner && banner.id, banner && banner.updatedAt, banner && banner.durationMinutes, banner && banner.durationHours]);

  useEffect(() => {
    if (!shouldShow) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const speed = typeof (banner && banner.speed) === "number" ? banner.speed : 1;
    const repeats = Math.max(1, Math.min(12, Math.round(Number(banner && banner.repeats) || 4)));
    const baseMs = 16000 + (repeats - 1) * 2000;
    const durationMs = Math.max(6000, Math.min(70000, baseMs / Math.max(0.4, speed)));
    // Scroll direction: Arabic ticker moves right→left (text enters from the right),
    // English left→right (enters from the left) — standard news-ticker behaviour.
    const rtl = msgRtl;
    progressRef.current = 0;
    let last = performance.now();

    function tick(now) {
      const el = tickRef.current;
      const track = trackRef.current;
      if (!el || !track) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const dt = Math.min(64, now - last);
      last = now;

      const delta = dt / durationMs;
      progressRef.current += delta;
      if (progressRef.current > 1) progressRef.current -= 1;

      const trackW = track.offsetWidth || window.innerWidth;
      const textW = el.offsetWidth || 200;
      // progress 0 → just left of view, progress 1 → just right of view
      let x = -textW + progressRef.current * (trackW + textW);
      // RTL: mirror so text travels the opposite physical direction
      if (rtl) x = trackW - progressRef.current * (trackW + textW);
      el.style.transform = `translate3d(${x}px, -50%, 0)`;

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [shouldShow, msgRtl, banner && banner.speed, banner && banner.id, banner && banner.message, banner && banner.letterSpacing, banner && banner.repeats]);

  if (!shouldShow) return null;

  const bg = (banner && banner.color) || "#146C94";
  const c = contrastFor(bg);
  const shine = typeof (banner && banner.shine) === "number" ? banner.shine : 40;
  const flashOn = !!(banner && banner.flash);
  const letterSpacing = typeof (banner && banner.letterSpacing) === "number" ? banner.letterSpacing : 0;
  const repeats = Math.max(1, Math.min(12, Math.round(Number(banner && banner.repeats) || 4)));
  const tickerText = buildTickerMessage(banner.message, letterSpacing, msgRtl, repeats);

  function dismiss() {
    if (hasTimedDuration) return;
    if (banner && banner.id) {
      saveDismissedId(banner.id);
      setDismissedId(banner.id);
    }
    setLive(false);
  }

  return (
    <div
      ref={trackRef}
      role="status"
      aria-live="polite"
      className={`site-banner${flashOn ? " site-banner--flash" : ""}`}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 3000,
        height: 40,
        overflow: "hidden",
        background: bg,
        borderBottom: `1px solid ${c.border}`,
        direction: "ltr",
        boxShadow: shine > 0
          ? `inset 0 0 ${8 + shine * 0.18}px rgba(255,255,255,${(shine / 100) * 0.22})`
          : undefined,
      }}
    >
      {shine > 0 && (
        <span
          aria-hidden="true"
          className="site-banner-shine"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 1,
            background: `linear-gradient(105deg, transparent 28%, rgba(255,255,255,${Math.min(0.65, (shine / 100) * 0.6)}) 50%, transparent 72%)`,
            backgroundSize: "220% 100%",
            animation: `siteBannerShimmer ${(5 / Math.max(0.4, (banner && banner.speed) || 1)).toFixed(2)}s ease-in-out infinite`,
          }}
        />
      )}

      {flashOn && (
        <>
          <span aria-hidden="true" className="site-banner-strobe site-banner-strobe--left" />
          <span aria-hidden="true" className="site-banner-strobe site-banner-strobe--right" />
          <span aria-hidden="true" className="site-banner-flash-pulse" />
        </>
      )}

      <div
        ref={tickRef}
        className="site-banner-ticker"
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          transform: "translate3d(-200px, -50%, 0)",
          willChange: "transform",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          color: c.text,
          fontFamily: msgRtl ? "'Amiri', 'Source Sans 3', serif" : "'Source Sans 3', sans-serif",
          fontSize: 14.5,
          fontWeight: 700,
          lineHeight: 1.35,
          paddingInline: 12,
          direction: msgRtl ? "rtl" : "ltr",
          unicodeBidi: "isolate",
          textAlign: msgRtl ? "right" : "left",
          letterSpacing: letterSpacing && !hasArabic(banner.message) ? `${letterSpacing}px` : undefined,
          zIndex: 2,
          textShadow: shine > 30
            ? `0 0 ${Math.round(shine / 12)}px rgba(255,255,255,${(shine / 100) * 0.45})`
            : undefined,
        }}
      >
        {tickerText}
      </div>

      {!hasTimedDuration && (
        <button
          type="button"
          onClick={dismiss}
          aria-label={isAr ? "إغلاق الإعلان" : "Dismiss announcement"}
          title={isAr ? "إغلاق" : "Dismiss"}
          style={{
            position: "absolute",
            top: "50%",
            insetInlineEnd: 6,
            transform: "translateY(-50%)",
            zIndex: 3,
            border: "none",
            background: "rgba(0,0,0,0.18)",
            color: c.muted,
            cursor: "pointer",
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 6,
            pointerEvents: "auto",
          }}
        >
          <XIcon size={14} />
        </button>
      )}
    </div>
  );
}
