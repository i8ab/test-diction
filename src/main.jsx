import React from "react";
import ReactDOM from "react-dom/client";
import DictionaryApp from "./App.jsx";
import ErrorBoundary from "./components/layout/ErrorBoundary.jsx";
import "./index.css";

// ---------------------------------------------------------------------------
// Soft button ripple — one delegated listener for the whole app.
// Kept subtle on purpose: short fade, no blend modes, skips tiny icon-only
// controls and menu rows that felt jittery with the old system.
// ---------------------------------------------------------------------------
function attachGlobalButtonRipple() {
  const handler = (e) => {
    // Primary pointer only (ignore multi-touch / secondary buttons)
    if (e.button != null && e.button !== 0) return;
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;
    // Skip pure icon/close/menu rows — ripple looks noisy on them
    if (btn.classList.contains("header-menu-item") || btn.classList.contains("tools-menu-item")) return;
    if (btn.classList.contains("header-menu-swatch") || btn.classList.contains("section-tab")) return;

    const rect = btn.getBoundingClientRect();
    // Skip very small hit targets (icon buttons ≤ 40px)
    if (rect.width < 40 || rect.height < 36) return;

    const size = Math.max(rect.width, rect.height) * 1.35;
    const ripple = document.createElement("span");
    ripple.className = "btn-ripple";
    ripple.style.width = ripple.style.height = `${size}px`;
    const cx = e.clientX != null ? e.clientX : rect.left + rect.width / 2;
    const cy = e.clientY != null ? e.clientY : rect.top + rect.height / 2;
    ripple.style.left = `${cx - rect.left - size / 2}px`;
    ripple.style.top = `${cy - rect.top - size / 2}px`;

    const computed = window.getComputedStyle(btn);
    if (computed.position === "static") btn.style.position = "relative";
    if (computed.overflow === "visible") btn.style.overflow = "hidden";

    // One ripple at a time — clear any leftover from a fast double-tap
    btn.querySelectorAll(".btn-ripple").forEach((el) => el.remove());
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
    // Safety cleanup if animationend never fires
    setTimeout(() => ripple.remove(), 500);
  };
  document.addEventListener("pointerdown", handler, { capture: true, passive: true });
}
attachGlobalButtonRipple();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <DictionaryApp />
    </ErrorBoundary>
  </React.StrictMode>
);
