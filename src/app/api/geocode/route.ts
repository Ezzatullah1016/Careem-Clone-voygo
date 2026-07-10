import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/infrastructure/supabase/server";
import { routingGateway } from "@/infrastructure/maps/routing.gateway";

/**
 * GET /api/geocode?address=...  → forward geocode
 * GET /api/geocode?lat=..&lng=.. → reverse geocode
 * Server-side proxy so the Maps server key never reaches the browser.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  try {
    if (address) {
      const result = await routingGateway.geocode(address);
      return NextResponse.json({ result });
    }
    if (lat && lng) {
      const formatted = await routingGateway.reverseGeocode({
        lat: Number(lat),
        lng: Number(lng),
      });
      return NextResponse.json({ result: formatted ? { formattedAddress: formatted } : null });
    }
    return NextResponse.json({ error: "address or lat/lng required" }, { status: 400 });
  } catch (err) {
    console.error("geocode failed", err);
    return NextResponse.json({ error: "Geocoding failed" }, { status: 502 });
  }
}
