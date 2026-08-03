import React from "react";
import ReactDOM from "react-dom/client";
import DictionaryApp from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";

// ---------------------------------------------------------------------------
// Global "modern button" ripple system.
// Rather than touching every single <button> in the app individually, we
// attach one delegated listener at the document level. On every pointerdown
// inside *any* button, we spawn a short-lived ripple span positioned at the
// click point. Combined with the button rules in index.css (applied
// globally via the `button` element selector), this gives every button in
// the app — Study, Quiz, Add, filters, menu items, etc. — the same modern,
// tactile, animated feel with zero per-component changes.
// ---------------------------------------------------------------------------
function attachGlobalButtonRipple() {
  const handler = (e) => {
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.6;
    const ripple = document.createElement("span");
    ripple.className = "btn-ripple";
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${(e.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2}px`;
    ripple.style.top = `${(e.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2}px`;

    const computed = window.getComputedStyle(btn);
    if (computed.position === "static") btn.style.position = "relative";
    btn.classList.add("btn-modern-active");
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
    setTimeout(() => btn.classList.remove("btn-modern-active"), 260);
  };
  document.addEventListener("pointerdown", handler, true);
}
attachGlobalButtonRipple();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <DictionaryApp />
    </ErrorBoundary>
  </React.StrictMode>
);
