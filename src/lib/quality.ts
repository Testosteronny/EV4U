import type { ListingRow } from "./supabase";

/* ============================================================================
   Inserat-Qualität (Konzept §4.8) — 0–100 %, with the next best actions.

   Every point is something a buyer asks about. The sell wizard shows the
   meter beside each step, /konto/inserate shows it per listing, and the
   account dashboard nudges the draft with the most to gain.
   ============================================================================ */

export type QualityInput = Pick<
  ListingRow,
  | "variant_id"
  | "photos"
  | "note"
  | "battery_warranty_until"
  | "battery_warranty_km"
  | "mfk_date"
  | "accident_free"
  | "owners"
  | "service_book"
  | "equipment"
  | "ort"
>;

type Check = { label: string; gain: number; done: (l: QualityInput) => boolean };

const CHECKS: Check[] = [
  { label: "Variante aus dem Katalog wählen", gain: 15, done: (l) => Boolean(l.variant_id) },
  { label: "Mindestens ein Foto", gain: 10, done: (l) => (l.photos?.length ?? 0) >= 1 },
  { label: "Fünf Fotos oder mehr", gain: 10, done: (l) => (l.photos?.length ?? 0) >= 5 },
  { label: "Acht Fotos, mit Cockpit und Ladeanschluss", gain: 5, done: (l) => (l.photos?.length ?? 0) >= 8 },
  { label: "Beschreibung mit mindestens 150 Zeichen", gain: 10, done: (l) => (l.note ?? "").trim().length >= 150 },
  {
    label: "Batteriegarantie angeben",
    gain: 15,
    done: (l) => Boolean(l.battery_warranty_until || l.battery_warranty_km),
  },
  { label: "Letzte MFK angeben", gain: 5, done: (l) => Boolean(l.mfk_date) },
  { label: "Unfallfrei ja oder nein", gain: 5, done: (l) => l.accident_free !== null },
  { label: "Anzahl Vorbesitzer", gain: 5, done: (l) => l.owners !== null },
  { label: "Serviceheft ja oder nein", gain: 5, done: (l) => l.service_book !== null },
  {
    label: "Ausstattung ankreuzen",
    gain: 10,
    done: (l) => Object.values(l.equipment ?? {}).filter((v) => typeof v === "boolean").length >= 3,
  },
  { label: "Ort mit Postleitzahl", gain: 5, done: (l) => /^\d{4}\s+\S/.test(l.ort.trim()) },
];

export function listingQuality(l: QualityInput): { score: number; next: { label: string; gain: number }[] } {
  let score = 0;
  const next: { label: string; gain: number }[] = [];
  for (const c of CHECKS) {
    if (c.done(l)) score += c.gain;
    else next.push({ label: c.label, gain: c.gain });
  }
  next.sort((a, b) => b.gain - a.gain);
  return { score, next };
}
