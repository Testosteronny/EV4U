import type { Segment } from "../data/evData";
import { fmtCH } from "../utils/swiss";
import catalogMeta from "../data/vehicleCatalogMeta.json";

/* ============================================================================
   Fahrzeugkatalog — Marke → Modell → Variante.

   Referenzdaten aus der EV4U-Variantendatenbank: jedes in Europa neu
   erhältliche E-Auto plus die relevanten Occasion-Modelle, eine Zeile je
   Antriebs-/Batterievariante (scripts/import-vehicle-catalog.mjs →
   Supabase). Hier stehen die Typen und alles, was sich aus dem Katalog
   ableitet, ohne React: welches Inserat-Segment, welche Kurzfakten, welche
   Startwerte ein neues Inserat bekommt.
   ============================================================================ */

export type Availability = "LIEFERBAR" | "IMPORT" | "ANGEKUENDIGT" | "AUSLAUF" | "OCCASION";

export type CatalogSegment =
  | "Kleinwagen"
  | "Kompaktklasse"
  | "Mittelklasse"
  | "Oberklasse"
  | "SUV"
  | "VAN/BUS"
  | "Sportwagen"
  | "Pick-up";

export type BodyType =
  | "Schrägheck"
  | "Limousine"
  | "Kombi"
  | "SUV"
  | "Coupé-SUV"
  | "Coupé"
  | "Cabrio"
  | "Roadster"
  | "Van"
  | "Hochdachkombi"
  | "Microcar"
  | "Pick-up";

export type CatalogModel = {
  id: string;
  slug: string;
  name: string;
  segment: CatalogSegment;
  body_type: BodyType;
  availability: Availability;
  /** Wie publiziert: «2021 (Facelift 2024)», «Herbst 2026», «2019–2022». */
  market_launch: string | null;
  launch_year: number | null;
  /** Produktionsende — nur bei Occasion-Modellen. */
  end_year: number | null;
  remark: string | null;
};

export type CatalogBrand = {
  id: string;
  slug: string;
  name: string;
  models: CatalogModel[];
};

export type CatalogVariant = {
  id: string;
  slug: string;
  name: string;
  vehicle_class: "M1" | "N1" | "L6e" | "L7e" | "L6e/L7e";
  seats: number;
  drive: "FWD" | "RWD" | "AWD";
  motors: number;
  power_kw: number | null;
  power_ps: number | null;
  accel_0_100_s: number | null;
  top_speed_kmh: number | null;
  battery_gross_kwh: number | null;
  /** Nutzbar — der Wert, mit dem Reichweite gerechnet wird. */
  battery_net_kwh: number | null;
  cell_chemistry: string;
  system_voltage_v: number;
  range_wltp_km: number | null;
  consumption_kwh_100km: number | null;
  /** null = kein DC-Laden (Leichtfahrzeuge) oder noch nicht publiziert. */
  dc_max_kw: number | null;
  dc_10_80_min: number | null;
  ac_max_kw: number;
  charge_port: string;
  v2l: boolean;
  trunk_l: number | null;
  frunk_l: number | null;
  towing_kg: number | null;
  curb_weight_kg: number | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  battery_warranty_years: number | null;
  battery_warranty_km: number | null;
  battery_warranty_conditional: boolean;
  battery_warranty_soh_pct: number | null;
  /** Schweizer Listenpreis neu, ohne Optionen — Referenz, kein Angebot. */
  price_new_chf: number | null;
};

/** Ausgabe, Stand und Umfang des Katalogs — vom Import mitgeschrieben. */
export const CATALOG_META = catalogMeta;

/** «2026-09-23» → «23.09.2026». */
export const catalogEdition = (): string => CATALOG_META.edition.split("-").reverse().join(".");

/* ---------- Ordnung --------------------------------------------------------
   Natürlich sortiert und ohne Akzent-Gewicht: «ID.3» vor «ID.10», «Škoda»
   bei S und nicht hinter Z (wohin es die Datenbank-Sortierung legt). */

const collator = new Intl.Collator("de-CH", { numeric: true, sensitivity: "base" });

export const byName = (a: { name: string }, b: { name: string }): number =>
  collator.compare(a.name, b.name);

/** Varianten von der Einstiegs- zur Topversion: nach Neupreis, dann
 *  Leistung. Occasion-Modelle haben keinen Neupreis mehr — dort trägt die
 *  Leistung allein. */
export function byEntryLevel(a: CatalogVariant, b: CatalogVariant): number {
  return (
    nullsLast(a.price_new_chf, b.price_new_chf) ||
    nullsLast(a.power_kw, b.power_kw) ||
    byName(a, b)
  );
}

const nullsLast = (x: number | null, y: number | null): number =>
  x === y ? 0 : x === null ? 1 : y === null ? -1 : x - y;

/* ---------- Modell-Auswahl ------------------------------------------------- */

/** Gruppen der Modell-Liste. Wer ein gebrauchtes Auto verkauft, sucht
 *  zuerst im aktuellen Angebot, dann bei den ausgelaufenen Modellen;
 *  Angekündigtes steht am Schluss. */
export const MODEL_GROUPS: { label: string; includes: Availability[] }[] = [
  { label: "Aktuelle Modelle", includes: ["LIEFERBAR", "IMPORT", "AUSLAUF"] },
  { label: "Nicht mehr neu erhältlich", includes: ["OCCASION"] },
  { label: "Angekündigt", includes: ["ANGEKUENDIGT"] },
];

