-- Semantics change: values are the CURRENT-YEAR tax (no multi-year
-- averaging). tax_year is shown in the UI and switched by the operator
-- when cantons change their rules (e.g. 2027 update).
alter table public.canton_taxes
  add column tax_year int not null default 2026;

-- SG 2026: first 4 years fully exempt → a current EV pays 0 today
-- (previously seeded as an early-years average of 100).
update public.canton_taxes
set ev_tax = 0, note = '2026: erste 4 Jahre befreit, danach 50 %'
where canton = 'SG';
