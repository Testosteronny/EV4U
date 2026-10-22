-- ============================================================================
-- Review hardening (22.10.2026).
--
--   · listings.photos / profiles.logo_path: only files in the owner's own
--     folder, in the shape the uploaders write. Photos were free text, so
--     a listing could point every visitor's browser at any path.
--   · listings.seller_name / seller_type come from the owner's profile.
--     The client used to send them: a private seller could list as a
--     «Garage» under any name, and the wizard fell back to the local part
--     of the seller's e-mail address — published on the listing.
--   · profiles.verified drops when a garage changes name, UID or type: the
--     badge says EV4U checked exactly these.
--   · listings.created_at means «online since»: publishing a draft sets
--     it, so alerts and «Neu eingetroffen» see drafts published days
--     later. A published listing cannot become a draft again (publishing
--     it once more would bump it to the top).
--   · messages / conversations: timestamps and markers are the server's
--     (a backdated reply faked the response-time badge; a pre-set
--     notified_at skipped the mail). Spam limits: 20 new conversations a
--     day, 30 messages per 10 minutes.
--   · favorites / saved_searches: per-account caps and a slug shape — the
--     alerts function reads them all, and one account must not flood its
--     batch or have it send thousands of mails.
--   · track_listing_event: the owner's own views and clicks don't count.
--   · api_quota: a daily budget for the paid `suche` function.
-- ============================================================================
set local lock_timeout = '5s';

/* ---------- 1 · file paths -------------------------------------------------- */

-- `<owner>/<listing slug>/<file>.jpg`, as PhotoStep uploads them. Platform
-- rows (owner null) are curated by the operator and not checked.
create function private.own_photo_paths(p_photos text[], p_owner uuid) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(bool_and(
    p ~ '^[0-9a-f-]{36}/[a-z0-9-]{1,80}/[a-z0-9-]{1,40}\.jpg$'
    and starts_with(p, p_owner::text || '/')
  ), true)
  from unnest(p_photos) as p;
$$;
-- A check constraint runs with the writer's rights.
grant execute on function private.own_photo_paths(text[], uuid) to anon, authenticated;

alter table public.listings
  add constraint listings_photos_own check (private.own_photo_paths(photos, owner));

alter table public.profiles
  add constraint profiles_logo_path_own check (
    logo_path is null
    or (logo_path ~ '^[0-9a-f-]{36}/_logo/[a-z0-9-]{1,40}\.jpg$' and starts_with(logo_path, id::text || '/'))
  );

/* ---------- 2 · listings: seller and «online since» ------------------------- */

create function private.seller_label(p_name text, p_type public.seller_type) returns text
language sql immutable set search_path = '' as $$
  select coalesce(nullif(btrim(p_name), ''), case p_type when 'GARAGE' then 'Garage' else 'Privatperson' end);
$$;
grant execute on function private.seller_label(text, public.seller_type) to anon, authenticated;

create or replace function private.protect_listing_columns() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') or private.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.hidden_at := null;
    new.created_at := now();
  else
    if old.status <> 'ENTWURF' and new.status = 'ENTWURF' then
      raise exception 'a published listing cannot become a draft again'
        using errcode = 'check_violation', hint = 'Pause it (PAUSIERT) instead.';
    end if;
    new.hidden_at := old.hidden_at;
    new.slug := old.slug;
    new.created_at := case
      when old.status = 'ENTWURF' and new.status <> 'ENTWURF' then now()
      else old.created_at
    end;
  end if;
  if new.owner is not null then
    select private.seller_label(p.name, p.type), p.type
      into new.seller_name, new.seller_type
      from public.profiles p
      where p.id = new.owner;
  end if;
  return new;
end;
$$;

-- A renamed profile renames its listings.
create function private.sync_listing_seller() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.listings
  set seller_name = private.seller_label(new.name, new.type), seller_type = new.type
  where owner = new.id;
  return null;
end;
$$;
revoke execute on function private.sync_listing_seller() from public, anon, authenticated;

