import { useEffect } from "react";
import {
  isRefreshInFlight,
  beginRefreshLock,
  endRefreshLock,
} from "../app/refreshLock";

/**
 * PWA display-mode attribute, force-refresh helper, and service worker registration.
 * Extracted from App.jsx (Phase A lifecycle).
 */
export function useAppShellLifecycle() {
  // Mark installed-PWA on <html> for CSS
  useEffect(() => {
    const apply = () => {
      try {
        const pwa = !!(
          window.navigator.standalone ||
          window.matchMedia("(display-mode: standalone)").matches
        );
        document.documentElement.setAttribute(
          "data-pwa-standalone",
          pwa ? "1" : "0"
        );
      } catch (_) {}
    };
    apply();
    let mq;
    try {
      mq = window.matchMedia(
        "(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)"
      );
      mq.addEventListener?.("change", apply);
      return () => mq.removeEventListener?.("change", apply);
    } catch (_) {}
  }, []);

  // window.__forceAppRefresh
  useEffect(() => {
    window.__forceAppRefresh = async () => {
      if (isRefreshInFlight()) return;
      beginRefreshLock();
      try {
        window.dispatchEvent(new CustomEvent("tt-force-refresh-start"));
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 80));
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
      } catch (_) {}
      try {
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (_) {}
      try {
        const u = new URL(window.location.href);
        u.searchParams.set("_r", String(Date.now()));
        window.location.replace(u.toString());
      } catch (_) {
        try {
          window.location.reload();
        } catch (__) {
          endRefreshLock();
          try {
            window.dispatchEvent(new CustomEvent("tt-force-refresh-end"));
          } catch (___) {}
        }
      }
    };
    return () => {
      try {
        delete window.__forceAppRefresh;
      } catch (_) {}
    };
  }, []);

  // Service worker register + single reload on controllerchange.
  //
  // PERF FIX (deep): on a *first-ever* visit there is no pre-existing
  // controller, so the browser activates the newly installed worker
  // immediately (no waiting phase needed). That activation still fires
  // `controllerchange`, which this code used to treat as "an update just
  // landed" and reacted to with a full `location.reload()`. The result:
  // every brand-new visitor loaded the entire app twice back-to-back
  // (two full navigations, JS parsed/executed twice, fonts/CSS re-applied
  // twice) — this alone was responsible for most of the Total Blocking
  // Time / Time-to-Interactive cost in the Lighthouse trace.
  //
  // Fix: only treat `controllerchange` as "a genuine update happened" when
  // this tab already had an active controller *before* registering (i.e.
  // the user was already using a previously-installed SW and a newer one
  // just took over). First-ever installs are left alone — the page just
  // loaded from the network a moment ago, so there is nothing stale to
  // recover from and no reload is needed.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    const hadControllerBeforeRegister = !!navigator.serviceWorker.controller;
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        if (cancelled) return;
        try {
          reg.update();
        } catch (_) {}
        const kick = () => {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        };
        if (reg.waiting) kick();
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              kick();
            }
          });
        });
      })
      .catch(() => {});
    const onControllerChange = () => {
      // Not a real update — this is the initial activation on a page that
      // had no SW controlling it yet. Nothing to refresh.
      if (!hadControllerBeforeRegister) return;
      if (isRefreshInFlight()) return;
      beginRefreshLock();
      try {
        window.location.reload();
      } catch (_) {
        endRefreshLock();
      }
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange
    );
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);
}
