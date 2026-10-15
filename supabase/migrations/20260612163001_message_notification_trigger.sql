-- New message → async webhook to the notify-message Edge Function, which
-- emails the other participant. pg_net is fire-and-forget: a failing email
-- never blocks the message insert. The anon key only opens the door; the
-- function re-validates the message id against the database.
create extension if not exists pg_net;

create function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://ovvxqtdqevzborasrpyu.supabase.co/functions/v1/notify-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92dnhxdGRxZXZ6Ym9yYXNycHl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNjk1NjEsImV4cCI6MjA5Njg0NTU2MX0.aA9vHQ1-pg0hv6k8a1KSBUZ1Qrjoblc7T1TgKLY6oRg'
    ),
    body := jsonb_build_object('message_id', new.id)
  );
  return new;
end;
$$;

revoke execute on function public.notify_new_message() from anon, authenticated, public;

create trigger messages_notify
  after insert on public.messages
  for each row execute function public.notify_new_message();
