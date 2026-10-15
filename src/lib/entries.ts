import { DEFAULT_FILTERS, filterParams, passes, type Filters } from "./filters";
import { href } from "./url";
import { SEGMENT_LABEL } from "../utils/format";
import type { Listing } from "../data/evData";

/* ============================================================================
   Einstiege in die Suche — Karosserie, Budget, Themen.

   Dieselben Einstiege stehen im Kaufen-Menü, als Chips auf der Startseite
   und im Footer. Jeder ist nur ein Filter-Patch: er führt in die normale
   Ergebnisseite, wo er als entfernbarer Chip steht und sich weiter
   verfeinern lässt.
   ============================================================================ */

export type Entry = { label: string; filter: Partial<Filters> };

export const BODY_ENTRIES: Entry[] = [
  { label: SEGMENT_LABEL.KOMPAKT, filter: { seg: "KOMPAKT" } },
  { label: SEGMENT_LABEL.LIMOUSINE, filter: { seg: "LIMOUSINE" } },
  { label: SEGMENT_LABEL.KOMBI, filter: { seg: "KOMBI" } },
  { label: SEGMENT_LABEL.SUV, filter: { seg: "SUV" } },
  { label: "7 Sitze", filter: { sitze: 7 } },
];

export const BUDGET_ENTRIES: Entry[] = [
  { label: "bis 15'000", filter: { preis: 15000 } },
  { label: "15–25'000", filter: { preisvon: 15000, preis: 25000 } },
  { label: "25–40'000", filter: { preisvon: 25000, preis: 40000 } },
  { label: "über 40'000", filter: { preisvon: 40000 } },
];

export const TOPIC_ENTRIES: Entry[] = [
  { label: "500+ km Reichweite", filter: { reichweite: 500 } },
  { label: "Schnelllader 150+ kW", filter: { laden: 150 } },
  { label: "Batteriegarantie aktiv", filter: { garantie: true } },
  { label: "Anhängerkupplung", filter: { ahk: true } },
  { label: "800 V", filter: { v800: true } },
  { label: "Strom zurückgeben (V2L)", filter: { v2l: true } },
];

/** /inserate URL for a filter patch. */
export function searchHref(filter: Partial<Filters>, extra?: Record<string, string>): string {
  const sp = filterParams(filter);
  for (const [k, v] of Object.entries(extra ?? {})) sp.set(k, v);
  const qs = sp.toString();
  return `${href("/inserate")}${qs ? `?${qs}` : ""}`;
}

/** How many listings an entry would show. */
export function entryCount(listings: Listing[], filter: Partial<Filters>): number {
  const f = { ...DEFAULT_FILTERS, ...filter };
  return listings.filter((l) => passes(l, f)).length;
}
