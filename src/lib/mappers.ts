import type { Listing } from "../data/evData";
import type { ListingRow } from "./supabase";

/** DB row (snake_case) → frontend Listing. Shared by the listings store
 *  and the build-time prerendering of /inserat/[slug]. */
export function rowToListing(r: ListingRow): Listing {
  return {
    id: r.slug,
    brand: r.brand,
    model: r.model,
    segment: r.segment,
    year: r.year,
    km: r.km,
    price: r.price,
    range: r.range_km,
    consumption: Number(r.consumption),
    chargeMin: r.charge_min,
    dcKw: r.dc_kw,
    battery: Number(r.battery_kwh),
    soh: r.soh,
    bidi: r.bidi,
    seats: r.seats,
    postedDays: Math.max(
      0,
      Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86_400_000),
    ),
    seller: r.seller_name,
    sellerType: r.seller_type,
    ort: r.ort,
    status: r.status === "RESERVIERT" ? "RESERVIERT" : "AKTIV",
    note: r.note,
    uid: r.id,
    owner: r.owner,
    photos: r.photos ?? [],
    priceNew: r.price_new ?? undefined,
    weightKg: r.weight_kg ?? undefined,
  };
}
