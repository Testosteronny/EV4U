import { useMemo } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { ListingThumb } from "../CarGraphic";
import { SectionHeader } from "../ui";
import { useCockpit } from "../../hooks/useCockpit";
import { useListings } from "../../hooks/useListings";
import { CARD_COMBOS, type Listing } from "../../data/evData";
import { useCantonTaxes } from "../../hooks/useCantonTaxes";
import { href } from "../../lib/url";
import {
  FUELS,
  MAINT_EV_PER_KM,
  MAINT_ICE_PER_KM,
  REF_WEIGHT_KG,
  cantonTaxFor,
  chAverageTax,
  currentCarEnergy,
} from "../../utils/costModel";
import { fmtCH } from "../../utils/swiss";

/* ============================================================================
   /vergleich — listing-level comparison (not model-level): the cars on the
   tray side by side, including the computed running cost per year (energy +
   maintenance) at the visitor's tariff and Lade-Mix. Shareable via
   ?ids=a,b,c. The best value per row is marked in lume.
   Not in the top nav — entered via the CompareTray (appears once cars are
   picked on the Markt-Tafel) or a shared ?ids= URL.
   ============================================================================ */

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
    label: "ERSPARNIS VS. DEIN AUTO *",
    value: (_, c) => `CHF ${fmtCH(c.savings)}`,
    num: (_, c) => c.savings,
    best: "max",
  },
  { label: "ANBIETER", value: (l) => `${l.sellerType} · ${l.ort.toUpperCase()}`, num: () => 0 },
];

export default function VergleichPage() {
  const {
    compareIds,
    toggleCompare,
    gemeinde,
    tariff,
    tariffLabel,
    annualKm,
    currentFuel,
    currentCons,
    publicShare,
  } = useCockpit();
  const { taxes: cantonTaxes, year: taxYear } = useCantonTaxes();
  const cantonCode = gemeinde && gemeinde.canton !== "CH" ? gemeinde.canton : null;
  const taxCfg = (cantonCode && cantonTaxes[cantonCode]) || chAverageTax(cantonTaxes);

  const { listings } = useListings();
  // URL wins (shareable), tray is the fallback.
  const urlIds =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("ids")?.split(",")
      : undefined;
  const ids = urlIds ?? compareIds;
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
        // Same model as the EngineCore: energy + maintenance + cantonal tax
        // vs. the visitor's CURRENT car — an existing EV carries neither a
        // maintenance nor a tax advantage.
        const isCurrentEv = currentFuel === "ELEKTRO";
        const maintSavings = isCurrentEv
          ? 0
          : annualKm * (MAINT_ICE_PER_KM - MAINT_EV_PER_KM);
        const taxSavings = isCurrentEv
          ? 0
          : cantonTaxFor(l.weightKg ?? REF_WEIGHT_KG, taxCfg).saving;
        return [
          l.id,
          {
            strom100: l.consumption * tariff,
            energyYear,
            savings:
              currentCarEnergy(currentFuel, currentCons, annualKm, tariff) -
              energyYear +
              maintSavings +
              taxSavings,
          } satisfies Calc,
        ];
      }),
    );
  }, [items, annualKm, publicShare, tariff, currentFuel, currentCons, taxCfg]);

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
            WÄHLE 2–3 OFFENE INSERATE (VS-KNOPF IN DER ZEILE) — DER VERGLEICH
            RECHNET SIE MIT DEINEM TARIF DURCH.
          </p>
          <a
            href={href("/inserate")}
            className="mt-6 inline-block border border-signal bg-signal px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-nacht transition-colors hover:bg-signal-dim"
          >
            Zu den Inseraten →
          </a>
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
                      <a
                        href={href(`/inserat/${l.id}`)}
                        className="stretch-wide text-sm font-extrabold uppercase text-ink hover:text-signal"
                      >
                        <ListingThumb listing={l} className="mb-2 h-12 w-20" />
                        {l.brand}
                        <br />
                        {l.model}
                      </a>
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
            ERSPARNIS VS. DEIN {FUELS[currentFuel].label.toUpperCase()} (
            {currentCons.toFixed(1)} {FUELS[currentFuel].unit.toUpperCase()})
            INKL. WARTUNG & VERKEHRSSTEUER {taxYear}{" "}
            {cantonCode ? `KT. ${cantonCode}` : "(CH-MITTEL)"} (GEWICHTSBASIERT,
            JE AUTO) · ● = BESTWERT
          </div>
        </motion.div>
      )}
    </section>
  );
}
