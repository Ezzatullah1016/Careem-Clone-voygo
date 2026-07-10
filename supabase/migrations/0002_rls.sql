-- ═══════════════════════════════════════════════════════════════════════════
-- Voygo — Row Level Security
-- Deny-by-default: RLS enabled on every table; access granted per role.
-- Writes that need cross-row invariants (wallets, dispatch) go through
-- SECURITY DEFINER functions or service-role edge functions, not direct DML.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.ride_types enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.saved_locations enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.rides enable row level security;
alter table public.ride_events enable row level security;
alter table public.ride_offers enable row level security;
alter table public.ride_locations enable row level security;
alter table public.ratings enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;

-- ─── profiles ────────────────────────────────────────────────────────────────

create policy "own profile read" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

-- Counterparty visibility: passenger and driver on a shared ride can see each other.
create policy "ride counterparty read" on public.profiles
  for select using (
    exists (
      select 1 from public.rides r
      where (r.passenger_id = auth.uid() and r.driver_id = profiles.id)
         or (r.driver_id = auth.uid() and r.passenger_id = profiles.id)
    )
  );

create policy "own profile update" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));
  -- role is immutable from the client; only admins (below) or service role change it.

create policy "admin profile update" on public.profiles
  for update using (public.is_admin());

-- ─── driver_profiles ────────────────────────────────────────────────────────

create policy "driver own read" on public.driver_profiles
  for select using (id = auth.uid() or public.is_admin());

-- Passengers can read their assigned driver's live row (location, status).
create policy "passenger reads assigned driver" on public.driver_profiles
  for select using (
    exists (
      select 1 from public.rides r
      where r.driver_id = driver_profiles.id
        and r.passenger_id = auth.uid()
        and r.status in ('accepted', 'arriving', 'in_progress')
    )
  );

create policy "driver self insert" on public.driver_profiles
  for insert with check (id = auth.uid());

-- Drivers may toggle availability + location, but not their verification status.
create policy "driver self update" on public.driver_profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and status = (select dp.status from public.driver_profiles dp where dp.id = auth.uid())
  );

create policy "admin driver update" on public.driver_profiles
  for update using (public.is_admin());

-- ─── vehicles ───────────────────────────────────────────────────────────────

create policy "vehicle owner read" on public.vehicles
  for select using (driver_id = auth.uid() or public.is_admin());

create policy "passenger reads ride vehicle" on public.vehicles
  for select using (
    exists (
      select 1 from public.rides r
      where r.vehicle_id = vehicles.id and r.passenger_id = auth.uid()
    )
  );

create policy "vehicle owner insert" on public.vehicles
  for insert with check (driver_id = auth.uid());

create policy "vehicle owner update" on public.vehicles
  for update using (driver_id = auth.uid())
  with check (
    driver_id = auth.uid()
    and status = (select v.status from public.vehicles v where v.id = vehicles.id)
  );

create policy "admin vehicle update" on public.vehicles
  for update using (public.is_admin());

-- ─── ride_types & pricing (public read, admin write) ───────────────────────

create policy "ride types public read" on public.ride_types
  for select using (true);

create policy "admin ride types write" on public.ride_types
  for all using (public.is_admin());

create policy "pricing public read" on public.pricing_rules
  for select using (is_active or public.is_admin());

create policy "admin pricing write" on public.pricing_rules
  for all using (public.is_admin());

-- ─── saved_locations ────────────────────────────────────────────────────────

create policy "saved locations owner" on public.saved_locations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── promo codes ────────────────────────────────────────────────────────────

-- Users can look up active codes (needed to validate at checkout); admins see all.
create policy "promo active read" on public.promo_codes
  for select using (
    (is_active and valid_from <= now() and (valid_until is null or valid_until > now()))
    or public.is_admin()
  );

create policy "admin promo write" on public.promo_codes
  for all using (public.is_admin());

create policy "own redemptions read" on public.promo_redemptions
  for select using (user_id = auth.uid() or public.is_admin());
-- Redemptions are inserted server-side (service role) during fare settlement.

-- ─── rides ──────────────────────────────────────────────────────────────────

create policy "ride party read" on public.rides
  for select using (
    passenger_id = auth.uid() or driver_id = auth.uid() or public.is_admin()
  );

