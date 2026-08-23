/**
 * AI Agent UHD — professional splash / loading screen.
 * Arabic slogan + animated progress bar until the main UI is ready.
 */
import { useEffect, useState, useRef } from "react";

const SLOGAN =
  "ذكاءٌ يستخرج المعنى… ودقةٌ تصنّف كل كلمة";

const SUB =
  "AI Agent UHD — استخراج ذكي للمفردات بأعلى دقة";

/**
 * @param {{ onComplete?: () => void; minMs?: number; forceProgress?: number | null }} props
 * forceProgress: if number 0–100, drive the bar externally; otherwise auto-animate.
 */
export default function SplashScreen({ onComplete, minMs = 1800, forceProgress = null }) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const startRef = useRef(Date.now());
  const completedRef = useRef(false);

  useEffect(() => {
    if (forceProgress != null && Number.isFinite(forceProgress)) {
      setProgress(Math.max(0, Math.min(100, forceProgress)));
      return;
    }

    let raf;
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      // Ease-out curve that reaches ~92% by minMs, then waits for complete
      const t = Math.min(1, elapsed / minMs);
      const eased = 1 - Math.pow(1 - t, 2.4);
      const p = Math.min(92, Math.round(eased * 92));
      setProgress(p);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [minMs, forceProgress]);

  useEffect(() => {
    if (forceProgress != null && forceProgress >= 100 && !completedRef.current) {
      completedRef.current = true;
      setProgress(100);
      setDone(true);
      const t = setTimeout(() => onComplete?.(), 320);
      return () => clearTimeout(t);
    }
  }, [forceProgress, onComplete]);

  // When auto mode: after minMs, finish to 100 and call onComplete
  useEffect(() => {
    if (forceProgress != null) return;
    const timer = setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      setProgress(100);
      setDone(true);
      setTimeout(() => onComplete?.(), 320);
    }, minMs + 200);
    return () => clearTimeout(timer);
  }, [minMs, forceProgress, onComplete]);

  return (
    <div
      className="uhd-splash"
      role="status"
      aria-live="polite"
      aria-busy={!done}
      aria-label="جاري تحميل التطبيق"
      dir="rtl"
    >
      <div className="uhd-splash-inner">
        <div className="uhd-splash-badge" aria-hidden="true">
          UHD
        </div>
        <h1 className="uhd-splash-slogan">{SLOGAN}</h1>
        <p className="uhd-splash-sub">{SUB}</p>

        <div className="uhd-splash-bar-wrap" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="uhd-splash-bar-track">
            <div
              className="uhd-splash-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="uhd-splash-pct">{progress}%</span>
        </div>

        <p className="uhd-splash-hint">
          {progress < 100 ? "جاري تجهيز الواجهة…" : "جاهز"}
        </p>
      </div>

      <style>{`
        .uhd-splash {
          min-height: 100dvh;
          display: grid;
          place-items: center;
          background:
            radial-gradient(ellipse 80% 60% at 50% 20%, rgba(99, 102, 241, 0.18), transparent),
            radial-gradient(ellipse 60% 50% at 80% 80%, rgba(16, 185, 129, 0.1), transparent),
            #0b0f1a;
          color: #f1f5f9;
          font-family: system-ui, "Segoe UI", Tahoma, "Noto Sans Arabic", sans-serif;
          padding: 1.5rem;
          box-sizing: border-box;
        }
        .uhd-splash-inner {
          max-width: 28rem;
          width: 100%;
          text-align: center;
        }
        .uhd-splash-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 3.25rem;
          height: 3.25rem;
          border-radius: 1rem;
          background: linear-gradient(135deg, #6366f1, #22d3ee);
          font-weight: 800;
          font-size: 0.95rem;
          letter-spacing: 0.06em;
          margin-bottom: 1.35rem;
          box-shadow: 0 8px 32px rgba(99, 102, 241, 0.35);
        }
        .uhd-splash-slogan {
          margin: 0 0 0.65rem;
          font-size: clamp(1.15rem, 4.2vw, 1.45rem);
          font-weight: 700;
          line-height: 1.55;
          letter-spacing: 0.01em;
        }
        .uhd-splash-sub {
          margin: 0 0 1.75rem;
          font-size: 0.8rem;
          opacity: 0.65;
          direction: ltr;
        }
        .uhd-splash-bar-wrap {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .uhd-splash-bar-track {
          flex: 1;
          height: 0.45rem;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.2);
          overflow: hidden;
        }
        .uhd-splash-bar-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #6366f1, #22d3ee);
          transition: width 0.18s ease-out;
        }
        .uhd-splash-pct {
          font-size: 0.8rem;
          font-variant-numeric: tabular-nums;
          min-width: 2.5rem;
          text-align: left;
          opacity: 0.85;
          direction: ltr;
        }
        .uhd-splash-hint {
          margin: 0.9rem 0 0;
          font-size: 0.78rem;
          opacity: 0.55;
        }
      `}</style>
    </div>
  );
}
