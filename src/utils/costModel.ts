/* ============================================================================
   Shared cost-model constants — used by the EngineCore and /vergleich so
   every number on the site agrees.
   ============================================================================ */

import fuelPrices from "../data/fuelPrices.json";
import { CARD_COMBOS, type CardCombo, type Listing } from "../data/evData";

/* ----------------------------------------------------------------------------
   The comparison car — "was fährst du heute?". The engine compares every
   listing against the visitor's ACTUAL car: petrol, diesel, or already
   electric. Consumption defaults are Swiss-fleet typical values and double
   as the fallback when the user never touches the setting.
   · BENZIN/DIESEL: official BFS monthly national average (LIK
     Durchschnittspreise, baked by scripts/fetch-fuel-prices.mjs — one rate
     for all of Switzerland, refreshed by CI). Hardcoded numbers are the
     offline fallback only.
   · ELEKTRO: no fixed price — energy is costed at the visitor's home
     tariff (the same one the simulated car uses).
   ---------------------------------------------------------------------------- */
export type FuelType = "BENZIN" | "DIESEL" | "HYBRID" | "PLUGIN" | "ELEKTRO";

/** "06/2026" — shown wherever a pump price is used. */
export const FUEL_PRICES_ASOF = `${fuelPrices.meta.month.slice(5)}/${fuelPrices.meta.month.slice(0, 4)}`;

const BENZIN_PRICE = Number(fuelPrices.benzin95) || 1.78;
const DIESEL_PRICE = Number(fuelPrices.diesel) || 1.86;

export type FuelConfig = {
  label: string;
  /** Ein Satz für die Auswahl — was genau ist gemeint? */
  hint: string;
  unit: string;
  /** CHF per unit; null → priced at the local electricity tariff. */
  price: number | null;
  defaultCons: number;
  min: number;
  max: number;
  /** Wartung & Verschleiss in CHF/km, siehe unten. */
  maintPerKm: number;
  /** Fährt (auch) mit Strom aus der Steckdose → braucht einen Ladeanteil. */
  plugIn: boolean;
};

/* ----------------------------------------------------------------------------
   Wartung & Verschleiss (Service, Öl, Bremsen, Auspuff, Betriebsstoffe),
   CHF pro km, nach TCS/ADAC-Vergleichen:
   · Verbrenner ≈ CHF 900/Jahr bei 15'000 km
   · E-Auto rund 35 % darunter — kein Ölwechsel, keine Zündkerzen, kein
     Auspuff, Rekuperation schont die Bremsen
   · Hybride liegen dazwischen, aber viel näher am Verbrenner: der Motor will
     denselben Service, die Rekuperation spart nur die Bremsen. Sie hier wie
     einen reinen Verbrenner zu rechnen hätte den Vorteil des E-Autos
     systematisch zu gross gemacht.
   ---------------------------------------------------------------------------- */
export const MAINT_ICE_PER_KM = 0.06; // ≈ CHF 900/Jahr @ 15'000 km
export const MAINT_HYBRID_PER_KM = 0.055; // ≈ CHF 825/Jahr
export const MAINT_EV_PER_KM = 0.038; // ≈ CHF 570/Jahr

/** Realistischer Stromverbrauch eines Plug-in-Hybrids auf den elektrisch
 *  gefahrenen Kilometern. Deutlich über einem reinen E-Auto: kleine Batterie,
 *  zusätzliches Gewicht des Verbrenners, kaum Optimierung auf Effizienz. */
export const PLUGIN_KWH_PER_100KM = 20;

