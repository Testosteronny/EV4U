-- ============================================================================
-- EV4U demo listings — for checking the live site before launch.
-- NOT real cars: every row is is_demo, shown with a «Demo» badge, kept out
-- of search engines, and owned by the platform (owner null), so nobody can
-- message a seller that doesn't exist.
--
-- Each car is a catalog variant (vehicle_variants.slug): brand, model,
-- variant and every spec come from the catalog, exactly as if a seller had
-- picked it in the sell form. Only what a seller adds is written here —
-- year, km, price, SOH, seller, place, a note.
--
-- Idempotent: replaces all demo rows, never touches anything else.
--   Load / reset:  supabase db query --linked -f supabase/seed/demo_listings.sql
--   Remove (before launch):  delete from public.listings where is_demo;
-- ============================================================================

begin;

delete from public.listings where is_demo;

insert into public.listings (
  slug, owner, is_demo, brand, model, variant, model_id, variant_id, segment,
  year, km, price, range_km, consumption, battery_kwh, dc_kw, charge_min,
  seats, weight_kg, bidi, price_new, soh, seller_name, seller_type, ort,
  status, note, created_at
)
select
  d.slug, null, true, b.name, m.name, v.name, m.id, v.id,
  -- Same mapping as toListingSegment() in src/lib/vehicleCatalog.ts.
  (case
     when m.body_type in ('Kombi', 'Van', 'Hochdachkombi') then 'KOMBI'
     when m.body_type in ('SUV', 'Coupé-SUV', 'Pick-up') then 'SUV'
     when m.body_type in ('Limousine', 'Coupé', 'Cabrio', 'Roadster') then 'LIMOUSINE'
     when m.segment = 'SUV' then 'SUV'
     when m.segment in ('Mittelklasse', 'Oberklasse', 'Sportwagen') then 'LIMOUSINE'
     else 'KOMPAKT'
   end)::public.segment,
  d.year, d.km, d.price,
  v.range_wltp_km, v.consumption_kwh_100km, v.battery_net_kwh, v.dc_max_kw, v.dc_10_80_min,
  v.seats,
  case when v.curb_weight_kg between 300 and 4000 then v.curb_weight_kg end,
  v.v2l, v.price_new_chf,
  d.soh, d.seller_name, d.seller_type::public.seller_type, d.ort,
  d.status::public.listing_status, d.note,
  now() - make_interval(days => d.posted_days, hours => d.posted_days % 7)
