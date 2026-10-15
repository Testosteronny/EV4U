-- ============================================================================
-- 1. Read receipts: recipients may mark messages read — and change NOTHING
--    else (column-level grant: only read_at is updatable).
-- ============================================================================
alter table public.messages add column read_at timestamptz;

revoke update on table public.messages from authenticated, anon;
grant update (read_at) on table public.messages to authenticated;

create policy "messages_update_read_by_recipient"
  on public.messages for update
  using (
    sender <> (select auth.uid())
    and exists (
      select 1
      from public.conversations c
      join public.listings l on l.id = c.listing_id
      where c.id = conversation_id
        and (c.buyer = (select auth.uid()) or l.owner = (select auth.uid()))
    )
  )
  with check (sender <> (select auth.uid()));

-- ============================================================================
-- 2. Saved searches: the catalogue filters are already a URL query string —
--    we store exactly that. Owner-only CRUD.
-- ============================================================================
create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default '' check (char_length(label) <= 120),
  params text not null check (char_length(params) <= 500),
  created_at timestamptz not null default now()
);

create index saved_searches_user_idx on public.saved_searches (user_id);

alter table public.saved_searches enable row level security;

create policy "saved_searches_select_own"
  on public.saved_searches for select using (user_id = (select auth.uid()));
create policy "saved_searches_insert_own"
  on public.saved_searches for insert with check (user_id = (select auth.uid()));
create policy "saved_searches_delete_own"
  on public.saved_searches for delete using (user_id = (select auth.uid()));

-- ============================================================================
-- 3. Neupreis-Vergleich: Swiss list price when new — every second-hand
--    listing tells a savings story ("−29 % gegenüber Neupreis").
-- ============================================================================
alter table public.listings add column price_new int check (price_new > 0);

update public.listings set price_new = v.p from (values
  ('dacia-spring', 16990), ('renault-5', 27900), ('tesla-m3', 44990),
  ('byd-seal', 45900), ('hyundai-i6', 49900), ('porsche-taycan', 111900),
  ('vw-id7', 54900), ('nio-et5t', 57500), ('bmw-i5t', 76900),
  ('skoda-enyaq', 44590), ('kia-ev6', 47950), ('audi-q6', 84900)
) as v(slug, p) where listings.slug = v.slug;
