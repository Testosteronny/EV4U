/* ============================================================================
   Shared cost-model constants — used by the EngineCore and /vergleich so
   every number on the site agrees.
   ============================================================================ */

/** Petrol price, CHF/L — Swiss average. */
export const FUEL_PRICE = 1.78;

/** Opportunity cost of self-consumed solar: the feed-in remuneration you
 *  forgo by charging the car instead of selling to the grid. CHF/kWh. */
export const SOLAR_COST = 0.08;

/** Realistic solar coverage of home charging (small PV → surplus charging). */
export const SOLAR_COVER_MIN = 0.2;
export const SOLAR_COVER_MAX = 0.7;

/* ----------------------------------------------------------------------------
   Maintenance & wear (service, oil, brakes, exhaust, fluids), CHF per km.
   Grounded in TCS/ADAC comparisons: EV maintenance runs ~30–35 % below a
   comparable combustion car (no oil changes, no spark plugs/exhaust, regen
   braking spares the brakes). At Swiss workshop rates and 15'000 km/year
   that's ≈ CHF 900 (ICE) vs ≈ CHF 570 (EV) — about CHF 330 saved per year.
   ---------------------------------------------------------------------------- */
export const MAINT_ICE_PER_KM = 0.06; // ≈ CHF 900/Jahr @ 15'000 km
export const MAINT_EV_PER_KM = 0.038; // ≈ CHF 570/Jahr @ 15'000 km

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