export const FUELS: Record<FuelType, FuelConfig> = {
  BENZIN: {
    label: "Benziner",
    hint: "Reiner Verbrenner",
    unit: "L/100km",
    price: BENZIN_PRICE,
    defaultCons: 7.2,
    min: 4,
    max: 12,
    maintPerKm: MAINT_ICE_PER_KM,
    plugIn: false,
  },
  DIESEL: {
    label: "Diesel",
    hint: "Reiner Verbrenner",
    unit: "L/100km",
    price: DIESEL_PRICE,
    defaultCons: 6.4,
    min: 3.5,
    max: 11,
    maintPerKm: MAINT_ICE_PER_KM,
    plugIn: false,
  },
  HYBRID: {
    label: "Vollhybrid",
    hint: "Lädt sich selbst, kein Stecker",
    unit: "L/100km",
    price: BENZIN_PRICE,
    defaultCons: 5.4,
    min: 3,
    max: 10,
    maintPerKm: MAINT_HYBRID_PER_KM,
    plugIn: false,
  },
  PLUGIN: {
    label: "Plug-in-Hybrid",
    hint: "Steckdose plus Benzinmotor",
    unit: "L/100km",
    price: BENZIN_PRICE,
    // Verbrauch im Hybridbetrieb, also mit leerer Batterie. Plug-in-Hybride
    // sind schwer, deshalb liegt der über einem vergleichbaren Benziner —
    // NICHT der geschönte WLTP-Mischwert von 1–2 l.
    defaultCons: 6.5,
    min: 4,
    max: 11,
    maintPerKm: MAINT_HYBRID_PER_KM,
    plugIn: true,
  },
  ELEKTRO: {
    label: "E-Auto",
    hint: "Rein elektrisch",
    unit: "kWh/100km",
    price: null,
    defaultCons: 16.8,
    min: 10,
    max: 30,
    maintPerKm: MAINT_EV_PER_KM,
    plugIn: true,
  },
};

/** Ist das ein bekannter Antrieb? Schützt vor einem alten localStorage-Wert
 *  oder einer Profilzeile aus einer früheren Version. */
export function isFuelType(v: unknown): v is FuelType {
  return typeof v === "string" && v in FUELS;
}

/** Energy cost per year of the visitor's current car.
 *
 *  Der Plug-in-Hybrid ist der einzige Antrieb, der zwei Energiequellen
 *  gleichzeitig hat, und deshalb der einzige mit zwei Eingaben: `cons` ist
 *  der Benzinverbrauch IM HYBRIDBETRIEB (Batterie leer, Motor läuft), und
 *  `elecShare` teilt die Jahreskilometer auf. Beide Teile werden getrennt
 *  bepreist — verschiebt man den Regler Richtung Strom, sinken die
 *  Benzinkilometer und der Wagen wird günstiger. Nähme man stattdessen den
 *  realen Gesamtschnitt als `cons`, steckte der Ladeanteil schon darin und
 *  der Strom käme ein zweites Mal obendrauf. */
export function currentCarEnergy(
  fuel: FuelType,
  cons: number,
  annualKm: number,
  tariff: number,
  elecShare = 0,
): number {
  const cfg = FUELS[fuel];
  if (fuel !== "PLUGIN") return (annualKm / 100) * cons * (cfg.price ?? tariff);

  const share = Math.min(100, Math.max(0, elecShare)) / 100;
  const petrolKm = annualKm * (1 - share);
  const elecKm = annualKm * share;
  return (
    (petrolKm / 100) * cons * (cfg.price ?? tariff) +
    (elecKm / 100) * PLUGIN_KWH_PER_100KM * tariff
  );
}

/** Opportunity cost of self-consumed solar: the feed-in remuneration you
 *  forgo by charging the car instead of selling to the grid. CHF/kWh. */
export const SOLAR_COST = 0.08;

/** Realistic solar coverage of home charging (small PV → surplus charging). */
export const SOLAR_COVER_MIN = 0.2;
export const SOLAR_COVER_MAX = 0.7;

/* ----------------------------------------------------------------------------
   Cantonal motor vehicle tax (Verkehrssteuer) — WEIGHT-BASED model:

     ice_same_weight = weight_kg / 100 × rate          (linearized tariff)
     ev_tax          = ice_same_weight × (1 − pct/100)
     saving          = ice_same_weight × pct/100

   · rate (CHF per 100 kg): the canton's regular tariff, linearized and
     calibrated on mid-size anchors (AR: researched ID.3 value). Hubraum-/kW-
     cantons are mapped via a weight equivalent — a declared approximation.
   · discountPct: the HARD researched part — the canton's current EV
     privilege (100 = exempt, 50 = half, 0 = no bonus). Never negative.
   Live values come from the operator-editable `canton_taxes` table; this
   map is the offline fallback. Listing weights come from the vehicle-model
   API once selected (see README) — until then `REF_WEIGHT_KG` fills gaps.
   ---------------------------------------------------------------------------- */
