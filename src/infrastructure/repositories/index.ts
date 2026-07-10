"use client";

/**
 * Composition root for the client-side repository layer.
 * `repos()` returns a memoised bundle of every repository wired to the
 * shared browser Supabase client — the only place implementations are chosen.
 */

import { createClient } from "@/infrastructure/supabase/client";
import { SupabaseRideRepository } from "./ride.repository";
import {
  SupabaseDriverRepository,
  SupabaseOfferRepository,
  SupabaseVehicleRepository,
} from "./driver.repository";
import {
  SupabaseNotificationRepository,
  SupabasePaymentRepository,
  SupabasePricingRepository,
  SupabaseProfileRepository,
  SupabasePromoRepository,
  SupabaseRatingRepository,
  SupabaseSavedLocationRepository,
  SupabaseSupportRepository,
  SupabaseWalletRepository,
} from "./misc.repositories";

function build() {
  const db = createClient();
  return {
    db,
    rides: new SupabaseRideRepository(db),
    drivers: new SupabaseDriverRepository(db),
    vehicles: new SupabaseVehicleRepository(db),
    offers: new SupabaseOfferRepository(db),
    profiles: new SupabaseProfileRepository(db),
    pricing: new SupabasePricingRepository(db),
    wallets: new SupabaseWalletRepository(db),
    payments: new SupabasePaymentRepository(db),
    promos: new SupabasePromoRepository(db),
    savedLocations: new SupabaseSavedLocationRepository(db),
    ratings: new SupabaseRatingRepository(db),
    notifications: new SupabaseNotificationRepository(db),
    support: new SupabaseSupportRepository(db),
  };
}

let cached: ReturnType<typeof build> | null = null;

export function repos() {
  cached ??= build();
  return cached;
}

export type Repos = ReturnType<typeof repos>;
