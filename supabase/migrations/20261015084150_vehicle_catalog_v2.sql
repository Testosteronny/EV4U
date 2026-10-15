-- ============================================================================
-- Vehicle catalog v2 — brand → model → variant.
--
-- Replaces the flat model list (279 rows, one «best variant» figure per
-- model, empty vehicle_variants) with the EV4U variant database: every EV
-- sold new in Europe plus the relevant used-only models, one row per
-- drivetrain/battery variant. The rows themselves are loaded by
-- scripts/import-vehicle-catalog.mjs → supabase/seed/vehicle_catalog.sql.
--
-- Grain follows the source: what classifies a product line (segment, body,
-- availability, launch, provenance) lives on the model and is verified
-- constant by the importer; everything technical lives on the variant,
-- because that is where it really varies (and can, in the next edition,
-- even where it does not today).
--
-- Every table carries the source key as `slug` — the importer upserts on it,
-- so ids stay stable across re-imports and listings keep their links.
-- ============================================================================

-- This alters the live listings table: give up quickly instead of queueing
-- behind — and then blocking — site traffic if a lock is held.
set local lock_timeout = '5s';

-- The old catalog is replaced wholesale. That is only safe while nothing
-- points into it — refuse instead of silently cutting links.
do $$
begin
  if exists (select 1 from public.listings where model_id is not null or variant_id is not null) then
    raise exception 'listings reference the old vehicle catalog — migrate those links first';
  end if;
end $$;

alter table public.listings drop constraint if exists listings_model_id_fkey;
alter table public.listings drop constraint if exists listings_variant_id_fkey;
drop table if exists public.vehicle_variants;
drop table if exists public.vehicle_models;

-- uuid keys, like the rest of the schema and the existing listings.model_id /
-- variant_id columns. Random-uuid index fragmentation does not matter for
-- reference tables of ~1'000 rows that change once per catalog edition.

