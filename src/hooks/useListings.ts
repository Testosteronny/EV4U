import { useEffect, useMemo } from "react";
import { useStore } from "@nanostores/react";
import { $listings, $listingsLive, ensureListings, refreshListings } from "../stores/listings";
import type { Listing } from "../data/evData";

/** Same API as the old ListingsContext — now backed by nanostores so every
 *  island on the page shares one source of truth. */
export function useListings(): {
  listings: Listing[];
  active: Listing[];
  live: boolean;
  refresh: () => Promise<void>;
} {
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
