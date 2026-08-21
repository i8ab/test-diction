import React from "react";
import { createRoot } from "react-dom/client";
import DictionaryApp from "./App.jsx";
import ErrorBoundary from "./components/layout/ErrorBoundary.jsx";
import "./index.css";

const root = document.getElementById("root");
createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <main id="app-main" aria-label="Bacaloria Community">
        <DictionaryApp />
      </main>
    </ErrorBoundary>
  </React.StrictMode>
);
