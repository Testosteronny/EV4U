import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, PhoneCall, X } from "lucide-react";
import { GABRIEL } from "../data/evData";
import { supabase } from "../lib/supabase";
import { href } from "../lib/url";
import { SectionHeader, Stamp } from "./ui";

/* ============================================================================
   BentoHub — the Schaltzentrale: intent doors + Gabriel, one bento grid.
   Every card's SVG acts out its action:
     A · Finden    (2 col) — a magnifier sweeps a row of cars; the right one
                             lights up in signal exactly under the lens
     B · Rechnen   (1 col) — a gauge needle sweeping restlessly
     C · Gabriel   (1 col) — a handset rings: receiver shakes, call waves
                             pulse outward — pick a slot, he calls you
     D · Verkaufen (2 col) — two worlds, one divider: the private owner
                             charging at home | the garage pro in his suit
   ============================================================================ */

/* ---- A · FINDEN: scan the row, find the one --------------------------------- */
function FindenSvg() {
  // Five cars on the lot; the lens starts over car 1 and parks over car 4.
  const cars = [60, 130, 200, 270, 340];
  const car = (cx: number) => (
    <g key={cx}>
      <path
        d={`M${cx - 22} 84 v-5 c0 -3 2 -5 5 -5 h4 l6 -8 h14 l6 8 h3 c3 0 4 2 4 5 v5`}
        fill="none"
      />
      <circle cx={cx - 11} cy={84} r="4" fill="none" />
      <circle cx={cx + 11} cy={84} r="4" fill="none" />
    </g>
  );
  return (
    <svg viewBox="0 0 420 110" className="h-24 w-full" aria-hidden>
      <line x1="14" y1="88" x2="406" y2="88" stroke="var(--ink)" strokeOpacity="0.15" />
      <g stroke="var(--ink)" strokeOpacity="0.4" strokeWidth="1.5" strokeLinejoin="round">
        {cars.map(car)}
      </g>
      {/* the find — flashes while the lens hovers it */}
      <g
        className="found-pulse"
        stroke="var(--signal)"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        {car(270)}
        <path d="M270 48 l-5 9 h6 l-4 9" fill="none" strokeLinecap="round" />
      </g>
      {/* the lens, sweeping the lot */}
      <g className="lens-sweep">
        <circle cx="60" cy="62" r="22" fill="var(--signal)" fillOpacity="0.06" />
        <circle cx="60" cy="62" r="22" fill="none" stroke="var(--ink)" strokeOpacity="0.7" strokeWidth="2" />
        <line x1="76" y1="46" x2="90" y2="32" stroke="var(--ink)" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />
        <path d="M48 54 a14 14 0 0 1 10 -6" fill="none" stroke="var(--ink)" strokeOpacity="0.35" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/* ---- B · RECHNEN: the restless needle ---------------------------------------- */
function RechnenSvg() {
  return (
    <svg viewBox="0 0 120 78" className="h-24 w-full" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => {
        const a = (-52 + i * 13) * (Math.PI / 180);
        const major = i % 4 === 0;
        const r1 = major ? 38 : 42;
        return (
          <line
            key={i}
            x1={60 + r1 * Math.sin(a)}
            y1={68 - r1 * Math.cos(a)}
            x2={60 + 47 * Math.sin(a)}
            y2={68 - 47 * Math.cos(a)}
            stroke="var(--ink)"
            strokeOpacity={major ? 0.6 : 0.25}
            strokeWidth={major ? 2 : 1}
          />
        );
      })}
      <g className="gauge-sweep" style={{ transformOrigin: "60px 68px" }}>
        <line x1="60" y1="68" x2="60" y2="28" stroke="var(--signal)" strokeWidth="2.5" />
      </g>
      <circle cx="60" cy="68" r="4.5" fill="var(--signal)" />
      <circle cx="60" cy="68" r="1.8" fill="var(--nacht)" />
    </svg>
  );
}

