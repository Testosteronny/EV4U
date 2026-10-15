-- Covering index for the composite FK listings_variant_model_fkey
-- (variant_id, model_id) -> vehicle_variants (id, model_id), flagged by the
-- unindexed_foreign_keys advisor. Its leading column also serves
-- listings_variant_id_fkey, so the single-column index becomes redundant.
set local lock_timeout = '5s';

create index if not exists listings_variant_model_idx on public.listings (variant_id, model_id);
drop index if exists public.listings_variant_id_idx;
