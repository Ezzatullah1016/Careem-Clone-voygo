"use client";

import type { DriverProfile, LatLng, Ride, RideOffer, Vehicle } from "@/core/entities";
import type { DriverRepository, OfferRepository, Page, VehicleRepository } from "@/core/repositories";
import type { BrowserSupabase } from "@/infrastructure/supabase/client";
import { mapDriverProfile, mapOffer, mapRide, mapVehicle, toGeography } from "@/infrastructure/supabase/mappers";

const PAGE_SIZE = 20;

export class SupabaseDriverRepository implements DriverRepository {
  constructor(private readonly db: BrowserSupabase) {}

  async getById(id: string): Promise<DriverProfile | null> {
    const { data, error } = await this.db
      .from("driver_profiles")
      .select("*, profiles(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapDriverProfile(data) : null;
  }

  async apply(input: { licenseNumber: string; licenseExpiry: string; licenseDocumentUrl: string; idDocumentUrl: string }): Promise<DriverProfile> {
    const { data: auth } = await this.db.auth.getUser();
    if (!auth.user) throw new Error("Not authenticated");
    const { data, error } = await this.db
      .from("driver_profiles")
      .insert({
        id: auth.user.id,
        license_number: input.licenseNumber,
        license_expiry: input.licenseExpiry,
        license_document_url: input.licenseDocumentUrl,
        id_document_url: input.idDocumentUrl,
      })
      .select()
      .single();
    if (error) throw error;
    return mapDriverProfile(data);
  }

  async setOnline(driverId: string, online: boolean): Promise<void> {
    const { error } = await this.db
      .from("driver_profiles")
      .update({ is_online: online })
      .eq("id", driverId);
    if (error) throw error;
  }

  async updateLocation(driverId: string, location: LatLng): Promise<void> {
    const { error } = await this.db
      .from("driver_profiles")
      .update({
        current_location: toGeography(location),
        location_updated_at: new Date().toISOString(),
      })
      .eq("id", driverId);
    if (error) throw error;
  }

  async listByStatus(status: string, page = 0): Promise<Page<DriverProfile>> {
    const from = page * PAGE_SIZE;
    const { data, error, count } = await this.db
      .from("driver_profiles")
      .select("*, profiles(*)", { count: "exact" })
      .eq("status", status)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    return { items: (data ?? []).map(mapDriverProfile), total: count ?? 0 };
  }

  async review(driverId: string, decision: "approved" | "rejected", reason?: string): Promise<void> {
    const { data: auth } = await this.db.auth.getUser();
    const { error } = await this.db
      .from("driver_profiles")
      .update({
        status: decision,
        approved_at: decision === "approved" ? new Date().toISOString() : null,
        approved_by: auth.user?.id ?? null,
        rejection_reason: decision === "rejected" ? reason ?? null : null,
      })
      .eq("id", driverId);
    if (error) throw error;
  }
}

export class SupabaseVehicleRepository implements VehicleRepository {
  constructor(private readonly db: BrowserSupabase) {}

  async listByDriver(driverId: string): Promise<Vehicle[]> {
    const { data, error } = await this.db.from("vehicles").select("*").eq("driver_id", driverId);
    if (error) throw error;
    return (data ?? []).map(mapVehicle);
  }

  async register(input: Omit<Vehicle, "id" | "status" | "isActive">): Promise<Vehicle> {
    const { data, error } = await this.db
      .from("vehicles")
      .insert({
        driver_id: input.driverId,
        ride_type_id: input.rideTypeId,
        make: input.make,
        model: input.model,
        year: input.year,
        color: input.color,
        plate_number: input.plateNumber,
      })
      .select()
      .single();
    if (error) throw error;
    return mapVehicle(data);
  }

  async listPending(page = 0): Promise<Page<Vehicle>> {
    const from = page * PAGE_SIZE;
    const { data, error, count } = await this.db
      .from("vehicles")
      .select("*", { count: "exact" })
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    return { items: (data ?? []).map(mapVehicle), total: count ?? 0 };
  }

  async review(vehicleId: string, decision: "approved" | "rejected", reason?: string): Promise<void> {
    const { data: auth } = await this.db.auth.getUser();
    const { error } = await this.db
      .from("vehicles")
      .update({
        status: decision,
        is_active: decision === "approved",
        reviewed_by: auth.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
        rejection_reason: decision === "rejected" ? reason ?? null : null,
      })
      .eq("id", vehicleId);
    if (error) throw error;
  }
}

export class SupabaseOfferRepository implements OfferRepository {
  constructor(private readonly db: BrowserSupabase) {}

  async pendingForDriver(driverId: string): Promise<RideOffer[]> {
    const { data, error } = await this.db
      .from("ride_offers")
      .select("*, rides(*, ride_type:ride_types(*))")
      .eq("driver_id", driverId)
      .is("responded_at", null)
      .gt("expires_at", new Date().toISOString());
    if (error) throw error;
    return (data ?? []).map(mapOffer);
  }

  async accept(rideId: string, vehicleId: string): Promise<Ride> {
    // Atomic first-wins acceptance via SECURITY DEFINER function.
    const { data, error } = await this.db.rpc("accept_ride", {
      p_ride_id: rideId,
      p_vehicle_id: vehicleId,
    });
    if (error) throw error;
    return mapRide(data);
  }

  async reject(offerId: string): Promise<void> {
    const { error } = await this.db
      .from("ride_offers")
      .update({ responded_at: new Date().toISOString(), accepted: false })
      .eq("id", offerId);
    if (error) throw error;
  }

  onNewOffer(driverId: string, cb: (offer: RideOffer) => void): () => void {
    const channel = this.db
      .channel(`offers:${driverId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ride_offers", filter: `driver_id=eq.${driverId}` },
        async (payload) => {
          // Fetch joined ride details for the offer card.
          const { data } = await this.db
            .from("ride_offers")
            .select("*, rides(*, ride_type:ride_types(*))")
            .eq("id", payload.new.id)
            .single();
          if (data) cb(mapOffer(data));
        }
      )
      .subscribe();
    return () => void this.db.removeChannel(channel);
  }
}
