import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite build tuned for Bacaloria Community PWA.
 * Goals: small initial JS, stable hashed assets, clean code-splitting so
 * heavy features (auth, study tools, transformers) never block first paint.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    minify: "esbuild",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Stable, readable chunk names help caching and debugging.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Keep React in its own long-lived chunk (rarely changes).
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("\\react\\")) {
            return "vendor-react";
          }
          // Transformers / ONNX are multi-MB — isolate so the main app never pays the cost.
          if (
            id.includes("@huggingface") ||
            id.includes("onnxruntime") ||
            id.includes("transformers")
          ) {
            return "vendor-ml";
          }
          // Everything else from node_modules.
          return "vendor";
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
  },
  // Ensure public/sw.js is copied as-is (not hashed) so registration stays /sw.js
  publicDir: "public",
});
