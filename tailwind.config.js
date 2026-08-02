/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./src/**/*.{astro,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      /* ======================================================================
         EV4U — Design tokens «Klartext»
         Ein Akzent (Markengrün) für Button · aktiv · Fokus · Link · Ersparnis.
         Ein Warnton (caution). Sonst nur Neutrale. Werte in src/index.css.
         ====================================================================== */
      colors: {
        canvas: "rgb(var(--c-canvas) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        surface2: "rgb(var(--c-surface2) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        line2: "rgb(var(--c-line2) / <alpha-value>)",
        fg: "rgb(var(--c-fg) / <alpha-value>)",
        fg2: "rgb(var(--c-fg2) / <alpha-value>)",
        fg3: "rgb(var(--c-fg3) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--c-accent) / <alpha-value>)",
          hover: "rgb(var(--c-accent-hover) / <alpha-value>)",
        },
        "on-accent": "rgb(var(--c-on-accent) / <alpha-value>)",
        caution: "rgb(var(--c-caution) / <alpha-value>)",
      },
      /* Eine Familie für alles. Zahlen richten sich über die Utility
         `.tabular` aus (font-variant-numeric) — Archivo bringt echte
         Tabellenziffern mit, ein zweites Schriftgesicht braucht es dafür
         nicht. */
      fontFamily: {
        sans: ['"Archivo"', "system-ui", "sans-serif"],
      },
      /* Die Skala aus dem Konzept. Kleinste Grösse 11 px, und die ist für
         Rechtliches reserviert; `small` (13) ist die Label-Untergrenze. */
      fontSize: {
        micro: ["0.6875rem", { lineHeight: "1rem" }],
        small: ["0.8125rem", { lineHeight: "1.25rem" }],
        body: ["0.9375rem", { lineHeight: "1.5rem" }],
        h3: ["1.0625rem", { lineHeight: "1.5rem" }],
        h2: ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "-0.02em" }],
        display: ["2rem", { lineHeight: "2.375rem", letterSpacing: "-0.02em" }],
        "display-lg": ["2.5rem", { lineHeight: "2.75rem", letterSpacing: "-0.022em" }],
      },
      borderRadius: {
        card: "10px",
        chip: "6px",
        overlay: "14px",
      },
      boxShadow: {
        overlay: "var(--overlay-shadow)",
      },
      maxWidth: {
        prose: "68ch",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        /* Die einzige Entrance im System — auf dem Seitencontainer, nicht
           pro Abschnitt. */
        "fade-in": "fade-in 160ms cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};
