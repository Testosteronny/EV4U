import { fold, matchesQuery } from "../utils/search";
import { SEGMENT_LABEL } from "../utils/format";
import { fmtCH } from "../utils/swiss";
import { isHighVoltage, warrantyActive } from "./listingFacts";
import type { Listing, Segment } from "../data/evData";

/* ============================================================================
   Der Filterzustand des Katalogs — Definition an EINER Stelle.

   Die URL ist die Quelle der Wahrheit (`/inserate?seg=SUV&preis=40000`):
   teilbar, als Lesezeichen speicherbar, reload-fest. Diese Datei übersetzt
   zwischen URL und Prädikaten und wird von der Filter-Seitenleiste, der
   Schnellsuche, den Trefferzahlen, den Filter-Chips, dem Finder, der
   KI-Suche, den Suchabos und den Blog-Teasern benutzt.

   Zahlen: 0 heisst immer «kein Filter».
   ============================================================================ */

export const SEGMENTS: Segment[] = ["KOMPAKT", "LIMOUSINE", "KOMBI", "SUV"];

export const PRICE_STEPS = [10000, 15000, 20000, 25000, 30000, 40000, 50000, 60000, 80000, 100000];
export const MONTHLY_STEPS = [100, 150, 200, 250, 300];
export const YEAR_STEPS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
export const KM_STEPS = [10000, 30000, 50000, 75000, 100000, 150000];
export const RANGE_STEPS = [200, 300, 400, 500, 600];
export const SOH_STEPS = [85, 90, 95];
export const DC_STEPS = [50, 100, 150, 200, 250];
export const TRUNK_STEPS = [300, 400, 500, 600];
export const SEAT_STEPS = [4, 5, 7];
export const RADIUS_STEPS = [10, 25, 50, 100];

/** Begleitparameter der KI-Suche — Erklärtext, keine Filter. */
export const AI_KEYS = ["ai", "airx", "aino"] as const;

export type Anbieter = "" | "PRIVAT" | "GARAGE";

export type Filters = {
  q: string;
  seg: Segment | "";
  /** Markenname, gross/klein und Akzente egal — «TESLA» (KI-Suche, alte
   *  Links) trifft dasselbe wie «Tesla» (Katalog). */
  marke: string;
  /** Katalog-Slug des Modells (vehicle_models.slug), "" = alle. */
  modell: string;
  /** Katalog-Slug der Variante (vehicle_variants.slug), "" = alle. */
  variante: string;
  /** Höchstpreis */
  preis: number;
  /** Mindestpreis (Budget-Einstiege «15–25'000») */
  preisvon: number;
  /** Betrieb pro Monat höchstens — gerechnet mit dem Fahrprofil. */
  betrieb: number;
  /** Jahrgang ab */
  jahr: number;
  /** km höchstens */
  km: number;
  reichweite: number;
  soh: number;
  garantie: boolean;
  /** DC-Ladeleistung ab, kW */
  laden: number;
  v800: boolean;
  ac22: boolean;
  v2l: boolean;
  ahk: boolean;
  allrad: boolean;
  waermepumpe: boolean;
  kofferraum: number;
  /** Sitze ab */
  sitze: number;
  unfallfrei: boolean;
  anbieter: Anbieter;
  /** Umkreis in km um die PLZ (`plz` in der URL, sonst die des Fahrprofils). */
  umkreis: number;
};

export const DEFAULT_FILTERS: Filters = {
  q: "",
  seg: "",
  marke: "",
  modell: "",
  variante: "",
  preis: 0,
  preisvon: 0,
  betrieb: 0,
  jahr: 0,
  km: 0,
  reichweite: 0,
  soh: 0,
  garantie: false,
  laden: 0,
  v800: false,
  ac22: false,
  v2l: false,
  ahk: false,
  allrad: false,
  waermepumpe: false,
  kofferraum: 0,
  sitze: 0,
  unfallfrei: false,
  anbieter: "",
  umkreis: 0,
};

export type FilterKey = keyof Filters;
export const FILTER_KEYS = Object.keys(DEFAULT_FILTERS) as FilterKey[];

/** Was ein Prädikat ausser dem Inserat wissen muss: die Monatskosten (aus
 *  dem Fahrprofil) und die Entfernung (aus PLZ-Koordinaten). Beide sind
 *  null, solange sie nicht berechnet werden können. */
export type FilterContext = {
  monthly: (l: Listing) => number | null;
  distance: (l: Listing) => number | null;
};

const NO_CONTEXT: FilterContext = { monthly: () => null, distance: () => null };

type Predicate = (l: Listing, f: Filters, ctx: FilterContext) => boolean;

/** Ein Prädikat je Filterschlüssel. Getrennt gehalten, damit Facettenzahlen
 *  berechnet werden können: „wie viele Treffer gäbe dieser Wert, wenn alle
 *  ANDEREN Filter gesetzt bleiben?“ */
