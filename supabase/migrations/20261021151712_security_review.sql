-- ============================================================================
-- Security review (21.10.2026).
--
--   · listings: the moderation and ranking columns are not the seller's to
--     set. hidden_at (set by three reports) could be cleared by the owner
--     through the REST API, created_at forged to pin a car on top of
--     «Neu eingetroffen», and the slug — a path segment of the prerendered
--     page and the storage folder — changed after publishing.
--   · listings.slug: only the shape newSlug() produces. It becomes a file
--     path at build time (/inserat/[slug]), so «../konto» must never get in.
--   · text lengths: every visitor downloads the whole stock, so a 1 MB note
--     would land on every page. Limits match the form fields.
--   · profiles: website only http(s), name/UID bounded (also at signup).
--   · messages.notified_at: notify-message claims each message once, so a
--     replayed call cannot mail the other participant again and again.
--   · job_runs: the alerts function takes a lease — extra calls (the
--     publishable key is public) neither run it twice nor in parallel.
--   · listing-photos: only the JPEGs the app produces, at most 5 MB — the
--     public bucket is no file host for anything else.
--   · newsletter_subscribers / job_runs: no table grants for API roles.
-- ============================================================================
set local lock_timeout = '5s';

/* ---------- 1 · listings: columns only admins (or the platform) set -------- */

create function private.protect_listing_columns() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') or private.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.hidden_at := null;
    new.created_at := now();
  else
    new.hidden_at := old.hidden_at;
    new.created_at := old.created_at;
    new.slug := old.slug;
  end if;
  return new;
end;
$$;

create trigger listings_protect_columns
  before insert or update on public.listings
  for each row execute function private.protect_listing_columns();

/* ---------- 2 · listings: slug shape and text lengths ---------------------- */

alter table public.listings
  add constraint listings_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  add constraint listings_text_lengths check (
    char_length(brand) <= 80
    and char_length(model) <= 120
    and char_length(coalesce(variant, '')) <= 160
    and char_length(seller_name) <= 120
    and char_length(ort) <= 120
    and char_length(note) <= 2000
  );

/* ---------- 3 · profiles ---------------------------------------------------- */

alter table public.profiles
  add constraint profiles_text_lengths
    check (char_length(name) <= 120 and char_length(coalesce(company_uid, '')) <= 40),
  add constraint profiles_website_check
    check (website is null or (website ~* '^https?://\S+$' and char_length(website) <= 300));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'name', ''), 120));
  insert into public.account_settings (user_id) values (new.id);
  return new;
end;
$$;

/* ---------- 4 · messages: one notification per message -------------------- */

-- authenticated may update read_at only (column grant), so this column is
-- the service role's.
alter table public.messages add column notified_at timestamptz;

/* ---------- 5 · job leases (alerts) ---------------------------------------- */

create table public.job_runs (
  name text primary key,
  started_at timestamptz not null default '-infinity'
);
alter table public.job_runs enable row level security;
insert into public.job_runs (name) values ('alerts');

/* ---------- 6 · grants: service-role-only tables --------------------------- */

revoke all on public.job_runs from anon, authenticated;
revoke all on public.newsletter_subscribers from anon, authenticated;

/* ---------- 7 · photo bucket ----------------------------------------------- */

update storage.buckets
set allowed_mime_types = array['image/jpeg'], file_size_limit = 5242880
where id = 'listing-photos';
