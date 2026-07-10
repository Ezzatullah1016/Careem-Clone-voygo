# Voygo — Premium Ride-Hailing Platform

Production-ready full-stack ride-hailing platform built from the Stitch "Seamless Velocity" design.
Passenger, Driver and Admin portals in one Next.js app, backed by Supabase.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript (strict), Tailwind CSS, shadcn-style UI, Framer Motion |
| Backend | Supabase (PostgreSQL + PostGIS, Row Level Security, Realtime, Edge Functions) |
| Auth | Supabase Auth — Phone OTP (Twilio), Google, Apple |
| Maps | Google Maps JS SDK (`@vis.gl/react-google-maps`), Routes API, Geocoding, Places |
| Payments | Stripe (PaymentIntents + webhooks), cash, in-app wallet |
| Notifications | In-app (Realtime), SMS (Twilio), Email (Resend) |

## Architecture

Clean architecture with the repository pattern:

```
src/
├── core/                     # Domain layer — zero framework imports
│   ├── entities/             # Ride, Profile, Wallet, PromoCode, …
│   ├── repositories/         # Ports (interfaces) the app programs against
│   └── services/             # Pure business logic (fare engine)
├── infrastructure/           # Adapters
│   ├── supabase/             # Browser / server / service-role clients + row mappers
│   ├── repositories/         # Supabase implementations of the ports
│   ├── stripe/               # Stripe server client
│   └── maps/                 # Google Routes/Geocoding gateway, polyline codec
├── app/                      # Next.js App Router
│   ├── (passenger)/          # home, book, ride/[id], wallet, history, profile, locations, support
│   ├── (driver)/driver/      # dashboard, earnings, history, wallet
│   ├── (admin)/admin/        # analytics, live-map, users, drivers, vehicles, pricing, coupons, payments, reports, support
│   ├── api/                  # fare-estimate, rides/dispatch, rides/complete, wallet/topup, webhooks/stripe, geocode
│   └── login, auth/callback  # Phone OTP + OAuth
├── components/               # ui/ (shadcn primitives), glass/ (design system), map/
├── hooks/                    # use-auth, use-live-ride, use-driver-presence
└── stores/                   # Zustand booking flow state
supabase/
├── migrations/               # 0001 schema, 0002 RLS, 0003 seed
└── functions/                # notify, expire-offers, dispatch-scheduled
```

Key design decisions:

- **RLS is the security boundary.** Every table has deny-by-default policies. Cross-row invariants
  (wallet balance ↔ ledger, first-driver-wins acceptance) run inside `SECURITY DEFINER` SQL functions
  (`apply_wallet_transaction`, `accept_ride`) so they hold even against direct API calls.
- **Money flows are server-side only.** Fare estimation, dispatch, settlement and Stripe live in API
  routes / edge functions using the service role; the browser never computes a price it can tamper with.
- **Realtime over polling.** Ride status, driver GPS breadcrumbs (`ride_locations`), incoming offers
  and notifications stream over Supabase Realtime channels.
- **Dispatch:** `find_nearby_drivers` (PostGIS `ST_DWithin` on a GIST index) → time-boxed `ride_offers`
  fan-out → atomic `accept_ride`. Cron edge functions expire dead offers and promote scheduled rides.

## Setup

### 1. Prerequisites

- Node 20+, [Supabase CLI](https://supabase.com/docs/guides/cli), a Stripe account,
  a Google Cloud project with **Maps JavaScript, Places, Geocoding, Routes** APIs enabled.

### 2. Configure environment

```bash
cp .env.example .env.local   # fill in every value
npm install
```

### 3. Database

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push             # applies 0001_schema, 0002_rls, 0003_seed
```

### 4. Auth providers (Supabase Dashboard → Authentication)

- **Phone**: enable, plug in Twilio SID / token / messaging service.
- **Google / Apple**: enable, set OAuth credentials; add
  `https://YOUR_DOMAIN/auth/callback` to the redirect allow-list.

### 5. Stripe

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe   # dev
```
In production create a webhook endpoint for `payment_intent.succeeded`,
`payment_intent.payment_failed`, `charge.refunded` and set `STRIPE_WEBHOOK_SECRET`.

### 6. Edge functions + cron

```bash
supabase functions deploy notify expire-offers dispatch-scheduled
```
Schedule the two cron functions (SQL editor):

```sql
select cron.schedule('expire-offers', '* * * * *',
  $$select net.http_post('https://YOUR_PROJECT.supabase.co/functions/v1/expire-offers',
    headers => jsonb_build_object('Authorization', 'Bearer ' || 'SERVICE_ROLE_KEY'))$$);
select cron.schedule('dispatch-scheduled', '* * * * *',
  $$select net.http_post('https://YOUR_PROJECT.supabase.co/functions/v1/dispatch-scheduled',
    headers => jsonb_build_object('Authorization', 'Bearer ' || 'SERVICE_ROLE_KEY'))$$);
```

### 7. Run

```bash
npm run dev        # http://localhost:3000
npm run typecheck  # strict TS
npm run lint
```

### 8. Deploy (Vercel)

Push to GitHub → import in Vercel → add every variable from `.env.example` →
deploy. `vercel.json` is included. Set `NEXT_PUBLIC_APP_URL` to the production URL
and update Supabase auth redirect URLs + Stripe webhook endpoint.

## Creating the first admin

```sql
update public.profiles set role = 'admin' where phone = '+1555…';
```

## Feature map

| Role | Features |
|---|---|
| Passenger | Book now / schedule, per-type fare estimates, promo codes, cash/card/wallet, live driver tracking (Realtime GPS), SOS, ratings, ride history, wallet top-up via Stripe, saved locations, support tickets |
| Driver | Go online/offline with GPS heartbeat, realtime ride offers with accept/decline race handling, Google Maps navigation hand-off, trip lifecycle (arriving → start → complete), earnings dashboard + 7-day chart, wallet ledger, trip history |
| Admin | KPI analytics + ride trend chart, live fleet map, user management (suspend/reinstate), driver verification queue, vehicle approval, versioned pricing rules, coupon CRUD, payment oversight, CSV reports, support desk |

## Testing the fare engine

`src/core/services/fare.service.ts` is pure — unit test with any runner:

```ts
import { calculateFare } from "@/core/services/fare.service";
expect(calculateFare(rule, 5000, 600).total).toBeGreaterThanOrEqual(rule.minimumFare);
```
