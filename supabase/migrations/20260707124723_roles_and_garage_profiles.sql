-- Roles: admin lives in its own table (never client-writable) and every
-- admin capability is an RLS policy — the UI only decides what to show.

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('ADMIN')),
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

-- Users may see their own role row (drives the admin UI); no client writes.
create policy "user_roles_read_own"
  on public.user_roles for select using (auth.uid() = user_id);

-- Security definer so RLS policies elsewhere can check admin status without
-- exposing other users' role rows.
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'ADMIN'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- Admin moderation: read everything (incl. drafts), correct status, remove.
create policy "listings_admin_select"
  on public.listings for select using (public.is_admin());
create policy "listings_admin_update"
  on public.listings for update using (public.is_admin()) with check (public.is_admin());
create policy "listings_admin_delete"
  on public.listings for delete using (public.is_admin());

-- Garage extras on the existing profile (type PRIVAT|GARAGE already exists).
alter table public.profiles
  add column company_uid text,
  add column website text;
