import type { BatteryWarranty, Equipment, Listing, ListingSpec } from "../data/evData";
import { fmtCH } from "../utils/swiss";

/* ============================================================================
   EV facts, derived from a listing — the plain-language answers v3 puts on
   cards, in filters and on the detail page («Garantie bis 2031», «lädt an
   deiner Wallbox in 4 h 05»). One place, so the card, the filter and the
   detail page can never disagree about what «Garantie aktiv» means.
   ============================================================================ */

/** "2031-03" → "03/2031" */
export const fmtMonth = (ym: string): string => `${ym.slice(5, 7)}/${ym.slice(0, 4)}`;

/** Current month as "YYYY-MM" (local time). */
export function thisMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Still covered: the date has not passed and the km limit is not reached.
 *  A warranty with only a km limit counts as long as the km do. */
export function warrantyActive(l: Pick<Listing, "warranty" | "km">, now = new Date()): boolean {
  const w = l.warranty;
  if (!w || (!w.until && !w.km)) return false;
  if (w.until && w.until < thisMonth(now)) return false;
  if (w.km && l.km >= w.km) return false;
  return true;
}

/** «bis 03/2031 oder 192'000 km, min. 70 %» — the seller's terms in one line. */
export function warrantyText(w: BatteryWarranty): string {
  const parts: string[] = [];
  if (w.until) parts.push(`bis ${fmtMonth(w.until)}`);
  if (w.km) parts.push(`${w.until ? "oder " : "bis "}${fmtCH(w.km)} km`);
  let s = parts.join(" ");
  if (w.soh) s += `${s ? ", " : ""}min. ${w.soh} % Kapazität`;
  return s;
}

/** Card badge: the year is enough there. */
export function warrantyBadge(l: Pick<Listing, "warranty" | "km">): string | null {
  if (!warrantyActive(l)) return null;
  const w = l.warranty!;
  return w.until ? `Garantie bis ${w.until.slice(0, 4)}` : `Garantie bis ${fmtCH(w.km!)} km`;
}

/** 800-V class (any system voltage ≥ 700 V). */
export const isHighVoltage = (l: Pick<Listing, "spec">): boolean => (l.spec?.voltage ?? 0) >= 700;

/** Online for at most three days. */
export const isFresh = (l: Pick<Listing, "postedDays">): boolean => l.postedDays <= 3;

/* ---------- Laden ----------------------------------------------------------- */

/** Home charging options of the Fahrprofil («Laden zuhause»). */
export const HOME_CHARGERS = [
  { kw: 2.3, label: "Steckdose", hint: "2.3 kW" },
  { kw: 3.7, label: "Wallbox 1-phasig", hint: "3.7 kW" },
  { kw: 11, label: "Wallbox", hint: "11 kW" },
  { kw: 22, label: "Wallbox 22 kW", hint: "22 kW" },
] as const;

/** Onboard AC limit when the catalog doesn't know it — the common value. */
const AC_DEFAULT_KW = 11;
/** AC charging losses (charger + battery), roughly 10 %. */
const AC_EFFICIENCY = 0.9;

/** Effective AC power at a given home charger: the weaker of the two. */
export function acPower(l: Pick<Listing, "spec">, chargerKw: number): number {
  return Math.min(chargerKw, l.spec?.acKw ?? AC_DEFAULT_KW);
}

/** Hours to charge from `from` to `to` % at home. */
export function homeChargeHours(
  l: Pick<Listing, "battery" | "spec">,
  chargerKw: number,
  from = 20,
  to = 80,
): number {
  const kwh = (l.battery * (to - from)) / 100;
  return kwh / (acPower(l, chargerKw) * AC_EFFICIENCY);
}

/** «4 h 05», «45 min» */
export function fmtDuration(hours: number): string {
  const total = Math.round(hours * 60);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

/** What the cell chemistry means for daily use. */
export function chemistryNote(chemistry: string): string | null {
  if (chemistry === "LFP") {
    return "LFP-Zellen: dürfen täglich auf 100 % geladen werden und gelten als besonders langlebig. Im Winter etwas mehr Reichweitenverlust.";
  }
  if (chemistry === "NMC") {
    return "NMC-Zellen: im Alltag bis 80 % laden, für lange Fahrten auf 100 %. Dicht gepackt, viel Reichweite pro Kilo.";
  }
  return null;
}

export const DRIVE_LABEL: Record<ListingSpec["drive"], string> = {
  FWD: "Frontantrieb",
  RWD: "Heckantrieb",
  AWD: "Allrad",
};

/* ---------- Ausstattung ----------------------------------------------------- */

export type EquipmentFlag = Exclude<keyof Equipment, "color">;

/** The seller's checklist, in the order buyers ask about it. */
export const EQUIPMENT_ITEMS: { key: EquipmentFlag; label: string }[] = [
  { key: "heat_pump", label: "Wärmepumpe" },
  { key: "tow_hitch", label: "Anhängerkupplung" },
  { key: "winter_tyres", label: "Winterräder" },
  { key: "cable_type2", label: "Ladekabel Typ 2" },
  { key: "cable_mode2", label: "Ladekabel für die Haushaltssteckdose" },
  { key: "adaptive_cruise", label: "Abstandstempomat" },
  { key: "camera_360", label: "360°-Kamera" },
  { key: "heated_seats", label: "Sitzheizung" },
  { key: "panorama_roof", label: "Panoramadach" },
];

/** «Antwortet meist innert 2 h» from the median minutes to a first reply. */
export function responseLabel(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (minutes <= 60) return "Antwortet meist innert einer Stunde";
  if (minutes <= 180) return "Antwortet meist innert 3 Stunden";
  if (minutes <= 24 * 60) return "Antwortet meist am selben Tag";
  return "Antwortet meist innert einiger Tage";
}

/* ---------- Ort ------------------------------------------------------------- */

/** «4600 Olten» → "4600" */
export function plzOf(l: Pick<Listing, "ort">): string | null {
  return /^(\d{4})\b/.exec(l.ort.trim())?.[1] ?? null;
}

/** «4600 Olten» → «Olten» */
export function placeOf(l: Pick<Listing, "ort">): string {
  return l.ort.replace(/^\d{4}\s*/, "").trim() || l.ort;
}

/* ---------- Katalog --------------------------------------------------------- */

/** Catalog model slug «tesla_model-y» → /modelle/tesla/model-y */
export function modelPath(modelSlug: string): string {
  const i = modelSlug.indexOf("_");
  return i < 0 ? `/modelle/${modelSlug}` : `/modelle/${modelSlug.slice(0, i)}/${modelSlug.slice(i + 1)}`;
}

/** Discount against the Swiss list price when new, in % (rounded). */
export function belowNewPct(l: Pick<Listing, "price" | "priceNew">): number | null {
  if (!l.priceNew || l.priceNew <= l.price) return null;
  return Math.round((1 - l.price / l.priceNew) * 100);
}
