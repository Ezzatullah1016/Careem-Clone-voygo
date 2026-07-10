-- ═══════════════════════════════════════════════════════════════════════════
-- Voygo — core schema
-- Extensions, enums, tables, indexes, triggers, helper functions.
-- RLS policies live in 0002_rls.sql.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ─── Enums ───────────────────────────────────────────────────────────────────

create type public.user_role as enum ('passenger', 'driver', 'admin');

create type public.driver_status as enum ('pending', 'documents_requested', 'approved', 'rejected', 'suspended');

create type public.vehicle_status as enum ('pending', 'approved', 'rejected');

create type public.ride_status as enum (
  'requested',      -- passenger submitted, matching in progress
  'scheduled',      -- future ride, not yet dispatched
  'accepted',       -- driver assigned
  'arriving',       -- driver en route to pickup
  'in_progress',    -- passenger on board
  'completed',
  'cancelled_by_passenger',
  'cancelled_by_driver',
  'no_drivers_found'
);

create type public.payment_method as enum ('card', 'cash', 'wallet');

create type public.payment_status as enum ('pending', 'authorized', 'captured', 'refunded', 'failed');

create type public.wallet_tx_type as enum ('topup', 'ride_payment', 'ride_earning', 'refund', 'payout', 'promo_credit', 'adjustment');

create type public.ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');

-- ─── Profiles ────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'passenger',
  full_name text,
  phone text unique,
  email text,
  avatar_url text,
  rating numeric(3, 2) not null default 5.00 check (rating between 0 and 5),
  rating_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.driver_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  status public.driver_status not null default 'pending',
  license_number text,
  license_expiry date,
  license_document_url text,
  id_document_url text,
  is_online boolean not null default false,
  current_location geography (point, 4326),
  location_updated_at timestamptz,
  acceptance_rate numeric(5, 2) not null default 100,
  total_trips integer not null default 0,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index driver_profiles_location_idx on public.driver_profiles using gist (current_location);
create index driver_profiles_online_idx on public.driver_profiles (is_online) where is_online = true;

