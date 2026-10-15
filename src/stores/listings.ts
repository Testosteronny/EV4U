import { atom } from "nanostores";
import { LISTINGS as SEED_LISTINGS, type Listing } from "../data/evData";
import { rowToListing } from "../lib/mappers";
import { LISTING_SELECT, supabase, type ListingRow } from "../lib/supabase";

/* ============================================================================
   Listings store — nanostores version of the old ListingsContext, shared
   across all React islands on a page. Paints the bundled seed instantly,
   swaps in the live Supabase rows once per page load.
   ============================================================================ */

export const $listings = atom<Listing[]>(SEED_LISTINGS);
export const $listingsLive = atom(false);

let started = false;
let seeded = false;

/** Adopt the build-time snapshot (passed down from an .astro page) as the
 *  first paint. Runs during prerendering too — that's what puts the real
 *  inventory into the static HTML — and again on hydration, so the page
 *  never flashes the bundled seed before the live fetch lands. */
export function seedListings(rows: Listing[]): void {
  if (seeded || $listingsLive.get()) return;
  seeded = true;
  $listings.set(rows);
}

let inFlight: Promise<void> | null = null;

/** Reload the catalogue from the database. Concurrent calls share one
 *  request — after a mutation, several panels ask at the same moment. */
export function refreshListings(): Promise<void> {
  inFlight ??= doRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doRefresh(): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .in("status", ["AKTIV", "RESERVIERT"])
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[ev4u] listings fetch failed — using bundled seed:", error.message);
    return;
  }
  if (data) {
    $listings.set((data as unknown as ListingRow[]).map(rowToListing));
    $listingsLive.set(true);
  }
}

/** Kick off the live fetch exactly once per page load. */
export function ensureListings(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  void refreshListings();
}

/** Listings by slug in ANY status the visitor may see — the store above
 *  only holds what is for sale, but a saved or linked car may be sold by
 *  now, and that is exactly what the Merkliste and the detail page must
 *  say. RLS decides: sold listings are public, drafts only for the owner. */
export async function fetchListingsBySlugs(slugs: string[]): Promise<Listing[] | null> {
  if (!supabase || slugs.length === 0) return supabase ? [] : null;
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .in("slug", slugs.slice(0, 200));
  if (error) {
    console.warn("[ev4u] listings by slug failed:", error.message);
    return null;
  }
  return (data as unknown as ListingRow[]).map(rowToListing);
}
