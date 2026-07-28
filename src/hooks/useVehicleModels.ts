import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/* ============================================================================
   Vehicle catalog — every EV model on the Swiss market (279 models, 78
   brands, imported from the EV4U master list). Reference data: public read,
   operator-managed. Used by the /verkaufen picker to prefill listings;
   variant-level specs (vehicle_variants) plug in the same way once enriched.
   ============================================================================ */

export type VehicleSegment =
  | "Kleinwagen"
  | "Kompaktklasse"
  | "Mittelklasse"
  | "Oberklasse"
  | "SUV"
  | "VAN/BUS";

export type VehicleModel = {
  id: string;
  brand: string;
  model: string;
  segment: VehicleSegment;
  status: "NEU" | "AUSLAUF";
  /** Best-variant figures from the master list (fallbacks until variants exist). */
  range_km_max: number | null;
  price_from_chf: number | null;
  seats_max: number | null;
  consumption_min: number | null;
  remark: string | null;
};

/** Catalog taxonomy (6 classes) → the four listing segments used by the
 *  Markt-Tafel filters and the CarGraphic silhouettes. The seller can still
 *  correct it before publishing. */
export function toListingSegment(
  s: VehicleSegment,
): "KOMPAKT" | "LIMOUSINE" | "KOMBI" | "SUV" {
  switch (s) {
    case "Kleinwagen":
    case "Kompaktklasse":
      return "KOMPAKT";
    case "Mittelklasse":
    case "Oberklasse":
      return "LIMOUSINE";
    case "VAN/BUS":
      return "KOMBI";
    default:
      return "SUV";
  }
}

// Module-level cache: the catalog is static per session, one fetch is enough.
let cache: VehicleModel[] | null = null;

export function useVehicleModels(): VehicleModel[] {
  const [models, setModels] = useState<VehicleModel[]>(cache ?? []);

  useEffect(() => {
    if (cache || !supabase) return;
    void supabase
      .from("vehicle_models")
      .select(
        "id,brand,model,segment,status,range_km_max,price_from_chf,seats_max,consumption_min,remark",
      )
      .order("brand")
      .order("model")
      .then(({ data }) => {
        if (data) {
          cache = data as VehicleModel[];
          setModels(cache);
        }
      });
  }, []);

  return models;
}