create trigger profiles_sync_listing_seller
  after update of name, type on public.profiles
  for each row
  when (old.name is distinct from new.name or old.type is distinct from new.type)
  execute function private.sync_listing_seller();

update public.listings l
set seller_name = private.seller_label(p.name, p.type), seller_type = p.type
from public.profiles p
where p.id = l.owner;

/* ---------- 3 · profiles: verification covers name, UID and type ------------ */

create or replace function private.protect_profile_verified() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') or private.is_admin() then
    return new;
  end if;
  new.verified := case
    when new.name is distinct from old.name
      or new.company_uid is distinct from old.company_uid
      or new.type is distinct from old.type then false
    else old.verified
  end;
  return new;
end;
$$;

/* ---------- 4 · messages and conversations ---------------------------------- */

create function private.guard_new_message() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  new.created_at := now();
  new.read_at := null;
  new.notified_at := null;
  if (
    select count(*) from public.messages m
    where m.sender = new.sender and m.created_at > now() - interval '10 minutes'
  ) >= 30 then
    raise exception 'too many messages in a short time' using errcode = 'check_violation', hint = 'rate_limit';
  end if;
  return new;
end;
$$;

create trigger messages_guard_insert
  before insert on public.messages
  for each row execute function private.guard_new_message();

create function private.guard_new_conversation() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  new.created_at := now();
  if (
    select count(*) from public.conversations c
    where c.buyer = new.buyer and c.created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'too many new conversations today' using errcode = 'check_violation', hint = 'rate_limit';
  end if;
  return new;
end;
$$;

create trigger conversations_guard_insert
  before insert on public.conversations
  for each row execute function private.guard_new_conversation();

/* ---------- 5 · favorites and saved searches: per-account caps -------------- */

create function private.cap_rows_per_user() returns trigger
language plpgsql set search_path = '' as $$
declare
  n integer;
begin
  if tg_table_name = 'favorites' then
    select count(*) into n from public.favorites where user_id = new.user_id;
  else
    select count(*) into n from public.saved_searches where user_id = new.user_id;
  end if;
  if n >= tg_argv[0]::integer then
    raise exception '% per account at most', tg_argv[0] using errcode = 'check_violation', hint = 'limit';
  end if;
  return new;
end;
$$;

create trigger favorites_cap
  before insert on public.favorites
  for each row execute function private.cap_rows_per_user('200');
create trigger saved_searches_cap
  before insert on public.saved_searches
  for each row execute function private.cap_rows_per_user('25');

alter table public.favorites
  add constraint favorites_slug_format
    check (listing_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(listing_slug) <= 80);

/* ---------- 6 · stats: the owner's own clicks don't count ------------------- */

create or replace function public.track_listing_event(p_listing uuid, p_kind text) returns void
language sql security definer set search_path = '' as $$
  insert into public.listing_events (listing_id, kind, count)
  select l.id, p_kind, 1
  from public.listings l
  where l.id = p_listing
    and p_kind in ('VIEW', 'CONTACT', 'SAVE')
    and l.status in ('AKTIV', 'RESERVIERT')
    and l.hidden_at is null
    and l.owner is distinct from (select auth.uid())
  on conflict (listing_id, day, kind)
  do update set count = public.listing_events.count + 1;
$$;

/* ---------- 7 · daily API budget (Edge Function `suche`) -------------------- */

create table public.api_quota (
  name text not null,
  day date not null default current_date,
  count integer not null default 0,
  primary key (name, day)
);
alter table public.api_quota enable row level security;
revoke all on public.api_quota from anon, authenticated;

-- Counts one call; false once today's budget is spent. Service role only.
create function public.take_api_quota(p_name text, p_limit integer) returns boolean
language sql set search_path = '' as $$
  insert into public.api_quota as q (name, day, count) values (p_name, current_date, 1)
  on conflict (name, day) do update set count = q.count + 1
  returning q.count <= p_limit;
$$;
revoke execute on function public.take_api_quota(text, integer) from public, anon, authenticated;
grant execute on function public.take_api_quota(text, integer) to service_role;
