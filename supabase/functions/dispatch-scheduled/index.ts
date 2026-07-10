// Supabase Edge Function: dispatch-scheduled
// Scheduled (cron, every minute): promotes due scheduled rides to 'requested'
// and fans out offers to nearby drivers — the same logic as /api/rides/dispatch.

import { createClient } from "npm:@supabase/supabase-js@2";

const OFFER_TTL_S = 30;
const SEARCH_RADIUS_M = 7000;
const MAX_OFFERS = 5;
const LEAD_TIME_MS = 10 * 60_000; // dispatch 10 min before pickup

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: due, error } = await admin
    .from("rides")
    .select("id, ride_type_id, pickup_location, passenger_id")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date(Date.now() + LEAD_TIME_MS).toISOString());

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let dispatched = 0;
  for (const ride of due ?? []) {
    await admin.from("rides").update({ status: "requested" }).eq("id", ride.id);

    const { data: drivers } = await admin.rpc("find_nearby_drivers", {
      p_pickup: ride.pickup_location,
      p_ride_type_id: ride.ride_type_id,
      p_radius_m: SEARCH_RADIUS_M,
      p_limit: MAX_OFFERS,
    });

    if (drivers?.length) {
      const expiresAt = new Date(Date.now() + OFFER_TTL_S * 1000).toISOString();
      await admin.from("ride_offers").insert(
        drivers.map((d: { driver_id: string }) => ({
          ride_id: ride.id,
          driver_id: d.driver_id,
          expires_at: expiresAt,
        }))
      );
      dispatched++;
    }

    await admin.from("notifications").insert({
      user_id: ride.passenger_id,
      title: "Scheduled ride starting",
      body: "We're finding a driver for your scheduled ride.",
      type: "ride_update",
      data: { ride_id: ride.id },
    });
  }

  return new Response(JSON.stringify({ promoted: due?.length ?? 0, dispatched }), {
    headers: { "Content-Type": "application/json" },
  });
});
