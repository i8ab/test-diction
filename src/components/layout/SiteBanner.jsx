import { useState, useEffect, useRef } from "react";
import { XIcon } from "../common/Icons";

/* =========================================================================
   SITE BANNER — paper streamer pulled by a plane
   -------------------------------------------------------------------------
   Continuous flight: exits one side of the screen and re-enters from the
   other. Direction follows UI language (LTR → flies left→right, RTL →
   right→left). Speed comes from admin `speed` setting.
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

/** Simple plane silhouette — flipped for RTL. */
function PlaneIcon({ color, flip }) {
  return (
    <svg
      width="44"
      height="28"
      viewBox="0 0 44 28"
      fill="none"
      aria-hidden="true"
      style={{
        display: "block",
        transform: flip ? "scaleX(-1)" : "none",
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.25))",
      }}
    >
      {/* fuselage */}
      <path
        d="M2 15.5 L28 13.2 L40 11.8 C41.5 11.5 42.5 12.2 42.2 13.5 C41.9 14.8 40.5 15.5 38.8 15.6 L28 16.2 L18 24.5 C17.4 25 16.6 24.7 16.5 24 L17.2 17.2 L8 18.5 C7.2 18.6 6.6 18.1 6.6 17.4 L6.8 16.2 L2 16.6 C1.3 16.7 1 16.2 1.2 15.7 Z"
        fill={color}
      />
      {/* wing */}
      <path
        d="M14 14.5 L26 7.5 C26.8 7 27.6 7.3 27.5 8.2 L26.2 14.8 L14.5 15.3 Z"
        fill={color}
        opacity="0.92"
      />
      {/* tail */}
      <path
        d="M4 12.5 L8 9.2 C8.5 8.8 9.1 9.1 9 9.8 L8.2 14.5 L4.5 14.8 Z"
        fill={color}
        opacity="0.88"
      />
      {/* window dots */}
      <circle cx="31" cy="13.8" r="1.1" fill="rgba(255,255,255,0.55)" />
      <circle cx="34.5" cy="13.4" r="1.1" fill="rgba(255,255,255,0.45)" />
    </svg>
  );
}

