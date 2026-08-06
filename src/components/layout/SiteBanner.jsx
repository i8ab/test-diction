import { useState, useEffect, useRef } from "react";
import { XIcon } from "../common/Icons";

/* =========================================================================
   SITE BANNER — simple news-ticker strip
   -------------------------------------------------------------------------
   Plain scrolling text (like a TV news ticker). No plane, no flutter, no
   wind streaks. Direction follows UI language (RTL ↔ LTR). Speed comes
   from the admin `speed` setting.
   ========================================================================= */
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

  useEffect(() => {
    setDismissedId(loadDismissedId());
    setLive(true);
  }, [banner && banner.id]);

  // Auto-hide after timed duration
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

  // Continuous ticker via rAF
  useEffect(() => {
    if (!shouldShow) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const speed = typeof (banner && banner.speed) === "number" ? banner.speed : 1;
    // Full crossing duration in ms (speed 1 ≈ 16s)
    const durationMs = Math.max(6000, Math.min(50000, 16000 / Math.max(0.4, speed)));
    const rtl = !!isAr;
    progressRef.current = rtl ? 1 : 0;
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
      if (rtl) {
        progressRef.current -= delta;
        if (progressRef.current < 0) progressRef.current += 1;
      } else {
        progressRef.current += delta;
        if (progressRef.current > 1) progressRef.current -= 1;
      }

      const trackW = track.offsetWidth || window.innerWidth;
      const textW = el.offsetWidth || 200;
      // Enter from -textW, exit at trackW
      const x = -textW + progressRef.current * (trackW + textW);
      el.style.transform = `translate3d(${x}px, -50%, 0)`;

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [shouldShow, isAr, banner && banner.speed, banner && banner.id]);

  if (!shouldShow) return null;

  const bg = (banner && banner.color) || "#146C94";
  const c = contrastFor(bg);

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
      className="site-banner"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 3000,
        height: 40,
        overflow: "hidden",
        background: bg,
        borderBottom: `1px solid ${c.border}`,
        direction: "ltr",
      }}
    >
      {/* Scrolling text — position updated every frame by rAF */}
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
          fontFamily: "'Source Sans 3', sans-serif",
          fontSize: 14.5,
          fontWeight: 700,
          lineHeight: 1.35,
          paddingInline: 12,
          direction: isAr ? "rtl" : "ltr",
        }}
      >
        {banner.message}
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
            zIndex: 2,
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
