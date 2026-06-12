import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CH_AVG_TARIFF, resolveZip, type GemeindeInfo } from "../utils/swiss";
import { type Listing } from "../data/evData";
import { useListings } from "./ListingsContext";

/* ============================================================================
   CockpitContext — the marketplace's shared, PERSISTED state.

   Every page reads the same instrument settings, so the site behaves like
   one device instead of five pages:
   · gemeinde/tariff   — fixed in the hero, used by boards, engines, compare
   · listing           — the Inserat simulated on /rechenwerk
   · annualKm / ice / publicShare / pv — simulation inputs, shared between
     the standalone engine and every embedded listing-detail engine
   · compareIds        — the compare tray (max 3 open listings)

   Persisted to localStorage so a returning visitor lands pre-personalised.
   ============================================================================ */

const LS_KEY = "ev4u.cockpit.v1";

type Persisted = {
  zip?: string | null;
  listingId?: string;
  annualKm?: number;
  ice?: number;
  publicShare?: number;
  pv?: "ja" | "nein";
  compareIds?: string[];
  favorites?: string[];
};

function loadPersisted(): Persisted {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as Persisted;
  } catch {
    return {};
  }
}

const saved = loadPersisted();

type CockpitState = {
  gemeinde: GemeindeInfo | null;
  setGemeinde: (g: GemeindeInfo | null) => void;
  /** Active tariff CHF/kWh — local if fixed, CH median otherwise. */
  tariff: number;
  tariffLabel: string;

  /** The listing simulated on the standalone /rechenwerk page. */
  listing: Listing;
  setListingId: (id: string) => void;

  /* Shared simulation inputs */
  annualKm: number;
  setAnnualKm: (v: number) => void;
  iceConsumption: number;
  setIceConsumption: (v: number) => void;
  /** Lade-Mix: % charged on the road. 0 = all home, 100 = all public. */
  publicShare: number;
  setPublicShare: (v: number) => void;
  pv: "ja" | "nein";
  setPv: (v: "ja" | "nein") => void;

  /* Compare tray */
  compareIds: string[];
  toggleCompare: (id: string) => void;
  clearCompare: () => void;

  /* Merkliste */
  favorites: string[];
  toggleFavorite: (id: string) => void;
};

const CockpitContext = createContext<CockpitState | null>(null);

export function CockpitProvider({ children }: { children: ReactNode }) {
  const { active } = useListings();
  const [gemeinde, setGemeinde] = useState<GemeindeInfo | null>(() =>
    saved.zip ? resolveZip(saved.zip) : null,
  );
  const [listingId, setListingId] = useState(saved.listingId ?? "");
  const [annualKm, setAnnualKm] = useState(saved.annualKm ?? 15000);
  const [iceConsumption, setIceConsumption] = useState(saved.ice ?? 7.2);
  const [publicShare, setPublicShare] = useState(saved.publicShare ?? 15);
  const [pv, setPv] = useState<"ja" | "nein">(saved.pv ?? "nein");
  const [compareIds, setCompareIds] = useState<string[]>(saved.compareIds ?? []);
  const [favorites, setFavorites] = useState<string[]>(saved.favorites ?? []);

  // Persist everything the instrument remembers.
  useEffect(() => {
    const data: Persisted = {
      zip: gemeinde?.zip ?? null,
      listingId,
      annualKm,
      ice: iceConsumption,
      publicShare,
      pv,
      compareIds,
      favorites,
    };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch {
      /* storage full / private mode — non-fatal */
    }
  }, [gemeinde, listingId, annualKm, iceConsumption, publicShare, pv, compareIds, favorites]);

  const value = useMemo<CockpitState>(() => {
    // The simulated listing must be an OPEN ad; fall back to the cheapest.
    const cheapest = [...active].sort((a, b) => a.price - b.price)[0];
    const listing = active.find((l) => l.id === listingId) ?? cheapest;
    return {
      gemeinde,
      setGemeinde,
      tariff: gemeinde?.tariff ?? CH_AVG_TARIFF,
      tariffLabel: gemeinde ? `${gemeinde.name} ${gemeinde.canton}` : "CH-Median",
      listing,
      setListingId,
      annualKm,
      setAnnualKm,
      iceConsumption,
      setIceConsumption,
      publicShare,
      setPublicShare,
      pv,
      setPv,
      compareIds,
      toggleCompare: (id) =>
        setCompareIds((prev) =>
          prev.includes(id)
            ? prev.filter((x) => x !== id)
            : prev.length >= 3
              ? prev
              : [...prev, id],
        ),
      clearCompare: () => setCompareIds([]),
      favorites,
      toggleFavorite: (id) =>
        setFavorites((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        ),
    };
  }, [active, gemeinde, listingId, annualKm, iceConsumption, publicShare, pv, compareIds, favorites]);

  return (
    <CockpitContext.Provider value={value}>{children}</CockpitContext.Provider>
  );
}

export function useCockpit(): CockpitState {
  const ctx = useContext(CockpitContext);
  if (!ctx) throw new Error("useCockpit must be used within <CockpitProvider>.");
  return ctx;
}