/** Name plus das, was beim Wählen hilft: Bauzeit, Import, Auslauf. */
export function modelOptionLabel(m: CatalogModel): string {
  switch (m.availability) {
    case "IMPORT":
      return `${m.name} · nur Import`;
    case "AUSLAUF":
      return `${m.name} · Auslauf`;
    case "OCCASION":
      return m.launch_year && m.end_year
        ? `${m.name} · ${m.launch_year}–${m.end_year}`
        : m.name;
    case "ANGEKUENDIGT":
      return m.launch_year ? `${m.name} · ab ${m.launch_year}` : `${m.name} · Termin offen`;
    default:
      return m.name;
  }
}

/* ---------- Variante → Inserat --------------------------------------------- */

/** Katalogklasse + Karosserie → die vier Segmente von Filter und Zeichnung.
 *  Die Karosserie entscheidet, wo sie eindeutig ist (ein Kombi der
 *  Oberklasse ist ein Kombi, keine Limousine); beim Schrägheck die Klasse. */
export function toListingSegment(m: Pick<CatalogModel, "segment" | "body_type">): Segment {
  switch (m.body_type) {
    case "Kombi":
    case "Van":
    case "Hochdachkombi":
      return "KOMBI";
    case "SUV":
    case "Coupé-SUV":
    case "Pick-up":
      return "SUV";
    case "Limousine":
    case "Coupé":
    case "Cabrio":
    case "Roadster":
      return "LIMOUSINE";
    default:
      if (m.segment === "SUV") return "SUV";
      return m.segment === "Mittelklasse" || m.segment === "Oberklasse" || m.segment === "Sportwagen"
        ? "LIMOUSINE"
        : "KOMPAKT";
  }
}

const DRIVE_LABEL: Record<CatalogVariant["drive"], string> = {
  FWD: "Front",
  RWD: "Heck",
  AWD: "Allrad",
};

/** Die Fakten, an denen man seine Variante erkennt — Batterie, Leistung,
 *  Antrieb, Reichweite. Leer, solange der Hersteller nichts publiziert hat. */
export function variantFacts(v: CatalogVariant): string[] {
  return [
    v.battery_net_kwh !== null && `${v.battery_net_kwh} kWh`,
    v.power_ps !== null && `${fmtCH(v.power_ps)} PS`,
    DRIVE_LABEL[v.drive],
    v.range_wltp_km !== null && `${fmtCH(v.range_wltp_km)} km WLTP`,
  ].filter((x): x is string => Boolean(x));
}

/** «8 J. / 160'000 km», «bis 10 J. / 250'000 km». */
export function warrantyLabel(v: CatalogVariant): string | null {
  if (v.battery_warranty_years === null) return null;
  const km = v.battery_warranty_km ? ` / ${fmtCH(v.battery_warranty_km)} km` : "";
  return `${v.battery_warranty_conditional ? "bis " : ""}${v.battery_warranty_years} J.${km}`;
}

/** Die technischen Spalten eines Inserats. */
export type ListingSpecs = {
  segment: Segment;
  range_km: number;
  consumption: number;
  battery_kwh: number;
  dc_kw: number | null;
  charge_min: number | null;
  seats: number;
  weight_kg: number | null;
  bidi: boolean;
  price_new: number | null;
};

/** Platzhalter für Pflichtwerte, die der Katalog nicht liefern kann
 *  (Variante unbekannt, Marke nicht im Katalog). Das Inserat startet als
 *  privater Entwurf; der Verkäufer korrigiert sie im Konto, bevor er
 *  publiziert. Alles Optionale bleibt dagegen leer, statt erfunden zu
 *  werden — ein Leichtfahrzeug lädt eben nicht mit «150 kW DC». */
export const SPEC_PLACEHOLDERS = { range_km: 400, consumption: 16.8, battery_kwh: 60, seats: 5 };

/** Grenzen der Inserat-Spalten (siehe Migration vehicle_catalog_v2). */
const WEIGHT_RANGE = [300, 4000] as const;

/** Startwerte eines neuen Inserats aus Modell und Variante. */
export function listingSpecs(
  model: CatalogModel | null,
  variant: CatalogVariant | null,
): ListingSpecs {
  const weight = variant?.curb_weight_kg ?? null;
  return {
    segment: model ? toListingSegment(model) : "LIMOUSINE",
    range_km: variant?.range_wltp_km ?? SPEC_PLACEHOLDERS.range_km,
    consumption: variant?.consumption_kwh_100km ?? SPEC_PLACEHOLDERS.consumption,
    battery_kwh: variant?.battery_net_kwh ?? SPEC_PLACEHOLDERS.battery_kwh,
    dc_kw: variant?.dc_max_kw ?? null,
    charge_min: variant?.dc_10_80_min ?? null,
    seats: variant?.seats ?? SPEC_PLACEHOLDERS.seats,
    weight_kg: weight !== null && weight >= WEIGHT_RANGE[0] && weight <= WEIGHT_RANGE[1] ? weight : null,
    // Das Inserat kennt nur «kann rückspeisen» — V2L ist genau das.
    bidi: variant?.v2l ?? false,
    price_new: variant?.price_new_chf ?? null,
  };
}

/** Passt der Jahrgang zur Bauzeit des Modells? Ein Hinweis, keine Sperre:
 *  Erstzulassung und Marktstart liegen gern ein Jahr auseinander. */
export function yearHint(
  model: Pick<CatalogModel, "name" | "launch_year" | "end_year"> | null,
  year: number,
): string | null {
  if (!model || !Number.isFinite(year) || year < 1990) return null;
  if (model.launch_year && year < model.launch_year - 1) {
    return `Der ${model.name} kam erst ${model.launch_year} auf den Markt — Jahrgang prüfen.`;
  }
  if (model.end_year && year > model.end_year + 1) {
    return `Der ${model.name} wurde bis ${model.end_year} gebaut — Jahrgang prüfen.`;
  }
  return null;
}
