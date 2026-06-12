import { useMemo } from "react";
import { useStore } from "@nanostores/react";
import { $cockpit, patchCockpit } from "../stores/cockpit";
import { useListings } from "./useListings";
import { CH_AVG_TARIFF, resolveZip, type GemeindeInfo } from "../utils/swiss";
import type { Listing } from "../data/evData";

/* ============================================================================
   useCockpit — identical API to the old CockpitContext, backed by the
   persisted nanostore. Every island (TopBar, Hero, engine, boards, tray)
   reads and writes the same atom; localStorage key unchanged.
   ============================================================================ */

type CockpitState = {
  gemeinde: GemeindeInfo | null;
  setGemeinde: (g: GemeindeInfo | null) => void;
  tariff: number;
  tariffLabel: string;
  listing: Listing;
  setListingId: (id: string) => void;
  annualKm: number;
  setAnnualKm: (v: number) => void;
  iceConsumption: number;
  setIceConsumption: (v: number) => void;
  publicShare: number;
  setPublicShare: (v: number) => void;
  pv: "ja" | "nein";
  setPv: (v: "ja" | "nein") => void;
  compareIds: string[];
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
};

export function useCockpit(): CockpitState {
  const data = useStore($cockpit);
  const { active } = useListings();

  const gemeinde = useMemo(
    () => (data.zip ? resolveZip(data.zip) : null),
    [data.zip],
  );

  return useMemo<CockpitState>(() => {
    const cheapest = [...active].sort((a, b) => a.price - b.price)[0];
    const listing = active.find((l) => l.id === data.listingId) ?? cheapest;
    return {
      gemeinde,
      setGemeinde: (g) => patchCockpit({ zip: g?.zip ?? null }),
      tariff: gemeinde?.tariff ?? CH_AVG_TARIFF,
      tariffLabel: gemeinde ? `${gemeinde.name} ${gemeinde.canton}` : "CH-Median",
      listing,
      setListingId: (id) => patchCockpit({ listingId: id }),
      annualKm: data.annualKm,
      setAnnualKm: (v) => patchCockpit({ annualKm: v }),
      iceConsumption: data.ice,
      setIceConsumption: (v) => patchCockpit({ ice: v }),
      publicShare: data.publicShare,
      setPublicShare: (v) => patchCockpit({ publicShare: v }),
      pv: data.pv,
      setPv: (v) => patchCockpit({ pv: v }),
      compareIds: data.compareIds,
      toggleCompare: (id) =>
        patchCockpit({
          compareIds: data.compareIds.includes(id)
            ? data.compareIds.filter((x) => x !== id)
            : data.compareIds.length >= 3
              ? data.compareIds
              : [...data.compareIds, id],
        }),
      clearCompare: () => patchCockpit({ compareIds: [] }),
      favorites: data.favorites,
      toggleFavorite: (id) =>
        patchCockpit({
          favorites: data.favorites.includes(id)
            ? data.favorites.filter((x) => x !== id)
            : [...data.favorites, id],
        }),
    };
  }, [data, gemeinde, active]);
}
