// Mobile-friendly modal dismiss: Android/browser back + swipe-down to close.
import { useEffect, useRef } from "react";

/**
 * When `open` is true, push a history entry so the system back button closes
 * the modal instead of leaving the site. Call `onClose` on popstate.
 */
export function useHistoryBackClose(open, onClose) {
  const pushed = useRef(false);
  useEffect(() => {
    if (!open || typeof onClose !== "function") return undefined;
    try {
      window.history.pushState({ ttModal: 1 }, "");
      pushed.current = true;
    } catch (_) {
      pushed.current = false;
    }
    function onPop() {
      pushed.current = false;
      onClose();
    }
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (pushed.current) {
        pushed.current = false;
        try { window.history.back(); } catch (_) {}
      }
    };
  }, [open, onClose]);
}

/**
 * Attach swipe-down-to-close on an element (the modal card).
 * Returns handlers: onTouchStart, onTouchMove, onTouchEnd.
 */
export function useSwipeDownClose(onClose, { threshold = 90, enabled = true } = {}) {
  const startY = useRef(0);
  const startX = useRef(0);
  const dragging = useRef(false);
  if (!enabled) {
    return { onTouchStart: undefined, onTouchMove: undefined, onTouchEnd: undefined };
  }
  return {
    onTouchStart(e) {
      const t = e.touches && e.touches[0];
      if (!t) return;
      startY.current = t.clientY;
      startX.current = t.clientX;
      dragging.current = true;
    },
    onTouchMove(e) {
      if (!dragging.current) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const dy = t.clientY - startY.current;
      const dx = Math.abs(t.clientX - startX.current);
      // Only care about mostly-vertical downward swipes
      if (dy > 24 && dy > dx * 1.2) {
        // prevent pull-to-refresh feel a bit
        if (e.cancelable) e.preventDefault();
      }
    },
    onTouchEnd(e) {
      if (!dragging.current) return;
      dragging.current = false;
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      const dy = t.clientY - startY.current;
      const dx = Math.abs(t.clientX - startX.current);
      if (dy >= threshold && dy > dx * 1.2 && typeof onClose === "function") {
        onClose();
      }
    },
  };
}

export function haptic(ms = 10) {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  } catch (_) {}
}
