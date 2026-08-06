import { useState, useEffect, useRef } from "react";
import { XIcon } from "../common/Icons";

/* =========================================================================
   SITE-WIDE ANNOUNCEMENT BANNER
   -------------------------------------------------------------------------
   Admins publish via Settings → Site banner.
     - shine (0–100): shimmer intensity
     - speed (0.4–2): enter/exit + shimmer speed
     - durationMinutes (0 = until admin turns off): auto-hide after this
       many minutes from updatedAt — X is hidden when a duration is set
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
  if (!bg || typeof bg !== "string") return { text: "#fff", muted: "rgba(255,255,255,0.85)", border: "rgba(255,255,255,0.25)" };
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
    return { text: "#1B1B1B", muted: "rgba(0,0,0,0.65)", border: "rgba(0,0,0,0.12)" };
  }
  return { text: "#fff", muted: "rgba(255,255,255,0.85)", border: "rgba(255,255,255,0.25)" };
}

/** Minutes the banner should stay live (0 = forever). Accepts legacy durationHours. */
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
  // phase: "in" | "shown" | "out" | "gone"
  const [phase, setPhase] = useState("gone");
  const exitTimer = useRef(null);
  const enterTimer = useRef(null);
  const mounted = useRef(false);

  const hasTimedDuration = durationMinutesOf(banner) > 0;

  const shouldShow =
    banner &&
    banner.enabled &&
    banner.message &&
    banner.message.trim() &&
    !(banner.id && dismissedId === banner.id) &&
    !isExpired(banner);

  useEffect(() => {
    setDismissedId(loadDismissedId());
  }, [banner && banner.id]);

  // Drive enter / exit with real CSS keyframe animations (more reliable than
  // toggling transition on first paint, which often skips the first frame).
  useEffect(() => {
    if (exitTimer.current) {
      clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
    if (enterTimer.current) {
      clearTimeout(enterTimer.current);
      enterTimer.current = null;
    }

    if (shouldShow) {
      // Start off-screen, then next frame play the enter animation
      setPhase("in");
      enterTimer.current = setTimeout(() => setPhase("shown"), 30);
      mounted.current = true;
      return () => {
        if (enterTimer.current) clearTimeout(enterTimer.current);
      };
    }

    // Hide
    if (mounted.current && phase !== "gone") {
      setPhase("out");
      const speed = typeof (banner && banner.speed) === "number" ? banner.speed : 1;
      const ms = Math.round(700 / Math.max(0.4, speed));
      exitTimer.current = setTimeout(() => {
        setPhase("gone");
        exitTimer.current = null;
      }, ms);
    } else {
      setPhase("gone");
    }

    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, [shouldShow]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-hide when the timed duration elapses
  useEffect(() => {
    if (!shouldShow || !banner) return;
    const mins = durationMinutesOf(banner);
    if (!mins || !banner.updatedAt) return;
    const endsAt = banner.updatedAt + mins * 60 * 1000;
    const wait = endsAt - Date.now();
    if (wait <= 0) return;
    const t = setTimeout(() => {
      setPhase("out");
      const speed = typeof banner.speed === "number" ? banner.speed : 1;
      const ms = Math.round(700 / Math.max(0.4, speed));
      setTimeout(() => setPhase("gone"), ms);
    }, wait);
    return () => clearTimeout(t);
  }, [shouldShow, banner && banner.id, banner && banner.updatedAt, banner && banner.durationMinutes, banner && banner.durationHours]);

  if (phase === "gone" && !shouldShow) return null;
  if (phase === "gone" && shouldShow) {
    // Brief frame before enter kicks in
  }

  const bg = (banner && banner.color) || "#146C94";
  const c = contrastFor(bg);
  const shine = typeof (banner && banner.shine) === "number" ? banner.shine : 40;
  const speed = typeof (banner && banner.speed) === "number" ? banner.speed : 1;
  const enterMs = Math.round(720 / Math.max(0.4, speed));
  const shimmerSec = (3.8 / Math.max(0.4, speed)).toFixed(2);
  const shineAlpha = Math.min(0.65, Math.max(0, shine / 100) * 0.65);

  function dismiss() {
    // Only allowed when no timed duration is set
    if (hasTimedDuration) return;
    if (banner && banner.id) {
      saveDismissedId(banner.id);
      setDismissedId(banner.id);
    }
    setPhase("out");
    const ms = Math.round(700 / Math.max(0.4, speed));
    setTimeout(() => setPhase("gone"), ms);
  }

  const animName =
    phase === "in" || phase === "shown"
      ? "siteBannerSlideIn"
      : phase === "out"
        ? "siteBannerSlideOut"
        : "none";

  return (
    <div
      role="status"
      aria-live="polite"
      className="site-banner"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 3000,
        overflow: "hidden",
        animation: animName !== "none" ? `${animName} ${enterMs}ms cubic-bezier(0.22, 1, 0.36, 1) both` : "none",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: bg,
          color: c.text,
          borderBottom: `1px solid ${c.border}`,
          padding: "12px 14px",
          paddingLeft: "max(14px, env(safe-area-inset-left))",
          paddingRight: "max(14px, env(safe-area-inset-right))",
          paddingTop: "max(12px, env(safe-area-inset-top))",
          fontFamily: "'Source Sans 3', sans-serif",
          fontSize: 15,
          fontWeight: 700,
          lineHeight: 1.45,
          direction: isAr ? "rtl" : "ltr",
          boxShadow: "0 2px 12px -4px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        {/* Continuous shimmer */}
        {shine > 0 && (
          <span
            aria-hidden="true"
            className="site-banner-shine"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `linear-gradient(105deg, transparent 25%, rgba(255,255,255,${shineAlpha}) 50%, transparent 75%)`,
              backgroundSize: "220% 100%",
              animation: `siteBannerShimmer ${shimmerSec}s linear infinite`,
            }}
          />
        )}

        {/* Spacer matches close button width so text stays centered when X is shown */}
        {!hasTimedDuration ? (
          <span style={{ width: 36, flexShrink: 0, position: "relative" }} aria-hidden="true" />
        ) : (
          <span style={{ width: 8, flexShrink: 0 }} aria-hidden="true" />
        )}

        <span
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: "center",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontWeight: 700,
            position: "relative",
          }}
        >
          {banner && banner.message}
        </span>

        {!hasTimedDuration ? (
          <button
            type="button"
            onClick={dismiss}
            aria-label={isAr ? "إغلاق الإعلان" : "Dismiss announcement"}
            title={isAr ? "إغلاق" : "Dismiss"}
            style={{
              position: "relative",
              flexShrink: 0,
              border: "none",
              background: "transparent",
              color: c.muted,
              cursor: "pointer",
              minWidth: 36,
              minHeight: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
              margin: "-4px",
            }}
          >
            <XIcon size={18} />
          </button>
        ) : (
          <span style={{ width: 8, flexShrink: 0 }} aria-hidden="true" />
        )}
      </div>

      <style>{`
        @keyframes siteBannerSlideIn {
          0% { transform: translateY(-105%); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes siteBannerSlideOut {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-105%); opacity: 0; }
        }
        @keyframes siteBannerShimmer {
          0% { background-position: 120% 0; }
          100% { background-position: -120% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .site-banner { animation: none !important; transform: none !important; opacity: 1 !important; }
          .site-banner-shine { animation: none !important; opacity: 0.25; }
        }
      `}</style>
    </div>
  );
}
