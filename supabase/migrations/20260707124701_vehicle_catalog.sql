-- Vehicle catalog: every EV model on the Swiss market (master list), plus
-- variant-level specs (trims). Operator-managed reference data: public read,
-- no client writes. Listings reference a model/variant for prefilled specs.

create table public.vehicle_models (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  model text not null,
  -- Excel taxonomy (finer than listing segments, mapped in the app)
  segment text not null check (segment in ('Kleinwagen','Kompaktklasse','Mittelklasse','Oberklasse','SUV','VAN/BUS')),
  status text not null default 'NEU' check (status in ('NEU','AUSLAUF')),
  -- Model-level best-variant figures from the master list; fallbacks until
  -- variant rows exist for the model.
  range_km_max integer,
  price_from_chf integer,
  seats_max integer,
  consumption_min numeric,
  remark text,
  created_at timestamptz not null default now(),
  unique (brand, model)
);

create table public.vehicle_variants (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.vehicle_models(id) on delete cascade,
  name text not null, -- trim, e.g. "77 kWh AWD Long Range"
  battery_gross_kwh numeric,
  battery_net_kwh numeric,
  range_wltp_km integer,
  consumption_kwh_100km numeric,
  dc_peak_kw integer,
  dc_10_80_min integer,
  ac_kw numeric,
  power_kw integer,
  torque_nm integer,
  accel_0_100_s numeric,
  top_speed_kmh integer,
  drive text check (drive in ('FWD','RWD','AWD')),
  weight_kg integer,
  payload_kg integer,
  towing_kg integer,
  seats integer,
  trunk_l integer,
  frunk_l integer,
  v2l boolean not null default false,
  v2h boolean not null default false,
  v2g boolean not null default false,
  heat_pump boolean,
  price_new_chf integer,
  market_start integer,
  market_end integer,
  features text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (model_id, name)
);

alter table public.vehicle_models enable row level security;
alter table public.vehicle_variants enable row level security;

create policy "vehicle_models_public_read"
  on public.vehicle_models for select using (true);
create policy "vehicle_variants_public_read"
  on public.vehicle_variants for select using (true);
-- No insert/update/delete policies: edited via dashboard/SQL only.

create index vehicle_models_brand_idx on public.vehicle_models (brand);
create index vehicle_variants_model_idx on public.vehicle_variants (model_id);

-- Listings can reference the catalog (nullable; free-text stays possible).
alter table public.listings
  add column model_id uuid references public.vehicle_models(id) on delete set null,
  add column variant_id uuid references public.vehicle_variants(id) on delete set null;
