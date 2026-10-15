set local lock_timeout = '5s';

-- is_admin() was SECURITY DEFINER in the exposed public schema, so anyone
-- could call it via /rest/v1/rpc/is_admin. Move it to a schema PostgREST
-- does not expose. anon and authenticated keep USAGE/EXECUTE because the
-- listings policies apply to every role and Postgres checks EXECUTE on
-- each function in a policy expression, even when OR short-circuits.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'ADMIN'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

-- One permissive policy per action instead of an *_own / listings_admin_*
-- pair. Same semantics: permissive policies were OR-ed already, and the
-- UPDATE pair's WITH CHECKs (owner via USING fallback, admin) OR to the same
-- expression as their USINGs.
drop policy listings_select_published_or_own on public.listings;
drop policy listings_admin_select on public.listings;
create policy listings_select_published_own_or_admin on public.listings
  for select
  using (
    status <> 'ENTWURF'
    or owner = (select auth.uid())
    or (select private.is_admin())
  );

drop policy listings_update_own on public.listings;
drop policy listings_admin_update on public.listings;
create policy listings_update_own_or_admin on public.listings
  for update
  using (owner = (select auth.uid()) or (select private.is_admin()))
  with check (owner = (select auth.uid()) or (select private.is_admin()));

drop policy listings_delete_own on public.listings;
drop policy listings_admin_delete on public.listings;
create policy listings_delete_own_or_admin on public.listings
  for delete
  using (owner = (select auth.uid()) or (select private.is_admin()));

drop function public.is_admin();
