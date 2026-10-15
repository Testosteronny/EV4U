-- ============================================================================
-- Concept v3 «Ladestand» — the data the marketplace needs.
--
--   · listings: seller-entered battery warranty (F1), condition and
--     equipment (F11), Verhandlungsbasis, auto-hide after reports
--   · listing_price_history: every price, logged by trigger (F7, Merkliste)
--   · listing_events: views / contacts / saves per day (account stats)
--   · reports: «Inserat melden», write-only, auto-hide at 3 reporters (F13)
--   · saved_searches: alert frequency (F7)
--   · favorites: note + the price at saving time (Merkliste changes)
--   · account_settings: the private Fahrprofil, copied out of the public
--     profiles row (profiles is readable by everyone). The old profiles
--     columns plz / car_fuel / car_consumption are no longer read or
--     written by the app.
--   · profiles: public garage profile fields (F12); `verified` is admin-only
--   · newsletter_subscribers: Monatsbrief, double opt-in (F21)
--   · seller_response_minutes(): «antwortet meist innert …»
-- ============================================================================
set local lock_timeout = '5s';

/* ---------- 1 · listings --------------------------------------------------- */

alter table public.listings
  add column battery_warranty_until date,
  add column battery_warranty_km integer,
  add column battery_warranty_soh_pct smallint,
  add column mfk_date date,
  add column accident_free boolean,
  add column owners smallint,
  add column service_book boolean,
  add column warranty_until date,
  add column equipment jsonb not null default '{}'::jsonb,
  add column negotiable boolean not null default false,
  add column hidden_at timestamptz,
  add constraint listings_battery_warranty_km_check
    check (battery_warranty_km between 1000 and 1000000),
  add constraint listings_battery_warranty_soh_check
    check (battery_warranty_soh_pct between 50 and 100),
  add constraint listings_owners_check check (owners between 1 and 20),
  add constraint listings_equipment_check
    check (jsonb_typeof(equipment) = 'object' and pg_column_size(equipment) <= 2000);

comment on column public.listings.battery_warranty_until is
  'Battery warranty valid until (first of the month), as entered by the seller. Never computed.';
comment on column public.listings.battery_warranty_km is 'Battery warranty km limit, seller-entered.';
comment on column public.listings.battery_warranty_soh_pct is 'Guaranteed minimum capacity in %, seller-entered.';
comment on column public.listings.warranty_until is 'Vehicle (factory or dealer) warranty, seller-entered.';
comment on column public.listings.equipment is
  'Checklist {heat_pump, tow_hitch, winter_tyres, cable_type2, cable_mode2, panorama_roof, adaptive_cruise, camera_360, heated_seats, color}.';
comment on column public.listings.hidden_at is 'Set when 3 different users reported the listing; cleared by an admin.';

-- Public: what is for sale, reserved or sold (the Merkliste shows «Verkauft»).
-- Drafts, paused and reported listings: owner and admins only.
alter policy listings_select_published_own_or_admin on public.listings
  using (
    (status in ('AKTIV', 'RESERVIERT', 'VERKAUFT') and hidden_at is null)
    or owner = (select auth.uid())
    or (select private.is_admin())
  );

/* ---------- 2 · price history ---------------------------------------------- */

create table public.listing_price_history (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  price integer not null check (price > 0),
  changed_at timestamptz not null default now()
);
create index listing_price_history_listing_idx
  on public.listing_price_history (listing_id, changed_at desc);
alter table public.listing_price_history enable row level security;

-- Visible exactly when the listing is (RLS of listings applies in the subquery).
create policy listing_price_history_select_visible on public.listing_price_history
  for select using (exists (select 1 from public.listings l where l.id = listing_id));

create function private.log_listing_price() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.price is distinct from old.price then
    insert into public.listing_price_history (listing_id, price) values (new.id, new.price);
  end if;
  return null;
end;
$$;

create trigger listings_price_history
  after insert or update of price on public.listings
  for each row execute function private.log_listing_price();