export const PREDICATES: Record<FilterKey, Predicate> = {
  q: (l, f) => matchesQuery(l, f.q),
  seg: (l, f) => !f.seg || l.segment === f.seg,
  marke: (l, f) => !f.marke || fold(l.brand) === fold(f.marke),
  // Modell und Variante treffen nur Inserate mit Katalog-Verknüpfung —
  // frei eingetippte Autos lassen sich nicht sicher zuordnen.
  modell: (l, f) => !f.modell || l.modelSlug === f.modell,
  variante: (l, f) => !f.variante || l.variantSlug === f.variante,
  preis: (l, f) => !f.preis || l.price <= f.preis,
  preisvon: (l, f) => l.price >= f.preisvon,
  betrieb: (l, f, ctx) => !f.betrieb || (ctx.monthly(l) ?? Infinity) <= f.betrieb,
  jahr: (l, f) => l.year >= f.jahr,
  km: (l, f) => !f.km || l.km <= f.km,
  reichweite: (l, f) => l.range >= f.reichweite,
  soh: (l, f) => l.soh >= f.soh,
  garantie: (l, f) => !f.garantie || warrantyActive(l),
  // Ohne DC-Wert zählt ein Inserat nur, solange kein Mindestwert gesetzt ist.
  laden: (l, f) => (l.dcKw ?? 0) >= f.laden,
  v800: (l, f) => !f.v800 || isHighVoltage(l),
  ac22: (l, f) => !f.ac22 || (l.spec?.acKw ?? 0) >= 22,
  v2l: (l, f) => !f.v2l || l.bidi,
  ahk: (l, f) => !f.ahk || l.equipment?.tow_hitch === true,
  allrad: (l, f) => !f.allrad || l.spec?.drive === "AWD",
  waermepumpe: (l, f) => !f.waermepumpe || l.equipment?.heat_pump === true,
  kofferraum: (l, f) => !f.kofferraum || (l.spec?.trunkL ?? 0) >= f.kofferraum,
  sitze: (l, f) => l.seats >= f.sitze,
  unfallfrei: (l, f) => !f.unfallfrei || l.condition?.accidentFree === true,
  anbieter: (l, f) => !f.anbieter || l.sellerType === f.anbieter,
  umkreis: (l, f, ctx) => !f.umkreis || (ctx.distance(l) ?? Infinity) <= f.umkreis,
};

/** Marke → Modell → Variante hängen aneinander: wer die Marke wechselt,
 *  verliert Modell und Variante. Für Trefferzahlen und «ohne diesen Filter»
 *  zählt ein Schlüssel deshalb samt allem, was unter ihm steht. */
const CASCADE: Partial<Record<FilterKey, FilterKey[]>> = {
  marke: ["modell", "variante"],
  modell: ["variante"],
};

export const withDependents = (key: FilterKey): FilterKey[] => [key, ...(CASCADE[key] ?? [])];

/** Erfüllt ein Inserat alle Filter — optional einen (samt abhängigen)
 *  ausgenommen? */
export function passes(
  l: Listing,
  f: Filters,
  ctx: FilterContext = NO_CONTEXT,
  except?: FilterKey,
): boolean {
  const skip = except ? withDependents(except) : [];
  return FILTER_KEYS.every((k) => skip.includes(k) || PREDICATES[k](l, f, ctx));
}

/** Ist ein Schlüssel vom Default abweichend gesetzt? */
export const isActive = (f: Filters, k: FilterKey): boolean => f[k] !== DEFAULT_FILTERS[k];

export const activeKeys = (f: Filters): FilterKey[] => FILTER_KEYS.filter((k) => isActive(f, k));

/* ---------- URL ------------------------------------------------------------ */

const BOOL_KEYS = FILTER_KEYS.filter((k) => typeof DEFAULT_FILTERS[k] === "boolean");
const NUM_KEYS = FILTER_KEYS.filter((k) => typeof DEFAULT_FILTERS[k] === "number");

/** URL → Filter. Unbekannte oder unsinnige Werte fallen auf den Default
 *  zurück, damit ein manipulierter Link nie NaN in die Rechnung trägt. */
export function readFilters(sp: URLSearchParams): Filters {
  const f: Filters = { ...DEFAULT_FILTERS };
  const rec = f as Record<FilterKey, string | number | boolean>;
  for (const k of NUM_KEYS) {
    const v = Number(sp.get(k));
    if (sp.has(k) && Number.isFinite(v) && v > 0) rec[k] = Math.round(v);
  }
  for (const k of BOOL_KEYS) rec[k] = sp.get(k) === "1";
  f.q = (sp.get("q") ?? "").slice(0, 120);
  const seg = sp.get("seg") ?? "";
  f.seg = (SEGMENTS as string[]).includes(seg) ? (seg as Segment) : "";
  f.marke = (sp.get("marke") ?? "").slice(0, 60);
  f.modell = (sp.get("modell") ?? "").slice(0, 120);
  f.variante = (sp.get("variante") ?? "").slice(0, 160);
  const a = sp.get("anbieter");
  f.anbieter = a === "PRIVAT" || a === "GARAGE" ? a : "";
  return f;
}

