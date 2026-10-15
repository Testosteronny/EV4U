-- Demo listings for checking the live site before launch. A flag rather
-- than a convention (owner is null) so they are labelled in the UI and
-- removed with one statement: delete from public.listings where is_demo;
--
-- Only platform rows may carry it: sellers always insert with their own
-- owner (RLS listings_insert_own), so no real listing can ever be marked
-- demo - or swept away by that cleanup.
set local lock_timeout = '5s';

alter table public.listings
  add column is_demo boolean not null default false,
  add constraint listings_demo_platform_only check (not is_demo or owner is null);

comment on column public.listings.is_demo is
  'Demo listing (platform-owned, shown with a Demo badge). Remove before launch: delete from public.listings where is_demo;';
