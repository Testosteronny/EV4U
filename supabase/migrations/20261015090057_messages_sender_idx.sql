set local lock_timeout = '5s';

-- Covers messages_sender_fkey: ON DELETE CASCADE from profiles and lookups
-- by sender otherwise scan the whole table. The table is tiny, so a plain
-- (non-concurrent) build inside the migration transaction is fine.
create index messages_sender_idx on public.messages (sender);
