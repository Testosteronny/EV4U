-- Semantics change: ice_tax = regular tariff for a car of the SAME WEIGHT
-- as the EV (not a lighter petrol equivalent). The saving therefore shows
-- the EV privilege only and is never negative just because EVs are heavier.
-- AR (weight-based, no EV bonus): a same-weight car pays the same → net 0.
-- Reference point: VW ID.3 regular weight tariff ≈ CHF 684 (comparis).
update public.canton_taxes
set ice_tax = 684,
    ev_tax = 684,
    note = 'Gewichtsbasiert, kein E-Bonus — gleich schweres Auto zahlt gleich viel'
where canton = 'AR';
