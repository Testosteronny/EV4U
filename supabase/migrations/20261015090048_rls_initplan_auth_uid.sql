set local lock_timeout = '5s';

-- (select auth.uid()) is evaluated once per statement as an InitPlan
-- instead of once per row.
alter policy favorites_select_own on public.favorites
  using ((select auth.uid()) = user_id);
alter policy favorites_insert_own on public.favorites
  with check ((select auth.uid()) = user_id);
alter policy favorites_delete_own on public.favorites
  using ((select auth.uid()) = user_id);

alter policy user_roles_read_own on public.user_roles
  using ((select auth.uid()) = user_id);
