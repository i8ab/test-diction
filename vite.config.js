import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Whisper يتحمّل كسولًا في chunk منفصل — مش في الحزمة الأولية
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
  build: {
    target: "es2020",
    sourcemap: false,
    cssCodeSplit: true,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom") || id.includes("scheduler")) {
              return "vendor-react";
            }
            if (id.includes("@huggingface") || id.includes("transformers") || id.includes("onnxruntime") || id.includes("protobufjs") || id.includes("flatbuffers")) {
              return "vendor-ml";
            }
            return "vendor-utils";
          }
        },
      },
    },
  },
});
