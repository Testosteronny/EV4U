import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Menu, Moon, Sun, X } from "lucide-react";
import { useCockpit } from "../hooks/useCockpit";
import { useUnread } from "../hooks/useUnread";
import { href } from "../lib/url";
import { fmtCH } from "../utils/swiss";

/* ============================================================================
   TopBar — shared by every route (React island, hydrated on load).
   Left: EV4U wordmark (→ home). Center: the destinations (≥ md).
   Right: the location-tariff chip, the sun/moon theme switch and — below
   md — the hamburger that opens the full-screen Schaltplan menu: on the
   phone this is the only way to reach the instruments, so it gets the full
   treatment. Both themes glow the same brand green — only the surface flips.
   ============================================================================ */

/* Every destination in one place: buy side, sell side, the two tools
   (Rechenwerk, Vergleich) and the account. The tools are also embedded in
   listings / the compare tray, but they stay visible here so nothing on the
   site can only be found by accident. Vergleich carries the live pick count. */
const LINKS = [
  { to: "/inserate", label: "INSERATE" },
  { to: "/verkaufen", label: "VERKAUFEN" },
  { to: "/rechenwerk", label: "RECHENWERK" },
  { to: "/vergleich", label: "VERGLEICH" },
  { to: "/konto", label: "KONTO" },
];

/** Sun (light) ⇄ moon (dark) theme switch. The saved theme class is applied
 *  pre-paint by an inline script in the layout head. */
function ThemeToggle() {
  const [light, setLight] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("light")
      : false,
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
    <button
      onClick={toggle}
      title={light ? "Dunkelmodus einschalten" : "Hellmodus einschalten"}
      aria-label="Hell-/Dunkelmodus wechseln"
      className="flex items-center border border-line"
    >
      <span
        className={`grid h-8 w-8 place-items-center transition-colors duration-200 ${
          light ? "bg-signal text-nacht" : "text-muted hover:text-ink"
        }`}
        aria-hidden
      >
        <Sun size={14} strokeWidth={2} />
      </span>
      <span
        className={`grid h-8 w-8 place-items-center border-l border-line transition-colors duration-200 ${
          !light ? "bg-signal text-nacht" : "text-muted hover:text-ink"
        }`}
        aria-hidden
      >
        <Moon size={14} strokeWidth={2} />
      </span>
    </button>
  );
}

/** Count badge on a nav link (compare tray size, unread messages). */
function Badge({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="ml-1.5 bg-signal px-1 text-[8px] font-bold text-nacht">
      {value}
    </span>
  );
}

/** Full-screen mobile menu — the Schaltplan. Numbered destinations in
 *  display type, the tariff fix, and the same badges as the desktop nav. */
function MobileMenu({
  path,
  unread,
  compare,
  onClose,
}: {
  path: string;
  unread: number;
  compare: number;
  onClose: () => void;
}) {
  const { gemeinde } = useCockpit();

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <motion.div
      id="mobile-menu"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation"
      className="bg-blueprint fixed inset-0 z-[80] flex flex-col bg-nacht md:hidden"
    >
      {/* Head row mirrors the bar so the X sits exactly on the hamburger */}
      <div className="flex h-16 items-center justify-between px-4">
        <a href={href("/")} className="flex items-center gap-3" onClick={onClose}>
          <span className="relative grid h-7 w-7 place-items-center bg-signal">
            <span className="absolute h-[3px] w-4 bg-white" />
            <span className="absolute h-4 w-[3px] bg-white" />
          </span>
          <span className="stretch-expand text-xl font-black tracking-tight text-ink">
            EV4U
          </span>
        </a>
        <button
          onClick={onClose}
          aria-label="Menü schliessen"
          className="grid h-10 w-10 place-items-center border border-line text-ink"
        >
          <X size={18} />
        </button>
      </div>
      <span className="current-line mx-4" aria-hidden />

      <nav className="flex flex-1 flex-col justify-center gap-1 px-6">
        {LINKS.map((l, i) => {
          const isActive = path === href(l.to);
          return (
            <motion.a
              key={l.to}
              href={href(l.to)}
              aria-current={isActive ? "page" : undefined}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + i * 0.05, duration: 0.3 }}
              className={`flex items-baseline gap-4 border-b border-line/60 py-4 ${
                isActive ? "text-signal" : "text-ink"
              }`}
            >
              <span className="stretch-expand text-3xl font-black uppercase tracking-tight">
                {l.label}
              </span>
              {l.to === "/konto" && <Badge value={unread} />}
              {l.to === "/vergleich" && <Badge value={compare} />}
            </motion.a>
          );
        })}
      </nav>

      <div className="px-6 pb-8">
        {gemeinde ? (
          <a
            href={href("/")}
            onClick={onClose}
            className="flex items-center gap-2 border border-line bg-panel px-4 py-3 font-mono text-[10px] tracking-[0.15em] text-ink"
          >
            <MapPin size={12} className="shrink-0 text-signal" />
            {gemeinde.zip} {gemeinde.name.toUpperCase()} ·{" "}
            {fmtCH(gemeinde.tariff * 100, 1)} RP/KWH
          </a>
        ) : (
          <a
            href={href("/")}
            onClick={onClose}
            className="flex items-center gap-2 border border-dashed border-line px-4 py-3 font-mono text-[10px] tracking-[0.15em] text-muted"
          >
            <MapPin size={12} className="shrink-0" />
            Standort wählen — PLZ auf der Startseite
          </a>
        )}
        <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.3em] text-muted/60">
          The Future is electric.
        </p>
      </div>
    </motion.div>
  );
}

