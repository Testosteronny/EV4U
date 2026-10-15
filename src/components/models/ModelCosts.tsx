import { useMemo } from "react";
import { FahrprofilLink } from "../layout/Fahrprofil";
import { useCockpit } from "../../hooks/useCockpit";
import { useCostsMap } from "../../hooks/useCosts";
import { FUELS } from "../../utils/costModel";
import { fmtCH } from "../../utils/swiss";
import type { Listing, Segment } from "../../data/evData";

/* ============================================================================
   Running costs of every variant of a model, with the visitor's Fahrprofil
   — the same `computeCosts` as on every listing, fed with catalog values.
   ============================================================================ */

export type CostVariant = {
  slug: string;
  name: string;
  consumption: number;
  weightKg: number | null;
  battery: number;
  range: number;
  seats: number;
};

export default function ModelCosts({
  brand,
  model,
  segment,
  variants,
}: {
  brand: string;
  model: string;
  segment: Segment;
  variants: CostVariant[];
}) {
  const { currentFuel, hydrated, gemeinde } = useCockpit();
  // A catalog variant in the shape of a listing: only the fields the cost
  // model reads (consumption, weight) matter.
  const pseudo = useMemo<Listing[]>(
    () =>
      variants.map((v) => ({
        id: v.slug,
        brand,
        model,
        segment,
        year: 2026,
        km: 0,
        price: 0,
        range: v.range,
        consumption: v.consumption,
        chargeMin: null,
        dcKw: null,
        battery: v.battery,
        weightKg: v.weightKg ?? undefined,
        soh: 100,
        bidi: false,
        seats: v.seats,
        postedDays: 0,
        seller: "",
        sellerType: "PRIVAT",
        ort: "",
        status: "AKTIV",
        note: "",
      })),
    [variants, brand, model, segment],
  );
  const costs = useCostsMap(pseudo);
  const fuel = FUELS[currentFuel];
  const compare = currentFuel !== "ELEKTRO";

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-body">
          <thead>
            <tr className="border-b border-line text-small text-fg2">
              <th className="py-2 pr-4 font-semibold">Variante</th>
              <th className="py-2 pr-4 text-right font-semibold">Verbrauch</th>
              <th className="py-2 pr-4 text-right font-semibold">Betrieb/Mt.</th>
              {compare && <th className="py-2 text-right font-semibold">gegen dein {fuel.label}</th>}
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const c = costs.get(v.slug);
              if (!c) return null;
              return (
                <tr key={v.slug} className="border-b border-line last:border-b-0">
                  <td className="py-2.5 pr-4 text-fg">{v.name}</td>
                  <td className="py-2.5 pr-4 text-right text-fg2 tabular">{fmtCH(v.consumption, 1)} kWh/100 km</td>
                  <td className="py-2.5 pr-4 text-right font-semibold text-fg tabular">CHF {fmtCH(c.evTotal / 12)}</td>
                  {compare && (
                    <td
                      className={`py-2.5 text-right font-semibold tabular ${c.savings >= 0 ? "text-accent" : "text-caution"}`}
                    >
                      {c.savings >= 0 ? "−" : "+"}CHF {fmtCH(Math.abs(c.savings))}/Jahr
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-small text-fg3">
        Strom, Wartung und Verkehrssteuer
        {hydrated && gemeinde ? ` für ${gemeinde.name}` : " mit dem Schweizer Mediantarif"}.{" "}
        <FahrprofilLink />
      </p>
    </div>
  );
}
