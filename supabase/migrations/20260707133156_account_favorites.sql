-- Merkliste moves from anonymous localStorage to the account: one row per
-- (user, listing slug), visible and writable only by the owner. Slug (not
-- uuid FK) so the client's slug-keyed rows work unchanged; slugs of deleted
-- listings are filtered client-side.

create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_slug text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_slug)
);

alter table public.favorites enable row level security;

create policy "favorites_select_own"
  on public.favorites for select using (auth.uid() = user_id);
create policy "favorites_insert_own"
  on public.favorites for insert with check (auth.uid() = user_id);
create policy "favorites_delete_own"
  on public.favorites for delete using (auth.uid() = user_id);
