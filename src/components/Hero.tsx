import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crosshair, MapPin } from "lucide-react";
import { useCockpit } from "../context/CockpitContext";
import { ACTIVE_LISTINGS } from "../data/evData";
import { CH_AVG_TARIFF, TARIFF_META, fmtCH, lv95, resolveZip } from "../utils/swiss";
import { Stamp } from "./ui";

/* ============================================================================
   Hero — "THE FUTURE IS ELECTRIC."
   Massive Swiss-grotesque typography over a swisstopo-style contour field.
   The Standort-Fixierung widget locks a Swiss ZIP like a survey instrument:
   type 4 digits → crosshair spins → coordinates lock → tariff is stamped and
   broadcast through CockpitContext to every instrument below.
   ============================================================================ */

type LockState = "idle" | "locking" | "locked";

/** Hand-drawn contour field, swisstopo style — pure decoration. */
function ContourField() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full text-ink"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <g fill="none" stroke="currentColor" strokeOpacity="0.06" strokeWidth="1">
        <path d="M-50 620 C 150 540, 280 660, 460 600 S 760 480, 940 560 S 1180 640, 1280 580" />
        <path d="M-50 560 C 160 470, 300 600, 480 540 S 760 410, 950 490 S 1170 570, 1280 510" />
        <path d="M-50 500 C 180 410, 320 540, 500 480 S 770 350, 960 430 S 1170 500, 1280 450" />
        <path d="M-50 440 C 200 350, 350 480, 530 420 S 780 290, 970 370 S 1170 440, 1280 390" />
        <path d="M-50 380 C 220 300, 380 420, 560 360 S 800 240, 990 320 S 1180 380, 1280 330" />
        <path d="M-50 320 C 240 250, 400 360, 590 310 S 820 200, 1010 270 S 1180 320, 1280 280" />
        <path d="M200 800 C 280 700, 420 740, 520 680 S 700 600, 840 660 S 1050 740, 1150 700" />
        <path d="M300 800 C 380 730, 480 760, 580 710 S 720 650, 860 700" />
      </g>
      {/* Spot heights, like a national map */}
      <g className="font-mono" fill="currentColor" fillOpacity="0.14" fontSize="9">
        <text x="180" y="370">· 1'608</text>
        <text x="640" y="290">· 2'106</text>
        <text x="980" y="420">· 4'478</text>
        <text x="420" y="560">· 634</text>
      </g>
    </svg>
  );
}

