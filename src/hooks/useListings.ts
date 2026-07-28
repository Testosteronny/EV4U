import { useEffect, useMemo } from "react";
import { useStore } from "@nanostores/react";
import {
  $listings,
  $listingsLive,
  ensureListings,
  refreshListings,
  seedListings,
} from "../stores/listings";
import type { Listing } from "../data/evData";

/** Same API as the old ListingsContext — now backed by nanostores so every
 *  island on the page shares one source of truth. Pages that prerender with
 *  a build-time snapshot pass it as `initial`; it must be adopted before the
 *  first store read so SSR emits the real inventory. */
export function useListings(initial?: Listing[]): {
  listings: Listing[];
  active: Listing[];
  live: boolean;
  refresh: () => Promise<void>;
} {
  if (initial) seedListings(initial);
  const listings = useStore($listings);
  const live = useStore($listingsLive);

  useEffect(() => {
    ensureListings();
  }, []);

  const active = useMemo(
    () => listings.filter((l) => l.status === "AKTIV"),
    [listings],
  );

  return { listings, active, live, refresh: refreshListings };
}
