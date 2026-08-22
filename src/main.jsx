import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DictionaryApp from "./App.jsx";
import ErrorBoundary from "./components/layout/ErrorBoundary.jsx";
import "./index.css";

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
