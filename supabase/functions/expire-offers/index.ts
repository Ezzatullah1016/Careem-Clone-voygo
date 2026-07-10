// Supabase Edge Function: expire-offers
// Scheduled (cron, every minute): marks rides with only expired, unanswered
// offers as no_drivers_found, and expires stale scheduled dispatches.
//
// Schedule via supabase/config.toml or the dashboard:
//   select cron.schedule('expire-offers', '* * * * *', ...)

import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Rides still 'requested' whose every offer has expired without acceptance.
  const { data: staleRides, error } = await admin
    .from("rides")
    .select("id, ride_offers(expires_at, accepted)")
    .eq("status", "requested")
    .lt("requested_at", new Date(Date.now() - 60_000).toISOString());

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const now = Date.now();
  const toExpire = (staleRides ?? [])
    .filter((ride: { ride_offers: { expires_at: string; accepted: boolean | null }[] }) => {
      const offers = ride.ride_offers ?? [];
      return (
        offers.length === 0 ||
        offers.every((o) => o.accepted === false || new Date(o.expires_at).getTime() < now)
      );
    })
    .map((r: { id: string }) => r.id);

  if (toExpire.length > 0) {
    await admin.from("rides").update({ status: "no_drivers_found" }).in("id", toExpire);
  }

  return new Response(JSON.stringify({ expired: toExpire.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
