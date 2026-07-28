# Listing → rebuild webhook (Supabase → GitHub Actions)

Goal: a listing that is published, edited or sold triggers a site rebuild
within minutes — so its prerendered page, sitemap entry and IndexNow ping
exist long before the monthly cron would have caught it.

Flow: `listings` table change → Postgres trigger → `pg_net` HTTP POST →
GitHub `repository_dispatch` (`listings-changed`) → deploy.yml builds and
deploys. The workflow's `concurrency: pages / cancel-in-progress` already
debounces bursts: rapid consecutive changes just cancel the superseded build.

## 1. Create a GitHub token

Fine-grained personal access token (github.com → Settings → Developer
settings), repository access limited to `Testosteronny/EV4U`, permission
**Contents: Read and write** (that is what `repository_dispatch` requires).
Set a long expiry and note it — the trigger dies silently when it expires.

## 2. Store the token in Supabase Vault

SQL editor (replace the placeholder):

```sql
select vault.create_secret('github_pat_XXXX', 'github_deploy_pat');
```

## 3. Create the trigger

SQL editor:

```sql
create extension if not exists pg_net;

create or replace function public.notify_deploy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pat text;
begin
  -- Only published inventory affects the public site; ignore draft churn.
  if coalesce(new.status, '') not in ('AKTIV', 'RESERVIERT')
     and coalesce(old.status, '') not in ('AKTIV', 'RESERVIERT') then
    return coalesce(new, old);
  end if;

  select decrypted_secret into pat
  from vault.decrypted_secrets where name = 'github_deploy_pat';

  perform net.http_post(
    url := 'https://api.github.com/repos/Testosteronny/EV4U/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || pat,
      'Accept', 'application/vnd.github+json',
      'Content-Type', 'application/json',
      'User-Agent', 'ev4u-supabase-webhook'
    ),
    body := '{"event_type": "listings-changed"}'::jsonb
  );
  return coalesce(new, old);
end;
$$;

create trigger listings_deploy_hook
after insert or update or delete on public.listings
for each row execute function public.notify_deploy();
```

## 4. Verify

Publish (or edit) a listing, then check github.com/Testosteronny/EV4U →
Actions: a "Deploy to GitHub Pages" run with trigger `repository_dispatch`
should appear within ~30 seconds. After it deploys, the listing has its own
prerendered `/inserat/[slug]` page, is in `sitemap.xml`, and was submitted
to IndexNow.

Troubleshooting: `pg_net` calls are async — failures land in
`net._http_response` (Supabase dashboard → SQL editor:
`select * from net._http_response order by id desc limit 10;`).
A 401/404 from GitHub means the PAT is wrong/expired or lacks the
Contents permission.

## When the real domain goes live

Update `SITE_URL` in `.github/workflows/deploy.yml` (two places) and the
`Sitemap:` line in `public/robots.txt` — nothing changes on the Supabase side.
