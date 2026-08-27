import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DictionaryApp from "./App.jsx";
import ErrorBoundary from "./components/layout/ErrorBoundary.jsx";

/* Design system — tokens → base → components → legacy → final overrides */
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components/entry-cards.css";
import "./styles/components/buttons.css";
import "./index.css";
import "./styles/overrides.css";

// Keep focused inputs visible above the mobile keyboard
(function setupKeyboardInset() {
  if (typeof window === "undefined" || !window.visualViewport) return;
  const vv = window.visualViewport;
  function update() {
    const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty("--kb-inset", inset + "px");
  }
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  update();
  document.addEventListener("focusin", (e) => {
    const t = e.target;
    if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    setTimeout(() => {
      try { t.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) { t.scrollIntoView(true); }
    }, 280);
  });
})();

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <main id="app-main" aria-label="Bacaloria Community">
          <DictionaryApp />
        </main>
      </ErrorBoundary>
    </StrictMode>
  );
}
