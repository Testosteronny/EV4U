-- v3: a seller can pause a listing without losing it. Its own migration:
-- a new enum value cannot be used in the transaction that adds it.
alter type public.listing_status add value if not exists 'PAUSIERT';
