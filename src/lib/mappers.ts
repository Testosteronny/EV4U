import type { Equipment, Listing, ListingSpec, ListingStatus } from "../data/evData";
import { listingQuality } from "./quality";
import type { CatalogVariantEmbed, ListingRow } from "./supabase";

/* ============================================================================
   DB row (snake_case) → frontend Listing. Shared by the listings store, the
   build-time prerendering and every page that reads a single listing.
   ============================================================================ */

const DAY = 86_400_000;

/** `numeric` can arrive as a string depending on the driver. */
const num = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

/** "2031-03-01" → "2031-03" — warranty and MFK dates are month-precise. */
const month = (d: string | null): string | undefined => (d ? d.slice(0, 7) : undefined);

function toSpec(v: CatalogVariantEmbed): ListingSpec {
  return {
    acKw: Number(v.ac_max_kw),
    voltage: v.system_voltage_v,
    chemistry: v.cell_chemistry,
    chargePort: v.charge_port,
    v2l: v.v2l,
    drive: v.drive,
    powerKw: v.power_kw,
    powerPs: v.power_ps,
    accel: num(v.accel_0_100_s),
    topSpeed: v.top_speed_kmh,
    trunkL: v.trunk_l,
    frunkL: v.frunk_l,
    towingKg: v.towing_kg,
    lengthMm: v.length_mm,
    widthMm: v.width_mm,
    heightMm: v.height_mm,
    batteryGross: num(v.battery_gross_kwh),
  };
}

const EQUIPMENT_FLAGS = [
  "heat_pump",
  "tow_hitch",
  "winter_tyres",
  "cable_type2",
  "cable_mode2",
  "panorama_roof",
  "adaptive_cruise",
  "camera_360",
  "heated_seats",
] as const;

/** Keep only the keys the checklist knows, with the right types. */
export function toEquipment(raw: Record<string, unknown> | null | undefined): Equipment {
  const out: Equipment = {};
  if (!raw) return out;
  for (const k of EQUIPMENT_FLAGS) if (typeof raw[k] === "boolean") out[k] = raw[k] as boolean;
  if (typeof raw.color === "string" && raw.color.trim()) out.color = raw.color.trim().slice(0, 40);
  return out;
}

/** The previous asking price, if the current one is a cut made in the
 *  last 30 days. History entries are compared newest first. */
function priceCut(
  price: number,
  history: { price: number; at: string }[],
): number | undefined {
  const desc = [...history].sort((a, b) => b.at.localeCompare(a.at));
  const i = desc.findIndex((h) => h.price !== price);
  if (i <= 0) return undefined;
  const before = desc[i].price;
  const since = Date.parse(desc[i - 1].at);
  return before > price && Date.now() - since <= 30 * DAY ? before : undefined;
}

export function rowToListing(r: ListingRow): Listing {
  const history = (r.price_history ?? [])
    .map((h) => ({ price: h.price, at: h.changed_at }))
    .sort((a, b) => a.at.localeCompare(b.at));
  const status: ListingStatus =
    r.status === "RESERVIERT" || r.status === "VERKAUFT" ? r.status : "AKTIV";

  return {
    id: r.slug,
    brand: r.brand,
    model: r.model,
    variant: r.variant ?? undefined,
    modelSlug: r.catalog_model?.slug,
    variantSlug: r.catalog_variant?.slug,
    segment: r.segment,
    year: r.year,
    km: r.km,
    price: r.price,
    priceNew: r.price_new ?? undefined,
    previousPrice: priceCut(r.price, history),
    priceHistory: history,
    negotiable: r.negotiable,
    range: r.range_km,
    consumption: Number(r.consumption),
    chargeMin: r.charge_min,
    dcKw: r.dc_kw,
    battery: Number(r.battery_kwh),
    weightKg: r.weight_kg ?? undefined,
    soh: r.soh,
    bidi: r.bidi,
    seats: r.seats,
    postedDays: Math.max(0, Math.floor((Date.now() - Date.parse(r.created_at)) / DAY)),
    createdAt: r.created_at,
    quality: listingQuality(r).score,
    seller: r.seller_name,
    sellerType: r.seller_type,
    sellerSlug: r.seller_profile?.slug ?? undefined,
    sellerVerified: r.seller_profile?.verified ?? false,
    ort: r.ort,
    status,
    note: r.note,
    warranty: r.battery_warranty_until || r.battery_warranty_km
      ? {
          until: month(r.battery_warranty_until),
          km: r.battery_warranty_km ?? undefined,
          soh: r.battery_warranty_soh_pct ?? undefined,
        }
      : undefined,
    condition: {
      mfk: month(r.mfk_date),
      accidentFree: r.accident_free ?? undefined,
      owners: r.owners ?? undefined,
      serviceBook: r.service_book ?? undefined,
      warrantyUntil: month(r.warranty_until),
    },
    equipment: toEquipment(r.equipment),
    spec: r.catalog_variant ? toSpec(r.catalog_variant) : undefined,
    uid: r.id,
    owner: r.owner,
    isDemo: r.is_demo,
    photos: r.photos ?? [],
  };
}
