// Lock body scroll while modals are open (React effect helper + component).

import { useEffect } from "react";

export function useBodyScrollLock(locked = true) {
  useEffect(() => {
    if (!locked) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

/** Drop-in component: <BodyScrollLock /> inside a modal */
export function BodyScrollLock() {
  useBodyScrollLock(true);
  return null;
}