-- Drivers may read open requests they have an active offer for.
create policy "offered driver reads ride" on public.rides
  for select using (
    exists (
      select 1 from public.ride_offers o
      where o.ride_id = rides.id and o.driver_id = auth.uid() and o.expires_at > now()
    )
  );

create policy "passenger creates ride" on public.rides
  for insert with check (
    passenger_id = auth.uid() and status in ('requested', 'scheduled') and driver_id is null
  );

-- Passenger may cancel own pre-pickup ride.
create policy "passenger cancels ride" on public.rides
  for update using (passenger_id = auth.uid())
  with check (
    passenger_id = auth.uid()
    and status in ('cancelled_by_passenger')
  );

-- Assigned driver advances the ride lifecycle.
create policy "driver updates own ride" on public.rides
  for update using (driver_id = auth.uid())
  with check (
    driver_id = auth.uid()
    and status in ('arriving', 'in_progress', 'completed', 'cancelled_by_driver')
  );

create policy "admin rides all" on public.rides
  for all using (public.is_admin());

-- ─── ride_events ────────────────────────────────────────────────────────────

create policy "ride events party read" on public.ride_events
  for select using (
    exists (
      select 1 from public.rides r
      where r.id = ride_events.ride_id
        and (r.passenger_id = auth.uid() or r.driver_id = auth.uid())
    ) or public.is_admin()
  );
-- Inserted only by trigger (security definer).

-- ─── ride_offers ────────────────────────────────────────────────────────────

create policy "driver reads own offers" on public.ride_offers
  for select using (driver_id = auth.uid() or public.is_admin());

create policy "driver responds to offer" on public.ride_offers
  for update using (driver_id = auth.uid())
  with check (driver_id = auth.uid());
-- Offers created by dispatch edge function (service role).

-- ─── ride_locations ─────────────────────────────────────────────────────────

create policy "ride party reads locations" on public.ride_locations
  for select using (
    exists (
      select 1 from public.rides r
      where r.id = ride_locations.ride_id
        and (r.passenger_id = auth.uid() or r.driver_id = auth.uid())
    ) or public.is_admin()
  );

create policy "assigned driver writes locations" on public.ride_locations
  for insert with check (
    driver_id = auth.uid()
    and exists (
      select 1 from public.rides r
      where r.id = ride_locations.ride_id
        and r.driver_id = auth.uid()
        and r.status in ('accepted', 'arriving', 'in_progress')
    )
  );

-- ─── ratings ────────────────────────────────────────────────────────────────

create policy "ratings visible to parties" on public.ratings
  for select using (rater_id = auth.uid() or ratee_id = auth.uid() or public.is_admin());

create policy "rate completed ride" on public.ratings
  for insert with check (
    rater_id = auth.uid()
    and exists (
      select 1 from public.rides r
      where r.id = ratings.ride_id
        and r.status = 'completed'
        and (
          (r.passenger_id = auth.uid() and r.driver_id = ratings.ratee_id)
          or (r.driver_id = auth.uid() and r.passenger_id = ratings.ratee_id)
        )
    )
  );

-- ─── wallets & payments ─────────────────────────────────────────────────────

create policy "own wallet read" on public.wallets
  for select using (user_id = auth.uid() or public.is_admin());

create policy "own wallet tx read" on public.wallet_transactions
  for select using (
    exists (select 1 from public.wallets w where w.id = wallet_transactions.wallet_id and w.user_id = auth.uid())
    or public.is_admin()
  );
-- Balance changes only via apply_wallet_transaction() / service role.

create policy "own payments read" on public.payments
  for select using (user_id = auth.uid() or public.is_admin());
-- Payments written server-side (Stripe webhook / edge functions).

-- ─── notifications ──────────────────────────────────────────────────────────

create policy "own notifications" on public.notifications
  for select using (user_id = auth.uid());

create policy "mark notification read" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own push subscriptions" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── support ────────────────────────────────────────────────────────────────

create policy "own tickets" on public.support_tickets
  for select using (user_id = auth.uid() or public.is_admin());

create policy "create ticket" on public.support_tickets
  for insert with check (user_id = auth.uid());

create policy "admin ticket update" on public.support_tickets
  for update using (public.is_admin());

create policy "ticket messages read" on public.ticket_messages
  for select using (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_messages.ticket_id
        and (t.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "ticket messages write" on public.ticket_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_messages.ticket_id
        and (t.user_id = auth.uid() or public.is_admin())
    )
  );