export type CantonTax = { rate: number; discountPct: number };

/** Fallback for the year shown in the UI; live value comes from the table. */
export const CANTON_TAX_YEAR_FALLBACK = 2026;

/** Mid-size EV reference weight, used when a listing has no weight yet. */
export const REF_WEIGHT_KG = 1900;

export const CANTON_TAXES_FALLBACK: Record<string, CantonTax> = {
  AG: { rate: 20.5, discountPct: 35 },
  AI: { rate: 20.0, discountPct: 0 },
  AR: { rate: 36.0, discountPct: 0 },
  BE: { rate: 25.3, discountPct: 50 },
  BL: { rate: 23.7, discountPct: 100 },
  BS: { rate: 21.1, discountPct: 50 },
  FR: { rate: 22.6, discountPct: 100 },
  GE: { rate: 28.9, discountPct: 75 },
  GL: { rate: 18.9, discountPct: 100 },
  GR: { rate: 23.7, discountPct: 50 },
  JU: { rate: 24.7, discountPct: 0 },
  LU: { rate: 20.0, discountPct: 0 },
  NE: { rate: 26.3, discountPct: 50 },
  NW: { rate: 15.8, discountPct: 65 },
  OW: { rate: 16.8, discountPct: 50 },
  SG: { rate: 21.1, discountPct: 100 },
  SH: { rate: 13.2, discountPct: 25 },
  SO: { rate: 20.0, discountPct: 100 },
  SZ: { rate: 22.1, discountPct: 0 },
  TG: { rate: 20.0, discountPct: 50 },
  TI: { rate: 23.7, discountPct: 100 },
  UR: { rate: 18.4, discountPct: 50 },
  VD: { rate: 25.3, discountPct: 70 },
  VS: { rate: 22.1, discountPct: 100 },
  ZG: { rate: 15.8, discountPct: 50 },
  ZH: { rate: 18.4, discountPct: 100 },
};

/** CH average — used until a PLZ (and thus a canton) is fixed. */
export function chAverageTax(map: Record<string, CantonTax>): CantonTax {
  const all = Object.values(map);
  const avg = (sel: (t: CantonTax) => number) =>
    all.reduce((s, t) => s + sel(t), 0) / all.length;
  return {
    rate: Math.round(avg((t) => t.rate) * 10) / 10,
    discountPct: Math.round(avg((t) => t.discountPct)),
  };
}

/** The weight-based tax computation, shared by engine and compare page. */
export function cantonTaxFor(weightKg: number, tax: CantonTax) {
  const ice = (weightKg / 100) * tax.rate;
  const ev = ice * (1 - tax.discountPct / 100);
  return { ice, ev, saving: ice - ev };
}

/* ============================================================================
   computeCosts — THE calculation. One implementation, every surface.

   This used to live three times over: in the engine, in the sidebar of a
   listing page, and in the compare table. The copies had already drifted —
   the engine costed public charging with the card the visitor had picked
   while the other two silently forced the cheapest one, so the headline in
   the sidebar could contradict the breakdown directly below it. A formula
   that appears three times is a formula that will disagree with itself.
   ============================================================================ */

/** Everything the model needs about the visitor, in one object. */
export type CostContext = {
  /** Home electricity tariff, CHF/kWh. */
  tariff: number;
  annualKm: number;
  /** The visitor's current car. */
  fuel: FuelType;
  /** …and its consumption, in that fuel's unit. */
  cons: number;
  /** Nur beim Plug-in-Hybrid: Anteil der Kilometer, die elektrisch gefahren
   *  werden, 0–100. Bei allen anderen Antrieben bedeutungslos. */
  elecShare?: number;
  /** Share of the LISTING's kWh charged away from home, 0–100. */
  publicShare: number;
  cantonTax: CantonTax;
  /** Charging-card combo; null/unknown id → the cheapest one. */
  comboId?: string | null;
  pv?: boolean;
};