export default function TopBar() {
  const { gemeinde, compareIds } = useCockpit();
  const unread = useUnread();
  const [menuOpen, setMenuOpen] = useState(false);
  // Resolved after mount so the server and first client render agree —
  // prerendered HTML has neither a location nor a persisted PLZ, so both
  // the active-link state and the tariff chip must wait for the client.
  const [path, setPath] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setPath(window.location.pathname.replace(/\/$/, ""));
    setMounted(true);
  }, []);

  return (
    <>
    <header className="fixed inset-x-0 top-0 z-50 bg-nacht/90 backdrop-blur-sm">
      {/* The navbar line is live: current flows through it */}
      <span className="current-line absolute inset-x-0 bottom-0 w-full" aria-hidden />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        {/* Wordmark → home */}
        <a href={href("/")} className="group flex items-center gap-3">
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
        </a>

        {/* Destinations */}
        <nav className="hidden items-center gap-4 md:flex lg:gap-6">
          {LINKS.map((l) => {
            const isActive = path === href(l.to);
            return (
              <a
                key={l.to}
                href={href(l.to)}
                aria-current={isActive ? "page" : undefined}
                className={`group font-mono text-[11px] tracking-[0.18em] transition-colors ${
                  isActive ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {l.label}
                {l.to === "/konto" && <Badge value={unread} />}
                {l.to === "/vergleich" && mounted && (
                  <Badge value={compareIds.length} />
                )}
                <span
                  className={`block h-px bg-signal transition-all duration-300 ${
                    isActive ? "max-w-full" : "max-w-0 group-hover:max-w-full"
                  }`}
                />
              </a>
            );
          })}
        </nav>

        {/* Tariff chip + polarity switch + hamburger */}
        <div className="flex items-center gap-3">
          {mounted && gemeinde && (
            <a
              href={href("/")}
              title="Standort ändern"
              className="hidden items-center gap-2 border border-line bg-panel px-3 py-1.5 font-mono text-[10px] tracking-[0.15em] text-ink transition-colors hover:border-signal/50 lg:flex"
            >
              <span className="h-1.5 w-1.5 bg-signal" aria-hidden />
              {gemeinde.zip} {gemeinde.name.toUpperCase()} ·{" "}
              {fmtCH(gemeinde.tariff * 100, 1)} RP/KWH
            </a>
          )}
          <ThemeToggle />
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Menü öffnen"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            className="grid h-10 w-10 place-items-center border border-line text-ink transition-colors hover:border-signal hover:text-signal md:hidden"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>
    </header>

    {/* Outside the header: its backdrop-filter would otherwise become the
        containing block and clip the fixed full-screen overlay to 64 px.
        Mounted conditionally (no AnimatePresence): closing must never depend
        on an exit animation completing — a stuck invisible overlay would
        swallow every tap on the page. */}
    {menuOpen && (
      <MobileMenu
        path={path}
        unread={unread}
        compare={compareIds.length}
        onClose={() => setMenuOpen(false)}
      />
    )}
    </>
  );
}
