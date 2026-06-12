import tariffs from "../data/tariffs.json";

/* ============================================================================
   Swiss helpers — real ZIP→Gemeinde→tariff resolution + CH number formatting.

   `tariffs.json` is baked from official open data by `npm run fetch:tariffs`:
   · ElCom (federal regulator) tariff cube on LINDAS — category H4 household,
     standard product, total in Rp./kWh (excl. VAT), median across operators.
   · swisstopo AMTOVZ locality directory — PLZ, canton, LV95 coordinates,
     BFS municipality number.

   Resolution is three-tiered:
   1. Exact match — every address PLZ in Switzerland (3'172 entries).
   2. Inference — Postfach-/Firmen-PLZ (3000 Bern, 2001 Neuchâtel, 8021
      Zürich, …) exist only in the Post's directory, which is no longer
      published as open data. They are always numbered inside their
      municipality's PLZ range, so we resolve them by Post numbering
      convention: near a hundred base (xx00–xx15) → the base municipality;
      otherwise a distance-weighted vote of the address PLZ within ±40.
      The UI discloses which address PLZ the tariff came from.
   3. CH median, stamped GESCHÄTZT — only when nothing is near (typos etc.).
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

type PlzEntry = [name: string, canton: string, rp: number, e: number, n: number, bfs: number];

// JSON imports type tuples as (string | number)[] — narrow via unknown.
const PLZ_MAP = tariffs.plz as unknown as Record<string, PlzEntry>;

/** Dataset metadata for UI footnotes: period, counts, source. */
export const TARIFF_META = tariffs.meta;

/** Swiss median household tariff (ElCom, latest period) in CHF/kWh — the
 *  instrument's zero point before a location is fixed. */
export const CH_AVG_TARIFF = tariffs.meta.chMedianRp / 100;

/** Region label for the rare PLZ that can't even be inferred (tier 3). */
const REGION_BY_PREFIX: Record<string, string> = {
  "1": "Westschweiz",
  "2": "Jura-Region",
  "3": "Mittelland/Wallis",
  "4": "Nordwestschweiz",
  "5": "Aargau-Region",
  "6": "Zentralschweiz/TI",
  "7": "Graubünden",
  "8": "Zürich-Region",
  "9": "Ostschweiz",
};

function fromEntry(zip: string, entry: PlzEntry, via?: string): GemeindeInfo {
  const [name, canton, rp, e, n] = entry;
  return { zip, name, canton, tariff: rp / 100, e, n, estimated: false, via };
}

/* Sorted numeric PLZ index, built lazily for tier-2 inference. */
let PLZ_INDEX: number[] | null = null;

function plzIndex(): number[] {
  if (!PLZ_INDEX) {
    PLZ_INDEX = Object.keys(PLZ_MAP).map(Number).sort((a, b) => a - b);
  }
  return PLZ_INDEX;
}

const asKey = (n: number) => String(n).padStart(4, "0");

/** Base rule: Fach-PLZ numbered close to a hundred base (xx00–xx15) belong
 *  to the municipality holding that base — 2001–2010 → 2000 Neuchâtel,
 *  3000–3003 → Bern (3004+), 1200 → Genève (1201+). Returns the highest
 *  mapped PLZ below the target within its hundred, else the lowest above. */
function inferFromHundredBase(zipNum: number): number | null {
  const base = zipNum - (zipNum % 100);
  let below: number | null = null;
  let above: number | null = null;
  for (const cand of plzIndex()) {
    if (cand < base || cand > base + 99) continue;
    if (cand < zipNum) below = cand; // index is sorted → ends at the highest
    else if (cand > zipNum && above === null) above = cand;
  }
  return below ?? above;
}

/** Neighbourhood vote: address PLZ within ±40 in the same thousand block
 *  vote for their municipality, weighted by 1/(1+distance). Handles
 *  interleaved Fach-PLZ (8021/8022 Zürich, 3030 Bern, 6341 Baar). */
function inferFromNeighbours(zipNum: number): number | null {
  const block = Math.floor(zipNum / 1000);
  const votes = new Map<number, { score: number; zip: number; dist: number }>();

  for (const cand of plzIndex()) {
    const dist = Math.abs(cand - zipNum);
    if (dist === 0 || dist > 40) continue;
    if (Math.floor(cand / 1000) !== block) continue; // Fach-PLZ never cross blocks
    const bfs = PLZ_MAP[asKey(cand)][5];
    const weight = 1 / (1 + dist);
    const v = votes.get(bfs);
    if (v) {
      v.score += weight;
      if (dist < v.dist) {
        v.dist = dist;
        v.zip = cand;
      }
    } else {
      votes.set(bfs, { score: weight, zip: cand, dist });
    }
  }

  let best: { score: number; zip: number; dist: number } | null = null;
  for (const v of votes.values()) {
    if (!best || v.score > best.score) best = v;
  }
  return best ? best.zip : null;
}

/** Tier 2: resolve a non-address PLZ (Postfach/Firmen/intern). Strategy by
 *  Post numbering convention, each falling back to the other. */
function inferZip(zipNum: number): { zip: string; entry: PlzEntry } | null {
  const nearBase = zipNum % 100 <= 15;
  const via = nearBase
    ? (inferFromHundredBase(zipNum) ?? inferFromNeighbours(zipNum))
    : (inferFromNeighbours(zipNum) ?? inferFromHundredBase(zipNum));
  if (via === null) return null;
  const zip = asKey(via);
  return { zip, entry: PLZ_MAP[zip] };
}

/** Resolve a Swiss 4-digit ZIP. See the tier description above. */
export function resolveZip(raw: string): GemeindeInfo | null {
  const zip = raw.trim();
  if (!/^\d{4}$/.test(zip)) return null;

  // Tier 1 — exact address PLZ.
  const hit = PLZ_MAP[zip];
  if (hit) return fromEntry(zip, hit);

  // Tier 2 — Postfach-/Sonder-PLZ via base rule / neighbourhood vote.
  const inferred = inferZip(parseInt(zip, 10));
  if (inferred) return fromEntry(zip, inferred.entry, inferred.zip);

  // Tier 3 — CH median, flagged as estimate.
  const region = REGION_BY_PREFIX[zip[0]];
  if (!region) return null;
  return {
    zip,
    name: region,
    canton: "CH",
    tariff: CH_AVG_TARIFF,
    e: 2_660_000,
    n: 1_190_000,
    estimated: true,
  };
}

/** Format LV95 coordinates for the survey stamp: 2'683'368 / 1'247'416 */
export function lv95(g: GemeindeInfo): string {
  return `${fmtCH(g.e)} / ${fmtCH(g.n)}`;
}

/** Swiss number formatting: 18'420.50 */
export function fmtCH(n: number, dec = 0): string {
  const fixed = Math.abs(n).toFixed(dec);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  const sign = n < 0 ? "−" : "";
  return frac ? `${sign}${grouped}.${frac}` : `${sign}${grouped}`;
}
