-- Admins verify garages (/admin). The verified flag itself stays guarded by
-- private.protect_profile_verified — this policy only lets the admin's
-- update reach the row.
create policy profiles_update_admin on public.profiles
  for update
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
