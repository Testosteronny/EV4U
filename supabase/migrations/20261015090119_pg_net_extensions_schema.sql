set local lock_timeout = '5s';

-- pg_net is not relocatable (ALTER EXTENSION ... SET SCHEMA fails), so drop
-- and recreate it in extensions, as the Supabase docs recommend. Its objects
-- live in the net schema either way, and notify_new_message() resolves
-- net.http_post at call time, so the trigger keeps working. The
-- issue_pg_net_access event trigger re-grants USAGE on net. Dropping
-- discards unsent requests, so refuse while any are queued.
do $$
begin
  if to_regclass('net.http_request_queue') is not null
     and exists (select 1 from net.http_request_queue) then
    raise exception 'pg_net has queued requests; retry once net.http_request_queue is empty';
  end if;
end $$;

drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;
