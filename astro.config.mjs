import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

// ASTRO_BASE is set by the GitHub Pages workflow ("/EV4U"); locally and on
// root-hosted deployments it defaults to "/".
export default defineConfig({
  site: "https://testosteronny.github.io",
  base: process.env.ASTRO_BASE ?? "/",
  integrations: [
    react(),
    // index.css carries the @tailwind directives + the design system.
    tailwind({ applyBaseStyles: false }),
  ],
  devToolbar: { enabled: false },
});
