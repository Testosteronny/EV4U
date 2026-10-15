import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// ASTRO_BASE is set by the GitHub Pages workflow ("/EV4U"); locally and on
// root-hosted deployments it defaults to "/".
export default defineConfig({
  site: "https://testosteronny.github.io",
  base: process.env.ASTRO_BASE ?? "/",
  integrations: [react()],
  // Astro 7 defaults to "jsx", which drops whitespace between inline
  // elements in .astro templates ("a <b>b</b>" → "a<b>b</b>"). The templates
  // were written against the old collapsing behaviour — keep it.
  compressHTML: true,
  vite: {
    // index.css carries `@import "tailwindcss"`, the @theme tokens and the
    // design system.
    plugins: [tailwindcss()],
  },
  devToolbar: { enabled: false },
});