-- ---------------------------------------------------------------------------
-- Brands
-- ---------------------------------------------------------------------------
create table public.vehicle_brands (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name       text not null unique check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

comment on table public.vehicle_brands is
  'EV brands (reference data, loaded by scripts/import-vehicle-catalog.mjs). Public read, no client write.';

-- ---------------------------------------------------------------------------
-- Models
-- ---------------------------------------------------------------------------
create table public.vehicle_models (
  id                 uuid primary key default gen_random_uuid(),
  brand_id           uuid not null references public.vehicle_brands (id) on delete cascade,
  slug               text not null unique check (slug ~ '^[a-z0-9-]+_[a-z0-9-]+$'),
  name               text not null check (char_length(name) between 1 and 80),
  segment            text not null check (segment in (
                       'Kleinwagen', 'Kompaktklasse', 'Mittelklasse', 'Oberklasse',
                       'SUV', 'VAN/BUS', 'Sportwagen', 'Pick-up')),
  body_type          text not null check (body_type in (
                       'Schrägheck', 'Limousine', 'Kombi', 'SUV', 'Coupé-SUV', 'Coupé',
                       'Cabrio', 'Roadster', 'Van', 'Hochdachkombi', 'Microcar', 'Pick-up')),
  availability       text not null check (availability in (
                       'LIEFERBAR', 'IMPORT', 'ANGEKUENDIGT', 'AUSLAUF', 'OCCASION')),
  market_launch      text check (char_length(market_launch) <= 80),
  launch_year        smallint check (launch_year between 1990 and 2100),
  end_year           smallint check (end_year between 1990 and 2100 and end_year >= launch_year),
  origin_country     text check (char_length(origin_country) <= 80),
  manufacturer_group text check (char_length(manufacturer_group) <= 80),
  remark             text check (char_length(remark) <= 500),
  created_at         timestamptz not null default now(),
  -- Leading brand_id doubles as the index for the foreign key.
  unique (brand_id, name)
);

comment on table public.vehicle_models is
  'EV models per brand (reference data). Public read, no client write.';
comment on column public.vehicle_models.slug is 'Source key «brand_model», e.g. tesla_model-3.';
comment on column public.vehicle_models.availability is
  'Swiss availability: LIEFERBAR (official sales), IMPORT (direct/parallel import only), ANGEKUENDIGT (confirmed, not yet orderable), AUSLAUF (last orders), OCCASION (no longer sold new).';
comment on column public.vehicle_models.market_launch is 'As published, e.g. «2021 (Facelift 2024)», «Herbst 2026», «2019–2022».';
comment on column public.vehicle_models.launch_year is 'First year parsed from market_launch; null when open.';
comment on column public.vehicle_models.end_year is 'End of production for used-only models («2019–2022» → 2022).';
comment on column public.vehicle_models.origin_country is 'Country/countries of production.';

-- ---------------------------------------------------------------------------
-- Variants
-- ---------------------------------------------------------------------------
create table public.vehicle_variants (
  id                           uuid primary key default gen_random_uuid(),
  model_id                     uuid not null references public.vehicle_models (id) on delete cascade,
  slug                         text not null unique check (slug ~ '^[a-z0-9-]+_[a-z0-9-]+_[a-z0-9-]+$'),
  name                         text not null check (char_length(name) between 1 and 80),
  vehicle_class                text not null check (vehicle_class in ('M1', 'N1', 'L6e', 'L7e', 'L6e/L7e')),
  seats                        smallint not null check (seats between 1 and 9),
  drive                        text not null check (drive in ('FWD', 'RWD', 'AWD')),
  motors                       smallint not null check (motors between 1 and 4),
  power_kw                     smallint check (power_kw > 0),
  power_ps                     smallint check (power_ps > 0),
  accel_0_100_s                numeric(4, 2) check (accel_0_100_s > 0),
  top_speed_kmh                smallint check (top_speed_kmh > 0),
  battery_gross_kwh            numeric(5, 1) check (battery_gross_kwh > 0),
  battery_net_kwh              numeric(5, 1) check (battery_net_kwh > 0 and battery_net_kwh <= battery_gross_kwh),
  cell_chemistry               text not null check (cell_chemistry in ('NMC', 'NCA', 'LFP', 'LMFP', 'Na-Ion')),
  system_voltage_v             smallint not null check (system_voltage_v > 0),
  range_wltp_km                smallint check (range_wltp_km > 0),
  consumption_kwh_100km        numeric(4, 1) check (consumption_kwh_100km > 0),
  dc_max_kw                    smallint check (dc_max_kw > 0),
  dc_10_80_min                 smallint check (dc_10_80_min > 0),
  ac_max_kw                    numeric(4, 1) not null check (ac_max_kw > 0),
  charge_port                  text not null check (charge_port in ('CCS2', 'Typ 2', 'Typ 2 / CCS2', 'CHAdeMO', 'Schuko')),
  v2l                          boolean not null,
  trunk_l                      smallint check (trunk_l >= 0),
  frunk_l                      smallint check (frunk_l >= 0),
  towing_kg                    smallint check (towing_kg >= 0),
  length_mm                    smallint check (length_mm > 0),
  width_mm                     smallint check (width_mm > 0),
  height_mm                    smallint check (height_mm > 0),
  wheelbase_mm                 smallint check (wheelbase_mm > 0),
  curb_weight_kg               smallint check (curb_weight_kg > 0),
  battery_warranty_years       smallint check (battery_warranty_years between 1 and 20),
  battery_warranty_km          integer check (battery_warranty_km > 0),
  battery_warranty_conditional boolean not null default false,
  battery_warranty_soh_pct     smallint check (battery_warranty_soh_pct between 50 and 100),
  price_new_chf                integer check (price_new_chf > 0),
  created_at                   timestamptz not null default now(),
  -- Leading model_id doubles as the index for the foreign key.
  unique (model_id, name),
  -- Target of the listings (variant_id, model_id) consistency key below.
  unique (id, model_id)
);

comment on table public.vehicle_variants is
  'Drivetrain/battery variants per model with technical data (reference data). Public read, no client write.';
comment on column public.vehicle_variants.slug is 'Source key «brand_model_variant», e.g. tesla_model-3_model-3-standard-rwd.';
comment on column public.vehicle_variants.vehicle_class is 'M1 passenger car · N1 commercial base · L6e/L7e light quadricycle.';
comment on column public.vehicle_variants.power_ps is 'As published by the manufacturer (not always kW × 1.36).';
comment on column public.vehicle_variants.battery_net_kwh is 'Usable capacity — the one range calculations use.';
comment on column public.vehicle_variants.system_voltage_v is 'On-board voltage; 800 V allows much shorter DC sessions than 400 V.';
comment on column public.vehicle_variants.range_wltp_km is 'Combined WLTP range, km.';
comment on column public.vehicle_variants.consumption_kwh_100km is 'Combined WLTP consumption incl. charging losses, kWh/100 km.';
comment on column public.vehicle_variants.dc_max_kw is 'Peak DC charging power, kW; null = no DC charging.';
comment on column public.vehicle_variants.dc_10_80_min is 'DC 10→80 %, minutes, manufacturer figure under ideal conditions.';
comment on column public.vehicle_variants.v2l is 'Vehicle-to-load (230 V outlet).';
comment on column public.vehicle_variants.curb_weight_kg is 'Curb weight, kg — drives the cantonal vehicle tax.';
comment on column public.vehicle_variants.battery_warranty_conditional is 'True for «bis …» warranties tied to conditions (e.g. dealer service).';
comment on column public.vehicle_variants.battery_warranty_soh_pct is 'Guaranteed remaining capacity; null = not published (not «none»).';
comment on column public.vehicle_variants.price_new_chf is 'Swiss list price when new, without options — a reference, not an offer.';

-- ---------------------------------------------------------------------------
-- Access: reference data. Everyone reads, nobody writes through the API —
-- the importer runs as the database owner.
-- ---------------------------------------------------------------------------
alter table public.vehicle_brands   enable row level security;
alter table public.vehicle_models   enable row level security;
alter table public.vehicle_variants enable row level security;

create policy vehicle_brands_public_read   on public.vehicle_brands   for select to anon, authenticated using (true);
create policy vehicle_models_public_read   on public.vehicle_models   for select to anon, authenticated using (true);
create policy vehicle_variants_public_read on public.vehicle_variants for select to anon, authenticated using (true);

-- Explicit both ways: the project's default privileges hand new tables to
-- anon/authenticated with every right, and the Data API may not expose new
-- tables at all. Neither should decide what the catalog allows.
revoke all on public.vehicle_brands, public.vehicle_models, public.vehicle_variants
  from anon, authenticated;
grant select on public.vehicle_brands, public.vehicle_models, public.vehicle_variants
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Listings ↔ catalog
-- ---------------------------------------------------------------------------
-- A listing snapshots brand/model/variant name and specs at creation (the
-- seller may correct them), and keeps the links for later use. Catalog rows
-- dropped by a re-import only cut the link, never the listing.
alter table public.listings
  add constraint listings_model_id_fkey
    foreign key (model_id) references public.vehicle_models (id) on delete set null,
  add constraint listings_variant_id_fkey
    foreign key (variant_id) references public.vehicle_variants (id) on delete set null,
  -- When both are set, the variant must belong to that model.
  add constraint listings_variant_model_fkey
    foreign key (variant_id, model_id) references public.vehicle_variants (id, model_id)
    on delete set null (variant_id);

create index if not exists listings_model_id_idx   on public.listings (model_id);
create index if not exists listings_variant_id_idx on public.listings (variant_id);

-- The variant's display name, snapshotted like brand and model
-- («Audi Q8 e-tron» + «SQ8 e-tron 106 kWh»).
alter table public.listings
  add column if not exists variant text check (char_length(variant) <= 80);

-- The catalog includes light vehicles (L6e/L7e): from 350 kg, one seat, and
-- no DC charging at all. A listing must be able to say so instead of
-- inventing a DC figure.
alter table public.listings alter column dc_kw drop not null;
alter table public.listings alter column charge_min drop not null;
alter table public.listings drop constraint listings_weight_kg_check;
alter table public.listings add constraint listings_weight_kg_check check (weight_kg between 300 and 4000);
alter table public.listings drop constraint listings_seats_check;
alter table public.listings add constraint listings_seats_check check (seats between 1 and 9);
