// قفل تمرير الصفحة (body) أثناء فتح المودالات — يدعم عدة مودالات متزامنة
// ويمنع التمرير على iOS بشكل أفضل.

import { useEffect } from "react";

let lockCount = 0;
let savedOverflow = "";
let savedPaddingRight = "";
let savedPosition = "";
let savedTop = "";
let savedScrollY = 0;

function applyLock() {
  if (typeof document === "undefined") return;
  const body = document.body;
  const html = document.documentElement;

  if (lockCount === 0) {
    savedOverflow = body.style.overflow;
    savedPaddingRight = body.style.paddingRight;
    savedPosition = body.style.position;
    savedTop = body.style.top;
    savedScrollY = window.scrollY || window.pageYOffset || 0;

    // تعويض شريط التمرير حتى لا يتحرك المحتوى
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    body.style.overflow = "hidden";
    // تثبيت الموضع على الموبايل (iOS) لمنع التمرير الخلفي
    body.style.position = "fixed";
    body.style.top = `-${savedScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
  }
  lockCount += 1;
}

function releaseLock() {
  if (typeof document === "undefined") return;
  if (lockCount <= 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    const body = document.body;
    body.style.overflow = savedOverflow;
    body.style.paddingRight = savedPaddingRight;
    body.style.position = savedPosition;
    body.style.top = savedTop;
    body.style.left = "";
    body.style.right = "";
    body.style.width = "";
    window.scrollTo(0, savedScrollY);
  }
}

/**
 * Hook: يقفل تمرير الـ body طالما locked = true
 * @param {boolean} locked
 */
export function useBodyScrollLock(locked = true) {
  useEffect(() => {
    if (!locked) return undefined;
    applyLock();
    return () => releaseLock();
  }, [locked]);
}

/** مكوّن جاهز: ضعه داخل أي مودال <BodyScrollLock /> */
export function BodyScrollLock() {
  useBodyScrollLock(true);
  return null;
}
