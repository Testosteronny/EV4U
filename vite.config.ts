import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config — minimal, fast, production-ready.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: "es2020",
    cssMinify: true,
    sourcemap: false,
  },
});
