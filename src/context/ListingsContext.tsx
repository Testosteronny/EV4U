import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase, type ListingRow } from "../lib/supabase";
import { LISTINGS as SEED_LISTINGS, type Listing } from "../data/evData";

/* ============================================================================
   ListingsContext — single source for the Inserate.
   Starts with the bundled seed (instant paint, offline-safe), then swaps in
   the live rows from Supabase. `refresh()` is called after user mutations
   (publish/delete on /konto, insert on /verkaufen).
   ============================================================================ */

function rowToListing(r: ListingRow): Listing {
  return {
    id: r.slug,
    brand: r.brand,
    model: r.model,
    segment: r.segment,
    year: r.year,
    km: r.km,
    price: r.price,
    range: r.range_km,
    consumption: Number(r.consumption),
    chargeMin: r.charge_min,
    dcKw: r.dc_kw,
    battery: Number(r.battery_kwh),
    soh: r.soh,
    bidi: r.bidi,
    seats: r.seats,
    postedDays: Math.max(
      0,
      Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86_400_000),
    ),
    seller: r.seller_name,
    sellerType: r.seller_type,
    ort: r.ort,
    // ENTWURF/VERKAUFT rows are filtered out below; map the rest 1:1.
    status: r.status === "RESERVIERT" ? "RESERVIERT" : "AKTIV",
    note: r.note,
    uid: r.id,
    owner: r.owner,
    photos: r.photos ?? [],
    priceNew: r.price_new ?? undefined,
  };
}

type ListingsState = {
  /** All publicly visible listings (AKTIV + RESERVIERT). */
  listings: Listing[];
  /** Open listings — the only ones simulatable/comparable. */
  active: Listing[];
  /** True once the live data has been loaded from Supabase. */
  live: boolean;
  refresh: () => Promise<void>;
};

const ListingsContext = createContext<ListingsState | null>(null);

export function ListingsProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useState<Listing[]>(SEED_LISTINGS);
  const [live, setLive] = useState(false);

  const refresh = useCallback(async () => {
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
      setListings((data as ListingRow[]).map(rowToListing));
      setLive(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<ListingsState>(
    () => ({
      listings,
      active: listings.filter((l) => l.status === "AKTIV"),
      live,
      refresh,
    }),
    [listings, live, refresh],
  );

  return <ListingsContext.Provider value={value}>{children}</ListingsContext.Provider>;
}

export function useListings(): ListingsState {
  const ctx = useContext(ListingsContext);
  if (!ctx) throw new Error("useListings must be used within <ListingsProvider>.");
  return ctx;
}
