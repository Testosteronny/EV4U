import {
  byEntryLevel,
  byName,
  type CatalogBrand,
  type CatalogModel,
  type CatalogVariant,
} from "./vehicleCatalog";
import { MODEL_COLUMNS, VARIANT_COLUMNS, normalizeVariant } from "../stores/vehicleCatalog";

/* ============================================================================
   Build-time catalog snapshot — every brand, model and variant in one
   request per `astro build`, for the prerendered model guide (/modelle,
   Konzept §4.6). The catalog changes a few times a year; the rebuild
   webhook covers it. Offline or unconfigured, it is empty and the guide
   says so instead of inventing pages.
   ============================================================================ */

export type FullModel = CatalogModel & { variants: CatalogVariant[] };
export type FullBrand = Omit<CatalogBrand, "models"> & { models: FullModel[] };

let cache: FullBrand[] | null = null;

export async function fetchBuildCatalog(): Promise<FullBrand[]> {
  if (cache) return cache;
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  cache = [];
  if (!url || !key) return cache;
  const select = `id,slug,name,models:vehicle_models(${MODEL_COLUMNS},variants:vehicle_variants(${VARIANT_COLUMNS}))`;
  try {
    const res = await fetch(`${url}/rest/v1/vehicle_brands?select=${encodeURIComponent(select)}`, {
      headers: { apikey: key },
    });
    if (!res.ok) return cache;
    const rows = (await res.json()) as FullBrand[];
    cache = rows
      .map((b) => ({
        ...b,
        models: b.models
          .map((m) => ({ ...m, variants: m.variants.map(normalizeVariant).sort(byEntryLevel) }))
          .sort(byName),
      }))
      .sort(byName);
  } catch {
    /* offline build → no model pages */
  }
  return cache;
}

/** «tesla_model-y» → "model-y" — the model's part of its URL. */
export const modelPart = (m: Pick<CatalogModel, "slug">): string => m.slug.slice(m.slug.indexOf("_") + 1);

/** Min–max of a numeric variant column, nulls ignored. */
export function span(variants: CatalogVariant[], pick: (v: CatalogVariant) => number | null): [number, number] | null {
  const xs = variants.map(pick).filter((x): x is number => x !== null);
  return xs.length ? [Math.min(...xs), Math.max(...xs)] : null;
}