/* ---- C · GABRIEL: the phone rings -------------------------------------------- */
function GabrielSvg() {
  return (
    <svg viewBox="0 0 120 78" className="h-24 w-full" aria-hidden>
      {/* receiver — shakes with every ring */}
      <g className="ring-shake">
        <path
          d="M26 44 q28 -26 56 0 l-9 11 q-19 -16 -38 0 z"
          fill="none"
          stroke="var(--ink)"
          strokeOpacity="0.7"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>
      {/* outgoing call waves, staggered */}
      <path d="M88 32 A11 11 0 0 1 94 43" fill="none" stroke="var(--signal)" strokeWidth="2" strokeLinecap="round" className="ring-arc" />
      <path d="M92 25 A18 18 0 0 1 101 44" fill="none" stroke="var(--signal)" strokeWidth="2" strokeLinecap="round" className="ring-arc" style={{ animationDelay: "0.25s" }} />
      <path d="M96 18 A25 25 0 0 1 108 45" fill="none" stroke="var(--signal)" strokeWidth="2" strokeLinecap="round" className="ring-arc" style={{ animationDelay: "0.5s" }} />
      {/* erreichbar */}
      <circle cx="22" cy="22" r="3" fill="var(--signal)" className="animate-blink" />
    </svg>
  );
}

/* ---- D · VERKAUFEN: two worlds, one divider ---------------------------------- */
function VerkaufenSvg() {
  return (
    <svg viewBox="0 0 420 120" className="h-28 w-full" aria-hidden>
      {/* shared ground */}
      <line x1="12" y1="106" x2="408" y2="106" stroke="var(--ink)" strokeOpacity="0.15" />

      {/* PRIVAT — house with wallbox, owner, car charging */}
      <g fill="none" stroke="var(--ink)" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 106 V62 L50 36 L80 62 V106" />
        <path d="M62 47 v-14 h9 v22" />
        <path d="M32 80 v-12 h14 v12 z M39 68 v12 M32 74 h14" />
        <path d="M58 106 V84 h14 v22" />
        <path d="M80 70 h8 v13 h-8" />
        <circle cx="104" cy="64" r="4.5" />
        <path d="M104 69 v14 M104 73 l-7 6 M104 73 l7 7 M104 83 l-6 19 M104 83 l6 19" />
        <path d="M132 102 v-6 c0 -4 3 -6 6 -6 h6 l8 -11 h21 l7 11 h4 c4 0 6 2 6 6 v6" />
        <path d="M150 89 l7 -10 h13 l6 10" />
        <circle cx="146" cy="102" r="5.5" />
        <circle cx="183" cy="102" r="5.5" />
      </g>
      {/* charging cable wallbox → car, current flowing */}
      <path d="M88 80 C 106 100, 118 102, 131 98" fill="none" stroke="var(--signal)" strokeWidth="1.5" strokeDasharray="4 5" className="dash-route" />
      <circle cx="132" cy="98" r="2.5" fill="var(--signal)" className="animate-blink" />

      {/* the divider — current between the two worlds */}
      <line x1="210" y1="14" x2="210" y2="106" stroke="var(--signal)" strokeWidth="1.5" strokeDasharray="6 8" className="dash-route" />

      {/* GARAGE — showroom, slatted door, salesman in suit */}
      <g fill="none" stroke="var(--ink)" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M236 106 V56 h110 v50" />
        <path d="M232 56 h118" />
        <path d="M246 106 V72 h56 v34 M246 81 h56 M246 89 h56 M246 97 h56" />
        <path d="M312 72 h26 v10 h-26 z" />
        <circle cx="376" cy="62" r="5" />
        <path d="M366 106 V80 l10 -10 10 10 v26" />
        <path d="M366 84 l-9 9 M386 84 l6 10" />
        <path d="M352 93 h12 v11 h-12 z M357 93 v-3 h2 v3" />
      </g>
      {/* the tie — signal-colored, of course */}
      <path d="M376 68 l-3 5 3 11 3 -11 z" fill="var(--signal)" />

      {/* labels */}
      <text x="100" y="22" textAnchor="middle" fontSize="9" letterSpacing="3" fill="var(--muted-c)" className="font-mono">
        PRIVAT
      </text>
      <text x="320" y="22" textAnchor="middle" fontSize="9" letterSpacing="3" fill="var(--muted-c)" className="font-mono">
        GARAGE
      </text>
    </svg>
  );
}

const cardMotion = (i: number) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, delay: i * 0.08 },
});

