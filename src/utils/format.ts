import type { Listing, Segment } from "../data/evData";

/* ============================================================================
   Anzeige-Namen — Regel 1 des Konzepts, endlich auch für die Daten.

   Das Design verbietet Versalien ausserhalb des Eyebrows, aber der ganze
   Katalog stand in Grossbuchstaben: «RENAULT 5 E-TECH 52», «VW ID.7 TOURER
   PRO S». Die Regel galt für das Chrom und nicht für den Inhalt — also
   genau dort nicht, wo am meisten Text steht.

   Die Seed-Daten sind gemischt gesetzt; live eingegebene Zeilen können es
   nicht sein (Altbestand, Import, Tippfehler). Diese Datei normalisiert
   deshalb defensiv beim ANZEIGEN, nicht beim Speichern:

   · Ein reines Versalwort wird zu Grossbuchstabe + Kleinbuchstaben —
     «TOURING» → «Touring».
   · Ausser es steht in KEEP (Kürzel und Antriebsbezeichnungen: RWD, GT,
     e-tron) oder enthält Ziffern («ID.7», «EV6», «Q6» bleiben, wie sie sind).
   · Gemischt geschriebene Eingaben werden nie angefasst — wer «e-tron»
     schreibt, meint «e-tron».
   ============================================================================ */

/** Marken, deren korrekte Schreibweise sich nicht ableiten lässt. */
const BRANDS: Record<string, string> = {
  BMW: "BMW",
  BYD: "BYD",
  VW: "VW",
  MG: "MG",
  DS: "DS",
  NIO: "Nio",
  KIA: "Kia",
  SERES: "Seres",
  XPENG: "XPeng",
  MINI: "Mini",
  SMART: "smart",
  CUPRA: "CUPRA",
  "MERCEDES-BENZ": "Mercedes-Benz",
  "ALFA ROMEO": "Alfa Romeo",
  "LAND ROVER": "Land Rover",
};

/** Modellkürzel, die Versal bleiben. Antriebe, Ausstattungen, Normen. */
const KEEP = new Set([
  "RWD", "AWD", "4WD", "FWD", "GT", "GTS", "GTX", "GTI", "RS", "AMG", "SUV",
  "LR", "SR", "SE", "SEL", "GLS", "GLX", "LT", "LTZ", "XLE", "EX", "SX",
  "PHEV", "BEV", "EV", "MHEV", "V2G", "V2L", "V2H", "AC", "DC", "HP", "PS",
  "N", "M", "S", "X", "Y", "R", "E",
  // Modellnamen, die der Hersteller selbst Versal setzt.
  "IONIQ", "EQS", "EQE", "EQA", "EQB", "EQC", "EQV", "EQT", "GLC", "GLE",
  "UX", "RZ", "ZS", "HS", "MX", "CX", "SU7",
]);

const ROMAN = /^[IVX]+$/;

/** Ein einzelnes Wort in Anzeigeschreibweise. */
function word(raw: string): string {
  if (!raw) return raw;
  // Gemischt geschrieben → der Verfasser wusste, was er tat.
  if (raw !== raw.toUpperCase()) return raw;
  if (KEEP.has(raw) || ROMAN.test(raw)) return raw;
  // Ziffern im Wort → Typenbezeichnung (ID.7, EV6, Q6, 77, 800V).
  if (/\d/.test(raw)) return raw;
  // Kürzel bis zwei Zeichen bleiben (VW, MG); alles andere wird gesetzt.
  if (raw.replace(/[^A-ZÀ-ÖØ-Þ]/g, "").length <= 2) return raw;
  return raw
    .split("-")
    .map((part) =>
      KEEP.has(part) || /\d/.test(part)
        ? part
        : part.charAt(0) + part.slice(1).toLowerCase(),
    )
    .join("-");
}

const titleCase = (s: string): string =>
  s.trim().split(/\s+/).map(word).join(" ");

/** Markenname in Anzeigeschreibweise: «RENAULT» → «Renault», «BMW» bleibt. */
export function brandName(brand: string): string {
  const key = brand.trim().toUpperCase();
  return BRANDS[key] ?? titleCase(brand);
}

/** Modellname in Anzeigeschreibweise: «5 E-TECH 52» → «5 E-Tech 52». */
export function modelName(model: string): string {
  return titleCase(model);
}

/** «Renault 5 E-Tech 52» — der Name, wie er überall auf der Seite steht. */
export function vehicleTitle(l: Pick<Listing, "brand" | "model">): string {
  return `${brandName(l.brand)} ${modelName(l.model)}`.trim();
}

/** Kurzform für enge Stellen (Vergleichsleiste): Marke + erstes Modellwort. */
export function vehicleShort(l: Pick<Listing, "brand" | "model">): string {
  return `${brandName(l.brand)} ${modelName(l.model).split(" ")[0]}`.trim();
}

/* ---------- Feste Vokabeln --------------------------------------------------
   Deutsche Substantive werden grossgeschrieben. Vorher stand im Quelltext
   überall `segment.toLowerCase()`, was «suv · Garage · 4600 Olten» ergab. */

export const SEGMENT_LABEL: Record<Segment, string> = {
  KOMPAKT: "Kompakt",
  LIMOUSINE: "Limousine",
  KOMBI: "Kombi",
  SUV: "SUV",
};

export const SELLER_LABEL: Record<Listing["sellerType"], string> = {
  PRIVAT: "Privat",
  GARAGE: "Garage",
};

/** Alle Zustände, die ein Inserat in der Datenbank annehmen kann. */
export const LISTING_STATI = ["ENTWURF", "AKTIV", "RESERVIERT", "VERKAUFT"] as const;
export type ListingStatusFull = (typeof LISTING_STATI)[number];

export const STATUS_LABEL: Record<ListingStatusFull, string> = {
  ENTWURF: "Entwurf",
  AKTIV: "Aktiv",
  RESERVIERT: "Reserviert",
  VERKAUFT: "Verkauft",
};
