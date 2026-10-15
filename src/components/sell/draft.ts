import type { Equipment, Segment } from "../../data/evData";
import { EMPTY_CHOICE, type VehicleChoice } from "../../hooks/useVehicleCatalog";
import type { QualityInput } from "../../lib/quality";
import type { CatalogVariantEmbed, ListingRow, ListingRowStatus } from "../../lib/supabase";
import type { ListingSpecs } from "../../lib/vehicleCatalog";

/* ============================================================================
   The sell wizard's state (Konzept §4.8) and its two homes:

   · localStorage, from the first keystroke — a reload, a login detour or a
     closed tab never loses an unfinished listing;
   · the `listings` row (status ENTWURF), as soon as everything the table
     requires is there (vehicle, year, km, place, SOH, price). From then on
     every step change saves; `?id=` opens the same wizard for editing.
   ============================================================================ */

export type Vehicle = {
  brand: string;
  model: string;
  /** Empty when unknown. */
  variant: string;
  modelId: string | null;
  variantId: string | null;
  /** Catalog facts of the variant, for the preview. */
  embed: CatalogVariantEmbed | null;
  modelSlug: string | null;
  launchYear: number | null;
  endYear: number | null;
  /** The manufacturer's battery warranty for this variant (catalog). */
  warranty: CatalogWarranty | null;
};

export type CatalogWarranty = { years: number; km: number | null; soh: number | null; conditional: boolean };

type WarrantyCols = {
  battery_warranty_years?: number | null;
  battery_warranty_km?: number | null;
  battery_warranty_soh_pct?: number | null;
  battery_warranty_conditional?: boolean | null;
};

export function catalogWarranty(v: WarrantyCols | null | undefined): CatalogWarranty | null {
  if (!v?.battery_warranty_years) return null;
  return {
    years: v.battery_warranty_years,
    km: v.battery_warranty_km ?? null,
    soh: v.battery_warranty_soh_pct ?? null,
    conditional: Boolean(v.battery_warranty_conditional),
  };
}

/** The uploaded walkthrough: R2 key, length, poster in listing-photos. */
export type DraftVideo = { path: string; seconds: number; poster: string | null };

/** Text fields as typed; converted on save. Months are "YYYY-MM". */
export type Draft = {
  id: string | null;
  slug: string | null;
  status: ListingRowStatus;
  createdAt: string | null;
  choice: VehicleChoice;
  vehicle: Vehicle | null;
  specs: ListingSpecs | null;
  year: string;
  km: string;
  plz: string;
  ort: string;
  mfk: string;
  accidentFree: boolean | null;
  owners: string;
  serviceBook: boolean | null;
  warrantyUntil: string;
  soh: string;
  bwUntil: string;
  bwKm: string;
  bwSoh: string;
  equipment: Equipment;
  photos: string[];
  video: DraftVideo | null;
  price: string;
  negotiable: boolean;
  note: string;
};

export const EMPTY_DRAFT: Draft = {
  id: null,
  slug: null,
  status: "ENTWURF",
  createdAt: null,
  choice: EMPTY_CHOICE,
  vehicle: null,
  specs: null,
  year: "",
  km: "",
  plz: "",
  ort: "",
  mfk: "",
  accidentFree: null,
  owners: "",
  serviceBook: null,
  warrantyUntil: "",
  soh: "",
  bwUntil: "",
  bwKm: "",
  bwSoh: "",
  equipment: {},
  photos: [],
  video: null,
  price: "",
  negotiable: false,
  note: "",
};

export const MAX_PHOTOS = 12;
export const NOTE_MAX = 2000;

/* ---------- Local autosave ------------------------------------------------- */

const KEY = "ev4u.sell.v1";

export function loadLocal(): { draft: Draft; step: number } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { draft?: Partial<Draft>; step?: number };
    if (!v.draft || typeof v.draft !== "object") return null;
    return { draft: { ...EMPTY_DRAFT, ...v.draft, id: null }, step: Number(v.step) || 0 };
  } catch {
    return null;
  }
}

