-- ============================================================================
-- Buyer ↔ seller messaging. One conversation per (listing, buyer); only the
-- two participants can ever see it. Platform-seeded listings (owner is null)
-- are not messageable.
-- ============================================================================

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer)
);

create index conversations_listing_idx on public.conversations (listing_id);
create index conversations_buyer_idx on public.conversations (buyer);

alter table public.conversations enable row level security;

-- Participants: the buyer, or the owner of the listing.
create policy "conversations_select_participants"
  on public.conversations for select
  using (
    buyer = (select auth.uid())
    or exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner = (select auth.uid())
    )
  );

-- Buyers start conversations about published, user-owned listings —
-- never about their own.
create policy "conversations_insert_buyer"
  on public.conversations for insert
  with check (
    buyer = (select auth.uid())
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.status in ('AKTIV', 'RESERVIERT')
        and l.owner is not null
        and l.owner <> (select auth.uid())
    )
  );

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;

-- Visible to both conversation participants…
create policy "messages_select_participants"
  on public.messages for select
  using (
    exists (
      select 1
      from public.conversations c
      join public.listings l on l.id = c.listing_id
      where c.id = conversation_id
        and (c.buyer = (select auth.uid()) or l.owner = (select auth.uid()))
    )
  );

-- …and writable only by a participant, as themselves.
create policy "messages_insert_participants"
  on public.messages for insert
  with check (
    sender = (select auth.uid())
    and exists (
      select 1
      from public.conversations c
      join public.listings l on l.id = c.listing_id
      where c.id = conversation_id
        and (c.buyer = (select auth.uid()) or l.owner = (select auth.uid()))
    )
  );
