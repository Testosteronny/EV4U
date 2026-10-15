import { useCallback, useEffect } from "react";
import { useStore } from "@nanostores/react";
import { supabase } from "../lib/supabase";
import type { CatalogBrand, CatalogModel, CatalogVariant } from "../lib/vehicleCatalog";
import {
  $vehicleCatalog,
  $vehicleVariants,
  loadVehicleCatalog,
  loadVehicleVariants,
  type LoadStatus,
} from "../stores/vehicleCatalog";

/* ============================================================================
   Fahrzeugkatalog in React — Marke → Modell → Variante. Laden und Zustand
   wohnen im Store (stores/vehicleCatalog.ts), damit alle Inseln einer Seite
   dasselbe sehen; die Hooks hier lesen nur und stossen das Laden an.
   ============================================================================ */

export type { LoadStatus };

export function useVehicleCatalog(): {
  brands: CatalogBrand[];
  status: LoadStatus;
  retry: () => void;
} {
  const { brands, status } = useStore($vehicleCatalog);
  useEffect(loadVehicleCatalog, []);
  return { brands, status, retry: loadVehicleCatalog };
}

export function useVehicleVariants(modelId: string | null): {
  variants: CatalogVariant[];
  status: LoadStatus;
  retry: () => void;
} {
  const all = useStore($vehicleVariants);

  useEffect(() => {
    if (modelId) loadVehicleVariants(modelId);
  }, [modelId]);

  const retry = useCallback(() => {
    if (modelId) loadVehicleVariants(modelId);
  }, [modelId]);

  if (!modelId) return { variants: [], status: "ready", retry };
  if (!supabase) return { variants: [], status: "offline", retry };
  // Noch kein Eintrag heisst: der Effekt hat das Laden eben erst angestossen.
  const entry = all[modelId];
  return { variants: entry?.rows ?? [], status: entry?.status ?? "loading", retry };
}

/* ---------- Auswahl -------------------------------------------------------- */

/** «Nicht im Katalog» — für Marke und Modell. */
export const OTHER = "__other__";
/** «Weiss ich nicht genau» — für die Variante. */
export const UNKNOWN = "__unknown__";

/** Was im Picker gewählt oder eingetippt ist. Ids sind Katalog-Ids oder
 *  einer der Platzhalter oben; die Texte gelten nur für Eingetipptes. */
export type VehicleChoice = {
  brandId: string;
  modelId: string;
  variantId: string;
  brandText: string;
  modelText: string;
  variantText: string;
};

export const EMPTY_CHOICE: VehicleChoice = {
  brandId: "",
  modelId: "",
  variantId: "",
  brandText: "",
  modelText: "",
  variantText: "",
};

/** Die aufgelöste Auswahl: Namen fürs Inserat, Katalogzeilen für die Werte. */
export type VehiclePick = {
  brand: string;
  model: string;
  /** Leer, wenn unbekannt. */
  variant: string;
  catalogModel: CatalogModel | null;
  catalogVariant: CatalogVariant | null;
  /** Marke und Modell benannt, Variante entschieden. */
  complete: boolean;
};

export function useVehiclePick(choice: VehicleChoice): VehiclePick {
  const { brands, status } = useVehicleCatalog();
  // Ohne Katalog (kein Backend) bleibt nur das Eintippen.
  const manualBrand = choice.brandId === OTHER || status === "offline";
  const brand = manualBrand ? null : (brands.find((b) => b.id === choice.brandId) ?? null);
  const manualModel = manualBrand || choice.modelId === OTHER;
  const model = brand && !manualModel ? (brand.models.find((m) => m.id === choice.modelId) ?? null) : null;
  const { variants: rows } = useVehicleVariants(model?.id ?? null);
  const variant = model ? (rows.find((v) => v.id === choice.variantId) ?? null) : null;

  const brandName = (brand?.name ?? (manualBrand ? choice.brandText : "")).trim();
  const modelName = (model?.name ?? (manualModel ? choice.modelText : "")).trim();
  const variantName = (variant?.name ?? (manualModel ? choice.variantText : "")).trim();

  return {
    brand: brandName,
    model: modelName,
    variant: variantName,
    catalogModel: model,
    catalogVariant: variant,
    complete:
      brandName !== "" &&
      modelName !== "" &&
      (manualModel || variant !== null || choice.variantId === UNKNOWN),
  };
}
