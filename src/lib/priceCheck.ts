import type { Listing } from "../data/evData";
import { fold } from "../utils/search";

/* ============================================================================
   Preis-Check (Konzept F8) — what is a used EV worth?

   1. Vergleichsinserate: the same catalog model (or brand + model name for
      cars outside the catalog), first registration within ±3 years, real
      listings only (no demo cars). Each asking price is moved to the
      seller's car: ±8 % per year of age, ∓2.5 % per 10'000 km, ±1 % per
      SOH point. The range is the middle half of those adjusted prices.
   2. Too few comparables: a rough estimate from the Swiss list price of the
      variant along a typical EV depreciation curve — labelled as such.

   Asking prices are not sale prices; the method text says so wherever the
   estimate is shown.
   ============================================================================ */

export const YEAR_RATE = 0.08;
export const KM_RATE_PER_10K = 0.025;
export const SOH_RATE = 0.01;
export const MIN_COMPARABLES = 3;

export type PriceTarget = {
  /** Catalog model slug, e.g. "tesla_model-y" — preferred match. */
  modelSlug?: string | null;
  brand: string;
  model: string;
  year: number;
  km: number;
  soh?: number | null;
  /** Swiss list price of the variant (catalog), for the fallback. */
  priceNew?: number | null;
  /** The seller's own listing, when editing. */
  excludeId?: string;
};

export type PriceEstimate = {
  low: number;
  mid: number;
  high: number;
  method: "inserate" | "neupreis";
  /** Comparable listings, closest first, with the price moved to the target. */
  comparables: { listing: Listing; adjusted: number }[];
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round100 = (v: number) => Math.round(v / 100) * 100;

/** A comparable's asking price, moved to the target car. */
export function adjustTo(l: Listing, t: PriceTarget): number {
  const year = Math.pow(1 + YEAR_RATE, t.year - l.year);
  const km = clamp(1 - KM_RATE_PER_10K * ((t.km - l.km) / 10_000), 0.6, 1.4);
  const soh = t.soh ? clamp(1 + SOH_RATE * (t.soh - l.soh), 0.8, 1.2) : 1;
  return l.price * year * km * soh;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function isComparable(l: Listing, t: PriceTarget): boolean {
  if (l.isDemo || l.id === t.excludeId) return false;
  if (Math.abs(l.year - t.year) > 3) return false;
  if (t.modelSlug && l.modelSlug) return l.modelSlug === t.modelSlug;
  return fold(l.brand) === fold(t.brand) && fold(l.model) === fold(t.model);
}

/** Residual value of a used EV as a share of its list price, by age in
 *  years — about 78 % after one year, 60 % after three, 47 % after five. */
export function residualShare(ageYears: number): number {
  if (ageYears <= 0) return 0.88;
  return 0.78 * Math.pow(0.88, ageYears - 1);
}

export function estimatePrice(listings: Listing[], t: PriceTarget, now = new Date()): PriceEstimate | null {
  if (!t.year || t.km < 0) return null;

  const comparables = listings
    .filter((l) => isComparable(l, t))
    .map((listing) => ({ listing, adjusted: adjustTo(listing, t) }))
    .sort(
      (a, b) =>
        Math.abs(a.listing.year - t.year) - Math.abs(b.listing.year - t.year) ||
        Math.abs(a.listing.km - t.km) - Math.abs(b.listing.km - t.km),
    );

  if (comparables.length >= MIN_COMPARABLES) {
    const prices = comparables.map((c) => c.adjusted).sort((a, b) => a - b);
    const mid = quantile(prices, 0.5);
    // Few comparables: at least ±8 % around the median.
    const low = Math.min(quantile(prices, 0.25), mid * 0.92);
    const high = Math.max(quantile(prices, 0.75), mid * 1.08);
    return { low: round100(low), mid: round100(mid), high: round100(high), method: "inserate", comparables };
  }

  if (t.priceNew) {
    const age = now.getFullYear() - t.year;
    const expectedKm = Math.max(1, age) * 15_000;
    const km = clamp(1 - KM_RATE_PER_10K * ((t.km - expectedKm) / 10_000), 0.6, 1.25);
    const soh = t.soh ? clamp(1 + SOH_RATE * (t.soh - 95), 0.8, 1.05) : 1;
    const mid = t.priceNew * residualShare(age) * km * soh;
    return {
      low: round100(mid * 0.88),
      mid: round100(mid),
      high: round100(mid * 1.12),
      method: "neupreis",
      comparables,
    };
  }

  return null;
}

export const PRICE_METHOD: Record<PriceEstimate["method"], string> = {
  inserate:
    "Aus vergleichbaren Inseraten (gleiches Modell, Jahrgang ±3), umgerechnet auf deinen Jahrgang, km-Stand und SOH: ±8 % pro Jahr, ∓2,5 % pro 10'000 km, ±1 % pro SOH-Punkt. Angebotspreise, keine Verkaufspreise.",
  neupreis:
    "Zu wenige Vergleichsinserate — grobe Schätzung aus dem Schweizer Neupreis der Variante mit einem typischen Wertverlust für E-Autos (rund 40 % nach drei Jahren), angepasst an km-Stand und SOH.",
};