from (values
  -- variant slug, listing slug, year, km, price CHF, SOH %, seller, type, place, status, note, days online
  ('tesla_model-3_model-3-long-range-premium-awd', 'demo-tesla-model-3-long-range', 2022, 68000, 26900, 91,
   'Garage Seeland E-Mobil', 'GARAGE', '2502 Biel/Bienne', 'AKTIV',
   'Anhängerkupplung nachgerüstet, Winterräder auf Felgen', 12),
  ('tesla_model-y_model-y-long-range-premium-awd', 'demo-tesla-model-y-long-range', 2023, 41000, 36900, 95,
   'Lena K.', 'PRIVAT', '8004 Zürich', 'AKTIV',
   'Garagengepflegt, Batterie-Check 06/2026 mit 95 %', 3),
  ('vw_id-3_id-3-pro-59-kwh', 'demo-vw-id-3-pro', 2021, 74000, 18900, 90,
   'Elektro Garage Aaretal', 'GARAGE', '4600 Olten', 'AKTIV',
   'Wärmepumpe, Navi, frisch ab MFK', 21),
  ('vw_id-4_id-4-pro-79-kwh', 'demo-vw-id-4-pro', 2022, 52000, 29500, 93,
   'Marco B.', 'PRIVAT', '3011 Bern', 'AKTIV',
   'Anhängerkupplung 1000 kg, Panoramadach', 8),
  ('vw_id-buzz_id-buzz-pro-86-kwh-lang', 'demo-vw-id-buzz-lang', 2024, 18000, 54900, 98,
   'E-Center Rheintal', 'GARAGE', '9450 Altstätten', 'AKTIV',
   'Langversion mit 7 Sitzen, Werksgarantie', 1),
  ('skoda_enyaq_enyaq-85-82-kwh', 'demo-skoda-enyaq-85', 2024, 23000, 38900, 97,
   'Elektro Garage Aaretal', 'GARAGE', '3600 Thun', 'AKTIV',
   'Werksgarantie bis 2028, Wärmepumpe', 5),
  ('hyundai_ioniq-5_ioniq-5-long-range-84-kwh-awd', 'demo-hyundai-ioniq-5-awd', 2023, 39000, 37500, 95,
   'Daniel S.', 'PRIVAT', '6003 Luzern', 'AKTIV',
   'V2L-Adapter dabei: Strom fürs Camping und für Werkzeug', 9),
  ('kia_ev6_ev6-long-range-84-kwh-rwd', 'demo-kia-ev6-long-range', 2022, 61000, 29900, 92,
   'Garage Seeland E-Mobil', 'GARAGE', '2502 Biel/Bienne', 'AKTIV',
   '800-Volt-Technik: 10–80 % in rund 18 Minuten', 16),
  ('kia_niro-ev_niro-ev-64-8-kwh', 'demo-kia-niro-ev', 2023, 27000, 27900, 96,
   'Sandra M.', 'PRIVAT', '5000 Aarau', 'AKTIV',
   'Wärmepumpe, Sitzheizung vorne und hinten', 4),
  ('renault_zoe_zoe-r135-52-kwh', 'demo-renault-zoe-r135', 2020, 89000, 11900, 88,
   'Peter W.', 'PRIVAT', '8400 Winterthur', 'AKTIV',
   'Batterie gekauft, keine Batteriemiete', 27),
  ('renault_5-e-tech_r5-comfort-range-52-kwh', 'demo-renault-5-comfort-range', 2025, 6000, 26500, 100,
   'E-Center Rheintal', 'GARAGE', '9000 St. Gallen', 'AKTIV',
   'Vorführwagen, Garantie bis 2030', 0),
  ('bmw_i3_i3s-120-ah', 'demo-bmw-i3s', 2020, 54000, 17900, 89,
   'Nina R.', 'PRIVAT', '4051 Basel', 'AKTIV',
   'Carbon-Karosserie, ideales Stadtauto', 33),
  ('bmw_ix1_xdrive30', 'demo-bmw-ix1-xdrive30', 2024, 15000, 44900, 98,
   'Garage am See', 'GARAGE', '6300 Zug', 'AKTIV',
   'M Sportpaket, Head-up-Display', 2),
  ('bmw_i4_edrive40', 'demo-bmw-i4-edrive40', 2023, 33000, 42500, 96,
   'Thomas H.', 'PRIVAT', '8200 Schaffhausen', 'AKTIV',
   'Service immer bei BMW, Werksgarantie', 11),
  ('polestar_polestar-2_polestar-2-long-range-dual-motor', 'demo-polestar-2-dual-motor', 2022, 58000, 28900, 92,
   'Julia F.', 'PRIVAT', '1003 Lausanne', 'RESERVIERT',
   'Pilot- und Plus-Paket', 14),
  ('volvo_ex30_ex30-single-motor-extended-69-kwh', 'demo-volvo-ex30-extended', 2024, 12000, 31900, 99,
   'Garage am See', 'GARAGE', '6300 Zug', 'AKTIV',
   'Wie neu, Garantie bis 2029', 6),
  ('mg_mg4_mg4-comfort-64-kwh', 'demo-mg4-comfort', 2023, 35000, 19900, 94,
   'Elektro Garage Aaretal', 'GARAGE', '3600 Thun', 'AKTIV',
   '7 Jahre Werksgarantie', 19),
  ('byd_atto-3_design-60-4-kwh', 'demo-byd-atto-3-design', 2024, 21000, 27500, 97,
   'E-Center Rheintal', 'GARAGE', '9450 Altstätten', 'AKTIV',
   'LFP-Batterie, 8 Jahre Batteriegarantie', 7),
  ('fiat_500e_500e-la-prima-42-kwh', 'demo-fiat-500e-la-prima', 2022, 30000, 17500, 94,
   'Chiara B.', 'PRIVAT', '6900 Lugano', 'AKTIV',
   'Parkassistent, perfekt für die Stadt', 10),
  ('nissan_leaf-ze1_leaf-40-kwh', 'demo-nissan-leaf-40', 2019, 98000, 9900, 84,
   'Urs K.', 'PRIVAT', '7000 Chur', 'AKTIV',
   'CHAdeMO-Anschluss, aus zweiter Hand', 41),
  ('mercedes-benz_eqa_eqa-250-70-5-kwh', 'demo-mercedes-eqa-250', 2022, 46000, 29900, 93,
   'Garage am See', 'GARAGE', '6300 Zug', 'RESERVIERT',
   'AMG Line, 360°-Kamera', 22),
  ('audi_q4-e-tron_e-tron-210-kw-82-kwh', 'demo-audi-q4-e-tron', 2024, 28000, 41900, 96,
   'Reto G.', 'PRIVAT', '8640 Rapperswil-Jona', 'AKTIV',
   'S line, Matrix-LED-Scheinwerfer', 13),
  ('porsche_taycan_taycan-4s-105-kwh', 'demo-porsche-taycan-4s', 2024, 24000, 94500, 98,
   'Garage Seeland E-Mobil', 'GARAGE', '2502 Biel/Bienne', 'AKTIV',
   'Sport Chrono, Porsche Approved bis 2027', 18),
  ('dacia_spring-26-8-kwh_spring-65-26-8-kwh', 'demo-dacia-spring-65', 2023, 21000, 10900, 96,
   'Michael T.', 'PRIVAT', '4600 Olten', 'AKTIV',
   'Zweitwagen, Ganzjahresreifen', 25),
  ('micro_microlino_microlino-dolce-14-kwh', 'demo-microlino-dolce', 2023, 8000, 15900, 98,
   'Sophie L.', 'PRIVAT', '8004 Zürich', 'AKTIV',
   'Schweizer Design, passt quer in jede Parklücke', 15),
  ('kia_ev9_ev9-long-range-rwd-99-8-kwh', 'demo-kia-ev9-long-range', 2024, 19000, 58900, 98,
   'Elektro Garage Aaretal', 'GARAGE', '3011 Bern', 'AKTIV',
   '7 Sitze, Anhängelast 2500 kg', 3),
  ('cupra_born_born-58-kwh', 'demo-cupra-born-58', 2022, 44000, 22900, 93,
   'Luca M.', 'PRIVAT', '6003 Luzern', 'AKTIV',
   'Sportsitze, Winterräder', 30),
  ('smart_1_1-premium-66-kwh', 'demo-smart-1-premium', 2023, 26000, 24900, 96,
   'E-Center Rheintal', 'GARAGE', '1700 Freiburg', 'AKTIV',
   'Panoramadach, Beats-Soundsystem', 8)
) as d (variant_slug, slug, year, km, price, soh, seller_name, seller_type, ort, status, note, posted_days)
join public.vehicle_variants v on v.slug = d.variant_slug
join public.vehicle_models m on m.id = v.model_id
join public.vehicle_brands b on b.id = m.brand_id;

-- The gate: every demo car found its catalog variant.
do $$
begin
  if (select count(*) from public.listings where is_demo) <> 28 then
    raise exception 'demo listings: a variant slug is missing from the catalog';
  end if;
end $$;

commit;
