import { persistentAtom } from "@nanostores/persistent";
import { isFuelType, type FuelType } from "../utils/costModel";
import type { GemeindeInfo } from "../utils/swiss";

/* ============================================================================
   Cockpit store — the persisted, cross-island state (was CockpitContext).
   SAME localStorage key as the SPA version, so returning visitors keep
   their ZIP, simulation inputs and compare tray. The Merkliste is NOT here:
   it belongs to the account (stores/favorites.ts, Supabase-backed).
   ============================================================================ */

/** Wie viele Autos der Vergleich fasst. Mehr als drei Spalten sind auf einem
 *  Telefon nicht mehr nebeneinander lesbar. */
export const MAX_COMPARE = 3;

/** A resolved postcode, tagged with the ElCom period it was resolved
 *  against — a new tariff year re-resolves it (see useCockpit). */
export type StoredPlace = GemeindeInfo & { period: string };

export type CockpitData = {
  zip: string | null;
  /** `zip` resolved to municipality + tariff. Persisted so a returning
   *  visitor doesn't have to download the PLZ map just to see their tariff. */
  place: StoredPlace | null;
  listingId: string;
  annualKm: number;
  /** The visitor's current car: fuel type + consumption (unit follows the
   *  fuel — L/100km or kWh/100km). Key `ice` kept for storage compat. */
  fuel: FuelType;
  ice: number;
  /** Plug-in-Hybrid: Anteil elektrisch gefahrener Kilometer, 0–100. */
  elecShare: number;
  /** Anteil der Ladung des INSERIERTEN E-Autos, der unterwegs passiert. */
  publicShare: number;
  pv: "ja" | "nein";
  compareIds: string[];
};

export const COCKPIT_DEFAULTS: CockpitData = {
  zip: null,
  place: null,
  listingId: "",
  annualKm: 15000,
  fuel: "BENZIN",
  ice: 7.2,
  // 45 % — was Plug-in-Hybride im Privatgebrauch real elektrisch fahren.
  elecShare: 45,
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
        const saved = JSON.parse(raw) as Partial<CockpitData>;
        const merged = { ...COCKPIT_DEFAULTS, ...saved };
        // Ein Antrieb aus einer früheren Version (oder ein manipulierter
        // localStorage) würde sonst `FUELS[fuel]` auf undefined laufen
        // lassen — und damit jede Zahl auf der Seite mitnehmen.
        if (!isFuelType(merged.fuel)) {
          merged.fuel = COCKPIT_DEFAULTS.fuel;
          merged.ice = COCKPIT_DEFAULTS.ice;
        }
        // Der Ort ist eine Abkürzung, keine Wahrheit: was nicht wie ein
        // aufgelöster Ort aussieht, wird verworfen und aus der PLZ neu gelöst.
        if (!isStoredPlace(merged.place)) merged.place = null;
        return merged;
      } catch {
        return COCKPIT_DEFAULTS;
      }
    },
  },
);

function isStoredPlace(v: unknown): v is StoredPlace {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.zip === "string" &&
    typeof p.name === "string" &&
    typeof p.canton === "string" &&
    typeof p.tariff === "number" &&
    Number.isFinite(p.tariff) &&
    p.tariff > 0 &&
    typeof p.e === "number" &&
    typeof p.n === "number" &&
    typeof p.estimated === "boolean" &&
    (p.via === undefined || typeof p.via === "string") &&
    typeof p.period === "string"
  );
}

export function patchCockpit(patch: Partial<CockpitData>): void {
  $cockpit.set({ ...$cockpit.get(), ...patch });
}
