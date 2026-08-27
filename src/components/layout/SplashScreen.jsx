/**
 * Bacaloria Community — professional splash / loading screen.
 * Site name + logo + water-style progress until the main UI is ready.
 * Aligned with the warm brass / paper design system.
 */
import { useEffect, useState, useRef } from "react";
import BrandMark from "../common/BrandMark";
import WaterProgressBar from "../common/WaterProgressBar";

/** Slogan aligned with the official product name */
const SLOGAN_AR = "باكالوريا كوميونيتي — قاموسك الذكي للمذاكرة";
const SLOGAN_EN = "Bacaloria Community — your smart study dictionary";

/**
 * @param {{
 *   onComplete?: () => void;
 *   minMs?: number;
 *   forceProgress?: number | null;
 *   isAr?: boolean;
 *   blocking?: boolean;
 * }} props
 * blocking: true = indeterminate water bar (force-refresh); never freeze at 100%.
 */
export default function SplashScreen({
  onComplete,
  minMs = 1800,
  forceProgress = null,
  isAr = true,
  blocking = false,
}) {
  const [progress, setProgress] = useState(blocking ? null : 0);
  const [done, setDone] = useState(false);
  const startRef = useRef(Date.now());
  const completedRef = useRef(false);

  useEffect(() => {
    if (blocking) {
      setProgress(null);
      return;
    }
    if (forceProgress != null && Number.isFinite(forceProgress)) {
      setProgress(Math.max(0, Math.min(100, forceProgress)));
      return;
    }

    let raf;
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const t = Math.min(1, elapsed / minMs);
      const eased = 1 - Math.pow(1 - t, 2.4);
      // Stay under 100 until we intentionally finish — avoids a stuck 100% bar.
      const p = Math.min(96, Math.round(eased * 96));
      setProgress(p);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [minMs, forceProgress, blocking]);

  useEffect(() => {
    if (blocking) return;
    if (forceProgress != null && forceProgress >= 100 && !completedRef.current) {
      completedRef.current = true;
      setProgress(100);
      setDone(true);
      const t = setTimeout(() => onComplete?.(), 200);
      return () => clearTimeout(t);
    }
  }, [forceProgress, onComplete, blocking]);

  useEffect(() => {
    if (blocking) return;
    if (forceProgress != null) return;
    const timer = setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      setProgress(100);
      setDone(true);
      setTimeout(() => onComplete?.(), 200);
    }, minMs + 150);
    return () => clearTimeout(timer);
  }, [minMs, forceProgress, onComplete, blocking]);

  const label = blocking
    ? isAr
      ? "جاري تحديث التطبيق…"
      : "Updating app…"
    : progress != null && progress >= 100
      ? isAr
        ? "جاهز"
        : "Ready"
      : isAr
        ? "جاري التحميل…"
        : "Loading…";

  return (
    <div
      className="uhd-splash"
      role="status"
      aria-live="polite"
      aria-busy={!done}
      aria-label={isAr ? "جاري تحميل باكالوريا كوميونيتي" : "Loading Bacaloria Community"}
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="uhd-splash-inner">
        <div className="uhd-splash-logo">
          <BrandMark size="md" isAr={isAr} editable={false} showUnderline />
        </div>
        <h1 className="uhd-splash-slogan">{isAr ? SLOGAN_AR : SLOGAN_EN}</h1>
        <p className="uhd-splash-sub">
          {isAr ? "مفردات · مراجعة · ذكاء اصطناعي" : "Vocabulary · Review · AI"}
        </p>

        <div className="uhd-splash-bar">
          <WaterProgressBar
            progress={blocking ? null : progress}
            label={label}
            height={12}
            showPercent={!blocking && progress != null}
          />
        </div>
      </div>

      <style>{`
        .uhd-splash {
          min-height: 100dvh;
          display: grid;
          place-items: center;
          background:
            radial-gradient(ellipse 85% 55% at 50% 12%, color-mix(in srgb, #D97B4F 22%, transparent), transparent),
            radial-gradient(ellipse 55% 45% at 88% 88%, color-mix(in srgb, #D6A94F 14%, transparent), transparent),
            #1B1712;
          color: #EDE4D6;
          font-family: "Source Sans 3", system-ui, "Segoe UI", Tahoma, "Noto Sans Arabic", sans-serif;
          padding: 1.5rem;
          box-sizing: border-box;
        }
        .uhd-splash-inner {
          max-width: 28rem;
          width: 100%;
          text-align: center;
          animation: splashFadeIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .uhd-splash-logo {
          display: flex;
          justify-content: center;
          margin-bottom: 1.35rem;
        }
        .uhd-splash-logo .brand-mark-title {
          color: #F5EDE0 !important;
          -webkit-text-fill-color: #F5EDE0 !important;
        }
        .uhd-splash-slogan {
          margin: 0 0 0.45rem;
          font-family: "Fraunces", "Amiri", Georgia, serif;
          font-size: clamp(1.08rem, 3.8vw, 1.38rem);
          font-weight: 600;
          line-height: 1.55;
          letter-spacing: -0.015em;
          color: #F5EDE0;
        }
        .uhd-splash-sub {
          margin: 0 0 1.65rem;
          font-size: 0.84rem;
          opacity: 0.62;
          letter-spacing: 0.02em;
        }
        .uhd-splash-bar {
          text-align: start;
        }
        @keyframes splashFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