export default function BentoHub() {
  const [booking, setBooking] = useState<string | null>(null);

  const refCode = booking ? `EV4U-G-${booking.replace(/[^A-Z0-9]/g, "")}` : "";

  const book = (slot: string) => {
    setBooking(slot);
    // Write-only booking request (RLS: insert allowed, select denied).
    void supabase?.from("bookings").insert({ consultant: GABRIEL.name, slot });
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
      <SectionHeader
        index="01"
        title="Schaltzentrale"
        claim="Finden · Rechnen · Reden · Verkaufen"
      />

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {/* A · FINDEN — 2 columns */}
        <motion.div {...cardMotion(0)} className="lg:col-span-2">
          <a
            href={href("/inserate")}
            className="panel group flex h-full flex-col justify-between p-6 transition-colors duration-300 hover:border-signal/60"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <h3 className="stretch-wide text-2xl font-extrabold uppercase text-ink">
                  E-Auto finden
                </h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                  Alle offenen Inserate, filterbar nach Marke, Sitzen und Preis —
                  jedes mit Energiekosten in deiner Gemeinde.
                </p>
              </div>
              <span className="font-mono text-xs tracking-[0.25em] text-signal">A</span>
            </div>
            <FindenSvg />
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted transition-colors group-hover:text-signal">
              Zur Markt-Tafel
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
            </span>
          </a>
        </motion.div>

        {/* B · RECHNEN — 1 column */}
        <motion.div {...cardMotion(1)}>
          <a
            href={href("/rechenwerk")}
            className="panel group flex h-full flex-col justify-between p-6 transition-colors duration-300 hover:border-signal/60"
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="stretch-wide text-2xl font-extrabold uppercase text-ink">
                Erst rechnen
              </h3>
              <span className="font-mono text-xs tracking-[0.25em] text-signal">B</span>
            </div>
            <RechnenSvg />
            <div>
              <p className="text-sm leading-relaxed text-muted">
                Benzin gegen Strom — mit deinem Tarif, Solar und Lade-Mix.
              </p>
              <span className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted transition-colors group-hover:text-signal">
                Zum Rechenwerk
                <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </a>
        </motion.div>

        {/* C · GABRIEL — 1 column, the phone rings */}
        <motion.div {...cardMotion(2)} id="beratung" className="scroll-mt-20">
          <div className="panel flex h-full flex-col justify-between p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="stretch-wide text-2xl font-extrabold uppercase text-ink">
                  Unsicher? <span className="text-signal">Red mit Gabriel.</span>
                </h3>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.25em] text-muted">
                  Kein Verkaufsgespräch · 20 Min.
                </p>
              </div>
              <span className="font-mono text-xs tracking-[0.25em] text-signal">C</span>
            </div>
            <GabrielSvg />
            <div>
              <p className="text-sm leading-relaxed text-muted">«{GABRIEL.intro}»</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {GABRIEL.slots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => book(slot)}
                    className={`px-2.5 py-1.5 font-mono text-[9px] tracking-[0.12em] transition-colors ${
                      booking === slot
                        ? "bg-signal text-white"
                        : "bg-nacht text-muted hover:bg-panel2 hover:text-ink"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
              <AnimatePresence>
                {booking && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ type: "spring", stiffness: 280, damping: 26 }}
                    className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-signal/50 bg-signal/[0.05] px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center bg-signal text-white">
                        <PhoneCall size={13} strokeWidth={1.5} />
                      </span>
                      <div>
                        <span className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.1em] text-ink">
                          {booking} <Stamp className="!px-1.5 !py-0 text-[8px]">Gebucht</Stamp>
                        </span>
                        <span className="font-mono text-[8px] tracking-[0.12em] text-muted">
                          REF {refCode} · GABRIEL RUFT DICH AN
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setBooking(null)}
                      title="Stornieren"
                      className="text-muted transition-colors hover:text-signal"
                    >
                      <X size={12} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* D · VERKAUFEN — 2 columns, room for the two-worlds scene */}
        <motion.div {...cardMotion(3)} className="lg:col-span-2">
          <a
            href={href("/verkaufen")}
            className="panel group flex h-full flex-col justify-between p-6 transition-colors duration-300 hover:border-signal/60"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <h3 className="stretch-wide text-2xl font-extrabold uppercase text-ink">
                  Verkaufen
                </h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                  Privat oder Garage — dein Inserat mit gemessenem SOH-Zertifikat.
                  Käufer sehen den Wert, nicht nur den Preis.
                </p>
              </div>
              <span className="font-mono text-xs tracking-[0.25em] text-signal">D</span>
            </div>
            <VerkaufenSvg />
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted transition-colors group-hover:text-signal">
              Inserat aufgeben
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
            </span>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
