import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// تحسينات البناء: إيقاف source maps + تقسيم حزم React
export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom") || id.includes("scheduler")) {
              return "vendor-react";
            }
            return "vendor";
          }
        },
      },
    },
  },
});