insert into public.listing_price_history (listing_id, price, changed_at)
select id, price, created_at from public.listings;

/* ---------- 3 · listing events (stats) ------------------------------------- */

create table public.listing_events (
  listing_id uuid not null references public.listings (id) on delete cascade,
  day date not null default current_date,
  kind text not null check (kind in ('VIEW', 'CONTACT', 'SAVE')),
  count integer not null default 0,
  primary key (listing_id, day, kind)
);
alter table public.listing_events enable row level security;

create policy listing_events_select_owner_or_admin on public.listing_events
  for select using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id
        and (l.owner = (select auth.uid()) or (select private.is_admin()))
    )
  );

-- The only write path: one call per view (once per browser session), per
-- contact and per heart click. Counts only public listings.
create function public.track_listing_event(p_listing uuid, p_kind text) returns void
language sql security definer set search_path = '' as $$
  insert into public.listing_events (listing_id, kind, count)
  select l.id, p_kind, 1
  from public.listings l
  where l.id = p_listing
    and p_kind in ('VIEW', 'CONTACT', 'SAVE')
    and l.status in ('AKTIV', 'RESERVIERT')
    and l.hidden_at is null
  on conflict (listing_id, day, kind)
  do update set count = public.listing_events.count + 1;
$$;
revoke execute on function public.track_listing_event(uuid, text) from public;
grant execute on function public.track_listing_event(uuid, text) to anon, authenticated;

-- «34× gemerkt» on the listing page — the one public number.
create function public.listing_save_count(p_listing uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(e.count), 0)::integer
  from public.listing_events e
  join public.listings l on l.id = e.listing_id
  where e.listing_id = p_listing and e.kind = 'SAVE'
    and l.status in ('AKTIV', 'RESERVIERT', 'VERKAUFT') and l.hidden_at is null;
$$;
revoke execute on function public.listing_save_count(uuid) from public;
grant execute on function public.listing_save_count(uuid) to anon, authenticated;

