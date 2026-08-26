import { useEffect, useRef } from "react";

/**
 * Keeps focused inputs visible above the on-screen keyboard (phone/tablet).
 * Uses visualViewport when available; falls back to scrollIntoView.
 * Attach to any modal/panel that contains text fields.
 */
export function useKeyboardAware(containerRef) {
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;

    function onResize() {
      const el = containerRef?.current;
      if (!el) return;
      // Shrink scrollable area to visible viewport height
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      el.style.setProperty("--kb-inset", `${offset}px`);
      el.style.paddingBottom = offset > 0 ? `calc(16px + ${offset}px)` : "";
    }

    function onFocusIn(e) {
      const t = e.target;
      if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      // Delay so keyboard animation settles
      setTimeout(() => {
        try {
          t.scrollIntoView({ block: "center", behavior: "smooth" });
        } catch (_) {
          t.scrollIntoView(true);
        }
      }, 280);
    }

    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    document.addEventListener("focusin", onFocusIn);
    onResize();

    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [containerRef]);
}

/** Class helper: add to modal body that scrolls */
export const keyboardAwareBodyStyle = {
  paddingBottom: "calc(16px + var(--kb-inset, 0px))",
  transition: "padding-bottom 0.2s ease",
};