export default function Hero() {
  const { gemeinde, setGemeinde } = useCockpit();
  const [zip, setZip] = useState("");
  const [lock, setLock] = useState<LockState>("idle");
  const [invalid, setInvalid] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 4 valid digits → spin the crosshair, then stamp the fix.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setInvalid(false);

    if (zip.length < 4) {
      setLock("idle");
      if (gemeinde) setGemeinde(null);
      return;
    }
    const hit = resolveZip(zip);
    if (!hit) {
      setLock("idle");
      setInvalid(true);
      return;
    }
    setLock("locking");
    timer.current = setTimeout(() => {
      setGemeinde(hit);
      setLock("locked");
    }, 750);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip]);

  const coords = gemeinde ? lv95(gemeinde) : null;

  return (
    <section id="top" className="relative overflow-hidden">
      <ContourField />

      {/* Corner marks — circuit-sheet flavor */}
      <div className="pointer-events-none absolute inset-x-4 top-20 hidden justify-between font-mono text-[9px] tracking-[0.3em] text-muted/60 sm:flex md:inset-x-8">
        <span>STROMKREIS 01 / EV4U.CH</span>
        <span>800 V DC · 50 HZ AC</span>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-8 sm:pt-24">
        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 font-mono text-[10px] uppercase tracking-[0.3em] text-muted sm:text-xs"
        >
          Der Schweizer E-Auto-Marktplatz · Privat & Garage —{" "}
          <span className="text-signal">100 % unter Strom</span>
        </motion.p>

        {/* Headline: solid / hollow / signal — the motto as a power line */}
        <h1 className="stretch-expand select-none text-[12.5vw] font-black uppercase leading-[0.82] tracking-tighter sm:text-[10vw] lg:text-[120px]">
          <motion.span
            className="block text-ink"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            The Future
          </motion.span>
          <motion.span
            className="text-outline block"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            is
          </motion.span>
          <motion.span
            className="block text-signal"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.31, ease: [0.22, 1, 0.36, 1] }}
          >
            electric.
          </motion.span>
        </h1>

        <div className="mt-12 grid items-start gap-10 lg:grid-cols-[1fr_minmax(380px,460px)]">
          {/* Claim + stat strip */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
          >
            <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Occasion vom Privaten oder Vorführwagen von der Garage: EV4U
              inseriert nicht nur — es rechnet jedes Inserat durch. Mit{" "}
              <span className="text-ink">deinem Gemeindetarif</span>,{" "}
              <span className="text-ink">deinem Solardach</span> und{" "}
              <span className="text-ink">deinen Kilometern</span>. Auf den
              Rappen genau, ohne Verkaufsdruck.
            </p>
            <div className="mt-8 grid max-w-xl grid-cols-3 divide-x divide-line border border-line">
              {[
                [fmtCH(ACTIVE_LISTINGS.length), "Offene Inserate"],
                [fmtCH(TARIFF_META.municipalities), `Gemeindetarife ${TARIFF_META.period}`],
                ["0", "Verkaufsdruck"],
              ].map(([n, l]) => (
                <div key={l} className="bg-panel px-4 py-4">
                  <div className="font-mono text-xl font-bold text-ink tabular sm:text-2xl">
                    {n}
                  </div>
                  <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
                    {l}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Standort-Fixierung — the instrument that drives everything */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="panel bg-blueprint relative p-5 sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
                Standort-Fixierung
              </span>
              <motion.span
                animate={
                  lock === "locking"
                    ? { rotate: 360 }
                    : lock === "locked"
                      ? { rotate: 0, scale: 1 }
                      : { rotate: 0 }
                }
                transition={
                  lock === "locking"
                    ? { repeat: Infinity, duration: 0.8, ease: "linear" }
                    : { type: "spring", stiffness: 300, damping: 20 }
                }
                className={lock === "locked" ? "text-signal" : "text-muted"}
              >
                <Crosshair size={18} strokeWidth={1.5} />
              </motion.span>
            </div>

            <label className="flex items-center gap-3 border border-line bg-nacht px-4 py-3 transition-colors focus-within:border-signal/60">
              <MapPin size={16} className="shrink-0 text-muted" strokeWidth={1.5} />
              <input
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="PLZ eingeben — z. B. 4617"
                inputMode="numeric"
                className="w-full bg-transparent font-mono text-lg tracking-[0.3em] text-ink placeholder:text-sm placeholder:tracking-normal placeholder:text-muted/60 focus:outline-none"
                aria-label="Schweizer Postleitzahl"
              />
              {lock === "locking" && (
                <span className="animate-blink font-mono text-[9px] tracking-[0.2em] text-signal">
                  PEILT…
                </span>
              )}
            </label>

            {invalid && (
              <p className="mt-3 font-mono text-[10px] tracking-[0.15em] text-warn">
                KEINE SCHWEIZER PLZ — BITTE PRÜFEN.
              </p>
            )}

            {/* Survey stamp once the fix is locked */}
            <AnimatePresence mode="wait">
              {lock === "locked" && gemeinde ? (
                <motion.div
                  key={gemeinde.zip}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                  className="mt-5 border-t border-dashed border-line pt-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="stretch-wide text-2xl font-extrabold uppercase text-ink">
                        {gemeinde.name}
                      </div>
                      <div className="mt-1 font-mono text-[10px] tracking-[0.2em] text-muted">
                        {gemeinde.zip} · KT. {gemeinde.canton}
                      </div>
                      {coords && !gemeinde.estimated && !gemeinde.via && (
                        <div className="mt-1 font-mono text-[10px] tracking-[0.12em] text-muted/70">
                          LV95 {coords}
                        </div>
                      )}
                    </div>
                    {gemeinde.estimated ? (
                      <Stamp className="!border-warn !text-warn">Geschätzt</Stamp>
                    ) : (
                      <Stamp>Fixiert</Stamp>
                    )}
                  </div>
                  <div className="mt-4 flex items-baseline justify-between border border-signal/40 bg-signal/[0.06] px-4 py-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                      Dein Stromtarif
                    </span>
                    <span className="font-mono text-xl font-bold text-signal tabular">
                      {fmtCH(gemeinde.tariff * 100, 1)}{" "}
                      <span className="text-xs font-normal">Rp./kWh</span>
                    </span>
                  </div>
                  <p className="mt-3 font-mono text-[9px] leading-relaxed tracking-[0.1em] text-muted">
                    {gemeinde.estimated
                      ? `KEINE ELCOM-ZUORDNUNG FÜR DIESE PLZ — CH-MEDIAN ${TARIFF_META.period} EINGESETZT.`
                      : gemeinde.via
                        ? `POSTFACH-/SONDER-PLZ — TARIF DER GEMEINDE ${gemeinde.name.toUpperCase()} (ZUSTELL-PLZ ${gemeinde.via}) ÜBERNOMMEN. QUELLE: ELCOM ${TARIFF_META.period} · H4 · EXKL. MWST.`
                        : `QUELLE: ELCOM ${TARIFF_META.period} · PROFIL H4 · EXKL. MWST. ALLE SEITEN RECHNEN JETZT MIT DIESEM TARIF — GESPEICHERT FÜR DEINEN NÄCHSTEN BESUCH.`}
                  </p>
                </motion.div>
              ) : (
                <motion.p
                  key="hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-5 font-mono text-[9px] leading-relaxed tracking-[0.12em] text-muted/80"
                >
                  OHNE FIXIERUNG RECHNET DAS INSTRUMENT MIT DEM CH-MEDIAN{" "}
                  {TARIFF_META.period} ({fmtCH(CH_AVG_TARIFF * 100, 1)} RP/KWH,
                  ELCOM H4). PROBIER 4617, 6300 ODER 1003.
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
