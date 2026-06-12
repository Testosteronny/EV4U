/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      /* ======================================================================
         EV4U — Schweizer Instrument design tokens
         Anthracite instrument panel · Swiss signal red · warm "lume" ink
         ====================================================================== */
      // All colors are CSS variables (see index.css): dark = anthracite +
      // Swiss signal red, light = paper white + Swiss federal blue.
      colors: {
        nacht: "rgb(var(--c-nacht) / <alpha-value>)", // page background
        panel: "rgb(var(--c-panel) / <alpha-value>)", // instrument panel
        panel2: "rgb(var(--c-panel2) / <alpha-value>)", // raised / hover
        ink: "rgb(var(--c-ink) / <alpha-value>)", // primary text
        muted: "rgb(var(--c-muted) / <alpha-value>)", // secondary text
        line: "rgb(var(--c-line) / <alpha-value>)", // hairline borders
        signal: {
          DEFAULT: "rgb(var(--c-signal) / <alpha-value>)", // brand accent
          dim: "rgb(var(--c-signal-dim) / <alpha-value>)",
        },
        lume: "rgb(var(--c-lume) / <alpha-value>)", // savings / positive
        warn: "rgb(var(--c-warn) / <alpha-value>)", // warnings / solar
      },
      fontFamily: {
        sans: ['"Archivo"', "system-ui", "sans-serif"],
        display: ['"Archivo"', "system-ui", "sans-serif"],
        mono: ['"Spline Sans Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 18px 50px -24px rgba(0,0,0,0.8)",
        signal: "0 0 0 1px rgba(255,59,48,0.4), 0 8px 32px -8px rgba(255,59,48,0.35)",
      },
      animation: {
        blink: "blink 1.1s steps(2, start) infinite",
        "sweep-in": "sweep-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
        "sweep-in": {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
