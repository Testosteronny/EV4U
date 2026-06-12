import { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { Fuel, PlugZap, Sun } from "lucide-react";
import { useCockpit } from "../context/CockpitContext";
import { CARDS_AS_OF, CARD_COMBOS, type Listing } from "../data/evData";
import { useCantonTaxes } from "../hooks/useCantonTaxes";
import {
  FUEL_PRICE,
  MAINT_EV_PER_KM,
  MAINT_ICE_PER_KM,
  SOLAR_COST,
  SOLAR_COVER_MAX,
  SOLAR_COVER_MIN,
  chAverageTax,
} from "../utils/costModel";
import { fmtCH } from "../utils/swiss";
import { AnimatedNumber, Fader, Segmented, Stamp } from "./ui";

/* ============================================================================
   EngineCore — the simulation engine, reusable:
   · standalone on /rechenwerk (page provides the Inserat picker)
   · embedded on every /inserat/:id detail page (locked to that listing)

   All inputs (km, ICE comparison, Lade-Mix, PV) live in CockpitContext and
   are persisted — tune them once, every engine on the site agrees.
   Model: see README "The cost model".
   ============================================================================ */

const RAD = Math.PI / 180;

/** Analog gauge: 240° sweep, ruler ticks, spring-loaded needle. */
function Gauge({
  frac,
  max,
  label,
  value,
  red,
  icon,
}: {
  frac: number;
  max: number;
  label: string;
  value: number;
  red?: boolean;
  icon: React.ReactNode;
}) {
  const spring = useSpring(0, { stiffness: 55, damping: 14 });
  useEffect(() => {
    spring.set(Math.min(Math.max(frac, 0), 1));
  }, [frac, spring]);

  const angle = useTransform(spring, (f) => -120 + f * 240);
  const x2 = useTransform(angle, (a) => 100 + 60 * Math.sin(a * RAD));
  const y2 = useTransform(angle, (a) => 112 - 60 * Math.cos(a * RAD));

  const ticks = Array.from({ length: 21 }, (_, i) => {
    const a = -120 + i * 12;
    const major = i % 5 === 0;
    const r1 = major ? 64 : 69;
    return (
      <line
        key={i}
        x1={100 + r1 * Math.sin(a * RAD)}
        y1={112 - r1 * Math.cos(a * RAD)}
        x2={100 + 74 * Math.sin(a * RAD)}
        y2={112 - 74 * Math.cos(a * RAD)}
        stroke="var(--ink)"
        strokeOpacity={major ? 0.7 : 0.25}
        strokeWidth={major ? 2 : 1}
      />
    );
  });

  const labelAt = (f: number, text: string) => {
    const a = (-120 + f * 240) * RAD;
    return (
      <text
        x={100 + 88 * Math.sin(a)}
        y={114 - 88 * Math.cos(a)}
        textAnchor="middle"
        fontSize="8"
        fill="var(--muted-c)"
        className="font-mono"
      >
        {text}
      </text>
    );
  };

  return (
    <div className="border border-line bg-nacht p-4">
      <svg viewBox="0 0 200 150" className="w-full" aria-hidden>
        {ticks}
        {labelAt(0, "0")}
        {labelAt(0.5, fmtCH(max / 2))}
        {labelAt(1, fmtCH(max))}
        <motion.line
          x1={100}
          y1={112}
          x2={x2}
          y2={y2}
          stroke={red ? "var(--signal)" : "var(--ink)"}
          strokeWidth={2.5}
        />
        <circle cx="100" cy="112" r="5" fill={red ? "var(--signal)" : "var(--ink)"} />
        <circle cx="100" cy="112" r="2" fill="var(--nacht)" />
      </svg>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
        <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
          {icon}
          {label}
        </span>
        <span
          className={`font-mono text-lg font-bold tabular ${red ? "text-signal" : "text-ink"}`}
        >
          CHF <AnimatedNumber value={value} />
        </span>
      </div>
    </div>
  );
}

export default function EngineCore({
  listing,
  children,
}: {
  listing: Listing;
  /** Optional extra content rendered at the top of the input column —
   *  the /rechenwerk page injects its Inserat picker here. */
  children?: React.ReactNode;
}) {
  const {
    tariff,
    tariffLabel,
    gemeinde,
    annualKm,
    setAnnualKm,
    iceConsumption,
    setIceConsumption,
    publicShare,
    setPublicShare,
    pv,
    setPv,
  } = useCockpit();
  const { taxes: cantonTaxes, year: taxYear } = useCantonTaxes();

  /** Manual charging-card override; null → cheapest combo auto-selected. */
  const [comboChoice, setComboChoice] = useState<string | null>(null);

  /* ---- The model ---------------------------------------------------------- */
  const kwhYear = (annualKm / 100) * listing.consumption;
  const publicKwh = kwhYear * (publicShare / 100);
  const homeKwh = kwhYear - publicKwh;
  const homeCost = homeKwh * tariff;

  const combos = CARD_COMBOS.map((c) => ({
    ...c,
    publicCost: c.monthly * 12 + Math.max(0, publicKwh - c.inclKwh) * c.perKwh,
  }));
  const cheapest = combos.reduce((a, b) => (b.publicCost < a.publicCost ? b : a));
  const chosen = combos.find((c) => c.id === comboChoice) ?? cheapest;

  const evEnergy = homeCost + chosen.publicCost;
  const fuelEnergy = (annualKm / 100) * iceConsumption * FUEL_PRICE;
  // Maintenance & wear: EVs run ~30–35 % cheaper (TCS/ADAC) — scales with km.
  const maintIce = annualKm * MAINT_ICE_PER_KM;
  const maintEv = annualKm * MAINT_EV_PER_KM;
  const maintSavings = maintIce - maintEv;
  // Cantonal Verkehrssteuer from the fixed PLZ's canton: CURRENT-YEAR values
  // from the backend config (no projection — the operator switches the
  // config when rules change). Can be NEGATIVE (e.g. AR).
  const cantonCode = gemeinde && gemeinde.canton !== "CH" ? gemeinde.canton : null;
  const tax = (cantonCode && cantonTaxes[cantonCode]) || chAverageTax(cantonTaxes);
  const taxSavings = tax.ice - tax.ev;
  // The gauges compare full running costs: energy + maintenance + tax.
  const fuelTotal = fuelEnergy + maintIce + tax.ice;
  const evTotal = evEnergy + maintEv + tax.ev;
  const savings = fuelTotal - evTotal;
  const gaugeMax = Math.max(
    500,
    Math.ceil((Math.max(fuelTotal, evTotal) * 1.25) / 500) * 500,
  );

  const solarRate = Math.max(0, tariff - SOLAR_COST);
  const solarLow = homeKwh * SOLAR_COVER_MIN * solarRate;
  const solarHigh = homeKwh * SOLAR_COVER_MAX * solarRate;
  const showSolar = pv === "ja" && homeKwh > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(320px,1fr)_1.6fr]">
      {/* ---- Inputs ---------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="panel space-y-7 p-6"
      >
        {children}

        <Fader
          label="Jahresfahrleistung"
          value={annualKm}
          min={5000}
          max={40000}
          step={500}
          unit="km"
          onChange={setAnnualKm}
        />
        <Fader
          label="Dein Verbrenner heute"
          value={iceConsumption}
          min={4}
          max={12}
          step={0.1}
          unit="L/100km"
          format={(v) => v.toFixed(1)}
          onChange={setIceConsumption}
        />

        {/* Lade-Mix fader: left = all home, right = all public */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Lade-Mix
            </span>
            <span className="font-mono text-sm text-ink tabular">
              {100 - publicShare} %{" "}
              <span className="text-[10px] text-muted">ZUHAUSE</span>
              <span className="mx-1 text-muted">·</span>
              {publicShare} %{" "}
              <span className="text-[10px] text-muted">UNTERWEGS</span>
            </span>
          </div>
          <input
            type="range"
            className="fader"
            min={0}
            max={100}
            step={5}
            value={publicShare}
            style={{ "--val": `${publicShare}%` } as React.CSSProperties}
            onChange={(e) => setPublicShare(Number(e.target.value))}
            aria-label="Lade-Mix: Anteil unterwegs geladen"
          />
          <div className="ruler mt-1.5" aria-hidden />
          <div className="mt-1.5 flex justify-between font-mono text-[8px] tracking-[0.15em] text-muted/60">
            <span>← 100 % ZUHAUSE</span>
            <span>100 % UNTERWEGS →</span>
          </div>
        </div>

        {/* PV block — toggle only; the potential is a range, not a dial */}
        <div className="border border-dashed border-line p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              <Sun size={13} className={pv === "ja" ? "text-warn" : ""} />
              PV-Anlage zuhause
            </span>
            <Segmented
              options={[
                { key: "ja" as const, label: "JA" },
                { key: "nein" as const, label: "NEIN" },
              ]}
              value={pv}
              onChange={setPv}
            />
          </div>
          {pv === "ja" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="overflow-hidden"
            >
              {showSolar ? (
                <div className="pt-4">
                  <div className="border border-warn/40 bg-warn/[0.05] px-4 py-3">
                    <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
                      Zusätzliches Sparpotenzial
                    </div>
                    <div className="stretch-wide mt-1 text-2xl font-extrabold text-warn tabular">
                      + CHF <AnimatedNumber value={solarLow} /> –{" "}
                      <AnimatedNumber value={solarHigh} />
                      <span className="ml-1 text-xs font-normal text-muted">/ Jahr</span>
                    </div>
                  </div>
                  <p className="mt-3 font-mono text-[9px] leading-relaxed tracking-[0.1em] text-muted/70">
                    JE NACH PV-LEISTUNG & ÜBERSCHUSSLADEN DECKT SOLAR{" "}
                    {SOLAR_COVER_MIN * 100}–{SOLAR_COVER_MAX * 100} % DEINER
                    HEIMLADUNG ({fmtCH(homeKwh)} KWH/JAHR). JEDE SOLAR-KWH SPART
                    DEINEN TARIF ({fmtCH(tariff * 100, 1)} RP) MINUS
                    EINSPEISEVERGÜTUNG ({fmtCH(SOLAR_COST * 100)} RP).
                  </p>
                </div>
              ) : (
                <p className="pt-4 font-mono text-[9px] leading-relaxed tracking-[0.1em] text-warn">
                  DEIN LADE-MIX ENTHÄLT KEINE HEIMLADUNG — SOLAR BRINGT IN
                  DIESEM SZENARIO NICHTS.
                </p>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* ---- Results ---------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, delay: 0.12 }}
        className="panel bg-blueprint p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Gauge
            frac={fuelTotal / gaugeMax}
            max={gaugeMax}
            label="Benziner / Jahr"
            value={fuelTotal}
            icon={<Fuel size={12} />}
          />
          <Gauge
            frac={evTotal / gaugeMax}
            max={gaugeMax}
            label="E-Auto / Jahr"
            value={evTotal}
            red
            icon={<PlugZap size={12} />}
          />
        </div>

        {/* Cost breakdown */}
        <div className="mt-4 space-y-px bg-line font-mono text-[10px] tracking-[0.12em]">
          <div className="flex items-baseline justify-between bg-nacht px-4 py-2.5">
            <span className="text-muted">
              ZUHAUSE ({tariffLabel.toUpperCase()}, {fmtCH(tariff * 100, 1)} RP)
            </span>
            <span className="text-ink tabular">
              {fmtCH(homeKwh)} KWH → CHF <AnimatedNumber value={homeCost} />
            </span>
          </div>
          <div className="flex items-baseline justify-between bg-nacht px-4 py-2.5">
            <span className="text-muted">
              UNTERWEGS · {chosen.primary.toUpperCase()}
            </span>
            <span className="text-ink tabular">
              {fmtCH(publicKwh)} KWH → CHF{" "}
              <AnimatedNumber value={chosen.publicCost} />
            </span>
          </div>
        </div>

        {/* Maintenance & wear — the quiet EV advantage (TCS/ADAC: ~−35 %) */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border border-line bg-nacht px-4 py-3 font-mono text-[10px] tracking-[0.12em]">
          <span className="text-muted">
            WARTUNG & SERVICE{" "}
            <span className="text-muted/60">(KEIN ÖL, KEINE ZÜNDKERZEN, REKU SCHONT BREMSEN)</span>
          </span>
          <span className="flex items-center gap-3 tabular">
            <span className="text-muted">
              BENZINER CHF <AnimatedNumber value={maintIce} />
            </span>
            <span className="text-muted">→</span>
            <span className="text-ink">
              E-AUTO CHF <AnimatedNumber value={maintEv} />
            </span>
            <span className="text-lume">
              −CHF <AnimatedNumber value={maintSavings} />
            </span>
          </span>
        </div>

        {/* Cantonal Verkehrssteuer — from the fixed PLZ's canton */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border border-line bg-nacht px-4 py-3 font-mono text-[10px] tracking-[0.12em]">
          <span className="text-muted">
            VERKEHRSSTEUER {taxYear}{" "}
            {cantonCode ? (
              <span className="text-ink">KT. {cantonCode}</span>
            ) : (
              <span className="text-muted/60">CH-MITTEL — PLZ FIXIEREN FÜR DEINEN KANTON</span>
            )}
          </span>
          <span className="flex items-center gap-3 tabular">
            <span className="text-muted">
              BENZINER CHF <AnimatedNumber value={tax.ice} />
            </span>
            <span className="text-muted">→</span>
            <span className="text-ink">
              E-AUTO CHF <AnimatedNumber value={tax.ev} />
            </span>
            <span className={taxSavings >= 0 ? "text-lume" : "text-warn"}>
              {taxSavings >= 0 ? "−" : "+"}CHF{" "}
              <AnimatedNumber value={Math.abs(taxSavings)} />
            </span>
          </span>
        </div>

        {/* Charging-card mini-matrix — cheapest stamped, click to override */}
        <div className="mt-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted">
              Ladekarte für unterwegs
            </span>
            {chosen.id !== cheapest.id && (
              <button
                onClick={() => setComboChoice(null)}
                className="font-mono text-[9px] tracking-[0.15em] text-signal hover:underline"
              >
                ZUR EMPFEHLUNG ZURÜCK
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {combos.map((c) => {
              const isChosen = c.id === chosen.id;
              const isBest = c.id === cheapest.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setComboChoice(c.id)}
                  className={`flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 border px-4 py-2.5 text-left font-mono transition-colors duration-200 ${
                    isChosen
                      ? "border-signal bg-signal/[0.07]"
                      : "border-line bg-nacht hover:border-signal/50"
                  }`}
                >
                  <span className="flex flex-col">
                    <span className="flex items-center gap-3 text-xs text-ink">
                      {c.primary} + {c.secondary}
                      {isBest && (
                        <Stamp className="!px-1.5 !py-0 text-[8px]">Empfohlen</Stamp>
                      )}
                    </span>
                    <span className="text-[8px] tracking-[0.15em] text-muted/70">
                      {c.network.toUpperCase()}
                    </span>
                  </span>
                  <span className="text-[10px] tracking-[0.1em] text-muted">
                    {c.monthly === 0 ? "0.—" : c.monthly.toFixed(2)}/MT ·{" "}
                    {c.perKwh.toFixed(2)}/KWH ·{" "}
                    <span className={`tabular ${isChosen ? "text-signal" : "text-ink"}`}>
                      CHF {fmtCH(c.publicCost)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 font-mono text-[8px] tracking-[0.12em] text-muted/60">
            ANBIETER-TARIFE STAND {CARDS_AS_OF} — DETAILS & TAGESPREISE IN DEN
            ANBIETER-APPS.
          </p>
        </div>

        {/* Savings delta */}
        <div
          className={`mt-4 border px-6 py-5 ${
            savings >= 0
              ? "border-lume/40 bg-lume/[0.05]"
              : "border-warn/40 bg-warn/[0.05]"
          }`}
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
                {savings >= 0 ? "Ersparnis mit diesem Inserat" : "Mehrkosten"}
              </div>
              <div
                className={`stretch-wide mt-1 text-4xl font-black tabular sm:text-5xl ${
                  savings >= 0 ? "text-lume" : "text-warn"
                }`}
              >
                CHF <AnimatedNumber value={Math.abs(savings)} />
                <span className="ml-2 text-base font-normal text-muted">/ Jahr</span>
              </div>
            </div>
            <div className="font-mono text-[10px] leading-relaxed tracking-[0.12em] text-muted">
              <div>
                ÜBER 10 JAHRE (ENERGIE + WARTUNG):{" "}
                <span className="text-ink tabular">
                  CHF{" "}
                  <AnimatedNumber
                    value={Math.abs(fuelEnergy - evEnergy + maintSavings) * 10}
                  />
                </span>
              </div>
              <div className="mt-1">
                ENERGIE:{" "}
                <span className="text-ink tabular">
                  CHF <AnimatedNumber value={fuelEnergy - evEnergy} />
                </span>{" "}
                · WARTUNG:{" "}
                <span className="text-ink tabular">
                  CHF <AnimatedNumber value={maintSavings} />
                </span>{" "}
                · STEUER {taxYear}:{" "}
                <span className={`tabular ${taxSavings >= 0 ? "text-ink" : "text-warn"}`}>
                  {taxSavings < 0 && "−"}CHF{" "}
                  <AnimatedNumber value={Math.abs(taxSavings)} />
                </span>
              </div>
              {showSolar && (
                <div className="mt-1 text-warn">
                  MIT SOLAR ZUSÄTZLICH: +{" "}
                  <span className="tabular">
                    CHF <AnimatedNumber value={solarLow} /> –{" "}
                    <AnimatedNumber value={solarHigh} />
                  </span>
                  /JAHR
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 font-mono text-[9px] tracking-[0.12em] text-muted/70">
          ENERGIE + WARTUNG + VERKEHRSSTEUER FÜR {listing.brand} {listing.model}{" "}
          ({listing.consumption.toFixed(1)} KWH/100KM). WARTUNG NACH TCS/ADAC
          (~35 % GÜNSTIGER); STEUER: AKTUELLE {taxYear}ER-WERTE, TYPISCHE
          MITTELKLASSE JE KANTON. VERSICHERUNG NICHT EINGERECHNET.
        </p>
      </motion.div>
    </div>
  );
}
