import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ============================================================================
   Supabase client — the only backend EV4U needs.
   The publishable key is public by design; every permission is enforced by
   Row Level Security in the database. When env vars are missing (e.g. a
   fork without a project), `supabase` is null and the app falls back to the
   bundled seed listings — the site never goes dark.
   ============================================================================ */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;

/** Public URL for a photo stored in the listing-photos bucket. We store
 *  bucket paths in the DB and derive URLs here. */
export function photoUrl(path: string): string {
  return `${url}/storage/v1/object/public/listing-photos/${path}`;
}

/** Database row shape of public.listings (snake_case). */
export type ListingRow = {
  id: string;
  owner: string | null;
  slug: string;
  brand: string;
  model: string;
  segment: "KOMPAKT" | "LIMOUSINE" | "KOMBI" | "SUV";
  year: number;
  km: number;
  price: number;
  price_new: number | null;
  range_km: number;
  consumption: number;
  charge_min: number;
  dc_kw: number;
  battery_kwh: number;
  weight_kg: number | null;
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
};
