import { fold, matchesQuery } from "../utils/search";
import type { Listing } from "../data/evData";

/* ============================================================================
   Der Filterzustand des Katalogs — Definition an EINER Stelle.

   Die URL ist die Quelle der Wahrheit (`/inserate?seg=SUV&preis=40000`):
   teilbar, als Lesezeichen speicherbar, reload-fest. Diese Datei übersetzt
   zwischen URL und Prädikaten und wird von der Filterzeile, den
   Trefferzahlen, dem Leerzustand, dem Finder-Quiz und der KI-Suche benutzt —
   vorher kannte jede dieser Stellen die Parameternamen selbst.
   ============================================================================ */

export const PRICE_MIN = 10000;
export const PRICE_MAX = 120000;

export const ANBIETER = ["ALLE", "PRIVAT", "GARAGE"] as const;
export const SITZE = ["ALLE", "4", "5"] as const;
export const RANGE_STEPS = [0, 300, 400, 500, 600];
export const DC_STEPS = [0, 50, 100, 150, 250];

/** Begleitparameter der KI-Suche — Erklärtext, keine Filter. */
export const AI_KEYS = ["ai", "airx", "aino"] as const;

export type Filters = {
  q: string;
  seg: string;
  /** Markenname, gross/klein und Akzente egal — «TESLA» (KI-Suche, alte
   *  Links) trifft dasselbe wie «Tesla» (Katalog). */
  marke: string;
  /** Katalog-Slug des Modells (vehicle_models.slug), "" = alle. */
  modell: string;
  /** Katalog-Slug der Variante (vehicle_variants.slug), "" = alle. */
  variante: string;
  anbieter: string;
  sitze: string;
  preis: number;
  reichweite: number;
  laden: number;
  v2x: boolean;
  fav: boolean;
};

/** Ein Prädikat je Filterschlüssel. Getrennt gehalten, damit Facettenzahlen
 *  berechnet werden können: „wie viele Treffer gäbe dieser Wert, wenn alle
 *  ANDEREN Filter gesetzt bleiben?“ */
type Predicate = (l: Listing, f: Filters, favorites: string[]) => boolean;

export const PREDICATES: Record<keyof Filters, Predicate> = {
  q: (l, f) => matchesQuery(l, f.q),
  seg: (l, f) => f.seg === "ALLE" || l.segment === f.seg,
  marke: (l, f) => f.marke === "ALLE" || fold(l.brand) === fold(f.marke),
  // Modell und Variante treffen nur Inserate mit Katalog-Verknüpfung —
  // frei eingetippte Autos lassen sich nicht sicher zuordnen.
  modell: (l, f) => !f.modell || l.modelSlug === f.modell,
  variante: (l, f) => !f.variante || l.variantSlug === f.variante,
  anbieter: (l, f) => f.anbieter === "ALLE" || l.sellerType === f.anbieter,
  sitze: (l, f) => f.sitze === "ALLE" || l.seats === Number(f.sitze),
  preis: (l, f) => l.price <= f.preis,
  reichweite: (l, f) => l.range >= f.reichweite,
  // Ohne DC-Wert zählt ein Inserat nur, solange kein Mindestwert gesetzt ist.
  laden: (l, f) => (l.dcKw ?? 0) >= f.laden,
  v2x: (l, f) => !f.v2x || l.bidi,
  fav: (l, f, favorites) => !f.fav || favorites.includes(l.id),
};

export const FILTER_KEYS = Object.keys(PREDICATES) as (keyof Filters)[];

/** Marke → Modell → Variante hängen aneinander: wer die Marke wechselt,
 *  verliert Modell und Variante. Für Trefferzahlen und «ohne diesen Filter»
 *  zählt ein Schlüssel deshalb samt allem, was unter ihm steht. */
const CASCADE: Partial<Record<keyof Filters, (keyof Filters)[]>> = {
  marke: ["modell", "variante"],
  modell: ["variante"],
};

export const withDependents = (key: keyof Filters): (keyof Filters)[] => [
  key,
  ...(CASCADE[key] ?? []),
];

/** Erfüllt ein Inserat alle Filter — optional einen (samt abhängigen)
 *  ausgenommen? */
export function passes(
  l: Listing,
  f: Filters,
  favorites: string[],
  except?: keyof Filters,
): boolean {
  const skip = except ? withDependents(except) : [];
  return FILTER_KEYS.every((k) => skip.includes(k) || PREDICATES[k](l, f, favorites));
}

/** URL → Filter. Unbekannte oder unsinnige Werte fallen auf den Default
 *  zurück, damit ein manipulierter Link nie NaN in die Rechnung trägt. */
export function readFilters(sp: URLSearchParams): Filters {
  const num = (key: string, def: number) => {
    const v = Number(sp.get(key));
    return Number.isFinite(v) && v >= 0 ? v : def;
  };
  return {
    q: sp.get("q") ?? "",
    seg: sp.get("seg") ?? "ALLE",
    marke: sp.get("marke") ?? "ALLE",
    modell: sp.get("modell") ?? "",
    variante: sp.get("variante") ?? "",
    anbieter: sp.get("anbieter") ?? "ALLE",
    sitze: sp.get("sitze") ?? "ALLE",
    preis: sp.has("preis") ? num("preis", PRICE_MAX) : PRICE_MAX,
    reichweite: num("reichweite", 0),
    laden: num("laden", 0),
    v2x: sp.get("v2x") === "1",
    fav: sp.get("fav") === "1",
  };
}
