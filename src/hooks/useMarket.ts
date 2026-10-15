import { useMemo } from "react";
import { useCockpit } from "./useCockpit";
import { useCostsMap } from "./useCosts";
import { usePlzResolver } from "./usePlzResolver";
import { plzOf } from "../lib/listingFacts";
import type { FilterContext } from "../lib/filters";
import type { Listing } from "../data/evData";

/* ============================================================================
   useMarket — the two numbers a card needs that depend on the visitor:

   · Betrieb pro Monat: energy at your tariff + maintenance + cantonal tax,
     from the one cost model (computeCosts → evTotal / 12).
   · Entfernung: straight line between your PLZ and the listing's PLZ, from
     the LV95 coordinates in the baked PLZ map (km = metres / 1000).

   Returned as maps for the cards and as a FilterContext, so the «Betrieb
   bis» and «Umkreis» filters and the matching sorts use the very same
   numbers the cards show.
   ============================================================================ */

export type Market = {
  monthly: Map<string, number>;
  distance: Map<string, number>;
  ctx: FilterContext;
  /** The point distances are measured from (null: no PLZ known). */
  origin: { zip: string; name: string } | null;
};

/** @param originPlz A PLZ from the URL (`plz=`) — else the Fahrprofil's. */
export function useMarket(listings: Listing[], originPlz?: string | null): Market {
  const costs = useCostsMap(listings);
  const { gemeinde, hydrated } = useCockpit();

  const wantPlz = originPlz || (hydrated ? gemeinde?.zip : null) || null;
  // Load the PLZ map only when there is something to measure from.
  const resolve = usePlzResolver(Boolean(wantPlz));

  const origin = useMemo(() => {
    if (!wantPlz) return null;
    if (!originPlz && gemeinde && !gemeinde.estimated) return gemeinde;
    const g = resolve?.(wantPlz);
    return g && !g.estimated ? g : null;
  }, [wantPlz, originPlz, gemeinde, resolve]);

  const key = listings.map((l) => l.id).join(",");

  const distance = useMemo(() => {
    const m = new Map<string, number>();
    if (!origin || !resolve) return m;
    for (const l of listings) {
      const plz = plzOf(l);
      const p = plz ? resolve(plz) : null;
      if (!p || p.estimated) continue;
      m.set(l.id, Math.round(Math.hypot(p.e - origin.e, p.n - origin.n) / 1000));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, origin, resolve]);

  const monthly = useMemo(() => {
    const m = new Map<string, number>();
    for (const [id, c] of costs) m.set(id, c.evTotal / 12);
    return m;
  }, [costs]);

  const ctx = useMemo<FilterContext>(
    () => ({
      monthly: (l) => monthly.get(l.id) ?? null,
      distance: (l) => distance.get(l.id) ?? null,
    }),
    [monthly, distance],
  );

  return {
    monthly,
    distance,
    ctx,
    origin: origin ? { zip: origin.zip, name: origin.name } : null,
  };
}