export function saveLocal(draft: Draft, step: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ draft, step }));
  } catch {
    /* private mode — the database copy is the safety net */
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/* ---------- Validation ----------------------------------------------------- */

const int = (s: string): number => (s.trim() === "" ? NaN : Number(s.replace(/['’\s]/g, "")));
const inRange = (s: string, lo: number, hi: number) => {
  const v = int(s);
  return Number.isFinite(v) && v >= lo && v <= hi;
};
const optRange = (s: string, lo: number, hi: number) => s.trim() === "" || inRange(s, lo, hi);
const maxYear = () => new Date().getFullYear() + 1;

export const valid = {
  vehicle: (d: Draft) => Boolean(d.vehicle && d.specs),
  year: (d: Draft) => inRange(d.year, 2008, maxYear()),
  km: (d: Draft) => inRange(d.km, 0, 1_000_000),
  ort: (d: Draft) => /^\d{4}\s+\S/.test(d.ort.trim()),
  owners: (d: Draft) => optRange(d.owners, 1, 20),
  soh: (d: Draft) => inRange(d.soh, 50, 100),
  bwKm: (d: Draft) => optRange(d.bwKm, 1000, 1_000_000),
  bwSoh: (d: Draft) => optRange(d.bwSoh, 50, 100),
  price: (d: Draft) => inRange(d.price, 1, 3_000_000),
};

/** Per step: can the seller move on? */
export const STEP_VALID: ((d: Draft) => boolean)[] = [
  (d) => valid.vehicle(d),
  (d) => valid.year(d) && valid.km(d) && valid.ort(d) && valid.owners(d),
  (d) => valid.soh(d) && valid.bwKm(d) && valid.bwSoh(d),
  () => true,
  () => true,
  (d) => valid.price(d),
  () => true,
];

/** Everything the table requires — the row can exist. */
export const canPersist = (d: Draft) =>
  valid.vehicle(d) && valid.year(d) && valid.km(d) && valid.ort(d) && valid.soh(d) && valid.price(d) && valid.owners(d) && valid.bwKm(d) && valid.bwSoh(d);

/** Publishing also needs a photo. */
export const canPublish = (d: Draft) => canPersist(d) && d.photos.length > 0;

/* ---------- Conversion ----------------------------------------------------- */

const monthToDate = (m: string): string | null => (/^\d{4}-\d{2}$/.test(m) ? `${m}-01` : null);
const dateToMonth = (d: string | null): string => (d ? d.slice(0, 7) : "");
const optInt = (s: string): number | null => (s.trim() === "" ? null : int(s));

/** The columns the wizard writes. */
export function draftToRow(d: Draft): Partial<ListingRow> {
  const v = d.vehicle!;
  const s = d.specs!;
  const equipment: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(d.equipment)) {
    if (typeof val === "boolean" || (k === "color" && typeof val === "string" && val.trim())) equipment[k] = val;
  }
  return {
    brand: v.brand,
    model: v.model,
    variant: v.variant || null,
    model_id: v.modelId,
    variant_id: v.variantId,
    segment: s.segment,
    range_km: s.range_km,
    consumption: s.consumption,
    battery_kwh: s.battery_kwh,
    dc_kw: s.dc_kw,
    charge_min: s.charge_min,
    seats: s.seats,
    weight_kg: s.weight_kg,
    bidi: s.bidi,
    price_new: s.price_new,
    year: int(d.year),
    km: int(d.km),
    ort: d.ort.trim(),
    mfk_date: monthToDate(d.mfk),
    accident_free: d.accidentFree,
    owners: optInt(d.owners),
    service_book: d.serviceBook,
    warranty_until: monthToDate(d.warrantyUntil),
    soh: int(d.soh),
    battery_warranty_until: monthToDate(d.bwUntil),
    battery_warranty_km: optInt(d.bwKm),
    battery_warranty_soh_pct: optInt(d.bwSoh),
    equipment,
    photos: d.photos.slice(0, MAX_PHOTOS),
    video_path: d.video?.path ?? null,
    video_seconds: d.video ? Math.max(1, Math.round(d.video.seconds)) : null,
    video_poster: d.video?.poster ?? null,
    price: int(d.price),
    negotiable: d.negotiable,
    note: d.note.trim().slice(0, NOTE_MAX),
  };
}

export type FullRow = Omit<ListingRow, "catalog_model" | "catalog_variant"> & {
  catalog_model?: { slug: string; launch_year?: number | null; end_year?: number | null } | null;
  catalog_variant?: (CatalogVariantEmbed & WarrantyCols) | null;
};

export function rowToDraft(r: FullRow): Draft {
  return {
    ...EMPTY_DRAFT,
    id: r.id,
    slug: r.slug,
    status: r.status,
    createdAt: r.created_at,
    vehicle: {
      brand: r.brand,
      model: r.model,
      variant: r.variant ?? "",
      modelId: r.model_id,
      variantId: r.variant_id,
      embed: r.catalog_variant ?? null,
      modelSlug: r.catalog_model?.slug ?? null,
      launchYear: r.catalog_model?.launch_year ?? null,
      endYear: r.catalog_model?.end_year ?? null,
      warranty: catalogWarranty(r.catalog_variant),
    },
    specs: {
      segment: r.segment as Segment,
      range_km: r.range_km,
      consumption: Number(r.consumption),
      battery_kwh: Number(r.battery_kwh),
      dc_kw: r.dc_kw,
      charge_min: r.charge_min,
      seats: r.seats,
      weight_kg: r.weight_kg,
      bidi: r.bidi,
      price_new: r.price_new,
    },
    year: String(r.year),
    km: String(r.km),
    plz: /^\d{4}/.exec(r.ort)?.[0] ?? "",
    ort: r.ort,
    mfk: dateToMonth(r.mfk_date),
    accidentFree: r.accident_free,
    owners: r.owners === null ? "" : String(r.owners),
    serviceBook: r.service_book,
    warrantyUntil: dateToMonth(r.warranty_until),
    soh: String(r.soh),
    bwUntil: dateToMonth(r.battery_warranty_until),
    bwKm: r.battery_warranty_km === null ? "" : String(r.battery_warranty_km),
    bwSoh: r.battery_warranty_soh_pct === null ? "" : String(r.battery_warranty_soh_pct),
    equipment: (r.equipment ?? {}) as Equipment,
    photos: r.photos ?? [],
    video: r.video_path && r.video_seconds ? { path: r.video_path, seconds: r.video_seconds, poster: r.video_poster } : null,
    price: String(r.price),
    negotiable: r.negotiable,
    note: r.note ?? "",
  };
}

export function draftQuality(d: Draft): QualityInput {
  return {
    variant_id: d.vehicle?.variantId ?? null,
    photos: d.photos,
    note: d.note,
    battery_warranty_until: monthToDate(d.bwUntil),
    battery_warranty_km: optInt(d.bwKm),
    mfk_date: monthToDate(d.mfk),
    accident_free: d.accidentFree,
    owners: optInt(d.owners),
    service_book: d.serviceBook,
    equipment: d.equipment as Record<string, unknown>,
    ort: d.ort,
  };
}

/** A URL-safe slug: «tesla-model-y-k3f9». */
export function newSlug(brand: string, model: string): string {
  const base = `${brand}-${model}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "e-auto"}-${Math.random().toString(36).slice(2, 6)}`;
}
