-- ============================================================================
-- Cantonal motor vehicle tax (Verkehrssteuer) config — OPERATOR-EDITABLE.
-- Typical annual tax for a mid-size petrol car vs. a mid-size EV, per canton,
-- reflecting current EV privileges (exemptions/discounts averaged over the
-- first ownership years). Estimates based on TCS/comparis/cantonal sources,
-- Stand 06/2026 — edit via dashboard/SQL; clients can only read.
-- ============================================================================

create table public.canton_taxes (
  canton text primary key check (char_length(canton) = 2),
  ice_tax int not null check (ice_tax >= 0),
  ev_tax int not null check (ev_tax >= 0),
  note text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.canton_taxes enable row level security;

-- Public read; NO write policies → only the service role / dashboard edits.
create policy "canton_taxes_select_all"
  on public.canton_taxes for select using (true);

create trigger canton_taxes_updated_at
  before update on public.canton_taxes
  for each row execute function public.set_updated_at();

insert into public.canton_taxes (canton, ice_tax, ev_tax, note) values
  ('AG', 390, 250, 'Reduktion für effiziente Fahrzeuge'),
  ('AI', 380, 380, 'Kein E-Bonus'),
  ('AR', 420, 530, 'Gewichtsbasiert — E-Autos oft TEURER'),
  ('BE', 480, 240, '50 % Rabatt (befristet)'),
  ('BL', 450, 0, 'Befreiung erste 4 Jahre'),
  ('BS', 400, 200, 'Rabatt für E-Fahrzeuge'),
  ('FR', 430, 0, 'Befreiung erste Jahre'),
  ('GE', 550, 150, 'Seit 2025 gewichtsbasiert'),
  ('GL', 360, 0, 'E-Autos befreit'),
  ('GR', 450, 220, 'Reduzierter Tarif'),
  ('JU', 470, 470, 'Kein E-Bonus'),
  ('LU', 380, 380, 'Kein E-Bonus'),
  ('NE', 500, 250, 'Rabatt (befristet)'),
  ('NW', 300, 100, 'Stark reduziert'),
  ('OW', 320, 160, 'Reduzierter Tarif'),
  ('SG', 400, 100, 'Ab 2026: 4 Jahre frei, danach 50 %'),
  ('SH', 250, 190, 'Moderater Rabatt'),
  ('SO', 380, 0, 'E-Autos befreit'),
  ('SZ', 420, 420, 'Kein E-Bonus'),
  ('TG', 380, 190, '50 % Rabatt'),
  ('TI', 450, 0, 'Befreiung erste 4 Jahre'),
  ('UR', 350, 175, '50 % Rabatt'),
  ('VD', 480, 150, 'Rabatt (befristet)'),
  ('VS', 420, 0, 'Befreiung erste 4 Jahre'),
  ('ZG', 300, 150, 'Rabatt für E-Fahrzeuge'),
  ('ZH', 350, 0, '100 % Rabatt für 8 Jahre');
