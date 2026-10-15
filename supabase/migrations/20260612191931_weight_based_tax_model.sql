-- ============================================================================
-- Weight-based tax model:
--   ice_same_weight = weight_kg / 100 × rate_per_100kg   (linearized tariff)
--   ev_tax          = ice_same_weight × (1 − ev_discount_pct/100)
--   saving          = ice_same_weight × ev_discount_pct/100
-- rate_per_100kg: per-canton regular tariff, linearized & calibrated on the
-- mid-size anchors (reference 1'900 kg ≙ previous ice_tax). Hubraum-/kW-
-- cantons are mapped via a weight equivalent (declared approximation).
-- ev_discount_pct is the HARD researched part (cantonal EV privilege 2026).
-- Prepared for the vehicle-model API: listings.weight_kg (decision pending).
-- ============================================================================

alter table public.listings add column weight_kg int check (weight_kg between 500 and 4000);

update public.listings set weight_kg = v.w from (values
  ('dacia-spring', 1045), ('renault-5', 1450), ('tesla-m3', 1765),
  ('byd-seal', 2055), ('hyundai-i6', 1985), ('porsche-taycan', 2295),
  ('vw-id7', 2180), ('nio-et5t', 2145), ('bmw-i5t', 2265),
  ('skoda-enyaq', 2020), ('kia-ev6', 2090), ('audi-q6', 2350),
  ('test-fiat-500e', 1365)
) as v(slug, w) where listings.slug = v.slug;

alter table public.canton_taxes
  add column rate_per_100kg numeric(6, 2) not null default 21.0
    check (rate_per_100kg >= 0),
  add column ev_discount_pct int not null default 0
    check (ev_discount_pct between 0 and 100);

update public.canton_taxes set rate_per_100kg = v.rate, ev_discount_pct = v.pct
from (values
  ('AG', 20.5, 35), ('AI', 20.0, 0), ('AR', 36.0, 0), ('BE', 25.3, 50),
  ('BL', 23.7, 100), ('BS', 21.1, 50), ('FR', 22.6, 100), ('GE', 28.9, 75),
  ('GL', 18.9, 100), ('GR', 23.7, 50), ('JU', 24.7, 0), ('LU', 20.0, 0),
  ('NE', 26.3, 50), ('NW', 15.8, 65), ('OW', 16.8, 50), ('SG', 21.1, 100),
  ('SH', 13.2, 25), ('SO', 20.0, 100), ('SZ', 22.1, 0), ('TG', 20.0, 50),
  ('TI', 23.7, 100), ('UR', 18.4, 50), ('VD', 25.3, 70), ('VS', 22.1, 100),
  ('ZG', 15.8, 50), ('ZH', 18.4, 100)
) as v(canton, rate, pct) where canton_taxes.canton = v.canton;

-- The absolute columns are superseded by rate × weight.
alter table public.canton_taxes drop column ice_tax, drop column ev_tax;
