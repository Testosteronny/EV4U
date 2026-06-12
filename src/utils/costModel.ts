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
