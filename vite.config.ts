import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config — minimal, fast, production-ready.
// VITE_BASE is set by the GitHub Pages workflow ("/EV4U/"); locally and on
// hosts with root deployment it defaults to "/".
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
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
