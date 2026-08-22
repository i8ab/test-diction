import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Whisper / ML is loaded lazily in a separate chunk — never in the critical path.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
  build: {
    target: "es2020",
    sourcemap: false,
    cssCodeSplit: true,
    cssMinify: true,
    minify: "esbuild",
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 600,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // Stable, cache-friendly hashed asset names (Vite default) + explicit vendor splits.
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes("react") ||
              id.includes("react-dom") ||
              id.includes("scheduler")
            ) {
              return "vendor-react";
            }
            if (
              id.includes("@huggingface") ||
              id.includes("transformers") ||
              id.includes("onnxruntime") ||
              id.includes("protobufjs") ||
              id.includes("flatbuffers")
            ) {
              return "vendor-ml";
            }
            return "vendor-utils";
          }
        },
      },
    },
  },
  esbuild: {
    // Drop pure debug noise from production bundles without changing behavior.
    legalComments: "none",
  },
});