/** Filter → URL-Parameter, nur was vom Default abweicht. */
export function filterParams(f: Partial<Filters>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const v = f[k];
    if (v === undefined || v === DEFAULT_FILTERS[k]) continue;
    sp.set(k, typeof v === "boolean" ? "1" : String(v));
  }
  return sp;
}

/* ---------- Sortierung ----------------------------------------------------- */

export type SortKey = "neu" | "preis" | "betrieb" | "reichweite" | "km" | "distanz";

export const SORTS: { key: SortKey; label: string }[] = [
  { key: "neu", label: "Neueste zuerst" },
  { key: "preis", label: "Günstigste zuerst" },
  { key: "betrieb", label: "Tiefste Betriebskosten" },
  { key: "reichweite", label: "Grösste Reichweite" },
  { key: "km", label: "Wenigste km" },
  { key: "distanz", label: "Nächste zuerst" },
];

export function readSort(sp: URLSearchParams): SortKey {
  const s = sp.get("sort");
  return SORTS.some((x) => x.key === s) ? (s as SortKey) : "neu";
}

/** Vergleichsfunktion für eine Sortierung. Unbekannte Werte (keine
 *  Entfernung, keine Monatskosten) landen hinten. */
export function sorter(sort: SortKey, ctx: FilterContext): (a: Listing, b: Listing) => number {
  const last = (v: number | null) => v ?? Number.POSITIVE_INFINITY;
  switch (sort) {
    case "preis":
      return (a, b) => a.price - b.price;
    case "betrieb":
      return (a, b) => last(ctx.monthly(a)) - last(ctx.monthly(b));
    case "reichweite":
      return (a, b) => b.range - a.range;
    case "km":
      return (a, b) => a.km - b.km;
    case "distanz":
      return (a, b) => last(ctx.distance(a)) - last(ctx.distance(b));
    default:
      // Newest day first; within a day the more complete listing leads.
      return (a, b) =>
        a.postedDays - b.postedDays ||
        (b.quality ?? 0) - (a.quality ?? 0) ||
        (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  }
}

/* ---------- Beschriftung --------------------------------------------------- */

/** Namen für Modell und Variante (Slugs → Anzeige), soweit bekannt. */
export type FilterNames = { modell?: string; variante?: string };

/** Ein Chip je aktivem Filter, in einer lesbaren Kurzform. */
export function filterChips(f: Filters, names: FilterNames = {}): { key: FilterKey; label: string }[] {
  const chf = (n: number) => `CHF ${fmtCH(n)}`;
  const label: Record<FilterKey, () => string> = {
    q: () => `«${f.q}»`,
    seg: () => (f.seg ? SEGMENT_LABEL[f.seg] : ""),
    marke: () => f.marke,
    modell: () => names.modell ?? "Modell",
    variante: () => names.variante ?? "Variante",
    preis: () => `bis ${chf(f.preis)}`,
    preisvon: () => `ab ${chf(f.preisvon)}`,
    betrieb: () => `Betrieb bis ${chf(f.betrieb)}/Mt.`,
    jahr: () => `ab ${f.jahr}`,
    km: () => `bis ${fmtCH(f.km)} km`,
    reichweite: () => `ab ${fmtCH(f.reichweite)} km WLTP`,
    soh: () => `SOH ab ${f.soh} %`,
    garantie: () => "Batteriegarantie aktiv",
    laden: () => `DC ab ${f.laden} kW`,
    v800: () => "800 V",
    ac22: () => "AC 22 kW",
    v2l: () => "Rückspeisen (V2L)",
    ahk: () => "Anhängerkupplung",
    allrad: () => "Allrad",
    waermepumpe: () => "Wärmepumpe",
    kofferraum: () => `Kofferraum ab ${f.kofferraum} l`,
    sitze: () => `ab ${f.sitze} Sitze`,
    unfallfrei: () => "Unfallfrei",
    anbieter: () => (f.anbieter === "GARAGE" ? "Garage" : "Privat"),
    umkreis: () => `${f.umkreis} km Umkreis`,
  };
  return activeKeys(f).map((key) => ({ key, label: label[key]() }));
}

/** «Tesla Model Y Occasionen» — H1 und Breadcrumb der Ergebnisseite. */
export function resultsTitle(f: Filters, names: FilterNames = {}): string {
  const subject = [
    f.marke,
    f.modell ? names.modell : "",
    !f.marke && f.seg ? SEGMENT_LABEL[f.seg] : "",
  ]
    .filter(Boolean)
    .join(" ");
  return subject ? `${subject} Occasionen` : "E-Auto Occasionen";
}
