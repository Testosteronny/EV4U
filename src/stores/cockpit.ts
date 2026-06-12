import { persistentAtom } from "@nanostores/persistent";

/* ============================================================================
   Cockpit store — the persisted, cross-island state (was CockpitContext).
   SAME localStorage key and shape as the SPA version, so returning visitors
   keep their ZIP, simulation inputs, Merkliste and compare tray.
   ============================================================================ */

export type CockpitData = {
  zip: string | null;
  listingId: string;
  annualKm: number;
  ice: number;
  publicShare: number;
  pv: "ja" | "nein";
  compareIds: string[];
  favorites: string[];
};

export const COCKPIT_DEFAULTS: CockpitData = {
  zip: null,
  listingId: "",
  annualKm: 15000,
  ice: 7.2,
  publicShare: 15,
  pv: "nein",
  compareIds: [],
  favorites: [],
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
