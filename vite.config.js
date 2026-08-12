import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Whisper (transformers.js) is large and ships its own WASM — keep it out of
// optimizeDeps so Vite doesn't pre-bundle it incorrectly.
// Do NOT force modals / study-tools into shared manual chunks: those modules are
// already split via React.lazy(). Putting the lazy() wrappers and their targets
// in the same chunk creates circular init (ReferenceError: Cannot access before
// initialization) and a blank white page at runtime.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom") || id.includes("scheduler")) {
              return "vendor-react";
            }
            if (id.includes("@huggingface") || id.includes("transformers")) {
              return "vendor-transformers";
            }
            return "vendor";
          }
        },
      },
    },
  },
});
