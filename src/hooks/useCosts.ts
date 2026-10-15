import { useMemo } from "react";
import { useCockpit } from "./useCockpit";
import { useCantonTaxes } from "./useCantonTaxes";
import { chAverageTax, computeCosts, type CostResult } from "../utils/costModel";
import type { Listing } from "../data/evData";

/* ============================================================================
   useCosts — «Deine Werte» + ein Inserat = die Rechnung.

   Die einzige Stelle, an der der Kontext der Kontextleiste in das Kostenmodell
   fliesst. Vorher hat jede Oberfläche (Engine, Seitenleiste, Vergleich) sich
   ihre Eingaben selbst zusammengesucht und die Formel neu getippt.
   ============================================================================ */

export function useCosts(
  listing: Listing | null | undefined,
  comboId?: string | null,
): CostResult | null {
  const { tariff, annualKm, currentFuel, currentCons, elecShare, publicShare, pv, gemeinde } =
    useCockpit();
  const { taxes } = useCantonTaxes();

  // "CH" ist der Platzhalter-Kanton der geschätzten PLZ (Tier 3) — dort gilt
  // das Schweizer Mittel, nicht der Tarif eines echten Kantons.
  const cantonCode = gemeinde && gemeinde.canton !== "CH" ? gemeinde.canton : null;
  const cantonTax = useMemo(
    () => (cantonCode && taxes[cantonCode]) || chAverageTax(taxes),
    [cantonCode, taxes],
  );

  return useMemo(
    () =>
      listing
        ? computeCosts(listing, {
            tariff,
            annualKm,
            fuel: currentFuel,
            cons: currentCons,
            elecShare,
            publicShare,
            cantonTax,
            comboId,
            pv: pv === "ja",
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listing, tariff, annualKm, currentFuel, currentCons, elecShare, publicShare, cantonTax, comboId, pv],
  );
}

/** Same model, but for a whole list — the compare table. Keyed by listing id. */
export function useCostsMap(listings: Listing[]): Map<string, CostResult> {
  const { tariff, annualKm, currentFuel, currentCons, elecShare, publicShare, pv, gemeinde } =
    useCockpit();
  const { taxes } = useCantonTaxes();

  const cantonCode = gemeinde && gemeinde.canton !== "CH" ? gemeinde.canton : null;
  const cantonTax = useMemo(
    () => (cantonCode && taxes[cantonCode]) || chAverageTax(taxes),
    [cantonCode, taxes],
  );

  // Auf die IDs memoisieren, nicht auf das Array: die Aufrufer bauen die
  // Liste bei jedem Render neu, ein Array-Vergleich träfe daher nie zu.
  const key = listings.map((l) => l.id).join(",");

  return useMemo(
    () =>
      new Map(
        listings.map((l) => [
          l.id,
          computeCosts(l, {
            tariff,
            annualKm,
            fuel: currentFuel,
            cons: currentCons,
            elecShare,
            publicShare,
            cantonTax,
            pv: pv === "ja",
          }),
        ]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, tariff, annualKm, currentFuel, currentCons, elecShare, publicShare, cantonTax, pv],
  );
}
