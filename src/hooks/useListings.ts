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
import { useHydrated } from "./useHydrated";

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
  const stored = useStore($listings);
  const storedLive = useStore($listingsLive);
  const hydrated = useHydrated();
  // The first client render shows what the static HTML shows: an island
  // that hydrates late (client:visible) may find the live rows already in
  // the store, and rendering them straight away would break hydration.
  const listings = !hydrated && initial ? initial : stored;
  const live = hydrated && storedLive;

  useEffect(() => {
    ensureListings();
  }, []);

  const active = useMemo(
    () => listings.filter((l) => l.status === "AKTIV"),
    [listings],
  );

  return { listings, active, live, refresh: refreshListings };
}
