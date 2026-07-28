import { useEffect, useMemo, useState } from "react";
import { useStore } from "@nanostores/react";
import { $cockpit, COCKPIT_DEFAULTS, patchCockpit } from "../stores/cockpit";
import { useListings } from "./useListings";
import { FUELS, type FuelType } from "../utils/costModel";
import { CH_AVG_TARIFF, resolveZip, type GemeindeInfo } from "../utils/swiss";
import type { Listing } from "../data/evData";

/* ============================================================================
   useCockpit — identical API to the old CockpitContext, backed by the
   persisted nanostore. Every island (TopBar, Hero, engine, boards, tray)
   reads and writes the same atom; localStorage key unchanged.
   ============================================================================ */

type CockpitState = {
  /** False during SSR and the very first client render; true once the
   *  persisted localStorage state has been adopted. */
  hydrated: boolean;
  gemeinde: GemeindeInfo | null;
  setGemeinde: (g: GemeindeInfo | null) => void;
  tariff: number;
  tariffLabel: string;
  listing: Listing;
  setListingId: (id: string) => void;
  annualKm: number;
  setAnnualKm: (v: number) => void;
  /** The visitor's current car — drives every "vs. dein Auto" comparison. */
  currentFuel: FuelType;
  /** Switching fuel resets the consumption to that fuel's typical value. */
  setCurrentFuel: (f: FuelType) => void;
  currentCons: number;
  setCurrentCons: (v: number) => void;
  publicShare: number;
  setPublicShare: (v: number) => void;
  pv: "ja" | "nein";
  setPv: (v: "ja" | "nein") => void;
  compareIds: string[];
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
};

export function useCockpit(): CockpitState {
  const raw = useStore($cockpit);
  const { active } = useListings();

  // The prerendered HTML is computed with COCKPIT_DEFAULTS (no localStorage
  // on the server), but the persisted atom hydrates synchronously on the
  // client — the first client render would disagree with the server HTML
  // (hydration mismatch on every tariff-dependent number). Serve the
  // defaults until after mount, then let the personalised values sweep in.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const data = hydrated ? raw : COCKPIT_DEFAULTS;

  const gemeinde = useMemo(
    () => (data.zip ? resolveZip(data.zip) : null),
    [data.zip],
  );

  return useMemo<CockpitState>(() => {
    const cheapest = [...active].sort((a, b) => a.price - b.price)[0];
    const listing = active.find((l) => l.id === data.listingId) ?? cheapest;
    return {
      hydrated,
      gemeinde,
      setGemeinde: (g) => patchCockpit({ zip: g?.zip ?? null }),
      tariff: gemeinde?.tariff ?? CH_AVG_TARIFF,
      tariffLabel: gemeinde ? `${gemeinde.name} ${gemeinde.canton}` : "CH-Median",
      listing,
      setListingId: (id) => patchCockpit({ listingId: id }),
      annualKm: data.annualKm,
      setAnnualKm: (v) => patchCockpit({ annualKm: v }),
      currentFuel: data.fuel,
      setCurrentFuel: (f) => patchCockpit({ fuel: f, ice: FUELS[f].defaultCons }),
      currentCons: data.ice,
      setCurrentCons: (v) => patchCockpit({ ice: v }),
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
    };
  }, [data, gemeinde, active, hydrated]);
}
