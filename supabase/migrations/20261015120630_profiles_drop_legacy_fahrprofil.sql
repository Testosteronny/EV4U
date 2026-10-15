-- The Fahrprofil lives in account_settings since v3_marketplace (owner-only;
-- profiles is public). These columns were copied there, are no longer read
-- or written by the app and were empty on every row.
set local lock_timeout = '5s';

alter table public.profiles
  drop column plz,
  drop column car_fuel,
  drop column car_consumption;
