-- Photo storage: public read, owners write into their own uid-prefixed folder.
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true);

create policy "photos_public_read"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

create policy "photos_owner_upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "photos_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
