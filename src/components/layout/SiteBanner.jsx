import { useState, useEffect } from "react";
import { XIcon } from "../common/Icons";

/* =========================================================================
   SITE-WIDE ANNOUNCEMENT BANNER
   -------------------------------------------------------------------------
   Admins publish a short message (see Admin panel → Announcement) that
   appears at the top of the app for every signed-in user. Each banner has
   a stable `id`; dismissing stores that id in localStorage so the same
   announcement stays hidden on this device until the admin posts a new one
   (new id). Colour is fully controlled by the admin (hex).
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

/** Pick readable text/close colours for a given background hex. */
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
  // Relative luminance (sRGB)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum > 0.55) {
    return { text: "#1B1B1B", muted: "rgba(0,0,0,0.65)", border: "rgba(0,0,0,0.12)" };
  }
  return { text: "#fff", muted: "rgba(255,255,255,0.85)", border: "rgba(255,255,255,0.25)" };
}

export default function SiteBanner({ banner, isAr }) {
  const [dismissedId, setDismissedId] = useState(loadDismissedId);

  useEffect(() => {
    setDismissedId(loadDismissedId());
  }, [banner && banner.id]);

  if (!banner || !banner.enabled || !banner.message || !banner.message.trim()) return null;
  if (banner.id && dismissedId === banner.id) return null;

  const bg = banner.color || "#146C94";
  const c = contrastFor(bg);

  function dismiss() {
    if (banner.id) {
      saveDismissedId(banner.id);
      setDismissedId(banner.id);
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        background: bg,
        color: c.text,
        borderBottom: `1px solid ${c.border}`,
        padding: "10px 12px",
        paddingLeft: "max(12px, env(safe-area-inset-left))",
        paddingRight: "max(12px, env(safe-area-inset-right))",
        fontFamily: "'Source Sans 3', sans-serif",
        fontSize: 14,
        lineHeight: 1.45,
        direction: isAr ? "rtl" : "ltr",
      }}
    >
      <span style={{ flex: 1, minWidth: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {banner.message}
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label={isAr ? "إغلاق الإعلان" : "Dismiss announcement"}
        title={isAr ? "إغلاق" : "Dismiss"}
        style={{
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
  );
}
