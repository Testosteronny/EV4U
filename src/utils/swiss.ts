import meta from "../data/tariffMeta.json";

/* ============================================================================
   Swiss helpers — ZIP→Gemeinde→tariff resolution + CH number formatting.

   The tariff data is baked from official open data by `npm run fetch:tariffs`:
   · ElCom (federal regulator) tariff cube on LINDAS — category H4 household,
     standard product, total in Rp./kWh (excl. VAT), median across operators.
   · swisstopo AMTOVZ locality directory — PLZ, canton, LV95 coordinates,
     BFS municipality number.

   Only the dataset metadata ships with every page. The PLZ map itself
   (~170 KB, 3'172 entries) lives in `plzResolver.ts` and is loaded on
   demand via `loadPlzResolver()` — when the visitor types a postcode, or
   once for a stored postcode that has no resolved place yet. The resolved
   place is persisted in the cockpit, so a returning visitor never needs it.
   ============================================================================ */

export type GemeindeInfo = {
  zip: string;
  name: string;
  canton: string;
  /** Local household electricity tariff in CHF / kWh (ElCom H4, excl. VAT). */
  tariff: number;
  /** LV95 survey coordinates of the locality (m). */
  e: number;
  n: number;
  /** True when the CH median is used (tier 3). */
  estimated: boolean;
  /** Set when resolved via neighbourhood vote (tier 2): the address PLZ the
   *  tariff was taken from, e.g. "3006" for the Postfach-PLZ 3000. */
  via?: string;
};

/** Dataset metadata for UI footnotes: period, counts, source. */
export const TARIFF_META = meta;

/** Swiss median household tariff (ElCom, latest period) in CHF/kWh — the
 *  instrument's zero point before a location is fixed. */
export const CH_AVG_TARIFF = meta.chMedianRp / 100;

export type ZipResolver = (raw: string) => GemeindeInfo | null;

let resolver: ZipResolver | null = null;
let loading: Promise<ZipResolver> | null = null;

/** The resolver if it has already been loaded, else null. */
export function plzResolverIfLoaded(): ZipResolver | null {
  return resolver;
}

/** Load the PLZ map (once; concurrent callers share the request). */
export function loadPlzResolver(): Promise<ZipResolver> {
  loading ??= import("./plzResolver")
    .then((m) => (resolver = m.resolveZip))
    .catch((err: unknown) => {
      loading = null; // let the next caller retry, e.g. after a flaky network
      throw err;
    });
  return loading;
}

/** All PLZ coordinates (loads the same lazy chunk as the resolver). */
export async function loadPlzPoints(): Promise<{ e: number; n: number }[]> {
  return (await import("./plzResolver")).allPlzPoints();
}

/** Resolve a Swiss 4-digit ZIP, loading the PLZ map first if needed. */
export async function resolveZip(raw: string): Promise<GemeindeInfo | null> {
  return (await loadPlzResolver())(raw);
}

/** Swiss number formatting: 18'420.50 */
export function fmtCH(n: number, dec = 0): string {
  const fixed = Math.abs(n).toFixed(dec);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  const sign = n < 0 ? "−" : "";
  return frac ? `${sign}${grouped}.${frac}` : `${sign}${grouped}`;
}
