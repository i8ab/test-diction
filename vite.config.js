import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Whisper (transformers.js) is large and ships its own WASM — keep it out of
// optimizeDeps so Vite doesn't pre-bundle it incorrectly.
// Manual chunks keep the main bundle smaller and improve caching.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
  build: {
    target: "es2020",
    // Raise warning limit a bit; the app is feature-rich.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // Keep React core together for better caching.
            if (id.includes("react") || id.includes("react-dom") || id.includes("scheduler")) {
              return "vendor-react";
            }
            // Transformers / Whisper must stay on its own (lazy-loaded).
            if (id.includes("@huggingface") || id.includes("transformers")) {
              return "vendor-transformers";
            }
            // Other third-party libs.
            return "vendor";
          }
          // Group heavy feature modules so they load only when needed.
          if (id.includes("/src/components/modals/")) {
            return "modals";
          }
          if (id.includes("/src/components/timer/") || id.includes("/src/components/calendar/") || id.includes("/src/components/todo/")) {
            return "study-tools";
          }
        },
      },
    },
  },
});
