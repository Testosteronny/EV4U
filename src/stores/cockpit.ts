import { persistentAtom } from "@nanostores/persistent";
import type { FuelType } from "../utils/costModel";

/* ============================================================================
   Cockpit store — the persisted, cross-island state (was CockpitContext).
   SAME localStorage key as the SPA version, so returning visitors keep
   their ZIP, simulation inputs and compare tray. The Merkliste is NOT here:
   it belongs to the account (stores/favorites.ts, Supabase-backed).
   ============================================================================ */

export type CockpitData = {
  zip: string | null;
  listingId: string;
  annualKm: number;
  /** The visitor's current car: fuel type + consumption (unit follows the
   *  fuel — L/100km or kWh/100km). Key `ice` kept for storage compat. */
  fuel: FuelType;
  ice: number;
  publicShare: number;
  pv: "ja" | "nein";
  compareIds: string[];
};

export const COCKPIT_DEFAULTS: CockpitData = {
  zip: null,
  listingId: "",
  annualKm: 15000,
  fuel: "BENZIN",
  ice: 7.2,
  publicShare: 15,
  pv: "nein",
  compareIds: [],
};

export const $cockpit = persistentAtom<CockpitData>(
  "ev4u.cockpit.v1",
  COCKPIT_DEFAULTS,
  {
    encode: JSON.stringify,
    decode: (raw) => {
      try {
        return { ...COCKPIT_DEFAULTS, ...(JSON.parse(raw) as Partial<CockpitData>) };
      } catch {
        return COCKPIT_DEFAULTS;
      }
    },
  },
);

export function patchCockpit(patch: Partial<CockpitData>): void {
  $cockpit.set({ ...$cockpit.get(), ...patch });
}
