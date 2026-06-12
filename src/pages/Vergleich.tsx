import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { SectionHeader } from "../components/ui";
import { useCockpit } from "../context/CockpitContext";
import { useListings } from "../context/ListingsContext";
import { CARD_COMBOS, type Listing } from "../data/evData";
import { fmtCH } from "../utils/swiss";

/* ============================================================================
   /vergleich — listing-level comparison (not model-level): the cars on the
   tray side by side, including the computed energy cost per year at the
   visitor's tariff and Lade-Mix. Shareable via ?ids=a,b,c. The best value
   per row is marked in lume.
   ============================================================================ */

const FUEL_PRICE = 1.78;

type Row = {
  label: string;
  value: (l: Listing, calc: Calc) => string;
  num: (l: Listing, calc: Calc) => number;
  /** Which direction wins this row; undefined → no winner highlight. */
  best?: "min" | "max";
};

type Calc = { strom100: number; energyYear: number; savings: number };

const ROWS: Row[] = [
  { label: "PREIS CHF", value: (l) => fmtCH(l.price), num: (l) => l.price, best: "min" },
  {
    label: "VS. NEUPREIS",
    value: (l) =>
      l.priceNew && l.priceNew > l.price
        ? `−${Math.round((1 - l.price / l.priceNew) * 100)} % (NEU ${fmtCH(l.priceNew)})`
        : "—",
    num: (l) => (l.priceNew ? 1 - l.price / l.priceNew : 0),
    best: "max",
  },
  { label: "JAHRGANG", value: (l) => `${l.year}`, num: (l) => l.year, best: "max" },
  { label: "KM-STAND", value: (l) => fmtCH(l.km), num: (l) => l.km, best: "min" },
  { label: "SOH BATTERIE", value: (l) => `${l.soh} %`, num: (l) => l.soh, best: "max" },
  { label: "WLTP-REICHWEITE", value: (l) => `${l.range} KM`, num: (l) => l.range, best: "max" },
  {
    label: "VERBRAUCH /100KM",
    value: (l) => `${l.consumption.toFixed(1)} KWH`,
    num: (l) => l.consumption,
    best: "min",
  },
  {
    label: "LADEZEIT 10–80 %",
    value: (l) => `${l.chargeMin} MIN`,
    num: (l) => l.chargeMin,
    best: "min",
  },
  { label: "BATTERIE", value: (l) => `${l.battery} KWH`, num: (l) => l.battery },
  { label: "SITZE", value: (l) => `${l.seats}`, num: (l) => l.seats },
  { label: "V2X", value: (l) => (l.bidi ? "JA" : "—"), num: (l) => (l.bidi ? 1 : 0) },
  {
    label: "STROM /100KM *",
    value: (_, c) => `CHF ${c.strom100.toFixed(2)}`,
    num: (_, c) => c.strom100,
    best: "min",
  },
  {
    label: "ENERGIE /JAHR *",
    value: (_, c) => `CHF ${fmtCH(c.energyYear)}`,
    num: (_, c) => c.energyYear,
    best: "min",
  },
  {
    label: "ERSPARNIS VS. BENZIN *",
    value: (_, c) => `CHF ${fmtCH(c.savings)}`,
    num: (_, c) => c.savings,
    best: "max",
  },
  { label: "ANBIETER", value: (l) => `${l.sellerType} · ${l.ort.toUpperCase()}`, num: () => 0 },
];

