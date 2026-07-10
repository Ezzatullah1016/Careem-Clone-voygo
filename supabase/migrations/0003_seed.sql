-- Seed: ride types + baseline pricing. Idempotent.

insert into public.ride_types (code, display_name, description, icon, seats, sort_order)
values
  ('basic',   'Voygo Basic',   'Affordable everyday rides', 'directions_car', 4, 1),
  ('premium', 'Voygo Premium', 'Luxury vehicles, top-rated drivers', 'directions_car', 4, 2),
  ('xl',      'Voygo XL',      'Vans and SUVs for groups', 'airport_shuttle', 6, 3)
on conflict (code) do nothing;

insert into public.pricing_rules (ride_type_id, base_fare, per_km, per_minute, minimum_fare, booking_fee, cancellation_fee, commission_pct)
select rt.id, p.base_fare, p.per_km, p.per_minute, p.minimum_fare, p.booking_fee, p.cancellation_fee, p.commission_pct
from (
  values
    ('basic',   2.50, 1.10, 0.25,  6.00, 1.00, 3.00, 20.00),
    ('premium', 5.00, 1.80, 0.40, 10.00, 1.50, 5.00, 22.50),
    ('xl',      6.50, 2.20, 0.45, 14.00, 1.50, 5.00, 22.50)
) as p (code, base_fare, per_km, per_minute, minimum_fare, booking_fee, cancellation_fee, commission_pct)
join public.ride_types rt on rt.code = p.code
where not exists (
  select 1 from public.pricing_rules pr where pr.ride_type_id = rt.id and pr.is_active
);
