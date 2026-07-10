import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/infrastructure/supabase/server";
import { createAdminClient } from "@/infrastructure/supabase/admin";

const BodySchema = z.object({ rideId: z.string().uuid() });

const OFFER_TTL_S = 30;
const SEARCH_RADIUS_M = 5000;
const MAX_OFFERS = 5;

/**
 * POST /api/rides/dispatch
 * Called after a passenger creates a ride. Finds nearby eligible drivers
 * and fans out time-boxed offers. Uses the service role because offers
 * target other users' rows; authorization = caller owns the ride.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: ride, error: rideErr } = await admin
    .from("rides")
    .select("id, passenger_id, status, ride_type_id, pickup_location")
    .eq("id", parsed.data.rideId)
    .single();

  if (rideErr || !ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }
  if (ride.passenger_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ride.status !== "requested") {
    return NextResponse.json({ error: "Ride is not dispatchable" }, { status: 409 });
  }

  const { data: drivers, error: findErr } = await admin.rpc("find_nearby_drivers", {
    p_pickup: ride.pickup_location,
    p_ride_type_id: ride.ride_type_id,
    p_radius_m: SEARCH_RADIUS_M,
    p_limit: MAX_OFFERS,
  });

  if (findErr) {
    console.error("find_nearby_drivers failed", findErr);
    return NextResponse.json({ error: "Dispatch failed" }, { status: 500 });
  }

  if (!drivers?.length) {
    await admin.from("rides").update({ status: "no_drivers_found" }).eq("id", ride.id);
    return NextResponse.json({ offered: 0, status: "no_drivers_found" });
  }

  const expiresAt = new Date(Date.now() + OFFER_TTL_S * 1000).toISOString();
  const { error: offerErr } = await admin.from("ride_offers").insert(
    drivers.map((d: { driver_id: string }) => ({
      ride_id: ride.id,
      driver_id: d.driver_id,
      expires_at: expiresAt,
    }))
  );
  if (offerErr) {
    console.error("offer insert failed", offerErr);
    return NextResponse.json({ error: "Dispatch failed" }, { status: 500 });
  }

  // In-app notification fan-out (push/SMS handled by the notify edge function).
  await admin.from("notifications").insert(
    drivers.map((d: { driver_id: string }) => ({
      user_id: d.driver_id,
      title: "New ride request",
      body: "A ride is available near you. Open Voygo to accept.",
      type: "ride_update",
      data: { ride_id: ride.id },
    }))
  );

  return NextResponse.json({ offered: drivers.length, expiresAt });
}