export default function Vergleich() {
  const [sp] = useSearchParams();
  const { compareIds, toggleCompare, tariff, tariffLabel, annualKm, iceConsumption, publicShare } =
    useCockpit();

  const { listings } = useListings();
  // URL wins (shareable), tray is the fallback.
  const ids = sp.get("ids")?.split(",") ?? compareIds;
  const items = ids
    .map((id) => listings.find((l) => l.id === id && l.status === "AKTIV"))
    .filter((l): l is Listing => Boolean(l))
    .slice(0, 3);

  const calcs = useMemo(() => {
    return new Map(
      items.map((l) => {
        const kwhYear = (annualKm / 100) * l.consumption;
        const publicKwh = kwhYear * (publicShare / 100);
        const homeCost = (kwhYear - publicKwh) * tariff;
        const publicCost = Math.min(
          ...CARD_COMBOS.map(
            (c) => c.monthly * 12 + Math.max(0, publicKwh - c.inclKwh) * c.perKwh,
          ),
        );
        const energyYear = homeCost + publicCost;
        return [
          l.id,
          {
            strom100: l.consumption * tariff,
            energyYear,
            savings: (annualKm / 100) * iceConsumption * FUEL_PRICE - energyYear,
          } satisfies Calc,
        ];
      }),
    );
  }, [items, annualKm, publicShare, tariff, iceConsumption]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
      <SectionHeader
        index="01"
        title="Vergleich"
        claim={`${items.length} Inserate · Seite an Seite`}
      />

      {items.length < 2 ? (
        <div className="panel mt-10 px-6 py-16 text-center">
          <p className="stretch-wide text-xl font-extrabold uppercase text-ink">
            {items.length === 0 ? "Der Vergleich ist leer." : "Eines ist keines."}
          </p>
          <p className="mt-2 font-mono text-[10px] tracking-[0.15em] text-muted">
            WÄHLE 2–3 OFFENE INSERATE AUF DER MARKT-TAFEL (VS-KNOPF IN DER ZEILE).
          </p>
          <Link
            to="/inserate"
            className="mt-6 inline-block border border-signal bg-signal px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-signal-dim"
          >
            Zur Markt-Tafel →
          </Link>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="panel mt-10 overflow-x-auto"
        >
          <table className="w-full min-w-[640px] border-collapse font-mono">
            <thead>
              <tr className="border-b border-line bg-nacht">
                <th className="px-4 py-4 text-left text-[9px] uppercase tracking-[0.2em] text-muted sm:px-6">
                  Kriterium
                </th>
                {items.map((l) => (
                  <th key={l.id} className="px-4 py-4 text-left sm:px-6">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/inserat/${l.id}`}
                        className="stretch-wide text-sm font-extrabold uppercase text-ink hover:text-signal"
                      >
                        {l.brand}
                        <br />
                        {l.model}
                      </Link>
                      <button
                        onClick={() => toggleCompare(l.id)}
                        title="Entfernen"
                        className="text-muted hover:text-signal"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const nums = items.map((l) => row.num(l, calcs.get(l.id)!));
                const target = row.best
                  ? row.best === "min"
                    ? Math.min(...nums)
                    : Math.max(...nums)
                  : null;
                return (
                  <tr key={row.label} className="border-b border-line/60 last:border-b-0">
                    <td className="px-4 py-3 text-[9px] uppercase tracking-[0.2em] text-muted sm:px-6">
                      {row.label}
                    </td>
                    {items.map((l, i) => {
                      const isBest = target !== null && nums[i] === target;
                      return (
                        <td
                          key={l.id}
                          className={`px-4 py-3 text-sm tabular sm:px-6 ${
                            isBest ? "font-bold text-lume" : "text-ink"
                          }`}
                        >
                          {row.value(l, calcs.get(l.id)!)}
                          {isBest && <span className="ml-1.5 text-[9px]">●</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="bg-nacht px-4 py-3 font-mono text-[9px] tracking-[0.15em] text-muted sm:px-6">
            * MIT DEINEM KONTEXT: TARIF {tariffLabel.toUpperCase()} (
            {fmtCH(tariff * 100, 1)} RP) · {fmtCH(annualKm)} KM/JAHR ·{" "}
            {100 - publicShare} % HEIMLADUNG · GÜNSTIGSTE LADEKARTE JE AUTO ·
            ● = BESTWERT
          </div>
        </motion.div>
      )}
    </section>
  );
}
