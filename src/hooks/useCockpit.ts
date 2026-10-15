import { useEffect, useMemo, useState } from "react";
import { useStore } from "@nanostores/react";
import { $cockpit, COCKPIT_DEFAULTS, MAX_COMPARE, patchCockpit } from "../stores/cockpit";
import { useListings } from "./useListings";
import { FUELS, type FuelType } from "../utils/costModel";
import { CH_AVG_TARIFF, TARIFF_META, resolveZip, type GemeindeInfo } from "../utils/swiss";
import type { Listing } from "../data/evData";

/* ============================================================================
   useCockpit — «Deine Werte»: der persistierte, inselübergreifende Zustand.

   Bewusst OHNE Bezug zum Bestand. Vorher löste dieser Hook nebenbei auch
   noch das simulierte Inserat auf und sortierte dafür bei jedem Render die
   gesamte Liste — und weil jede Inseratskarte den Hook aufruft, geschah das
   auf einer Katalogseite ein Dutzend Mal pro Tastendruck. Wer das simulierte
   Auto braucht, ist genau eine Seite: `useSimulatedListing` unten.
   ============================================================================ */

type CockpitState = {
  /** False during SSR and the very first client render; true once the
   *  persisted localStorage state has been adopted. */
  hydrated: boolean;
  gemeinde: GemeindeInfo | null;
  setGemeinde: (g: GemeindeInfo | null) => void;
  tariff: number;
  tariffLabel: string;
  annualKm: number;
  setAnnualKm: (v: number) => void;
  /** The visitor's current car — drives every "vs. dein Auto" comparison. */
  currentFuel: FuelType;
  /** Switching fuel resets the consumption to that fuel's typical value. */
  setCurrentFuel: (f: FuelType) => void;
  currentCons: number;
  setCurrentCons: (v: number) => void;
  /** Nur relevant, wenn `currentFuel` ein Plug-in-Hybrid ist. */
  elecShare: number;
  setElecShare: (v: number) => void;
  publicShare: number;
  setPublicShare: (v: number) => void;
  pv: "ja" | "nein";
  setPv: (v: "ja" | "nein") => void;
  compareIds: string[];
  setCompareIds: (ids: string[]) => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  /** Which listing the standalone engine simulates. */
  listingId: string;
  setListingId: (id: string) => void;
};

export function useCockpit(): CockpitState {
  const raw = useStore($cockpit);

  // The prerendered HTML is computed with COCKPIT_DEFAULTS (no localStorage
  // on the server), but the persisted atom hydrates synchronously on the
  // client — the first client render would disagree with the server HTML
  // (hydration mismatch on every tariff-dependent number). Serve the
  // defaults until after mount, then let the personalised values sweep in.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const data = hydrated ? raw : COCKPIT_DEFAULTS;

  // The persisted place answers synchronously. Only a stored PLZ without a
  // (current) place — a visitor from before places were persisted, or a new
  // ElCom tariff year — loads the PLZ map, once, and stores the result.
  const place = data.place;
  const placeCurrent =
    !!data.zip && place?.zip === data.zip && place.period === TARIFF_META.period;
  const gemeinde: GemeindeInfo | null = placeCurrent ? place : null;

  useEffect(() => {
    if (hydrated && data.zip && !placeCurrent) void syncPlace(data.zip);
  }, [hydrated, data.zip, placeCurrent]);

  return useMemo<CockpitState>(
    () => ({
      hydrated,
      gemeinde,
      setGemeinde: (g) =>
        patchCockpit({
          zip: g?.zip ?? null,
          place: g ? { ...g, period: TARIFF_META.period } : null,
        }),
      tariff: gemeinde?.tariff ?? CH_AVG_TARIFF,
      tariffLabel: gemeinde ? `${gemeinde.name} ${gemeinde.canton}` : "CH-Median",
      annualKm: data.annualKm,
      setAnnualKm: (v) => patchCockpit({ annualKm: v }),
      currentFuel: data.fuel,
      setCurrentFuel: (f) => patchCockpit({ fuel: f, ice: FUELS[f].defaultCons }),
      currentCons: data.ice,
      setCurrentCons: (v) => patchCockpit({ ice: v }),
      elecShare: data.elecShare,
      setElecShare: (v) => patchCockpit({ elecShare: v }),
      publicShare: data.publicShare,
      setPublicShare: (v) => patchCockpit({ publicShare: v }),
      pv: data.pv,
      setPv: (v) => patchCockpit({ pv: v }),
      compareIds: data.compareIds,
      setCompareIds: (ids) => patchCockpit({ compareIds: ids.slice(0, MAX_COMPARE) }),
      toggleCompare: (id) =>
        patchCockpit({
          compareIds: data.compareIds.includes(id)
            ? data.compareIds.filter((x) => x !== id)
            : data.compareIds.length >= MAX_COMPARE
              ? data.compareIds
              : [...data.compareIds, id],
        }),
      clearCompare: () => patchCockpit({ compareIds: [] }),
      listingId: data.listingId,
      setListingId: (id) => patchCockpit({ listingId: id }),
    }),
    [data, gemeinde, hydrated],
  );
}

/** Resolve a stored PLZ into its place. Every island calls useCockpit, so
 *  concurrent calls for the same PLZ share one resolution. */
let syncing: string | null = null;
async function syncPlace(zip: string): Promise<void> {
  if (syncing === zip) return;
  syncing = zip;
  try {
    const g = await resolveZip(zip);
    // The visitor may have typed another PLZ meanwhile — don't clobber it.
    if ($cockpit.get().zip !== zip) return;
    patchCockpit(
      g ? { place: { ...g, period: TARIFF_META.period } } : { zip: null, place: null },
    );
  } catch (err) {
    console.warn("[ev4u] PLZ map failed to load:", err);
  } finally {
    syncing = null;
  }
}

/** The listing the standalone engine on /rechenwerk currently simulates —
 *  the stored one, or the cheapest open ad as a sensible starting point. */
export function useSimulatedListing(initial?: Listing[]): Listing | null {
  const { listingId } = useCockpit();
  const { active } = useListings(initial);

  return useMemo(() => {
    if (active.length === 0) return null;
    return (
      active.find((l) => l.id === listingId) ??
      active.reduce((a, b) => (b.price < a.price ? b : a))
    );
  }, [active, listingId]);
}