export default function SiteBanner({ banner, isAr }) {
  const [dismissedId, setDismissedId] = useState(loadDismissedId);
  const [live, setLive] = useState(true);
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

  if (!shouldShow) return null;

  const bg = (banner && banner.color) || "#146C94";
  const c = contrastFor(bg);
  const shine = typeof (banner && banner.shine) === "number" ? banner.shine : 40;
  const speed = typeof (banner && banner.speed) === "number" ? banner.speed : 1;
  // One full pass across the viewport. Higher speed = faster (shorter duration).
  // Base 18s at speed 1; clamp to a comfortable range.
  const durationSec = Math.max(6, Math.min(40, 18 / Math.max(0.4, speed)));
  const rtl = !!isAr;
  const planeColor = c.text === "#fff" ? "rgba(255,255,255,0.95)" : "rgba(30,30,30,0.9)";

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
      role="status"
      aria-live="polite"
      className="site-banner"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 3000,
        height: 52,
        overflow: "hidden",
        // Sky strip behind the flight path
        background: `linear-gradient(180deg, ${bg}dd 0%, ${bg} 55%, ${bg}ee 100%)`,
        borderBottom: `1px solid ${c.border}`,
        boxShadow: "0 2px 12px -4px rgba(0,0,0,0.22)",
        direction: "ltr", // animation axes are physical L/R; plane flip handles RTL
      }}
    >
      {/* Soft wind streaks in the sky */}
      <div
        aria-hidden="true"
        className="site-banner-wind"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: Math.min(0.55, 0.15 + (shine / 100) * 0.4),
          background:
            "repeating-linear-gradient(90deg, transparent 0 28px, rgba(255,255,255,0.07) 28px 30px, transparent 30px 62px)",
          animation: `siteBannerWind ${Math.max(3, 8 / Math.max(0.4, speed))}s linear infinite`,
          animationDirection: rtl ? "reverse" : "normal",
        }}
      />

      {/* Flying group: plane + paper streamer */}
      <div
        className="site-banner-flight"
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          display: "flex",
          alignItems: "center",
          gap: 0,
          // Start fully off one side; keyframes carry it across and off the other
          transform: "translateY(-50%)",
          animation: `${rtl ? "siteBannerFlyRtl" : "siteBannerFlyLtr"} ${durationSec}s linear infinite`,
          willChange: "transform",
          whiteSpace: "nowrap",
        }}
      >
        {/* Plane leads in LTR; in RTL we still put plane first then flip the whole row via flex-direction */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexDirection: rtl ? "row-reverse" : "row",
          }}
        >
          <div style={{ flexShrink: 0, marginInline: 4 }}>
            <PlaneIcon color={planeColor} flip={rtl} />
          </div>

          {/* Tow string */}
          <span
            aria-hidden="true"
            style={{
              width: 18,
              height: 2,
              background: c.text === "#fff" ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.3)",
              flexShrink: 0,
              borderRadius: 1,
            }}
          />

          {/* Paper banner */}
          <div
            className="site-banner-paper"
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              maxWidth: "min(72vw, 520px)",
              padding: "8px 18px",
              marginInlineStart: 2,
              // Paper look
              background: `
                linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 40%),
                linear-gradient(135deg, ${bg} 0%, ${bg}ee 50%, ${bg} 100%)
              `,
              color: c.text,
              border: `1px solid ${c.border}`,
              borderRadius: 4,
              boxShadow:
                "2px 3px 0 rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.15) inset, 0 -1px 0 rgba(0,0,0,0.08) inset",
              fontFamily: "'Source Sans 3', sans-serif",
              fontSize: 14.5,
              fontWeight: 700,
              lineHeight: 1.35,
              // Wind flutter
              animation: `siteBannerFlutter ${Math.max(0.9, 2.2 / Math.max(0.4, speed))}s ease-in-out infinite`,
              transformOrigin: rtl ? "100% 50%" : "0% 50%",
            }}
          >
            {/* Paper edge notches */}
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                insetBlock: 4,
                insetInlineStart: -5,
                width: 10,
                background: `radial-gradient(circle at 0 50%, transparent 5px, ${bg} 5.5px)`,
                backgroundSize: "10px 12px",
                backgroundRepeat: "repeat-y",
                opacity: 0.9,
              }}
            />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                direction: isAr ? "rtl" : "ltr",
                textAlign: "center",
                minWidth: 80,
              }}
            >
              {banner.message}
            </span>
          </div>
        </div>
      </div>

      {/* Dismiss — only when no timed duration */}
      {!hasTimedDuration && (
        <button
          type="button"
          onClick={dismiss}
          aria-label={isAr ? "إغلاق الإعلان" : "Dismiss announcement"}
          title={isAr ? "إغلاق" : "Dismiss"}
          style={{
            position: "absolute",
            top: "50%",
            insetInlineEnd: 8,
            transform: "translateY(-50%)",
            zIndex: 2,
            border: "none",
            background: "rgba(0,0,0,0.15)",
            color: c.muted,
            cursor: "pointer",
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
          }}
        >
          <XIcon size={16} />
        </button>
      )}

      <style>{`
        @keyframes siteBannerFlyLtr {
          0%   { transform: translateY(-50%) translateX(-105%); }
          100% { transform: translateY(-50%) translateX(105vw); }
        }
        @keyframes siteBannerFlyRtl {
          0%   { transform: translateY(-50%) translateX(105vw); }
          100% { transform: translateY(-50%) translateX(-105%); }
        }
        @keyframes siteBannerFlutter {
          0%, 100% { transform: rotate(-1.2deg) skewX(-1deg); }
          50%      { transform: rotate(1.4deg) skewX(1.2deg); }
        }
        @keyframes siteBannerWind {
          0%   { background-position: 0 0; }
          100% { background-position: 60px 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .site-banner-flight {
            animation: none !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
          }
          .site-banner-paper,
          .site-banner-wind {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
