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
   Cantonal motor vehicle tax (Verkehrssteuer): the CURRENT-YEAR annual CHF
   for a typical mid-size petrol car vs. EV, per canton — no multi-year
   projection logic; when cantons change their rules, the operator updates
   the `canton_taxes` table (and its tax_year) in Supabase. This map is the
   offline fallback, seeded identically (TCS/comparis/cantonal sources).
   Note AR: weight-based — EVs currently pay MORE.
   ---------------------------------------------------------------------------- */
export type CantonTax = { ice: number; ev: number };

/** Fallback for the year shown in the UI; live value comes from the table. */
export const CANTON_TAX_YEAR_FALLBACK = 2026;

export const CANTON_TAXES_FALLBACK: Record<string, CantonTax> = {
  AG: { ice: 390, ev: 250 },
  AI: { ice: 380, ev: 380 },
  AR: { ice: 420, ev: 530 },
  BE: { ice: 480, ev: 240 },
  BL: { ice: 450, ev: 0 },
  BS: { ice: 400, ev: 200 },
  FR: { ice: 430, ev: 0 },
  GE: { ice: 550, ev: 150 },
  GL: { ice: 360, ev: 0 },
  GR: { ice: 450, ev: 220 },
  JU: { ice: 470, ev: 470 },
  LU: { ice: 380, ev: 380 },
  NE: { ice: 500, ev: 250 },
  NW: { ice: 300, ev: 100 },
  OW: { ice: 320, ev: 160 },
  SG: { ice: 400, ev: 0 },
  SH: { ice: 250, ev: 190 },
  SO: { ice: 380, ev: 0 },
  SZ: { ice: 420, ev: 420 },
  TG: { ice: 380, ev: 190 },
  TI: { ice: 450, ev: 0 },
  UR: { ice: 350, ev: 175 },
  VD: { ice: 480, ev: 150 },
  VS: { ice: 420, ev: 0 },
  ZG: { ice: 300, ev: 150 },
  ZH: { ice: 350, ev: 0 },
};

/** CH average — used until a PLZ (and thus a canton) is fixed. */
export function chAverageTax(map: Record<string, CantonTax>): CantonTax {
  const all = Object.values(map);
  const avg = (sel: (t: CantonTax) => number) =>
    Math.round(all.reduce((s, t) => s + sel(t), 0) / all.length);
  return { ice: avg((t) => t.ice), ev: avg((t) => t.ev) };
}
