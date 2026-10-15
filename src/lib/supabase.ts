import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ============================================================================
   Supabase client — the only backend EV4U needs.
   The publishable key is public by design; every permission is enforced by
   Row Level Security in the database. When env vars are missing (e.g. a
   fork without a project), `supabase` is null and the app falls back to the
   bundled seed listings — the site never goes dark.
   ============================================================================ */

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;

/** Public URL for a photo stored in the listing-photos bucket. We store
 *  bucket paths in the DB and derive URLs here; segments are encoded so a
 *  stray character in a path can never alter the URL structure. */
export function photoUrl(path: string): string {
  if (!url) return "";
  const safe = path.split("/").map(encodeURIComponent).join("/");
  return `${url}/storage/v1/object/public/listing-photos/${safe}`;
}

/** Database row shape of public.listings (snake_case). */
export type ListingRow = {
  id: string;
  owner: string | null;
  slug: string;
  brand: string;
  model: string;
  /** Snapshot of the catalog variant name; null when unknown or typed in without one. */
  variant: string | null;
  segment: "KOMPAKT" | "LIMOUSINE" | "KOMBI" | "SUV";
  year: number;
  km: number;
  price: number;
  price_new: number | null;
  range_km: number;
  consumption: number;
  charge_min: number | null;
  dc_kw: number | null;
  battery_kwh: number;
  weight_kg: number | null;
  /** Links into the vehicle catalog (vehicle_models / vehicle_variants). */
  model_id: string | null;
  variant_id: string | null;
  soh: number;
  bidi: boolean;
  seats: number;
  seller_name: string;
  seller_type: "PRIVAT" | "GARAGE";
  ort: string;
  status: "ENTWURF" | "AKTIV" | "RESERVIERT" | "VERKAUFT";
  note: string;
  photos: string[];
  created_at: string;
  /** Catalog keys, embedded by LISTING_SELECT; absent in reads that use `*` alone. */
  catalog_model?: { slug: string } | null;
  catalog_variant?: { slug: string } | null;
};

/** The public listing read: every column plus the slugs of the linked
 *  catalog model and variant — the stable keys the Marke → Modell →
 *  Variante filter puts in the URL. listings → vehicle_variants has two
 *  FKs (variant_id alone and the composite with model_id), so both embeds
 *  name theirs. */
export const LISTING_SELECT =
  "*,catalog_model:vehicle_models!listings_model_id_fkey(slug)," +
  "catalog_variant:vehicle_variants!listings_variant_id_fkey(slug)";