create table public.vehicles (
  id uuid primary key default gen_random_uuid (),
  driver_id uuid not null references public.driver_profiles (id) on delete cascade,
  status public.vehicle_status not null default 'pending',
  ride_type_id uuid, -- fk added after ride_types
  make text not null,
  model text not null,
  year integer not null check (year >= 2000),
  color text not null,
  plate_number text not null unique,
  registration_document_url text,
  insurance_document_url text,
  insurance_expiry date,
  is_active boolean not null default false,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Pricing ────────────────────────────────────────────────────────────────

create table public.ride_types (
  id uuid primary key default gen_random_uuid (),
  code text not null unique,           -- 'basic' | 'premium' | 'xl'
  display_name text not null,          -- 'Voygo Basic'
  description text,
  icon text not null default 'directions_car',
  seats integer not null default 4,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.vehicles
  add constraint vehicles_ride_type_fkey foreign key (ride_type_id) references public.ride_types (id);

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid (),
  ride_type_id uuid not null references public.ride_types (id) on delete cascade,
  currency text not null default 'USD',
  base_fare numeric(10, 2) not null,
  per_km numeric(10, 2) not null,
  per_minute numeric(10, 2) not null,
  minimum_fare numeric(10, 2) not null,
  booking_fee numeric(10, 2) not null default 0,
  cancellation_fee numeric(10, 2) not null default 0,
  surge_multiplier numeric(4, 2) not null default 1.00 check (surge_multiplier between 1 and 5),
  commission_pct numeric(5, 2) not null default 20.00, -- platform cut on earnings
  effective_from timestamptz not null default now(),
  is_active boolean not null default true,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index pricing_rules_active_idx on public.pricing_rules (ride_type_id, is_active, effective_from desc);

-- ─── Locations ──────────────────────────────────────────────────────────────

create table public.saved_locations (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,                 -- 'Home', 'Work', 'Gym'
  icon text not null default 'place',
  address text not null,
  location geography (point, 4326) not null,
  created_at timestamptz not null default now(),
  unique (user_id, label)
);

-- ─── Promo codes ────────────────────────────────────────────────────────────

create table public.promo_codes (
  id uuid primary key default gen_random_uuid (),
  code text not null unique,
  description text,
  discount_pct numeric(5, 2) check (discount_pct between 0 and 100),
  discount_amount numeric(10, 2) check (discount_amount >= 0),
  max_discount numeric(10, 2),
  min_fare numeric(10, 2) not null default 0,
  usage_limit integer,                 -- total redemptions allowed, null = unlimited
  per_user_limit integer not null default 1,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (discount_pct is not null or discount_amount is not null)
);

create table public.promo_redemptions (
  id uuid primary key default gen_random_uuid (),
  promo_id uuid not null references public.promo_codes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  ride_id uuid,                        -- fk added after rides
  discount_applied numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

-- ─── Rides ──────────────────────────────────────────────────────────────────

create table public.rides (
  id uuid primary key default gen_random_uuid (),
  passenger_id uuid not null references public.profiles (id),
  driver_id uuid references public.driver_profiles (id),
  vehicle_id uuid references public.vehicles (id),
  ride_type_id uuid not null references public.ride_types (id),
  status public.ride_status not null default 'requested',
  pickup_address text not null,
  pickup_location geography (point, 4326) not null,
  dropoff_address text not null,
  dropoff_location geography (point, 4326) not null,
  scheduled_at timestamptz,            -- null = ride now
  distance_m integer,
  duration_s integer,
  route_polyline text,                 -- encoded polyline from Directions API
  estimated_fare numeric(10, 2),
  final_fare numeric(10, 2),
  surge_multiplier numeric(4, 2) not null default 1.00,
  currency text not null default 'USD',
  payment_method public.payment_method not null default 'card',
  promo_id uuid references public.promo_codes (id),
  discount_amount numeric(10, 2) not null default 0,
  driver_earnings numeric(10, 2),
  platform_fee numeric(10, 2),
  cancellation_reason text,
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.promo_redemptions
  add constraint promo_redemptions_ride_fkey foreign key (ride_id) references public.rides (id);

create index rides_passenger_idx on public.rides (passenger_id, created_at desc);
create index rides_driver_idx on public.rides (driver_id, created_at desc);
create index rides_status_idx on public.rides (status) where status in ('requested', 'scheduled', 'accepted', 'arriving', 'in_progress');
create index rides_pickup_idx on public.rides using gist (pickup_location);

-- Immutable status timeline for audit + passenger-facing progress.
create table public.ride_events (
  id bigint generated always as identity primary key,
  ride_id uuid not null references public.rides (id) on delete cascade,
  status public.ride_status not null,
  actor_id uuid references public.profiles (id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index ride_events_ride_idx on public.ride_events (ride_id, created_at);

-- Dispatch offers: which drivers were offered a ride, and their response.
create table public.ride_offers (
  id uuid primary key default gen_random_uuid (),
  ride_id uuid not null references public.rides (id) on delete cascade,
  driver_id uuid not null references public.driver_profiles (id) on delete cascade,
  expires_at timestamptz not null,
  responded_at timestamptz,
  accepted boolean,
  created_at timestamptz not null default now(),
  unique (ride_id, driver_id)
);

create index ride_offers_driver_idx on public.ride_offers (driver_id, created_at desc);

-- High-frequency driver breadcrumbs during active rides (realtime channel source).
create table public.ride_locations (
  id bigint generated always as identity primary key,
  ride_id uuid not null references public.rides (id) on delete cascade,
  driver_id uuid not null references public.driver_profiles (id),
  location geography (point, 4326) not null,
  heading numeric(5, 2),
  speed_mps numeric(6, 2),
  recorded_at timestamptz not null default now()
);

create index ride_locations_ride_idx on public.ride_locations (ride_id, recorded_at desc);

-- ─── Ratings ────────────────────────────────────────────────────────────────

create table public.ratings (
  id uuid primary key default gen_random_uuid (),
  ride_id uuid not null references public.rides (id) on delete cascade,
  rater_id uuid not null references public.profiles (id),
  ratee_id uuid not null references public.profiles (id),
  stars integer not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (ride_id, rater_id)
);

-- ─── Wallet & payments ──────────────────────────────────────────────────────

create table public.wallets (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  balance numeric(12, 2) not null default 0 check (balance >= 0),
  currency text not null default 'USD',
  updated_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid (),
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  type public.wallet_tx_type not null,
  amount numeric(12, 2) not null,      -- signed: negative = debit
  balance_after numeric(12, 2) not null,
  ride_id uuid references public.rides (id),
  stripe_payment_intent_id text,
  description text,
  created_at timestamptz not null default now()
);

create index wallet_tx_wallet_idx on public.wallet_transactions (wallet_id, created_at desc);

create table public.payments (
  id uuid primary key default gen_random_uuid (),
  ride_id uuid not null references public.rides (id),
  user_id uuid not null references public.profiles (id),
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  amount numeric(10, 2) not null,
  currency text not null default 'USD',
  stripe_payment_intent_id text unique,
  stripe_customer_id text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_user_idx on public.payments (user_id, created_at desc);

-- ─── Notifications ──────────────────────────────────────────────────────────

create table public.notifications (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  type text not null default 'general', -- ride_update | payment | promo | system
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ─── Support ────────────────────────────────────────────────────────────────

create table public.support_tickets (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  ride_id uuid references public.rides (id),
  subject text not null,
  status public.ticket_status not null default 'open',
  assigned_to uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid (),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Functions & triggers
-- ═══════════════════════════════════════════════════════════════════════════

-- Auto-provision profile + wallet on signup.
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone, email, full_name, avatar_url)
  values (
    new.id,
    new.phone,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.wallets (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user ();

-- Keep updated_at fresh.
create or replace function public.touch_updated_at ()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_profiles before update on public.profiles for each row execute function public.touch_updated_at ();
create trigger touch_driver_profiles before update on public.driver_profiles for each row execute function public.touch_updated_at ();
create trigger touch_vehicles before update on public.vehicles for each row execute function public.touch_updated_at ();
create trigger touch_rides before update on public.rides for each row execute function public.touch_updated_at ();
create trigger touch_payments before update on public.payments for each row execute function public.touch_updated_at ();
create trigger touch_tickets before update on public.support_tickets for each row execute function public.touch_updated_at ();

-- Append to ride_events on every status change.
create or replace function public.log_ride_event ()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.ride_events (ride_id, status, actor_id)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger rides_log_event after insert or update on public.rides
  for each row execute function public.log_ride_event ();

-- Recompute aggregate rating on the ratee's profile.
create or replace function public.apply_rating ()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles p
  set rating = sub.avg_stars, rating_count = sub.cnt
  from (
    select avg(stars)::numeric(3,2) as avg_stars, count(*) as cnt
    from public.ratings where ratee_id = new.ratee_id
  ) sub
  where p.id = new.ratee_id;
  return new;
end;
$$;

create trigger ratings_apply after insert on public.ratings
  for each row execute function public.apply_rating ();

-- Role helpers used by RLS. SECURITY DEFINER so policies avoid recursive lookups.
create or replace function public.current_role ()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin ()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() = 'admin';
$$;

-- Atomic wallet movement. Single entry point for all balance changes so the
-- balance and its ledger can never diverge. Locks the wallet row.
create or replace function public.apply_wallet_transaction (
  p_user_id uuid,
  p_type public.wallet_tx_type,
  p_amount numeric,
  p_ride_id uuid default null,
  p_stripe_pi text default null,
  p_description text default null
)
returns public.wallet_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_wallet public.wallets;
  v_tx public.wallet_transactions;
begin
  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if not found then
    raise exception 'wallet not found for user %', p_user_id;
  end if;
  if v_wallet.balance + p_amount < 0 then
    raise exception 'insufficient wallet balance';
  end if;

  update public.wallets
  set balance = balance + p_amount, updated_at = now()
  where id = v_wallet.id;

  insert into public.wallet_transactions (wallet_id, type, amount, balance_after, ride_id, stripe_payment_intent_id, description)
  values (v_wallet.id, p_type, p_amount, v_wallet.balance + p_amount, p_ride_id, p_stripe_pi, p_description)
  returning * into v_tx;

  return v_tx;
end;
$$;

-- Nearest online, approved drivers for a ride type within radius (dispatch).
create or replace function public.find_nearby_drivers (
  p_pickup geography,
  p_ride_type_id uuid,
  p_radius_m integer default 5000,
  p_limit integer default 10
)
returns table (driver_id uuid, distance_m double precision)
language sql stable security definer set search_path = public as $$
  select dp.id, st_distance(dp.current_location, p_pickup)
  from public.driver_profiles dp
  join public.vehicles v on v.driver_id = dp.id and v.is_active and v.status = 'approved'
  where dp.is_online
    and dp.status = 'approved'
    and dp.current_location is not null
    and dp.location_updated_at > now() - interval '2 minutes'
    and st_dwithin(dp.current_location, p_pickup, p_radius_m)
    and (p_ride_type_id is null or v.ride_type_id = p_ride_type_id)
    and not exists (
      select 1 from public.rides r
      where r.driver_id = dp.id
        and r.status in ('accepted', 'arriving', 'in_progress')
    )
  order by 2
  limit p_limit;
$$;

-- Atomic ride acceptance: first driver wins, others get 'already taken'.
create or replace function public.accept_ride (p_ride_id uuid, p_vehicle_id uuid)
returns public.rides
language plpgsql security definer set search_path = public as $$
declare
  v_ride public.rides;
begin
  select * into v_ride from public.rides where id = p_ride_id for update;
  if not found then
    raise exception 'ride not found';
  end if;
  if v_ride.status <> 'requested' and v_ride.status <> 'scheduled' then
    raise exception 'ride already taken';
  end if;

  update public.rides
  set driver_id = auth.uid(), vehicle_id = p_vehicle_id,
      status = 'accepted', accepted_at = now()
  where id = p_ride_id
  returning * into v_ride;

  update public.ride_offers
  set responded_at = now(), accepted = true
  where ride_id = p_ride_id and driver_id = auth.uid();

  return v_ride;
end;
$$;

-- ─── Realtime ───────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.rides;
alter publication supabase_realtime add table public.ride_locations;
alter publication supabase_realtime add table public.ride_offers;
alter publication supabase_realtime add table public.notifications;
