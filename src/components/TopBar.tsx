import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useCockpit } from "../context/CockpitContext";
import { useUnread } from "../hooks/useUnread";
import { fmtCH } from "../utils/swiss";

/* ============================================================================
   TopBar — shared by every route.
   Left: EV4U wordmark (→ home). Center: the destinations.
   Right: the location-tariff chip and the POLARITY SWITCH: like a battery,
   the red terminal is PLUS (dark mode, signal red) and the blue terminal is
   MINUS (light mode, federal blue).
   ============================================================================ */

const LINKS = [
  { to: "/inserate", label: "INSERATE" },
  { to: "/rechenwerk", label: "RECHENWERK" },
  { to: "/vergleich", label: "VERGLEICH" },
  { to: "/verkaufen", label: "VERKAUFEN" },
  { to: "/konto", label: "KONTO" },
];

/** Pluspol (+, dark, signal red) ⇄ Minuspol (−, light, federal blue) —
 *  exactly like the battery terminals in the car. The class is applied
 *  pre-paint by an inline script in index.html. */
function PolarityToggle() {
  const [light, setLight] = useState(() =>
    document.documentElement.classList.contains("light"),
  );

  const toggle = () => {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("ev4u.theme", next ? "light" : "dark");
    } catch {
      /* private mode — theme just won't persist */
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="hidden font-mono text-[9px] tracking-[0.25em] text-muted lg:block">
        POL
      </span>
      <button
        onClick={toggle}
        title={
          light
            ? "Auf Pluspol wechseln — dunkel, signalrot"
            : "Auf Minuspol wechseln — hell, blau"
        }
        aria-label="Polarität wechseln (Hell-/Dunkelmodus)"
        className="flex items-center border border-line font-mono text-sm font-bold"
      >
        <span
          className={`grid h-8 w-8 place-items-center transition-colors duration-200 ${
            !light ? "bg-signal text-white" : "text-muted hover:text-ink"
          }`}
          aria-hidden
        >
          +
        </span>
        <span
          className={`grid h-8 w-8 place-items-center border-l border-line transition-colors duration-200 ${
            light ? "bg-signal text-white" : "text-muted hover:text-ink"
          }`}
          aria-hidden
        >
          −
        </span>
      </button>
    </div>
  );
}

export default function TopBar() {
  const { gemeinde, compareIds } = useCockpit();
  const unread = useUnread();

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-nacht/90 backdrop-blur-sm">
      {/* The navbar line is live: current flows through it */}
      <span className="current-line absolute inset-x-0 bottom-0 w-full" aria-hidden />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        {/* Wordmark → home */}
        <Link to="/" className="group flex items-center gap-3">
          <span className="relative grid h-7 w-7 place-items-center bg-signal transition-transform duration-300 group-hover:rotate-90">
            <span className="absolute h-[3px] w-4 bg-white" />
            <span className="absolute h-4 w-[3px] bg-white" />
          </span>
          <span className="stretch-expand text-xl font-black tracking-tight text-ink">
            EV4U
          </span>
          <span className="hidden font-mono text-[9px] uppercase tracking-[0.25em] text-muted xl:block">
            The Future is electric
          </span>
        </Link>

        {/* Destinations */}
        <nav className="hidden items-center gap-5 md:flex lg:gap-7">
          {LINKS.map((l, i) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `group font-mono text-[10px] tracking-[0.22em] transition-colors ${
                  isActive ? "text-ink" : "text-muted hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="mr-1.5 text-signal/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {l.label}
                  {l.to === "/vergleich" && compareIds.length > 0 && (
                    <span className="ml-1.5 bg-signal px-1 text-[8px] font-bold text-white">
                      {compareIds.length}
                    </span>
                  )}
                  {l.to === "/konto" && unread > 0 && (
                    <span className="ml-1.5 animate-blink bg-signal px-1 text-[8px] font-bold text-white">
                      {unread}
                    </span>
                  )}
                  <span
                    className={`block h-px bg-signal transition-all duration-300 ${
                      isActive ? "max-w-full" : "max-w-0 group-hover:max-w-full"
                    }`}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Tariff chip + polarity switch */}
        <div className="flex items-center gap-3">
          {gemeinde && (
            <Link
              to="/"
              title="Standort ändern"
              className="hidden items-center gap-2 border border-line bg-panel px-3 py-1.5 font-mono text-[10px] tracking-[0.15em] text-ink transition-colors hover:border-signal/50 sm:flex"
            >
              <span className="h-1.5 w-1.5 animate-blink bg-signal" aria-hidden />
              {gemeinde.zip} {gemeinde.name.toUpperCase()} ·{" "}
              {fmtCH(gemeinde.tariff * 100, 1)} RP/KWH
            </Link>
          )}
          <PolarityToggle />
        </div>
      </div>
    </header>
  );
}
