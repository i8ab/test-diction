import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Whisper (transformers.js) is large and ships its own WASM — keep it out of
// optimizeDeps so Vite doesn't pre-bundle it incorrectly.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
  build: {
    target: "es2020",
  },
});
