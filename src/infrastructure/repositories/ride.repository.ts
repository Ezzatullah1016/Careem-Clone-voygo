"use client";

import type { LatLng, Ride, RideStatus } from "@/core/entities";
import type { Page, RideRepository } from "@/core/repositories";
import type { BrowserSupabase } from "@/infrastructure/supabase/client";
import { mapRide, parseGeo, toGeography } from "@/infrastructure/supabase/mappers";

const RIDE_SELECT = `
  *,
  ride_type:ride_types(*),
  driver:driver_profiles(*, profiles(*)),
  vehicle:vehicles(*)
`;

const PAGE_SIZE = 20;

export class SupabaseRideRepository implements RideRepository {
  constructor(private readonly db: BrowserSupabase) {}

  async getById(id: string): Promise<Ride | null> {
    const { data, error } = await this.db
      .from("rides")
      .select(RIDE_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRide(data) : null;
  }

  async create(input: Parameters<RideRepository["create"]>[0]): Promise<Ride> {
    const { data: auth } = await this.db.auth.getUser();
    if (!auth.user) throw new Error("Not authenticated");

    const { data, error } = await this.db
      .from("rides")
      .insert({
        passenger_id: auth.user.id,
        ride_type_id: input.rideTypeId,
        status: input.scheduledAt ? "scheduled" : "requested",
        pickup_address: input.pickupAddress,
        pickup_location: toGeography(input.pickupLocation),
        dropoff_address: input.dropoffAddress,
        dropoff_location: toGeography(input.dropoffLocation),
        payment_method: input.paymentMethod,
        estimated_fare: input.estimatedFare,
        distance_m: input.distanceM,
        duration_s: input.durationS,
        route_polyline: input.routePolyline ?? null,
        promo_id: input.promoId ?? null,
        scheduled_at: input.scheduledAt ?? null,
      })
      .select(RIDE_SELECT)
      .single();
    if (error) throw error;
    return mapRide(data);
  }

  async updateStatus(id: string, status: RideStatus, extra: Record<string, unknown> = {}): Promise<Ride> {
    const timestamps: Record<RideStatus, Record<string, string>> = {
      arriving: {},
      in_progress: { started_at: new Date().toISOString() },
      completed: { completed_at: new Date().toISOString() },
      cancelled_by_passenger: { cancelled_at: new Date().toISOString() },
      cancelled_by_driver: { cancelled_at: new Date().toISOString() },
      requested: {},
      scheduled: {},
      accepted: {},
      no_drivers_found: {},
    };
    const { data, error } = await this.db
      .from("rides")
      .update({ status, ...timestamps[status], ...extra })
      .eq("id", id)
      .select(RIDE_SELECT)
      .single();
    if (error) throw error;
    return mapRide(data);
  }

  private async history(column: "passenger_id" | "driver_id", userId: string, page = 0): Promise<Page<Ride>> {
    const from = page * PAGE_SIZE;
    const { data, error, count } = await this.db
      .from("rides")
      .select(RIDE_SELECT, { count: "exact" })
      .eq(column, userId)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    return { items: (data ?? []).map(mapRide), total: count ?? 0 };
  }

  historyForPassenger(passengerId: string, page = 0) {
    return this.history("passenger_id", passengerId, page);
  }

  historyForDriver(driverId: string, page = 0) {
    return this.history("driver_id", driverId, page);
  }

  async activeForUser(userId: string): Promise<Ride | null> {
    const { data, error } = await this.db
      .from("rides")
      .select(RIDE_SELECT)
      .or(`passenger_id.eq.${userId},driver_id.eq.${userId}`)
      .in("status", ["requested", "accepted", "arriving", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRide(data) : null;
  }

  onRideChange(rideId: string, cb: (ride: Ride) => void): () => void {
    const channel = this.db
      .channel(`ride:${rideId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rides", filter: `id=eq.${rideId}` },
        async () => {
          // Re-fetch with joins; the realtime payload lacks related rows.
          const ride = await this.getById(rideId);
          if (ride) cb(ride);
        }
      )
      .subscribe();
    return () => void this.db.removeChannel(channel);
  }

  onDriverLocation(rideId: string, cb: (loc: LatLng & { heading?: number }) => void): () => void {
    const channel = this.db
      .channel(`ride-loc:${rideId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ride_locations", filter: `ride_id=eq.${rideId}` },
        (payload) => {
          const loc = parseGeo(payload.new.location);
          if (loc) cb({ ...loc, heading: payload.new.heading ?? undefined });
        }
      )
      .subscribe();
    return () => void this.db.removeChannel(channel);
  }

  async pushDriverLocation(rideId: string, driverId: string, loc: LatLng, heading?: number, speedMps?: number): Promise<void> {
    const { error } = await this.db.from("ride_locations").insert({
      ride_id: rideId,
      driver_id: driverId,
      location: toGeography(loc),
      heading: heading ?? null,
      speed_mps: speedMps ?? null,
    });
    if (error) throw error;
  }
}
