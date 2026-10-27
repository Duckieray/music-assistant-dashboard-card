import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/music-assistant-dashboard-card.ts",
      formats: ["es"],
      fileName: () => "music-assistant-dashboard-card.js"
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
