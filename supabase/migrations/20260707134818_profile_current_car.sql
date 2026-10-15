-- The visitor's current car (fuel + consumption) personalises every
-- comparison in the Rechenwerk. Stored on the profile so logged-in users
-- keep it across devices; null = never set -> the app's fleet-typical
-- defaults apply.

alter table public.profiles
  add column car_fuel text check (car_fuel in ('BENZIN','DIESEL','ELEKTRO')),
  add column car_consumption numeric check (car_consumption > 0 and car_consumption < 50);
