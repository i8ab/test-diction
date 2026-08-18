import { useState, useEffect, useCallback } from "react";
import { tr } from "../../lib/config/i18n";

/** True when running as installed PWA (standalone / fullscreen / minimal-ui). */
export function useIsPwaStandalone() {
  const [isPwa, setIsPwa] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      if (window.navigator.standalone === true) return true; // iOS Safari
      return window.matchMedia("(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)").matches;
    } catch (_) {
      return false;
    }
  });

  useEffect(() => {
    let mq;
    try {
      mq = window.matchMedia("(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)");
      const apply = () => setIsPwa(!!(window.navigator.standalone || mq.matches));
      apply();
      mq.addEventListener?.("change", apply);
      return () => mq.removeEventListener?.("change", apply);
    } catch (_) {}
  }, []);

  return isPwa;
}

/**
 * Visible only in installed PWA. Triggers a full app update/reload
 * (SW update + cache bust) — the equivalent of browser refresh when
 * there is no address bar.
 */
export default function PwaSyncButton({ isAr = false }) {
  const isPwa = useIsPwaStandalone();
  const [busy, setBusy] = useState(false);

  const onSync = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Prefer the global hard-refresh helper if App registered it
      if (typeof window.__forceAppRefresh === "function") {
        await window.__forceAppRefresh();
        return;
      }
      // Fallback: ask SW to update, then reload
      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.update();
            if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        } catch (_) {}
      }
      const u = new URL(window.location.href);
      u.searchParams.set("_r", String(Date.now()));
      window.location.replace(u.toString());
    } catch (_) {
      try { window.location.reload(); } catch (__) {}
    } finally {
      // reload should unmount; if not, clear busy after a moment
      setTimeout(() => setBusy(false), 4000);
    }
  }, [busy]);

  if (!isPwa) return null;

  return (
    <button
      type="button"
      className="pwa-sync-btn touch-target"
      onClick={onSync}
      disabled={busy}
      title={tr(isAr, "Refresh / sync app", "تحديث / مزامنة التطبيق")}
      aria-label={tr(isAr, "Refresh app", "تحديث التطبيق")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        minWidth: 40,
        minHeight: 40,
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid rgba(var(--border-rgb), 0.18)",
        background: "color-mix(in srgb, var(--paper, #0E1A20) 88%, transparent)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        color: "var(--ink, #e8eef2)",
        fontSize: 12.5,
        fontWeight: 700,
        cursor: busy ? "wait" : "pointer",
        opacity: busy ? 0.7 : 1,
        fontFamily: "var(--font-latin)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{
          animation: busy ? "pwaSyncSpin 0.8s linear infinite" : "none",
        }}
      >
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      <span className="pwa-sync-btn-label">
        {busy
          ? tr(isAr, "Updating…", "بيحدّث…")
          : tr(isAr, "Sync", "مزامنة")}
      </span>
    </button>
  );
}
