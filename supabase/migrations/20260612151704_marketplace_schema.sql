-- ============================================================================
-- EV4U marketplace schema: profiles, listings, bookings.
-- Authorization is enforced entirely by Row Level Security.
-- ============================================================================

create type public.seller_type as enum ('PRIVAT', 'GARAGE');
create type public.listing_status as enum ('ENTWURF', 'AKTIV', 'RESERVIERT', 'VERKAUFT');
create type public.segment as enum ('KOMPAKT', 'LIMOUSINE', 'KOMBI', 'SUV');

-- ----------------------------------------------------------------------------
-- profiles — one row per auth user (PRIVAT seller or GARAGE)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  type public.seller_type not null default 'PRIVAT',
  name text not null default '',
  plz text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_all"
  on public.profiles for select using (true);
create policy "profiles_insert_own"
  on public.profiles for insert with check ((select auth.uid()) = id);
create policy "profiles_update_own"
  on public.profiles for update using ((select auth.uid()) = id);

-- Auto-create a profile when a user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- listings — the Inserate. `slug` is the public URL id; `owner` is null for
-- platform-seeded data and required for user-created listings (RLS).
-- ----------------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  owner uuid references public.profiles (id) on delete cascade,
  brand text not null,
  model text not null,
  segment public.segment not null,
  year int not null check (year between 2008 and 2035),
  km int not null check (km >= 0),
  price int not null check (price > 0),
  range_km int not null check (range_km > 0),
  consumption numeric(4, 1) not null check (consumption > 0),
  charge_min int not null check (charge_min > 0),
  dc_kw int not null check (dc_kw > 0),
  battery_kwh numeric(5, 1) not null check (battery_kwh > 0),
  soh int not null check (soh between 50 and 100),
  bidi boolean not null default false,
  seats int not null default 5 check (seats between 2 and 9),
  seller_name text not null,
  seller_type public.seller_type not null,
  ort text not null,
  status public.listing_status not null default 'ENTWURF',
  note text not null default '',
  photos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_status_idx on public.listings (status);
create index listings_browse_idx on public.listings (segment, price);
create index listings_owner_idx on public.listings (owner);

alter table public.listings enable row level security;

-- Published listings are public; drafts are visible to their owner only.
create policy "listings_select_published_or_own"
  on public.listings for select
  using (status <> 'ENTWURF' or owner = (select auth.uid()));
create policy "listings_insert_own"
  on public.listings for insert
  with check (owner = (select auth.uid()));
create policy "listings_update_own"
  on public.listings for update
  using (owner = (select auth.uid()));
create policy "listings_delete_own"
  on public.listings for delete
  using (owner = (select auth.uid()));

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger listings_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- bookings — Sprechstunde requests. Write-only from the client: anyone may
-- insert, nobody may read (no select policy) — handled by staff tooling.
-- ----------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  consultant text not null,
  slot text not null,
  contact text not null default '',
  listing_slug text,
  created_at timestamptz not null default now()
);

alter table public.bookings enable row level security;

create policy "bookings_insert_anyone"
  on public.bookings for insert with check (true);
