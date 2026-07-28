import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Crosshair, MapPin } from "lucide-react";
import { useCockpit } from "../hooks/useCockpit";
import { ACTIVE_LISTINGS } from "../data/evData";
import { href } from "../lib/url";
import { CH_AVG_TARIFF, TARIFF_META, fmtCH, resolveZip } from "../utils/swiss";
import { Stamp } from "./ui";

/* ============================================================================
   Hero — says what the platform does, in one line, then gets out of the way.
   Left: value proposition, key numbers, the two doors (kaufen / verkaufen).
   Right: the tariff widget — type a Swiss ZIP and every price on the site
   is computed with your municipal electricity tariff (persisted via
   CockpitContext). Clarity first: sentence-case copy, no survey theater.
   ============================================================================ */

type LockState = "idle" | "locking" | "locked";

export default function Hero() {
  const { gemeinde, setGemeinde } = useCockpit();
  const [zip, setZip] = useState("");
  const [lock, setLock] = useState<LockState>("idle");
  const [invalid, setInvalid] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only user input may clear the fix — on mount the field is empty while a
  // persisted/adopted location may exist (it used to be wiped here).
  const touched = useRef(false);

  // Adopt an existing fix (persisted visit, home PLZ, popup) into the field.
  useEffect(() => {
    if (gemeinde && zip === "" && !touched.current) setZip(gemeinde.zip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gemeinde]);

  // 4 valid digits → brief search state, then store the tariff.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setInvalid(false);

    if (zip.length < 4) {
      setLock("idle");
      if (gemeinde && touched.current) setGemeinde(null);
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
    }, 500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip]);

  return (
    <section id="top" className="relative overflow-hidden">
      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-8 sm:pt-16">
        {/* Eyebrow — one line of brand, then business */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 font-mono text-[11px] uppercase tracking-[0.25em] text-muted"
        >
          Der Schweizer E-Auto-Marktplatz ·{" "}
          <span className="text-signal">The Future is electric</span>
        </motion.p>

        {/* Headline: what EV4U does, not just how it feels */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="stretch-expand max-w-4xl text-4xl font-black uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl lg:text-6xl"
        >
          E-Autos kaufen und verkaufen —{" "}
          <span className="text-signal">ehrlich durchgerechnet.</span>
        </motion.h1>

        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1fr_minmax(380px,460px)]">
          {/* Claim + stat strip + the two doors */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Occasion vom Privaten oder Vorführwagen von der Garage: EV4U
              rechnet jedes Inserat durch — mit{" "}
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
                  <div className="mt-1 text-[11px] text-muted">{l}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={href("/inserate")}
                className="group flex items-center gap-2 border border-signal bg-signal px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.15em] text-nacht transition-colors hover:bg-signal-dim"
              >
                Inserate ansehen
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href={href("/verkaufen")}
                className="border border-line px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.15em] text-ink transition-colors hover:border-signal hover:text-signal"
              >
                Auto verkaufen
              </a>
            </div>
          </motion.div>

          {/* Tariff widget — the personalisation that drives every price */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="panel relative p-5 sm:p-6"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">Dein Stromtarif</h2>
              <motion.span
                animate={lock === "locking" ? { rotate: 360 } : { rotate: 0 }}
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
            <p className="mb-4 text-sm leading-relaxed text-muted">
              PLZ eingeben — alle Preise auf EV4U rechnen dann mit dem
              Stromtarif deiner Gemeinde.
            </p>

            <label className="flex items-center gap-3 border border-line bg-nacht px-4 py-3 transition-colors focus-within:border-signal/60">
              <MapPin size={16} className="shrink-0 text-muted" strokeWidth={1.5} />
              <input
                value={zip}
                onChange={(e) => {
                  touched.current = true;
                  setZip(e.target.value.replace(/\D/g, "").slice(0, 4));
                }}
                placeholder="PLZ eingeben — z. B. 4617"
                inputMode="numeric"
                className="w-full bg-transparent font-mono text-lg tracking-[0.2em] text-ink placeholder:text-sm placeholder:tracking-normal placeholder:text-muted/60 focus:outline-none"
                aria-label="Schweizer Postleitzahl"
              />
              {lock === "locking" && (
                <span className="font-mono text-[10px] tracking-[0.1em] text-signal">
                  Suche…
                </span>
              )}
            </label>

            {invalid && (
              <p className="mt-3 text-sm text-warn">
                Keine Schweizer PLZ — bitte prüfen.
              </p>
            )}

            {/* Plain conditional swap — the tariff confirmation must appear
                instantly and never hang on an exit animation. */}
            {lock === "locked" && gemeinde ? (
              <div key={gemeinde.zip} className="mt-5 border-t border-line pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xl font-extrabold text-ink">
                        {gemeinde.name}
                      </div>
                      <div className="mt-0.5 text-sm text-muted">
                        {gemeinde.zip} · Kanton {gemeinde.canton}
                      </div>
                    </div>
                    {gemeinde.estimated ? (
                      <Stamp className="!border-warn !text-warn">Geschätzt</Stamp>
                    ) : (
                      <Stamp>Gespeichert</Stamp>
                    )}
                  </div>
                  <div className="mt-4 flex items-baseline justify-between border border-signal/40 bg-signal/[0.06] px-4 py-3">
                    <span className="text-sm text-muted">Dein Stromtarif</span>
                    <span className="font-mono text-xl font-bold text-signal tabular">
                      {fmtCH(gemeinde.tariff * 100, 1)}{" "}
                      <span className="text-xs font-normal">Rp./kWh</span>
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted">
                    {gemeinde.estimated
                      ? `Für diese PLZ gibt es keine ElCom-Zuordnung — wir rechnen mit dem Schweizer Median ${TARIFF_META.period}.`
                      : gemeinde.via
                        ? `Postfach-/Sonder-PLZ — Tarif der Gemeinde ${gemeinde.name} (Zustell-PLZ ${gemeinde.via}) übernommen. Quelle: ElCom ${TARIFF_META.period}, Profil H4, exkl. MwSt.`
                        : `Quelle: ElCom ${TARIFF_META.period}, Profil H4, exkl. MwSt. Der Tarif bleibt für deinen nächsten Besuch gespeichert.`}
                  </p>
              </div>
            ) : (
              <p className="mt-4 text-xs leading-relaxed text-muted">
                Ohne PLZ rechnen wir mit dem Schweizer Median{" "}
                {TARIFF_META.period} ({fmtCH(CH_AVG_TARIFF * 100, 1)} Rp./kWh).
                Probier z.&nbsp;B. 4617, 6300 oder 1003.
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
