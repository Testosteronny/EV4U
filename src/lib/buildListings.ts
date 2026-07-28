import { LISTINGS, type Listing } from "../data/evData";
import { rowToListing } from "./mappers";
import type { ListingRow } from "./supabase";

/* ============================================================================
   Build-time listings snapshot — one fetch per `astro build`, shared by
   every prerendered page (/, /inserate, /inserat/[slug]). The pages pass it
   into their islands as `initial`, so the static HTML carries the real
   inventory instead of the bundled seed — the content crawlers and LLMs
   actually read. Falls back to the seed when offline or unconfigured.
   ============================================================================ */

let cache: Listing[] | null = null;

export async function fetchBuildListings(): Promise<Listing[]> {
  if (cache) return cache;
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url && key) {
    try {
      const res = await fetch(
        `${url}/rest/v1/listings?select=*&status=in.(AKTIV,RESERVIERT)&order=created_at.desc`,
        { headers: { apikey: key } },
      );
      if (res.ok) {
        cache = ((await res.json()) as ListingRow[]).map(rowToListing);
        return cache;
      }
    } catch {
      /* offline build → seed listings */
    }
  }
  cache = LISTINGS;
  return cache;
}