/* ---------- 4 · reports ---------------------------------------------------- */

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  reporter uuid default auth.uid() references auth.users (id) on delete set null,
  reason text not null check (reason in ('BETRUG', 'FALSCHE_ANGABEN', 'NICHT_VERFUEGBAR', 'DOPPELT', 'ANDERES')),
  detail text not null default '' check (char_length(detail) <= 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index reports_one_per_reporter on public.reports (listing_id, reporter)
  where reporter is not null;
create index reports_open_idx on public.reports (created_at desc) where resolved_at is null;
create index reports_listing_idx on public.reports (listing_id);
alter table public.reports enable row level security;

-- Anyone may report; a logged-in reporter is recorded as themselves.
create policy reports_insert_anyone on public.reports
  for insert with check (
    resolved_at is null
    and (reporter = (select auth.uid()) or (reporter is null and (select auth.uid()) is null))
  );
create policy reports_select_admin on public.reports
  for select using ((select private.is_admin()));
create policy reports_update_admin on public.reports
  for update using ((select private.is_admin())) with check ((select private.is_admin()));

-- Three different logged-in reporters hide a listing until an admin looks.
-- Anonymous reports reach the queue but never hide anything on their own.
create function private.auto_hide_reported() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (
    select count(distinct r.reporter) from public.reports r
    where r.listing_id = new.listing_id and r.reporter is not null and r.resolved_at is null
  ) >= 3 then
    update public.listings set hidden_at = now()
    where id = new.listing_id and hidden_at is null and not is_demo;
  end if;
  return null;
end;
$$;

create trigger reports_auto_hide
  after insert on public.reports
  for each row execute function private.auto_hide_reported();

/* ---------- 5 · saved searches: alerts ------------------------------------- */

alter table public.saved_searches
  add column frequency text not null default 'TAEGLICH'
    check (frequency in ('SOFORT', 'TAEGLICH', 'WOECHENTLICH', 'AUS')),
  add column last_notified_at timestamptz,
  add column last_opened_at timestamptz not null default now();

create policy saved_searches_update_own on public.saved_searches
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

/* ---------- 6 · favorites: note + price at saving -------------------------- */

alter table public.favorites
  add column note text not null default '' check (char_length(note) <= 500),
  add column saved_price integer check (saved_price > 0),
  add column notified_price integer,
  add column notified_status text;

create policy favorites_update_own on public.favorites
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

/* ---------- 7 · account settings (private Fahrprofil) ---------------------- */

create table public.account_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plz text check (plz ~ '^[0-9]{4}$'),
  annual_km integer check (annual_km between 1000 and 100000),
  car_fuel text check (car_fuel in ('BENZIN', 'DIESEL', 'HYBRID', 'PLUGIN', 'ELEKTRO')),
  car_consumption numeric check (car_consumption > 0 and car_consumption < 50),
  elec_share smallint check (elec_share between 0 and 100),
  public_share smallint check (public_share between 0 and 100),
  pv boolean,
  charge_kw numeric check (charge_kw > 0 and charge_kw <= 22),
  notify_messages boolean not null default true,
  notify_alerts boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.account_settings enable row level security;

create policy account_settings_select_own on public.account_settings
  for select using ((select auth.uid()) = user_id);
create policy account_settings_insert_own on public.account_settings
  for insert with check ((select auth.uid()) = user_id);
create policy account_settings_update_own on public.account_settings
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create trigger account_settings_updated_at
  before update on public.account_settings
  for each row execute function public.set_updated_at();

insert into public.account_settings (user_id, plz, car_fuel, car_consumption)
select id, plz, car_fuel, car_consumption from public.profiles;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  insert into public.account_settings (user_id) values (new.id);
  return new;
end;
$$;

/* ---------- 8 · profiles: garage profile, admin-only verification ---------- */

alter table public.profiles
  add column slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  add column address text not null default '' check (char_length(address) <= 200),
  add column phone text not null default '' check (char_length(phone) <= 40),
  add column opening_hours text not null default '' check (char_length(opening_hours) <= 400),
  add column about text not null default '' check (char_length(about) <= 2000),
  add column logo_path text check (char_length(logo_path) <= 300);

-- `verified` (garage UID checked by EV4U) used to be writable by the owner
-- through profiles_update_own. Only an admin or the service role sets it.
create function private.protect_profile_verified() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.verified is distinct from old.verified
     and not (current_user in ('service_role', 'postgres') or private.is_admin()) then
    new.verified := old.verified;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_verified
  before update on public.profiles
  for each row execute function private.protect_profile_verified();

/* ---------- 9 · newsletter (Monatsbrief) ----------------------------------- */

-- No policies: only the `newsletter` Edge Function (service role) reads or
-- writes, so addresses are never exposed and double opt-in can't be skipped.
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique
    check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  token uuid not null default gen_random_uuid(),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;

/* ---------- 10 · seller response time -------------------------------------- */

-- Median minutes from a buyer's first message to the seller's first reply,
-- last 180 days. Null below two answered conversations (no badge then).
create function public.seller_response_minutes(p_owner uuid) returns integer
language sql stable security definer set search_path = '' as $$
  with firsts as (
    select
      min(m.created_at) filter (where m.sender = c.buyer) as asked,
      min(m.created_at) filter (where m.sender = p_owner) as answered
    from public.conversations c
    join public.listings l on l.id = c.listing_id
    join public.messages m on m.conversation_id = c.id
    where l.owner = p_owner and c.created_at > now() - interval '180 days'
    group by c.id
  )
  select case when count(*) >= 2 then
    round(percentile_cont(0.5) within group (order by extract(epoch from answered - asked) / 60))::integer
  end
  from firsts where answered > asked;
$$;
revoke execute on function public.seller_response_minutes(uuid) from public;
grant execute on function public.seller_response_minutes(uuid) to anon, authenticated;
