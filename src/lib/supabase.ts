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

/** Status of a listing row, including the ones only its owner sees. */
export type ListingRowStatus = "ENTWURF" | "AKTIV" | "RESERVIERT" | "VERKAUFT" | "PAUSIERT";

/** Database row shape of public.listings (snake_case). */
export type ListingRow = {
  id: string;
  owner: string | null;
  /** Demo car for checking the site before launch — platform-owned, never for sale. */
  is_demo: boolean;
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
  negotiable: boolean;
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
  status: ListingRowStatus;
  note: string;
  photos: string[];
  created_at: string;
  /* Seller-entered battery warranty, condition and equipment (v3). */
  battery_warranty_until: string | null;
  battery_warranty_km: number | null;
  battery_warranty_soh_pct: number | null;
  mfk_date: string | null;
  accident_free: boolean | null;
  owners: number | null;
  service_book: boolean | null;
  warranty_until: string | null;
  equipment: Record<string, unknown> | null;
  hidden_at: string | null;
  /** Video-Rundgang: key in the R2 bucket (lib/video.ts), its length and a
   *  poster frame in listing-photos. All null without a video. */
  video_path: string | null;
  video_seconds: number | null;
  video_poster: string | null;
  /* Embedded by LISTING_SELECT; absent in reads that use `*` alone. */
  catalog_model?: { slug: string } | null;
  catalog_variant?: CatalogVariantEmbed | null;
  price_history?: { price: number; changed_at: string }[];
  seller_profile?: { slug: string | null; verified: boolean } | null;
};

/** The catalog facts a listing carries along (see ListingSpec). */
export type CatalogVariantEmbed = {
  slug: string;
  ac_max_kw: number | string;
  system_voltage_v: number;
  cell_chemistry: string;
  charge_port: string;
  v2l: boolean;
  drive: "FWD" | "RWD" | "AWD";
  power_kw: number | null;
  power_ps: number | null;
  accel_0_100_s: number | string | null;
  top_speed_kmh: number | null;
  trunk_l: number | null;
  frunk_l: number | null;
  towing_kg: number | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  battery_gross_kwh: number | string | null;
};

/** The public listing read: every column, plus
 *  · the slugs of the linked catalog model and variant (the stable keys the
 *    Marke → Modell → Variante filter puts in the URL) and the variant's
 *    catalog facts — AC power, voltage, chemistry, trunk, towing, size;
 *  · the price history (Preis gesenkt, Merkliste changes);
 *  · the seller's public garage slug and verification.
 *  listings → vehicle_variants has two FKs (variant_id alone and the
 *  composite with model_id), so both embeds name theirs. */
export const LISTING_SELECT =
  "*,catalog_model:vehicle_models!listings_model_id_fkey(slug)," +
  "catalog_variant:vehicle_variants!listings_variant_id_fkey(slug,ac_max_kw,system_voltage_v," +
  "cell_chemistry,charge_port,v2l,drive,power_kw,power_ps,accel_0_100_s,top_speed_kmh,trunk_l," +
  "frunk_l,towing_kg,length_mm,width_mm,height_mm,battery_gross_kwh)," +
  "price_history:listing_price_history(price,changed_at)," +
  "seller_profile:profiles!listings_owner_fkey(slug,verified)";
