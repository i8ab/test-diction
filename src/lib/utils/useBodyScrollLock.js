import { useEffect } from "react";

let lockCount = 0;
let savedScrollY = 0;
let savedPadding = "";
let savedHtmlOverflow = "";
let savedBodyOverflow = "";
let savedBodyPosition = "";
let savedBodyTop = "";
let savedBodyWidth = "";

function applyLock() {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  const body = document.body;
  if (lockCount === 0) {
    savedScrollY = window.scrollY || window.pageYOffset || 0;
    savedPadding = body.style.paddingRight;
    savedHtmlOverflow = html.style.overflow;
    savedBodyOverflow = body.style.overflow;
    savedBodyPosition = body.style.position;
    savedBodyTop = body.style.top;
    savedBodyWidth = body.style.width;

    const sbw = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${savedScrollY}px`;
    body.style.width = "100%";
    if (sbw > 0) body.style.paddingRight = `${sbw}px`;
  }
  lockCount += 1;
}

function releaseLock() {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;
  const html = document.documentElement;
  const body = document.body;
  html.style.overflow = savedHtmlOverflow;
  body.style.overflow = savedBodyOverflow;
  body.style.position = savedBodyPosition;
  body.style.top = savedBodyTop;
  body.style.width = savedBodyWidth;
  body.style.paddingRight = savedPadding;
  window.scrollTo(0, savedScrollY);
}

/**
 * Locks document scroll while `locked` is true (supports nested modals via counter).
 * Backdrop click / Escape still work — only background scrolling is blocked.
 */
export function useBodyScrollLock(locked = true) {
  useEffect(() => {
    if (!locked) return undefined;
    applyLock();
    return () => releaseLock();
  }, [locked]);
}

/** Drop-in component: mount inside any open modal to lock background scroll. */
export function BodyScrollLock({ active = true }) {
  useBodyScrollLock(active);
  return null;
}
