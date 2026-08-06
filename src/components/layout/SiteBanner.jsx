import { useState, useEffect, useRef } from "react";
import { XIcon } from "../common/Icons";

/* =========================================================================
   SITE-WIDE ANNOUNCEMENT BANNER
   -------------------------------------------------------------------------
   Admins publish via Header menu → Site banner. Appears at the very top
   (above the sticky header). Supports:
     - shine (0–100): shimmer intensity
     - speed (0.4–2): animation speed multiplier
     - durationHours (0 = forever): auto-hide after this many hours from
       updatedAt for everyone
   Enter/exit: soft slide from top.
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

function isExpired(banner) {
  const hours = banner && typeof banner.durationHours === "number" ? banner.durationHours : 0;
  if (!hours || hours <= 0) return false;
  const from = (banner && banner.updatedAt) || 0;
  if (!from) return false;
  return Date.now() > from + hours * 60 * 60 * 1000;
}

export default function SiteBanner({ banner, isAr }) {
  const [dismissedId, setDismissedId] = useState(loadDismissedId);
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef(null);

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

  // Soft enter when banner becomes eligible; soft exit when it stops.
  useEffect(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    if (shouldShow) {
      setLeaving(false);
      // next frame so CSS transition runs from the off-screen state
      const t = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(t);
    }
    if (visible) {
      setLeaving(true);
      setVisible(false);
      leaveTimer.current = setTimeout(() => {
        setLeaving(false);
        leaveTimer.current = null;
      }, 700);
    }
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, [shouldShow]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-hide when durationHours elapses while the tab is open.
  useEffect(() => {
    if (!shouldShow || !banner) return;
    const hours = typeof banner.durationHours === "number" ? banner.durationHours : 0;
    if (!hours || hours <= 0 || !banner.updatedAt) return;
    const endsAt = banner.updatedAt + hours * 60 * 60 * 1000;
    const wait = endsAt - Date.now();
    if (wait <= 0) return;
    const t = setTimeout(() => {
      // Force a re-render by flipping dismissed state path via leaving.
      setVisible(false);
      setLeaving(true);
    }, wait);
    return () => clearTimeout(t);
  }, [shouldShow, banner && banner.id, banner && banner.updatedAt, banner && banner.durationHours]);

  if (!shouldShow && !leaving) return null;

  const bg = (banner && banner.color) || "#146C94";
  const c = contrastFor(bg);
  const shine = typeof (banner && banner.shine) === "number" ? banner.shine : 40;
  const speed = typeof (banner && banner.speed) === "number" ? banner.speed : 1;
  // Base durations (ms) scaled by speed: higher speed = faster motion.
  const enterMs = Math.round(650 / speed);
  const shimmerSec = (4.5 / speed).toFixed(2);
  const shineAlpha = Math.min(0.55, Math.max(0, shine / 100) * 0.55);

  function dismiss() {
    if (banner && banner.id) {
      saveDismissedId(banner.id);
      setDismissedId(banner.id);
    }
    setVisible(false);
    setLeaving(true);
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
        overflow: "hidden",
        // Slide in/out from the top edge
        transform: visible ? "translateY(0)" : "translateY(-110%)",
        opacity: visible ? 1 : 0,
        transition: `transform ${enterMs}ms cubic-bezier(0.22,1,0.36,1), opacity ${enterMs}ms ease`,
        willChange: "transform, opacity",
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
        {/* Soft continuous shimmer — intensity from admin "shine" setting */}
        {shine > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `linear-gradient(105deg, transparent 30%, rgba(255,255,255,${shineAlpha}) 50%, transparent 70%)`,
              backgroundSize: "200% 100%",
              animation: `siteBannerShimmer ${shimmerSec}s ease-in-out infinite`,
              opacity: 0.9,
            }}
          />
        )}
        <span style={{ width: 36, flexShrink: 0, position: "relative" }} aria-hidden="true" />
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
      </div>
      <style>{`
        @keyframes siteBannerShimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .site-banner { transition: none !important; transform: none !important; opacity: 1 !important; }
          .site-banner span[aria-hidden="true"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