export type PricedCombo = CardCombo & { publicCost: number };

export type CostResult = {
  /* Energy */
  kwhYear: number;
  homeKwh: number;
  publicKwh: number;
  homeCost: number;
  /** Electricity cost per 100 km at the home tariff — the catalogue figure. */
  strom100: number;
  combos: PricedCombo[];
  cheapest: PricedCombo;
  chosen: PricedCombo;
  evEnergy: number;
  currentEnergy: number;

  /* Maintenance */
  maintEv: number;
  maintCurrent: number;
  maintSavings: number;

  /* Cantonal vehicle tax */
  tax: { ice: number; ev: number; saving: number };
  taxCurrent: number;
  taxSavings: number;
  /** The canton's EV privilege in percent — shown next to the tax line. */
  taxDiscountPct: number;

  /* Totals — the numbers the UI actually shows */
  evTotal: number;
  currentTotal: number;
  /** Positive → the listing is cheaper than the visitor's car. */
  savings: number;

  /* Solar, as a range: coverage depends on the installation. */
  solarLow: number;
  solarHigh: number;
  solarActive: boolean;

  /** True when the visitor already drives electric — no maintenance or tax
   *  advantage exists in that case, and the UI must not pretend otherwise. */
  currentIsEv: boolean;
  weightKg: number;
};

/** Price every charging-card combo for a given annual public demand. */
export function priceCombos(publicKwh: number): PricedCombo[] {
  return CARD_COMBOS.map((c) => ({
    ...c,
    publicCost: c.monthly * 12 + Math.max(0, publicKwh - c.inclKwh) * c.perKwh,
  }));
}

export function computeCosts(listing: Listing, ctx: CostContext): CostResult {
  const kwhYear = (ctx.annualKm / 100) * listing.consumption;
  const publicKwh = kwhYear * (ctx.publicShare / 100);
  const homeKwh = kwhYear - publicKwh;
  const homeCost = homeKwh * ctx.tariff;

  const combos = priceCombos(publicKwh);
  const cheapest = combos.reduce((a, b) => (b.publicCost < a.publicCost ? b : a));
  const chosen = combos.find((c) => c.id === ctx.comboId) ?? cheapest;

  const evEnergy = homeCost + chosen.publicCost;
  const currentEnergy = currentCarEnergy(
    ctx.fuel,
    ctx.cons,
    ctx.annualKm,
    ctx.tariff,
    ctx.elecShare,
  );

  const currentIsEv = ctx.fuel === "ELEKTRO";
  const maintEv = ctx.annualKm * MAINT_EV_PER_KM;
  const maintCurrent = ctx.annualKm * FUELS[ctx.fuel].maintPerKm;

  const weightKg = listing.weightKg ?? REF_WEIGHT_KG;
  const tax = cantonTaxFor(weightKg, ctx.cantonTax);
  // Against an existing EV there is no tax privilege to win — it is already
  // being enjoyed. Comparing to `tax.ice` there would invent a saving.
  const taxCurrent = currentIsEv ? tax.ev : tax.ice;

  const evTotal = evEnergy + maintEv + tax.ev;
  const currentTotal = currentEnergy + maintCurrent + taxCurrent;

  const solarRate = Math.max(0, ctx.tariff - SOLAR_COST);
  const solarActive = Boolean(ctx.pv) && homeKwh > 0;

  return {
    kwhYear,
    homeKwh,
    publicKwh,
    homeCost,
    strom100: listing.consumption * ctx.tariff,
    combos,
    cheapest,
    chosen,
    evEnergy,
    currentEnergy,
    maintEv,
    maintCurrent,
    maintSavings: maintCurrent - maintEv,
    tax,
    taxCurrent,
    taxSavings: taxCurrent - tax.ev,
    taxDiscountPct: ctx.cantonTax.discountPct,
    evTotal,
    currentTotal,
    savings: currentTotal - evTotal,
    solarLow: homeKwh * SOLAR_COVER_MIN * solarRate,
    solarHigh: homeKwh * SOLAR_COVER_MAX * solarRate,
    solarActive,
    currentIsEv,
    weightKg,
  };
}
