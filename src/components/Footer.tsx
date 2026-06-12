import { Link } from "react-router-dom";
import { TARIFF_META, fmtCH } from "../utils/swiss";

/* ============================================================================
   Footer — giant hollow wordmark over the Swiss grid, survey-sheet small
   print. The page signs off like a printed map sheet.
   ============================================================================ */

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="overflow-hidden border-t border-line bg-nacht">
      <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-8">
        <div className="grid gap-10 pb-16 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="relative grid h-7 w-7 place-items-center bg-signal">
                <span className="absolute h-[3px] w-4 bg-white" />
                <span className="absolute h-4 w-[3px] bg-white" />
              </span>
              <span className="stretch-expand text-xl font-black text-ink">EV4U</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              Das Schweizer E-Auto-Instrument. Unabhängig, datenbasiert,
              gebaut für Entscheidungen — nicht für Klicks.
            </p>
          </div>

          <div>
            <div className="mb-4 font-mono text-[9px] uppercase tracking-[0.25em] text-muted">
              Instrumente
            </div>
            <ul className="space-y-2 font-mono text-xs">
              {[
                ["/inserate", "01 Markt-Tafel"],
                ["/rechenwerk", "02 Rechenwerk"],
                ["/vergleich", "03 Vergleich"],
                ["/verkaufen", "04 Verkaufen"],
                ["/#beratung", "05 Mit Gabriel reden"],
              ].map(([to, label]) => (
                <li key={to}>
                  <Link to={to} className="text-muted transition-colors hover:text-signal">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-4 font-mono text-[9px] uppercase tracking-[0.25em] text-muted">
              Koordinaten
            </div>
            <ul className="space-y-2 font-mono text-xs text-muted">
              <li>EV4U.CH</li>
              <li>LV95 2'600'421 / 1'199'498</li>
              <li>{fmtCH(440)} M Ü. M.</li>
              <li className="pt-2 text-muted/60">HALLO@EV4U.CH</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Giant hollow wordmark, half-cropped like a print bleed */}
      <div
        className="text-outline stretch-expand pointer-events-none select-none whitespace-nowrap text-center text-[26vw] font-black leading-[0.72] opacity-30"
        aria-hidden
      >
        EV4U
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 font-mono text-[9px] tracking-[0.2em] text-muted/70 sm:px-8">
          <span>© {year} EV4U — ENTWICKELT IN DER SCHWEIZ</span>
          <span>
            STROMTARIFE: ELCOM {TARIFF_META.period} ({fmtCH(TARIFF_META.plzCount)}{" "}
            PLZ) · ORTSCHAFTEN: SWISSTOPO
          </span>
          <span>THE FUTURE IS ELECTRIC.</span>
        </div>
      </div>
    </footer>
  );
}
