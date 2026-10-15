-- Fixes for security advisor findings.

-- 1. Pin search_path on the trigger function.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Trigger functions must not be callable via the REST RPC surface.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.set_updated_at() from anon, authenticated, public;

-- 3. Booking inserts: keep them public but validated, not blanket-true.
drop policy "bookings_insert_anyone" on public.bookings;
create policy "bookings_insert_validated"
  on public.bookings for insert
  with check (
    char_length(consultant) between 1 and 80
    and char_length(slot) between 1 and 40
    and char_length(contact) <= 200
    and (listing_slug is null or char_length(listing_slug) <= 80)
  );

-- 4. Public bucket: object URLs work without a broad SELECT policy on
--    storage.objects — remove it so clients can't LIST the bucket.
drop policy "photos_public_read" on storage.objects;
