import { atom } from "nanostores";
import { LISTINGS as SEED_LISTINGS, type Listing } from "../data/evData";
import { rowToListing } from "../lib/mappers";
import { supabase, type ListingRow } from "../lib/supabase";

/* ============================================================================
   Listings store — nanostores version of the old ListingsContext, shared
   across all React islands on a page. Paints the bundled seed instantly,
   swaps in the live Supabase rows once per page load.
   ============================================================================ */

export const $listings = atom<Listing[]>(SEED_LISTINGS);
export const $listingsLive = atom(false);

let started = false;

export async function refreshListings(): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .in("status", ["AKTIV", "RESERVIERT"])
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[ev4u] listings fetch failed — using bundled seed:", error.message);
    return;
  }
  if (data) {
    $listings.set((data as ListingRow[]).map(rowToListing));
    $listingsLive.set(true);
  }
}

/** Kick off the live fetch exactly once per page load. */
export function ensureListings(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  void refreshListings();
}
